# 1AG pastoral care release

Scope: seven requested additions for the existing owner-only 1AG workspace. No SaaS plans, tenant signup, staff permissions, or new production contacts. Preserve prayer approval and existing declined requests. No live congregation test messages.

- [x] Care records, editable plans, actions, history, snooze and completion
- [x] Personal morning digest and due reminders, durable sending claims
- [x] Today agenda and person history
- [x] Prayer/conversation links, assimilation reply hold, availability
- [x] Quick notes with reviewed follow-up dates
- [x] Volunteer confirmation/decline, conflicts and replacement flow
- [x] Worker isolation, heartbeat and visible failure recovery
- [x] Regression tests, TypeScript, build and local browser flows
- [x] Backend deployment/readback, Netlify publish, live read-only verification

Live baselines: staff v29, worker v26, Twilio v18 saved outside repository in ../care-release. Existing general SMS number awaits carrier approval. Do not enable it automatically. Reminder preferences require the pastor's destination/channel choice.

Validation: 120 core tests and two built staff API contract tests passed. Frontend and all three backend TypeScript checks passed. Desktop care creation/completion and quick-note date review, Settings save/readback, mobile reminder Settings, and volunteer decline/invitation queue were exercised using fictional local data. No real recipients were contacted.

Production release: PR #34 merged; Netlify production deployment 6ab7e2c32cfb2c000816d075 published the merge commit. Staff v30, worker v27 and Twilio v19 read back byte-for-byte. Worker heartbeat completed without errors; unauthenticated health returns 401. Live personal preferences remain off and no test contacts or messages were created. Final recovery patch allows only never-attempted cancelled reminders to resume.
