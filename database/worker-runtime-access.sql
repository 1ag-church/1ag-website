-- Fresh provisioning companion, not a production repair migration.
-- Append these permissions to the private runtime creation transaction, before
-- seeding secrets/runtime rows. This standalone form requires an empty table
-- and the reviewed SECURITY INVOKER worker-claim function to exist already.
BEGIN;
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.pastoral_worker_runtime'::regclass)
     OR EXISTS (SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'pastoral_worker_runtime') THEN
    RAISE EXCEPTION 'Runtime must have RLS enabled and no client policies';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pastoral_worker_runtime) THEN
    RAISE EXCEPTION 'Fresh provisioning only: runtime already contains rows';
  END IF;
  IF (SELECT prosecdef FROM pg_proc
      WHERE oid = 'public.pastoral_claim_worker(text,text,uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'Worker claim must remain SECURITY INVOKER';
  END IF;
END $$;

REVOKE ALL ON TABLE public.pastoral_worker_runtime FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO service_role;
-- Worker checks credentials/lease and updates health. Creation/seeding is done
-- by postgres, not by an application client; INSERT and DELETE are unnecessary.
GRANT SELECT, UPDATE ON TABLE public.pastoral_worker_runtime TO service_role;
REVOKE ALL ON FUNCTION public.pastoral_claim_worker(text,text,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pastoral_claim_worker(text,text,uuid) TO service_role;
COMMIT;
