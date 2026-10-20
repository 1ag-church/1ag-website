-- Read-only catalog audit. Does not select application records or alter grants.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS anon_write_or_ddl,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') AS authenticated_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') AS authenticated_delete,
       has_table_privilege('service_role', c.oid, 'SELECT') AS service_select,
       has_table_privilege('service_role', c.oid, 'UPDATE') AS service_update
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT pg_get_userbyid(defaclrole) AS creator,
       defaclnamespace::regnamespace AS schema_name, defaclobjtype, defaclacl
FROM pg_default_acl WHERE defaclnamespace = 'public'::regnamespace;
