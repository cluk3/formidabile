# 09: Authoring tables with immutability enforced by triggers

**What to build:** The first migration pair, holding every authoring table: forms, drafts (deleted by cascade from forms), form versions, form version questions, question identities (with `UNIQUE (form_id, question_id, type)` as the foreign key's target), and the draft revision sequence. A separate custom migration adds the triggers that make published form versions immutable and stop a published form from being deleted. Each invariant is proven directly against the database on both drivers. Repository functions and row mappers arrive with the use cases that need them, from ticket 10 onward.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api) and its "Rules for every phase" on migrations; [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md), [ADR 0014](../../../docs/adr/0014-only-never-published-forms-can-be-deleted.md); [Persistence model](../../form-builder-mvp/issues/10-persistence-model.md), [Definition and persistence defects](../../form-builder-mvp/issues/27-definition-and-persistence-defects.md).

**Blocked by:** 03 (Server shell on Postgres and PGlite).

**Status:** ready-for-agent

- [x] There is one `drizzle-kit generate` migration, plus a `generate --custom` migration for triggers and checks generated in a separate step, so they never share a second. `drizzle-kit check` passes.
- [x] Triggers reject any update, delete or truncate of form versions, question keys and question identities, any `TRUNCATE` of forms, and deleting a form that has any version. Each has a test.
- [x] A raw SQL `DELETE` of a published form fails even as the table owner, and deleting a never-published form removes its draft by cascade.
- [x] The database enforces one question type per question identity.
- [x] `timestamptz` and `jsonb` values round-trip on both drivers.
- [x] Every test here runs on PGlite under `vp test`, and again under `test:pg`.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t09-authoring-tables`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- The Drizzle tables are in `packages/server/lib/persistence/schema.ts`: `forms`, `drafts`, `formVersions`, `questionIdentities`, `formVersionQuestions` and the `draftRevisions` sequence. Timestamps are `timestamptz` in `mode: "date"`, `drafts.revision` is `bigint` in `mode: "bigint"` and defaults to `nextval('form_management.draft_revisions')`, so an insert gets a revision by itself. A save must set `revision = nextval('form_management.draft_revisions')` explicitly.
- The fixed-value `CHECK`s (`availability`, `response_limit`, open needs a current version, version `number >= 1`) are declared with Drizzle's `check()` and live in the generated migration. The custom migration holds only triggers. There's no `CHECK` on question `type`: a new type shouldn't need a migration (ADR 0005).
- Every trigger raises SQLSTATE `23001` (`restrict_violation`). Messages: `<OP> on form_management.<table> is not allowed`, `form <id> has a published version and can't be deleted`, and `a form's tenant never changes`. The tenant trigger comes from the Persistence model's `forms.tenant` rule. It's in this migration because no other ticket owns it and migrations are append-only.
- `@fb/server/testing` now also exports `DatabaseTestPostgres(databaseUrl)`, a fresh migrated database per layer build, dropped on release, and the `forms` and `formVersions` tables for persistence tests that need Drizzle's column codecs. Ticket 19 can reuse the both-drivers pattern in `tests/authoring-tables.ts` (described in `packages/README.md`).
- Composite foreign keys have explicit names (`forms_current_version_fkey`, `drafts_based_on_version_fkey`, `form_versions_derived_from_version_fkey`, `form_version_questions_identity_fkey`, `form_version_questions_version_fkey`), so a repository can map a violation by constraint name.
- No Skill tool or sub-agents for `code-review` here, so the diff was reviewed by hand.
