# Serving Teams

Serving schedules live in `pastoral_workspaces.state.serving`, alongside the existing People database. Assignments reference existing person IDs; no new contacts table, imports, or copies are created. Existing owner authentication, RLS and optimistic workspace version checks apply.

Staff actions create/edit/cancel/restore services, copy up to 26 weekly schedules, and create/edit/remove ministry areas. Arrival times and dates use America/Chicago, including DST. Copies are independent dates. Permission changes remain exclusively in People.

The existing minute cron prepares due per-person SMS broadcasts and dispatches them using the separate general Communications number. Stable service/area/person/cadence keys deduplicate retries. Saving an area authorizes its automatic reminders; no prayer approval is involved. Eligibility is rechecked before dispatch, including assignment, schedule, SMS consent, STOP suppression, contact changes, global pause and sending hours. Reminders expire at arrival or six hours after their nominal due time. Assignments made after a reminder's due time skip that reminder. Provider attempts are retained and ambiguous responses are never retried automatically. Edited schedules may replace unattempted reminders but never resend an attempted one.

Texts and skips appear in the service's reminder delivery section and in Communications. The app does not turn on the new number before Twilio verification. No contacts or actual schedules are seeded in production.

Deployment: export fresh `pastoralos-staff` and `pastoralos-worker` function bundles into a release directory as `<slug>/baseline.json`, compare their shared communications implementation with the repository, then run `python3 backend/serving-teams/prepare.py <release-directory>`. Deploy each generated `deploy.json` using the Supabase connector. Custom authentication and the existing `verify_jwt` setting are preserved. Publish the frontend through the Git-connected Netlify website.

Validation: `npm test --prefix pastoralos`, TypeScript check, full production build, function bundle type-check, staff endpoint contract tests, and browser flow checks with a local mock store and synthetic contacts. Do not send production reminder tests to volunteers.
