# Assimilation categories

The People board, person step selector, and journey report use the configured follow-up rules. New assignments store `step:<rule-id>` in the existing `Person.stage` field; changing a title does not change identity or reset the schedule anchor. A new enrollment uses the first configured rule. Without any rules it waits for staff to assign a step.

Legacy fixed stages resolve only when exactly one configured rule uses that stage. Unmapped or ambiguous people appear in Choose a step and cannot generate rule follow-ups until assigned. Completed people retain their completion status. Non-assimilating and archived contacts do not appear. Deleting a step preserves the person and attempted delivery history, cancels waiting work, and exposes the person for reassignment. Event registration retains explicit step assignments; Starting Point attendance still completes assimilation.

Deploy the updated `pastoralos/lib/pastoral/model.ts` as `lib/pastoral/model.ts` into fresh exports of pastoralos-staff, pastoralos-worker, and pastoralos-twilio. Verify baseline model parity before overlaying, preserve all other files and custom authentication, and read back each deployed bundle. There is no database migration or production contact write. Publish the frontend through the existing Git-connected Netlify site.

Validation: 106 model/workflow tests, frontend and all three function bundle TypeScript checks, complete production build, and local browser checks of step renaming, matching categories, and assigning a person. Browser checks use a mock store and fictional contacts; no real messages are sent.
