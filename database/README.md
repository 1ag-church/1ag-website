# Database creation and Data API access

Audited October 20, 2026 against `main` at `0c69cfc`, the shared church Supabase project's catalog and 17 recorded migrations, and all six deployed Edge Function bundles. No production DDL, grants, policies, records, function deployments, or Data API settings were changed by this audit.

Supabase's [October 30 change](https://github.com/orgs/supabase/discussions/45329) removes automatic Data API grants for newly created public tables. Existing tables keep their grants. A reset, preview database, or schema recreation creates new tables, so its SQL must explicitly grant the required operations. [Grants and RLS are separate controls](https://supabase.com/docs/guides/api/securing-your-api): grants admit a role to a table; RLS then limits its rows. `service_role` bypasses RLS but still needs table privileges. Do not copy the announcement's sample anonymous grant onto private tables.

## Current production versus future creation

The catalog showed 17 public tables, all with RLS enabled. Effective privilege checks found no anonymous writes and no anonymous reads on private tables. `anon` has SELECT only on `public.storage`; its public-content policy permits only `1ag_sermons_v1`, `1ag_staff_v1`, and `1ag_settings_v1` where `shared=false`. Other authenticated users do not become website administrators merely by signing in. The staff-access self-read policy and `active AND website_admin` checks remain necessary.

This is evidence about permissions, not an end-to-end availability test or proof that every production integration works. Old default privileges were still present at audit time; a future migration must work without them. No schema-wide default privileges were changed.

| Table(s) | Verified application path / needed role operations | Existing creation or permission SQL | Future creation action |
| --- | --- | --- | --- |
| `storage` | Website browser: `anon` SELECT of the three public content keys; `authenticated` SELECT/INSERT/UPDATE/DELETE gated by website-admin RLS. Upsert needs SELECT/INSERT/UPDATE. No current Edge Function requires service access to this table. | Old README created permissive RLS without explicit grants. Recorded `20260908220841_church_website_permissions` explicitly grants anonymous SELECT and authenticated/service CRUD and restricts rows. | Use [website-setup.sql](website-setup.sql) for a fresh table after the staff-access foundation. It removes old creation-time defaults on this table, grants only the browser operations, and installs the reviewed row restrictions. It does not alter existing production service grants. |
| `pastoral_staff_access` | Browser: authenticated SELECT of its own membership. Edge staff authorization: service SELECT. Membership provisioning is an operator action; clients must never create/update their own permissions. | `20260908213045_shared_project_staff_access` explicitly grants authenticated SELECT and service CRUD; client writes/anonymous access revoked; self-read RLS. | Existing grants cover fresh replay. Preserve the foundation and provision staff through the reviewed private process. Do not grant authenticated writes. |
| `pastoral_workspaces` | Staff/worker/Twilio server clients: service SELECT/UPDATE; private workspace provisioning also needs INSERT. No direct browser access. | `20260908213028_pastoralos_integration_foundation`: explicit service SELECT/INSERT/UPDATE, RLS, client revokes. | Existing grants cover fresh replay. No anonymous/authenticated table grants or client policies. |
| `pastoral_twilio_inbound` | Private receipt RPC reads/inserts: service SELECT/INSERT. | Same foundation: explicit service SELECT/INSERT, RLS, client revokes. | Existing grants cover fresh replay. Preserve receipt isolation and RPC authorization. |
| `pastoral_twilio_status_events` | Twilio status upsert with `ignoreDuplicates`: service SELECT/INSERT. | Same foundation: explicit service SELECT/INSERT, RLS, client revokes. | Existing grants cover fresh replay. No client table access. |
| `pastoral_worker_runtime` | Worker and Sites bridges: service SELECT; worker lease/health and claim RPC: service UPDATE. Runtime rows/secrets are provisioned by `postgres`. | Current effective service privileges are present; RLS enabled, no client policies. **No creation entry in the 17 recorded migrations.** Current claim RPC already restricts EXECUTE to service. | Add [worker-runtime-access.sql](worker-runtime-access.sql) to the private provisioning recipe immediately after creation and before seeding. Its fresh-only companion grants SELECT/UPDATE and service-only claim EXECUTE, without INSERT/DELETE or client access. Runtime table/function creation remains a private recovery prerequisite. |
| `contacts`, `ministry_leaders`, `lifegroup_leaders`, `pipeline_events`, `email_queue`, `activity_log`, `events`, `registrations`, `gifts_responses`, `leader_contact_log`, `email_templates` | Legacy assimilation tables. No direct consumer found in current website/portal or deployed functions; preserve the reviewed legacy contract: authenticated CRUD behind website-admin RLS and service CRUD. No anonymous access. | March creation migrations omit grants and originally use permissive policies. Final `20260908220841_church_website_permissions` explicitly grants CRUD and replaces them with staff-only policies. | Complete the reviewed sequence, including the final permission cutover, before making a restored environment available. Do not add grants to the old permissive policies or treat a partial replay as safe. Revalidate any external legacy consumers before changing their contract. |

