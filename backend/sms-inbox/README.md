# SMS conversations release

The SMS view combines received Twilio messages and recorded outbound deliveries by the actual phone number used. Staff notes and email messages are excluded. Read/Done markers are tied to the inbound message the staff member saw; a later reply reopens a conversation. Unknown and shared numbers remain visible but cannot be replied to without identifying the contact and its texting permission.

Communications sends and schedules in one action. The server retains its exact-content/audience snapshot and opt-out checks; the stored legacy `approval` field is a dispatch integrity record, not a second approval workflow. `broadcast.queue` replaces the user-facing approval action while the old action remains compatible. Prayer review and declined requests are unchanged.

General SMS requires a distinct `PASTORALOS_GENERAL_SMS_NUMBER` and `PASTORALOS_GENERAL_SMS_ENABLED=true`. Do not enable before the number is owned, correctly routed and approved for messaging by Twilio. There is no fallback to the prayer number. SES and the prayer worker keep their existing connections. Incoming texts on the general number never enter the AI prayer intake or pastor command handler, regardless of their wording. STOP still suppresses the number across all programs.

Fetch fresh exports of staff, worker and Twilio into `<release>/<slug>/baseline.json`, then run `python3 backend/sms-inbox/prepare.py <release>`. Inspect the listed changes, test the prepared bundles, and deploy their `deploy.json` payloads retaining existing authentication. Read back every deployed file before publishing the matching frontend. The routing tests run from `<release>/pastoralos-twilio/tests` with the existing backend test dependencies available.

No existing draft is automatically released, no failed delivery is retried, and no contact permission is changed by this release. Sent in the conversation view means accepted by the provider unless an existing delivery record specifically confirms delivery. Group texts are separate individual messages, not group-chat threads.
