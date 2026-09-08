# Staff security preparation

This branch preserves public page markup and changes staff authorization and saving behavior. It does not apply database policies or deploy PastoralOS.

- Staff Login verifies the Supabase user with Auth and checks the user's own `pastoral_staff_access` row for `active` and `website_admin`.
- A valid ordinary account is insufficient for administration. The old compiled default-password/shared-session fallback is removed.
- Settings save only on the staff Save action, and success appears after persistence succeeds. Page loading no longer writes settings.
- Existing public sermons, staff information, and settings reads are unchanged.
- The Supabase client version used for verification is pinned and its dependency lockfile is committed.

The additive `pastoral_staff_access` table and the confirmed pastor's membership have been provisioned in the church Supabase project. Its self-read policy grants no client edits. The existing website policies remain unchanged pending backup and cutover review.

The corresponding SQL policy changes are staged in the PastoralOS source at `supabase/review/20260908212419_church_website_permissions.sql`. They preserve anonymous read access to the three public website content keys, restrict writes to designated staff, hide the legacy shared-session record, and restrict staff-photo uploads. The other existing contact/event/leader consumers need verification before those tables' policies change.

Validation: website production build; PastoralOS's embedded Postgres authorization tests cover public reads, anonymous write denial, non-staff denial, designated staff writes, photo upload permissions, and immediate membership revocation. A real authenticated browser walkthrough and a restorable database backup remain required before the permission cutover. Automatic approval review blocked the data export pending explicit approval of the records and destination. No backup was produced by that attempt.

Do not merge automatically. Coordinate with the existing Staff Login → PastoralOS link PR so its button is preserved. This branch does not supersede or merge that PR.
