# People directory and communications deployment

Frontend: normal Git/Netlify build. `standalone/workspace-preview.html` is a local-only test harness with fictional in-memory data; Vite's production entry is only `standalone/index.html` and does not publish this harness.

## Backend

The hosted Supabase functions have separate deployment histories. Retrieve current bundles before changing either one. The accompanying `staff-communications.patch` and `worker-communications.patch` describe the exact integration changes against staff version 14 and worker version 11 respectively. Do not apply them blindly to a later version. Preserve each function's existing dependencies, especially its `prayer-flow.ts`; those files differ between these two functions.

Add the repository's `lib/pastoral/communications.ts` and `lib/pastoral/broadcast-worker.ts` to both function bundles at the same relative paths. Apply the matching integration patch and deploy the staff API before the worker. Keep the existing custom authentication and JWT settings. No database schema change is necessary: optional `directoryGroups`, `broadcasts`, and person group/tag/preference fields are added to the existing versioned workspace document. Old records retain existing prayer and guest permissions; no bulk permission grants or data migration are performed.

The worker uses the existing cron/lease. Broadcast submission is independent from the prayer outbox. A recipient is durably claimed, rechecked, and submitted once. Ambiguous provider responses remain uncertain for manual review; no automatic resend. Queue status `Sent` means provider acceptance, not delivery/read confirmation. The UI surfaces per-recipient results. Pause, send hours, permission withdrawal, SMS opt-outs, sample contact exclusions, and exact approved audience/body checks remain in effect. An approved scheduled broadcast can be cancelled; pending recipients are skipped. Already-submitted messages cannot be recalled.

## Amazon SES activation (still required)

The church has not created an AWS account yet. Email drafts work, but approval/sending is disabled until SES is connected. Sender and reply address are both `info@1ag.tv`.

After account creation:

1. Verify the church's sending domain/address in the chosen SES region and obtain production sending access appropriate to church broadcasts.
2. Create an SES contact list for church communications. The sender uses `ListManagementOptions` and the managed `{{amazonSESUnsubscribeUrl}}` footer; SES enforces unsubscribes on this list. Do not replace the list later without preserving opt-outs.
3. Configure account-level bounce/complaint suppression. Record the church's actual postal address for the footer.
4. Store limited sending credentials and configuration as Supabase secrets, never frontend/Netlify public variables:
   - `PASTORALOS_SES_REGION`
   - `PASTORALOS_SES_ACCESS_KEY_ID`
   - `PASTORALOS_SES_SECRET_ACCESS_KEY`
   - optional `PASTORALOS_SES_SESSION_TOKEN`
   - `PASTORALOS_SES_CONTACT_LIST`
   - `PASTORALOS_EMAIL_POSTAL_ADDRESS`
5. Only after readiness verification, set `PASTORALOS_SES_ENABLED=true`. The same server configuration is read by the staff API and worker. Check the authenticated delivery-connection endpoint and perform an explicitly authorized test email before announcing email delivery as live.

The current composer supports text email content; it does not yet include the earlier proposed drag-and-drop newsletter designer or recurring broadcasts.

Reference: https://docs.aws.amazon.com/ses/latest/dg/sending-email-subscription-management.html
