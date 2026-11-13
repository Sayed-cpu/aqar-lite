-- The application connects as aqar_app: not the owner of any table, so
-- row-level security applies to it, and it holds only the privileges below.
-- docker/postgres/init creates it with LOGIN and a password; this block only
-- makes the migration self-sufficient where that script did not run (tests).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aqar_app') THEN
    CREATE ROLE aqar_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO aqar_app;
--> statement-breakpoint
-- Auth tables. Login happens before any company is known, so these carry no
-- row-level security; only src/server/auth reads them.
GRANT SELECT ON companies, users TO aqar_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO aqar_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON login_attempts TO aqar_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE login_attempts_id_seq TO aqar_app;
--> statement-breakpoint
-- No UPDATE, no DELETE: the app cannot rewrite history even if it wanted to.
GRANT SELECT, INSERT ON audit_logs TO aqar_app;
--> statement-breakpoint
-- The tenant of the current transaction, set by withTenant() through
-- set_config('app.company_id', ..., true). NULL when nothing was set.
CREATE FUNCTION app_current_company_id() RETURNS uuid
  LANGUAGE sql
  STABLE
  AS $$ SELECT nullif(current_setting('app.company_id', true), '')::uuid $$;
--> statement-breakpoint
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Read: only the current company's rows; NULL-company rows are visible to no
-- one. Write: the current company, or NULL for a failed login on an email
-- that matches no user (no tenant exists at that point).
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  USING (company_id = app_current_company_id())
  WITH CHECK (company_id IS NULL OR company_id = app_current_company_id());
--> statement-breakpoint
-- Append-only for every role, the owner included.
CREATE FUNCTION audit_logs_reject_change() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_change();
