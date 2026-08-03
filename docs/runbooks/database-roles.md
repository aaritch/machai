# Runbook — Database roles and the append-only audit log

The application enforces "append-only" for `audit_log` by convention: nothing in
the codebase updates or deletes from it. Convention is not a control. Enforce it
in Postgres.

## Roles

Create two roles. The application uses the restricted one.

```sql
-- Owner: runs migrations. Not used by the running application.
CREATE ROLE machai_owner LOGIN PASSWORD '...';

-- Application: what DATABASE_URL points at.
CREATE ROLE machai_app LOGIN PASSWORD '...';

GRANT CONNECT ON DATABASE machai TO machai_app;
GRANT USAGE ON SCHEMA public TO machai_app;

-- Normal tables: full DML, no DDL.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO machai_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO machai_app;

-- audit_log: INSERT and SELECT only. This is the enforcement.
REVOKE UPDATE, DELETE ON audit_log FROM machai_app;

-- Future tables created by migrations inherit the same grants.
ALTER DEFAULT PRIVILEGES FOR ROLE machai_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO machai_app;
ALTER DEFAULT PRIVILEGES FOR ROLE machai_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO machai_app;
```

Run migrations as `machai_owner` (`DATABASE_URL_UNPOOLED`), and the application
as `machai_app` (`DATABASE_URL`).

## Verifying

```sql
-- Should return no rows for update/delete on audit_log.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'audit_log'
  AND grantee = 'machai_app'
  AND privilege_type IN ('UPDATE', 'DELETE');
```

A quick functional check, as `machai_app`:

```sql
DELETE FROM audit_log WHERE false;  -- must raise: permission denied
```

## Retention

Audit entries are retained per Legal's schedule and may outlive the account they
reference — `audit_log.actor_id` is `ON DELETE SET NULL` for exactly that reason,
so purging a user does not destroy the record that an action occurred.

Reconcile any deletion request against retention obligations explicitly. TASK-08
flags this tension; it is resolved by policy, not by code.
