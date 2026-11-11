-- Who is acting in the current transaction, set by withTenant() alongside the
-- company. NULL when nothing was set (login, migrations, the owner).
CREATE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE sql
  STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE FUNCTION app_current_role() RETURNS text
  LANGUAGE sql
  STABLE
  AS $$ SELECT nullif(current_setting('app.role', true), '') $$;
--> statement-breakpoint
-- Insert and read; UPDATE only on the columns a business action may change.
-- No DELETE: nothing in the system removes a unit or a client. company_id,
-- owner_user_id and id are not updatable by the app at all.
GRANT SELECT, INSERT ON units, clients TO aqar_app;
--> statement-breakpoint
GRANT UPDATE (project, number, type, area_sqm, rooms, price_halalas, status) ON units TO aqar_app;
--> statement-breakpoint
GRANT UPDATE (name, phone, notes) ON clients TO aqar_app;
--> statement-breakpoint
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY units_tenant_isolation ON units
  USING (company_id = app_current_company_id())
  WITH CHECK (company_id = app_current_company_id());
--> statement-breakpoint
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- The company, and inside it ownership: a sales rep sees and writes only the
-- clients they own; a manager or accountant sees the company's. With no role
-- set, nothing is visible — the default is no access, not full access.
CREATE POLICY clients_tenant_and_owner ON clients
  USING (
    company_id = app_current_company_id()
    AND (
      app_current_role() IN ('manager', 'accountant')
      OR (app_current_role() = 'sales_rep' AND owner_user_id = app_current_user_id())
    )
  )
  WITH CHECK (
    company_id = app_current_company_id()
    AND (
      app_current_role() IN ('manager', 'accountant')
      OR (app_current_role() = 'sales_rep' AND owner_user_id = app_current_user_id())
    )
  );
--> statement-breakpoint
CREATE FUNCTION touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER units_touch_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER clients_touch_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
-- The brief's unit lifecycle, held by the database for every role, the owner
-- included: a new unit is available; status moves only
--   available → reserved   (a reservation)
--   reserved  → available  (the reservation expired)
--   reserved  → sold       (the contract was approved)
-- and the price changes only while the unit is available.
CREATE FUNCTION units_enforce_lifecycle() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'available' THEN
      RAISE EXCEPTION 'a new unit must be available, not %', NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'available' AND NEW.status = 'reserved')
    OR (OLD.status = 'reserved' AND NEW.status IN ('available', 'sold'))
  ) THEN
    RAISE EXCEPTION 'unit status cannot move from % to %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.price_halalas IS DISTINCT FROM OLD.price_halalas AND OLD.status <> 'available' THEN
    RAISE EXCEPTION 'the price of a % unit cannot change', OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER units_enforce_lifecycle
  BEFORE INSERT OR UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION units_enforce_lifecycle();
