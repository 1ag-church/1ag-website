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
- [ ] Backend deployment/readback, Netlify publish, live read-only verification

Live baselines: staff v29, worker v26, Twilio v18 saved outside repository in ../care-release. Existing general SMS number awaits carrier approval. Do not enable it automatically. Reminder preferences require the pastor's destination/channel choice.

Validation: 118 core tests and two built staff API contract tests passed. Frontend and all three backend TypeScript checks passed. Desktop care creation/completion and quick-note date review, Settings save/readback, mobile reminder Settings, and volunteer decline/invitation queue were exercised using fictional local data. No real recipients were contacted.
