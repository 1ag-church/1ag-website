# Separate prayer and general texting lines

These files are deployment overlays for the existing `pastoralos-twilio` Supabase function. Its remaining dependencies come from the current deployed bundle; export and preserve that bundle before deployment. The validated baseline on September 23 was webhook v12, staff v20 and worker v17.

## Configuration

- The existing `twilioAccount.phone` remains the prayer line.
- `PASTORALOS_GENERAL_SMS_NUMBER` is the additional, church-owned E.164 number. Its inbound SMS webhook uses the same existing `/pastoralos-twilio/inbound` endpoint.
- `PASTORALOS_GENERAL_SMS_ENABLED` must stay false until Twilio approves the second number for messaging. The shared `readBroadcastConfig` uses it for general broadcasts; prayer-worker sending keeps its existing sender.
- Until a general number is configured, existing behavior stays available. Once configured, an unverified or invalid general sender cannot fall back to the prayer number.

Webhook routing happens after signature, account and destination validation. Only the prayer destination invokes prayer ingestion or pastor approval commands. General texts, including prayer wording, remain conversations. Unknown/shared senders appear privately without associating them with an assumed identity. STOP remains a conservative church-wide SMS suppression.

## Deployment sequence

1. Complete Twilio's primary compliance profile, purchase the new number, and prepare its messaging verification.
2. Deploy the webhook overlay with its unchanged dependencies; add the optional inbox `to` and `line` fields from `pastoralos/lib/pastoral/model.ts`.
3. Deploy the shared `broadcast-worker.ts`, `communications.ts`, and model changes to the staff and worker functions while preserving all other live files.
4. Publish the frontend. Configure the general-number secret and inbound webhook, keeping sending disabled while verification is pending.
5. Read back Twilio verification and webhook settings before enabling. Test inbound routing and a specifically authorized outbound text.

## Validation

The routing test runs in the exported bundle using the installed Twilio SDK. It covers both destinations, pastor commands on the general line, unknown/shared senders, STOP, signatures, unknown destinations, concurrency/replays and status callbacks. The portal suite includes sender selection and the verification gate. The Conversations reply flow was exercised in a local browser using fictional contacts. No live texts were sent during development.
