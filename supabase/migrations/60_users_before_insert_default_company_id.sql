/* Default public.users.company_id on INSERT when omitted (same as other tenant tables).
   Edge Functions using service role must still pass company_id explicitly; authenticated
   clients that omit it get the value from get_my_company_id() via tenant_default_company_id(). */

BEGIN;

DROP TRIGGER IF EXISTS trg_users_default_company ON public.users;
CREATE TRIGGER trg_users_default_company
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.tenant_default_company_id();

COMMIT;
