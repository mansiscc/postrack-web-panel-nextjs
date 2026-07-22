-- =========================================
-- Migration 36: Add current_balance to accounts (denormalized)
-- =========================================
-- Adds `accounts.current_balance` and keeps it correct using triggers.
--
-- current_balance = opening_balance + (SUM(income.amount) - SUM(expense.amount))
-- where is_deleted = false.
--
-- This avoids downloading all rows from `entries` on the client.
-- =========================================

BEGIN;

-- 1) Add column
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18,2) NOT NULL DEFAULT 0;

-- 2) Backfill using existing entries
-- Set current_balance for every account (even if it has zero entries).
UPDATE public.accounts a
SET current_balance = COALESCE(a.opening_balance, 0) + COALESCE(net.net_entries, 0)
FROM (
  SELECT
    a2.id,
    COALESCE(
      SUM(
        CASE
          WHEN e.entry_type = 'income' THEN e.amount
          WHEN e.entry_type = 'expense' THEN -e.amount
          ELSE 0
        END
      ),
      0
    ) AS net_entries
  FROM public.accounts a2
  LEFT JOIN public.entries e
    ON e.account_id = a2.id
   AND e.is_deleted = false
  GROUP BY a2.id
) net
WHERE a.id = net.id;

-- 3) accounts: initialize current_balance on insert
CREATE OR REPLACE FUNCTION public.fn_accounts_set_current_balance_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.current_balance := COALESCE(NEW.opening_balance, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_set_current_balance_before_insert ON public.accounts;
CREATE TRIGGER trg_accounts_set_current_balance_before_insert
BEFORE INSERT ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.fn_accounts_set_current_balance_before_insert();

-- 4) accounts: when opening_balance changes, adjust current_balance by delta
CREATE OR REPLACE FUNCTION public.fn_accounts_opening_balance_adjust_current_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta NUMERIC(18,2);
BEGIN
  v_delta := COALESCE(NEW.opening_balance, 0) - COALESCE(OLD.opening_balance, 0);

  IF v_delta <> 0 THEN
    UPDATE public.accounts
    SET current_balance = COALESCE(current_balance, 0) + v_delta
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_opening_balance_adjust_current_balance ON public.accounts;
CREATE TRIGGER trg_accounts_opening_balance_adjust_current_balance
AFTER UPDATE OF opening_balance ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.fn_accounts_opening_balance_adjust_current_balance();

-- 5) entries: keep accounts.current_balance correct on INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.fn_entries_adjust_account_current_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_contrib NUMERIC(18,2) := 0;
  v_new_contrib NUMERIC(18,2) := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_deleted = false THEN
      v_new_contrib :=
        CASE
          WHEN NEW.entry_type = 'income' THEN NEW.amount
          WHEN NEW.entry_type = 'expense' THEN -NEW.amount
          ELSE 0
        END;

      UPDATE public.accounts
      SET current_balance = COALESCE(current_balance, 0) + v_new_contrib
      WHERE id = NEW.account_id;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Old contribution only counts if it was not deleted.
    IF OLD.is_deleted = false THEN
      v_old_contrib :=
        CASE
          WHEN OLD.entry_type = 'income' THEN OLD.amount
          WHEN OLD.entry_type = 'expense' THEN -OLD.amount
          ELSE 0
        END;
    END IF;

    -- New contribution only counts if it is not deleted.
    IF NEW.is_deleted = false THEN
      v_new_contrib :=
        CASE
          WHEN NEW.entry_type = 'income' THEN NEW.amount
          WHEN NEW.entry_type = 'expense' THEN -NEW.amount
          ELSE 0
        END;
    END IF;

    -- If account_id stays the same: adjust by (new - old)
    IF OLD.account_id = NEW.account_id THEN
      IF (v_new_contrib - v_old_contrib) <> 0 THEN
        UPDATE public.accounts
        SET current_balance = COALESCE(current_balance, 0) + (v_new_contrib - v_old_contrib)
        WHERE id = NEW.account_id;
      END IF;
    ELSE
      -- Remove old contribution from old account
      IF v_old_contrib <> 0 THEN
        UPDATE public.accounts
        SET current_balance = COALESCE(current_balance, 0) - v_old_contrib
        WHERE id = OLD.account_id;
      END IF;

      -- Add new contribution to new account
      IF v_new_contrib <> 0 THEN
        UPDATE public.accounts
        SET current_balance = COALESCE(current_balance, 0) + v_new_contrib
        WHERE id = NEW.account_id;
      END IF;
    END IF;

    RETURN NEW;
  ELSE -- DELETE
    -- Hard deletes are rare (app uses soft delete), but handle it anyway.
    IF OLD.is_deleted = false THEN
      v_old_contrib :=
        CASE
          WHEN OLD.entry_type = 'income' THEN OLD.amount
          WHEN OLD.entry_type = 'expense' THEN -OLD.amount
          ELSE 0
        END;

      UPDATE public.accounts
      SET current_balance = COALESCE(current_balance, 0) - v_old_contrib
      WHERE id = OLD.account_id;
    END IF;

    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_entries_adjust_account_current_balance ON public.entries;
CREATE TRIGGER trg_entries_adjust_account_current_balance
AFTER INSERT OR UPDATE OR DELETE ON public.entries
FOR EACH ROW
EXECUTE FUNCTION public.fn_entries_adjust_account_current_balance();

COMMIT;

