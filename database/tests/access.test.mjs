import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const websiteSql = await readFile(new URL('../website-setup.sql', import.meta.url), 'utf8');
const runtimeSql = await readFile(new URL('../worker-runtime-access.sql', import.meta.url), 'utf8');
const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  nonstaff: '00000000-0000-4000-8000-000000000002',
  inactive: '00000000-0000-4000-8000-000000000003',
};

// Minimal synthetic fixtures, not a backup or complete Supabase schema.
async function fixture(legacyDefaults) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE public.pastoral_staff_access (
      user_id uuid PRIMARY KEY, website_admin boolean NOT NULL DEFAULT false,
      active boolean NOT NULL DEFAULT true
    );
    ALTER TABLE public.pastoral_staff_access ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.pastoral_staff_access TO authenticated, service_role;
    CREATE POLICY pastoral_staff_read_self ON public.pastoral_staff_access
      FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
    INSERT INTO public.pastoral_staff_access VALUES
      ('${ids.admin}', true, true), ('${ids.nonstaff}', false, true), ('${ids.inactive}', true, false);
    ${legacyDefaults ? `
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT ALL ON TABLES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
    ` : ''}
  `);
  return db;
}

async function roleQuery(db, role, sql, user = '') {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
  await db.exec(`SET ROLE ${role}`);
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user]);
    return await db.query(sql);
  } finally {
    await db.exec('RESET ROLE');
  }
}

async function denied(promise) {
  await assert.rejects(promise, e => e.code === '42501');
}

for (const legacyDefaults of [false, true]) {
  const mode = legacyDefaults ? 'legacy automatic grants' : 'no automatic grants';
  test(`website creation and row authorization with ${mode}`, async () => {
    const db = await fixture(legacyDefaults);
    try {
      await db.exec(websiteSql);
      await db.exec(`INSERT INTO public.storage(key,value,shared) VALUES
        ('1ag_sermons_v1','public-sermons',false),
        ('1ag_staff_v1','public-staff',false),
        ('1ag_settings_v1','public-settings',false),
        ('private-contact-data','private-sentinel',false),
        ('1ag_sermons_v1','shared-sentinel',true);`);

      for (const role of ['anon', 'authenticated']) {
        const rows = await roleQuery(db, role, 'SELECT value FROM public.storage ORDER BY value', ids.nonstaff);
        assert.deepEqual(rows.rows.map(x => x.value), ['public-sermons', 'public-settings', 'public-staff']);
      }
      await denied(roleQuery(db, 'anon', "INSERT INTO public.storage(key,value) VALUES('injected','bad')"));
      await denied(roleQuery(db, 'anon', "UPDATE public.storage SET value='bad' WHERE key='1ag_sermons_v1'"));
      await denied(roleQuery(db, 'anon', "DELETE FROM public.storage WHERE key='1ag_staff_v1'"));
      await denied(roleQuery(db, 'anon', 'SELECT * FROM public.pastoral_staff_access'));

      for (const user of [ids.nonstaff, ids.inactive]) {
        await denied(roleQuery(db, 'authenticated', "INSERT INTO public.storage(key,value) VALUES('injected','bad')", user));
        assert.equal((await roleQuery(db, 'authenticated', "UPDATE public.storage SET value='bad' WHERE key='1ag_sermons_v1' RETURNING id", user)).rows.length, 0);
        assert.equal((await roleQuery(db, 'authenticated', "DELETE FROM public.storage WHERE key='1ag_staff_v1' RETURNING id", user)).rows.length, 0);
        await denied(roleQuery(db, 'authenticated', 'UPDATE public.pastoral_staff_access SET website_admin=true', user));
        const own = await roleQuery(db, 'authenticated', 'SELECT user_id FROM public.pastoral_staff_access', user);
        assert.deepEqual(own.rows.map(x => x.user_id), [user]);
      }

      const saved = await roleQuery(db, 'authenticated', `
        INSERT INTO public.storage(key,value,shared) VALUES('1ag_sermons_v1','admin-save',false)
        ON CONFLICT(key,shared) DO UPDATE SET value=EXCLUDED.value RETURNING value`, ids.admin);
      assert.equal(saved.rows[0].value, 'admin-save');
      assert.equal((await roleQuery(db, 'authenticated', "SELECT value FROM public.storage WHERE key='private-contact-data'", ids.admin)).rows[0].value, 'private-sentinel');
      await roleQuery(db, 'authenticated', "INSERT INTO public.storage(key,value) VALUES('admin-test','synthetic')", ids.admin);
      assert.equal((await roleQuery(db, 'authenticated', "DELETE FROM public.storage WHERE key='admin-test' RETURNING key", ids.admin)).rows.length, 1);
      assert.equal((await roleQuery(db, 'anon', "SELECT value FROM public.storage WHERE key='1ag_sermons_v1'")).rows[0].value, 'admin-save');
      await denied(roleQuery(db, 'service_role', 'SELECT * FROM public.storage'));

      assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.storage'::regclass")).rows[0].relrowsecurity, true);
      assert.equal((await db.query("SELECT has_table_privilege('anon','public.storage','TRUNCATE,REFERENCES,TRIGGER') AS extra")).rows[0].extra, false);
    } finally { await db.close(); }
  });

  test(`worker runtime service permissions with ${mode}`, async () => {
    const db = await fixture(legacyDefaults);
    try {
      await db.exec(`
        CREATE TABLE public.pastoral_worker_runtime(owner_id text PRIMARY KEY, last_phase text);
        ALTER TABLE public.pastoral_worker_runtime ENABLE ROW LEVEL SECURITY;
        CREATE FUNCTION public.pastoral_claim_worker(text,text,uuid) RETURNS boolean
          LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT true $$;
      `);
      await db.exec(runtimeSql);
      await db.exec("INSERT INTO public.pastoral_worker_runtime VALUES ('synthetic-owner','ready')");
      for (const role of ['anon', 'authenticated']) {
        await denied(roleQuery(db, role, 'SELECT * FROM public.pastoral_worker_runtime', ids.admin));
        await denied(roleQuery(db, role, "UPDATE public.pastoral_worker_runtime SET last_phase='bad'", ids.admin));
        await denied(roleQuery(db, role, "SELECT public.pastoral_claim_worker('x','x','00000000-0000-4000-8000-000000000000')", ids.admin));
      }
      assert.equal((await roleQuery(db, 'service_role', 'SELECT last_phase FROM public.pastoral_worker_runtime')).rows[0].last_phase, 'ready');
      assert.equal((await roleQuery(db, 'service_role', "UPDATE public.pastoral_worker_runtime SET last_phase='complete' WHERE owner_id='synthetic-owner' RETURNING last_phase")).rows[0].last_phase, 'complete');
      await denied(roleQuery(db, 'service_role', "INSERT INTO public.pastoral_worker_runtime VALUES ('other-owner','ready')"));
      await denied(roleQuery(db, 'service_role', "DELETE FROM public.pastoral_worker_runtime WHERE owner_id='synthetic-owner'"));
      assert.equal((await roleQuery(db, 'service_role', "SELECT public.pastoral_claim_worker('x','x','00000000-0000-4000-8000-000000000000') AS ok")).rows[0].ok, true);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE tablename='pastoral_worker_runtime'")).rows[0].n, 0);
    } finally { await db.close(); }
  });
}

test('website refuses missing or unsafe staff foundation and existing storage', async () => {
  const db = await fixture(false);
  try {
    await db.exec('DROP TABLE public.pastoral_staff_access');
    await assert.rejects(db.exec(websiteSql), /foundation first/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query("SELECT to_regclass('public.storage')::text AS name")).rows[0].name, null);
  } finally { await db.close(); }
  for (const unsafe of ['ALTER TABLE public.pastoral_staff_access DISABLE ROW LEVEL SECURITY', 'GRANT UPDATE ON public.pastoral_staff_access TO authenticated']) {
    const unsafeDb = await fixture(false);
    try {
      await unsafeDb.exec(unsafe);
      await assert.rejects(unsafeDb.exec(websiteSql), /Unexpected staff-access security/);
      await unsafeDb.exec('ROLLBACK');
    } finally { await unsafeDb.close(); }
  }
  const existingDb = await fixture(false);
  try {
    await existingDb.exec(websiteSql);
    await assert.rejects(existingDb.exec(websiteSql), /already exists/);
    await existingDb.exec('ROLLBACK');
  } finally { await existingDb.close(); }
});

test('runtime companion refuses populated table, client policies, disabled RLS, or definer RPC', async () => {
  for (const unsafe of [
    "INSERT INTO public.pastoral_worker_runtime VALUES ('existing')",
    'CREATE POLICY unsafe ON public.pastoral_worker_runtime FOR SELECT TO authenticated USING(true)',
    'ALTER TABLE public.pastoral_worker_runtime DISABLE ROW LEVEL SECURITY',
    'ALTER FUNCTION public.pastoral_claim_worker(text,text,uuid) SECURITY DEFINER',
  ]) {
    const db = await fixture(false);
    try {
      await db.exec(`
        CREATE TABLE public.pastoral_worker_runtime(owner_id text PRIMARY KEY);
        ALTER TABLE public.pastoral_worker_runtime ENABLE ROW LEVEL SECURITY;
        CREATE FUNCTION public.pastoral_claim_worker(text,text,uuid) RETURNS boolean
          LANGUAGE sql SECURITY INVOKER AS $$ SELECT true $$;
      `);
      await db.exec(unsafe);
      await assert.rejects(db.exec(runtimeSql), /Fresh provisioning only|Runtime must have RLS|SECURITY INVOKER/);
      await db.exec('ROLLBACK');
    } finally { await db.close(); }
  }
});
