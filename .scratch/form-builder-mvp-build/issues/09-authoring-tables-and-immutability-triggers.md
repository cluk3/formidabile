# 09: Authoring tables with immutability enforced by triggers

**What to build:** The first migration pair, holding every authoring table: forms, drafts (deleted by cascade from forms), form versions, form version questions, question identities (with `UNIQUE (form_id, question_id, type)` as the foreign key's target), and the draft revision sequence. A separate custom migration adds the triggers that make published form versions immutable and stop a published form from being deleted. Each invariant is proven directly against the database on both drivers. Repository functions and row mappers arrive with the use cases that need them, from ticket 10 onward.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api) and its "Rules for every phase" on migrations; [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md), [ADR 0014](../../../docs/adr/0014-only-never-published-forms-can-be-deleted.md); [Persistence model](../../form-builder-mvp/issues/10-persistence-model.md), [Definition and persistence defects](../../form-builder-mvp/issues/27-definition-and-persistence-defects.md).

**Blocked by:** 03 (Server shell on Postgres and PGlite).

**Status:** ready-for-agent

- [ ] There is one `drizzle-kit generate` migration, plus a `generate --custom` migration for triggers and checks generated in a separate step, so they never share a second. `drizzle-kit check` passes.
- [ ] Triggers reject any update, delete or truncate of form versions, question keys and question identities, any `TRUNCATE` of forms, and deleting a form that has any version. Each has a test.
- [ ] A raw SQL `DELETE` of a published form fails even as the table owner, and deleting a never-published form removes its draft by cascade.
- [ ] The database enforces one question type per question identity.
- [ ] `timestamptz` and `jsonb` values round-trip on both drivers.
- [ ] Every test here runs on PGlite under `vp test`, and again under `test:pg`.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