All inspected public table identifiers use UUIDs or text, not serial/identity sequences. These additions need no sequence grants. A future serial-based table must grant only the necessary sequence privileges to its inserting roles. Supabase Storage buckets use `storage.objects`, a different schema; the October 30 public-schema change does not change those permissions. Staff photo uploads and private greetings still require their separate reviewed bucket policies/configuration.

## Fresh setup and recovery

These files are provisioning SQL and documentation, **not an automatically discovered Supabase migration directory**. There is no complete `supabase/migrations` chain or reset configuration in this repository. Do not run a reset against production.

For a new website table in an environment with the reviewed shared-project staff-access foundation already installed:

1. Confirm the foundation's `pastoral_staff_access` has RLS, authenticated self-read, no anonymous grants and no client writes. Provision a real Auth user and explicit active website-admin membership through the existing private process. No user/account is seeded by these files.
2. Run the complete [website-setup.sql](website-setup.sql) as `postgres`. Creation, grants and policies commit together. It refuses an existing `public.storage` rather than replacing production security. It supplies no new `service_role` storage grant because no inspected runtime requires one.
3. Configure the `staff-photos` bucket and its authorized staff upload policy through the reviewed storage setup. Use a publishable/legacy anon key in `VITE_SUPABASE_ANON_KEY`; keep secret/service keys on the server.
4. Run [verify-access.sql](verify-access.sql), then validate public reads, nonstaff denial and authorized admin saves in an isolated preview with synthetic records.

For a full reset, preview environment, or recovery:

1. Recover the complete **private** schema/provisioning source and backups. Do not publish backend source, actual workspace data, staff UUIDs, runtime token hashes, Vault secret IDs, or credentials into this public repository.
2. Reconcile the March legacy creation migrations with the September permission cutover before exposure. The final cutover explicitly grants every legacy table; do not omit it. It has policy-drift and provisioned-admin guards and is not designed for arbitrary reruns. Do not combine its old permissive-storage expectations with the new secure storage script without adapting the private replay plan.
3. Preserve the foundation's explicit per-table grants and service-only `pastoral_receive_sms` EXECUTE. They already support the new default.
4. Recover and review the missing worker-runtime table and `pastoral_claim_worker(text,text,uuid)` creation recipe. Append the runtime companion's permission block inside that creation transaction, or run the standalone companion in the still-private environment **before seeding**. The companion intentionally rejects populated tables, missing objects, disabled RLS, unexpected policies, and a SECURITY DEFINER claim function. It does not create runtime tables, scheduler jobs, secrets, or RPC implementations.
5. Check Data API settings: the API must be enabled and the required schema exposed. Check HTTP PostgREST calls using a publishable key, a nonstaff session, an authorized staff session, and a server secret in the preview. Do not send real SMS/email or trigger delivery jobs as a grant test.

Each future table-creation migration must declare its access model in the same transaction: schema-qualified table; RLS; authorized row policies for client access; explicit per-table grants; explicit RPC/sequence permissions where needed. Never use `GRANT ALL ON ALL TABLES`, restore broad schema defaults, or add a `USING (true)` write policy to resolve a permission error. Use the Supabase CLI's `supabase migration new <name>` when adding an actual versioned migration to the private source.

## Validation and remaining verification

Run the isolated SQL tests with Node 20+:

```bash
npm ci --prefix database --no-audit --no-fund
npm test --prefix database
```

The tests use in-memory PostgreSQL via PGlite, synthetic data, and a minimal staff/runtime fixture. They exercise both absent default grants and older broad defaults, allowed content reads, denied private/shared reads and anonymous writes, staff self-read, nonstaff/inactive denial, admin upsert/update/delete, and service-only runtime SELECT/UPDATE/RPC. They verify fresh-only guards. They do not replace a full Supabase reset or HTTP Data API integration test.

Remaining: recover the complete private creation chain (especially worker runtime), reconcile historical storage creation with the secured setup, confirm Dashboard Data API settings, and run the real preview/reset plus HTTP checks. SQL catalog access did not expose the Dashboard API/schema configuration. No complete recreation was claimed or attempted against production.

Repository scope: the other accessible church repository, `1ag-church/attendance-tracker`, uses Firebase/Firestore and contains no Supabase migrations. The open separate-text-line draft PR was also checked and adds no table creation or grant changes. The historical private backend archives available in the workspace contain an older application/SQLite build, not the missing Supabase provisioning chain.

The security advisor's four “RLS enabled/no policy” notices correspond to intentionally service-only private tables. Separate existing advisor findings concern two mutable trigger search paths and disabled leaked-password protection; this change adds a fixed search path to its fresh trigger but does not modify those production settings/functions.
