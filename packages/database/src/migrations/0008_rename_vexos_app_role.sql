-- Custom SQL migration file, put your code below! --

-- DL-PROD-005: renames the application runtime role provisioned by
-- 0006_app_role_privilege_separation.sql from vexos_app to nyxor_app,
-- following the product rename away from "vexOS"/"VEX-OS" (trademark
-- conflict with Vexos Corporation, vexos.com). 0006 is left unedited -
-- it's an already-applied migration, and rewriting its history would
-- desync drizzle's checksum tracking for anyone who already ran it.
-- ALTER ROLE ... RENAME preserves the role's existing grants, RLS
-- exemption status, and password - nothing else needs to be re-applied.

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vexos_app')
     AND NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nyxor_app') THEN
    ALTER ROLE vexos_app RENAME TO nyxor_app;
  END IF;
END
$$;
