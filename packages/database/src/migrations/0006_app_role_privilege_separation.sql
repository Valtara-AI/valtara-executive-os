-- Custom SQL migration file, put your code below! --

-- DL-SEC-004: provisions a restricted role for the application's own
-- runtime connection (DATABASE_URL), separate from whatever privileged
-- role actually runs migrations (DATABASE_MIGRATION_URL - see migrate.ts,
-- which also sets this role's password from DB_APP_ROLE_PASSWORD after
-- applying migrations).
--
-- Why this exists: audit_log_entries' immutability (SEC-001 §6) is
-- enforced via ENABLE + FORCE ROW LEVEL SECURITY with no UPDATE/DELETE
-- policy (0001_hitl_enforcement.sql). FORCE makes that apply even to the
-- table owner - but it does NOT apply to a role with the SUPERUSER
-- attribute, which bypasses RLS unconditionally, no exception possible.
-- Both docker-compose.yml's and CI's postgres services create their sole
-- role via POSTGRES_USER, which Docker's official postgres image always
-- bootstraps as a cluster superuser - so an application that connects as
-- that same role (as this one did until now) gets no actual protection
-- from the RLS policy at all. See
-- packages/database/src/__tests__/audit-log-immutability.test.ts's header
-- for how this was discovered (a real CI failure, not a hypothetical).
--
-- vexos_app is deliberately NOT superuser and NOT granted CREATEROLE/
-- CREATEDB - an ordinary login role, so FORCE ROW LEVEL SECURITY actually
-- applies to it.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vexos_app') THEN
    CREATE ROLE vexos_app WITH LOGIN;
  END IF;
END
$$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO vexos_app;
--> statement-breakpoint

-- Broad CRUD on every table that exists today...
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vexos_app;
--> statement-breakpoint

-- ...except audit_log_entries, which only ever gets appended to or read.
-- Belt-and-suspenders alongside the RLS policy itself: even if RLS were
-- ever misconfigured or disabled by accident, this table-level REVOKE
-- independently blocks UPDATE/DELETE for this role.
REVOKE UPDATE, DELETE ON audit_log_entries FROM vexos_app;
--> statement-breakpoint

-- ...and every table a *future* migration creates, automatically - so
-- adding a new table never requires a matching GRANT statement of its own
-- (the alternative - hand-maintaining a grant per migration - is exactly
-- the kind of thing that gets forgotten). FOR ROLE CURRENT_USER captures
-- whichever role actually runs this migration (vexos locally/CI today;
-- production's migration role, whatever it's named, at deploy time) -
-- deliberately not hardcoded, so this stays correct wherever it runs.
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vexos_app;
