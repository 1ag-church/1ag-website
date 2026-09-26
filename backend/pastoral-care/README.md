# 1AG care and reminders

Run `python3 backend/pastoral-care/prepare.py <export-root>` against fresh exports of staff, worker, and Twilio. Each function folder must have `baseline.json` returned by Supabase's get-edge-function tool. Export and deploy files stay outside this repository. Compare the changed files and preserve custom authentication (`verify_jwt=false` is existing behavior, not anonymous access).

No schema migration: care records, tasks, preferences and durable notification claims use the existing authenticated workspace JSON and version-checked writes. Authenticated health reads expose only completion time and a sanitized job error. Existing worker authentication, global lease, Twilio signature checking, incoming receipt deduplication and prayer approvals remain in place.

Personal delivery starts off. Staff choose channel/time in Settings. Email is bound to the authenticated staff address; SMS uses the configured pastor notification number and requires the existing general-SMS activation flag. Digests contain counts and a private link. Sample/archived contacts are excluded from notifications. STOP, global pause, task revisions and recipient changes are checked before submission. Sending claims persist before provider calls. Unknown outcomes never retry automatically; definitive failures can be retried explicitly while current.

Guest replies from a uniquely identified enrolled person create a hold, with explicit resume. Confirmation replies require the assignment code, current schedule and matching phone; they remain ordinary communications and cannot become prayer requests. Availability and declined responses stop pending serving sends. Invitations use the same permission checks and reports as Communications.

Background jobs run independently in a bounded sequence. A failing prayer job cannot prevent care, serving, communications or guest work. The existing runtime table records completion/errors; Today and Settings show health and personal-delivery issues. No carrier flag is enabled by this release and no congregation messages should be sent as deployment tests.

Validation: core regression tests and TypeScript, the built staff API's authentication/version contracts, local browser workflows, production function readback, Netlify asset readback, and scheduler heartbeat. Provider acceptance is not evidence of recipient reading or guaranteed delivery.
