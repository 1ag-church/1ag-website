# Visual communications and explicit assimilation

Adding a contact now defaults to `assimilation:false`, stage `Contact`. Only explicit enrollment, an assimilation CSV import, or a guest connection card starts the guest journey. Existing legacy journeys remain compatible; the three prayer-only production contacts are corrected separately, preserving prayer permissions and declined requests.

People exposes the existing stable recipient-group IDs as shared tags. Creating a tag makes it available immediately in Communications. Tag membership and channel permissions remain separate. `contactPermissions` records permission for individually addressed general communications; adding a person or tag never grants it automatically.

Communications has Email, Text messages, and Broadcast queue views. The email editor supports eight block types, reorder/duplicate/delete, image upload or HTTPS URLs, colors, font, spacing, reusable templates, and desktop/mobile preview. SMS supports a person or tag audience. `broadcast.send` saves the exact draft and approves its reviewed audience in one version-checked action. Drafts do not send. Central wall-clock scheduling handles DST and rejects invalid dates. Existing delivery pause, sending-hour, opt-out, and uncertain-result protections still apply.

## Backend release

Start from a fresh retrieval of each deployed function; preserve its other files and authentication. Do not combine the independent staff, worker, and webhook bundles.

For both `pastoralos-staff` and `pastoralos-worker`, replace these dependencies from `pastoralos/lib/pastoral/`:

- `model.ts`, `people-csv.ts`, `communications.ts`, `broadcast-worker.ts`
- Add `email-design.ts`

For staff only, add `email-image.ts` and apply `visual-editor-staff.patch` (against staff version 15). It adds an authenticated image upload endpoint. The existing Netlify API wildcard forwards it without redirect changes. No webhook change is needed: incoming SMS does not create contacts or enroll guests.

Provision a public image bucket `pastoral-email-images`, limited to JPG/PNG and 3 MiB per file. Uploads run through the existing owner-authenticated staff endpoint and service-side storage client. No public write policy is added. Only email artwork belongs in this bucket; contact records remain in the private workspace. Do not upload test assets to production as part of deployment.

Deploy both functions with their existing custom authentication and verify source readback. Recheck worker runtime health. Correct the three previously identified prayer-only contacts to `assimilation:false` and `stage:'Contact'` using a version-checked update. Keep their prayer preferences, contact context, and other records unchanged; confirm there are no guest drafts to release.

## Amazon SES

Sending remains disabled until the previously documented SES account setup is complete. The editor, templates, image uploads, and draft schedule preparation work independently. SES receives server-rendered HTML plus a plain-text alternative and managed unsubscribe footer. The approved design participates in a canonical fingerprint so JSONB key reordering does not invalidate unchanged approvals. No real messages are sent during development verification.

## Verification

- Frontend typecheck, production builds, and 50 unit tests.
- Backend entrypoint typecheck and 13 integration tests, including authorization, version checks, image validation, and existing prayer approval and summary behavior.
- Local browser: shared tag creation, content edits, duplication/deletion, template save, mobile preview, draft save/reopen, individual SMS scheduling, and phone-width layout. All contacts and sends in this fixture are fictional; no provider is contacted.
- Production check: Netlify published commit and assets, protected endpoint responses, deployed function readback, contact classification, and worker health. Live email delivery requires AWS setup and is not claimed as tested.

## Two-image layout follow-up

The `Two images` block stores exactly two independently editable HTTPS image sources, descriptions, and optional destination links. It renders an email-compatible table with equal-width columns and stacks at mobile width. The upload handler retains the originally selected block ID and image slot across asynchronous completion. Existing designs remain unchanged by validation, so prior approval fingerprints remain compatible.

Replace only `lib/pastoral/email-design.ts` in fresh staff and worker bundles for this follow-up. No database, storage, webhook, or SES credential changes are required. Validation: 52 shared/frontend tests, frontend/backend typechecks, production build, and local browser checks for desktop column positions, mobile stacking, and saving the image-pair draft. No real email was sent.
