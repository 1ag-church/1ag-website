-- Fresh website table only. Run as postgres after the reviewed shared-project
-- staff-access foundation. This deliberately fails if public.storage exists;
-- do not run it to change production permissions or replace existing policies.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pastoral_staff_access') IS NULL THEN
    RAISE EXCEPTION 'Install the reviewed shared-project staff-access foundation first';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.pastoral_staff_access'::regclass)
     OR NOT has_table_privilege('authenticated', 'public.pastoral_staff_access', 'SELECT')
     OR has_table_privilege('anon', 'public.pastoral_staff_access', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_table_privilege('authenticated', 'public.pastoral_staff_access', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'Unexpected staff-access security; review the foundation before setup';
  END IF;
END $$;

CREATE TABLE public.storage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX storage_key_shared_idx ON public.storage(key, shared);
ALTER TABLE public.storage ENABLE ROW LEVEL SECURITY;

-- Remove inherited creation-time defaults on THIS table, including older
-- Supabase defaults. Do not restore schema-wide default grants.
REVOKE ALL ON TABLE public.storage FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.storage TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.storage TO authenticated;

-- These are the only records the public website loads. "shared=false" is the
-- existing adapter convention, not an assertion that every false row is public.
CREATE POLICY website_public_content ON public.storage
  FOR SELECT TO anon, authenticated
  USING (key IN ('1ag_sermons_v1', '1ag_staff_v1', '1ag_settings_v1') AND shared = false);

-- Match the reviewed production authorization: a valid login alone is not enough.
CREATE POLICY website_staff_manage ON public.storage
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pastoral_staff_access a
    WHERE a.user_id = (SELECT auth.uid()) AND a.active AND a.website_admin
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pastoral_staff_access a
    WHERE a.user_id = (SELECT auth.uid()) AND a.active AND a.website_admin
  ));

CREATE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER update_storage_updated_at
  BEFORE UPDATE ON public.storage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
