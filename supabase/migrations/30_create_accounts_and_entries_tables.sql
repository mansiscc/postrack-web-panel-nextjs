-- =========================================
-- Accounting Module: accounts & entries
-- =========================================

-- NOTE:
-- - This migration ONLY creates new tables:
--     1) accounts
--     2) entries
-- - It does NOT modify any existing tables.
-- - It assumes:
--     * extension "pgcrypto" or "uuid-ossp" with gen_random_uuid() is available
--     * table "users" with primary key "id" (UUID) already exists
--     * table "accounting_categories" with primary key "id" (UUID) already exists

-- =========================================
-- TABLE: accounts
-- Purpose:
--   Stores financial accounts such as:
--     - Cash in Hand
--     - Bank Account
--     - Online Payments
-- =========================================

CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,
    description TEXT NULL,

    opening_balance NUMERIC(18,2) DEFAULT 0,

    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,

    created_by UUID NULL REFERENCES public.users (id) ON UPDATE CASCADE ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES public.users (id) ON UPDATE CASCADE ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on is_active for quick filtering of active accounts
CREATE INDEX accounts_is_active_idx
    ON public.accounts (is_active);

-- Enforce unique account names
CREATE UNIQUE INDEX accounts_name_unique_idx
    ON public.accounts (name);

-- =========================================
-- TABLE: entries
-- Purpose:
--   Stores all accounting income and expense transactions.
-- =========================================

CREATE TABLE public.entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    entry_type TEXT NOT NULL,
    -- Restrict entry_type to 'income' or 'expense'
    CONSTRAINT entries_entry_type_check
        CHECK (entry_type IN ('income', 'expense')),

    account_id  UUID NOT NULL REFERENCES public.accounts (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES public.accounting_categories (id) ON UPDATE CASCADE ON DELETE RESTRICT,

    amount NUMERIC(18,2) NOT NULL,
    -- Enforce positive amounts
    CONSTRAINT entries_amount_check
        CHECK (amount > 0),

    -- Business transaction date (not necessarily created_at)
    entry_date DATE NOT NULL,

    remarks TEXT NULL,

    source_type TEXT NULL,
    -- Restrict source_type to allowed values when not null
    CONSTRAINT entries_source_type_check
        CHECK (
            source_type IS NULL
            OR source_type IN ('bill', 'bill_return', 'purchase', 'manual')
        ),

    source_id UUID NULL,
    -- source_id refers to original transaction (bill, bill_return, purchase, etc.)

    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    created_by UUID NULL REFERENCES public.users (id) ON UPDATE CASCADE ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- Indexes for entries
-- =========================================

-- Fast lookup by account
CREATE INDEX entries_account_id_idx
    ON public.entries (account_id);

-- Fast lookup by accounting category
CREATE INDEX entries_category_id_idx
    ON public.entries (category_id);

-- Fast lookup and reporting by entry date
CREATE INDEX entries_entry_date_idx
    ON public.entries (entry_date);

-- Fast lookup from external source (bill, purchase, etc.)
CREATE INDEX entries_source_type_source_id_idx
    ON public.entries (source_type, source_id);

-- Prevent duplicate accounting entries for the same source + account
-- Enforces uniqueness of (source_type, source_id, account_id)
CREATE UNIQUE INDEX entries_source_type_source_id_account_id_unique_idx
    ON public.entries (source_type, source_id, account_id);

-- =========================================
-- Seed Default Accounts
-- Purpose:
--   Insert default system accounts.
--   All are marked is_default = TRUE to protect from deletion/modification.
-- =========================================

INSERT INTO public.accounts (name, description, opening_balance, is_default, is_active)
VALUES
    ('Cash in Hand',  'Cash account',        0, TRUE, TRUE),
    ('Bank Account',  'Bank account',        0, FALSE, TRUE),
    ('Online Payments','Online payments',    0, FALSE, TRUE)
ON CONFLICT (name) DO NOTHING;

