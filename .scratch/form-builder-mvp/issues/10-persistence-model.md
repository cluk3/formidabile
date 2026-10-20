# Persistence model

Type: grilling
Status: resolved
Blocked by: 07, 08
Map: [Form builder MVP](../map.md)

## Question

What is the Postgres and Drizzle schema for forms, drafts, form versions, question snapshots, responses, answers and external references, and how does it enforce the ADR 0001 §5 invariants?

Decide:

- Tables and keys, and what is stored as JSONB versus normalised columns (e.g. whether question snapshots are rows or part of a version document).
- How immutability of published versions is enforced (application only, or also at the database level).
- How atomic publication and the current-published-version pointer are implemented.
- Optimistic concurrency for drafts (revision column and conflict behaviour).
- How answers reference question snapshots so historical responses can be rebuilt (ADR §8.1).
- Indexes needed for the MVP analytics (counts by version, choice distributions).
- How responses, which can be edited, are stored next to immutable versions: a revision column, a last-edited time, and enforcement of the response limit (one per respondent per form).
- How the form-level external reference association set and the fixed external references on responses are stored.
- Where identity lands in the schema ([Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md)): an immutable tenant column on forms, and how tenant-scoped queries are kept from leaking across tenants. Also the respondent id (the actor's `sub`, nullable for anonymous respondents) on responses, with the one-per-respondent limit enforced over (form, respondent id), and the publishing actor's subject on form versions.
- How the two deletion operations (one response, or all responses for a respondent id) are carried out alongside the immutability triggers, and how a form version is protected from deletion while any response references it (ADR §9).

Product rules come from [MVP product calls on the ADR open questions](./05-mvp-product-calls-on-the-adr-open-questions.md). The definition, answer shape and envelopes to store come from [Canonical form definition model](./08-canonical-form-definition-model.md): answers arrive as one object keyed by question identity, and the form record has no name column.

## Answer

Recorded as [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md). No glossary changes: every new name here (revision, question key, `limited`) is an implementation detail.

- **Placement**: every table lives in a dedicated `form_management` Postgres schema (Drizzle `pgSchema`), and Drizzle's migrations table lives there too. Phase 0 must check that the Effect migrator accepts a migrations-schema option; that's unverified.
- **Conventions**:
  - Forms, versions and responses get application-generated UUIDv7 ids. Question identities stay builder-minted v4. PGlite reports PostgreSQL 18.6, so both databases behave the same.
  - Timestamps are `timestamptz`, set from Effect `Clock`, never `now()`, so `TestClock` makes them deterministic.
  - Fixed-value columns are `text` with `CHECK` constraints, not `pgEnum`.
- **Tables**:
  - `forms`: `id`, `tenant` (immutable), `availability` (`open | closed`), `response_limit` (`unlimited | one_per_respondent`), `current_version_id`, `created_at`, `updated_at`.
    - `(current_version_id, id)` is a composite foreign key to `form_versions (id, form_id)`, so the pointer can only point at the same form's version.
    - `CHECK (availability = 'closed' OR current_version_id IS NOT NULL)`: a form can't be opened without a published version.
  - `drafts`: `form_id` (primary key, which enforces one draft per form), `revision bigint` (see Drafts below), `based_on_version_id`, `definition jsonb`, `updated_at`.
    - `(based_on_version_id, form_id)` is a composite foreign key to `form_versions`.
  - `form_versions`: `id`, `form_id`, `number`, `definition jsonb`, `published_at`, `published_by` (the actor's `sub`, not null), `derived_from_version_id`.
    - `UNIQUE (form_id, number)` and `UNIQUE (id, form_id)`, the latter as a target for composite foreign keys.
    - `derived_from_version_id` uses a same-form composite foreign key and is copied from the draft's `based_on_version_id` at publish.
  - `question_identities`: `(form_id, question_id)` primary key, plus `type`. Inserted if missing at publish. It enforces "one question type per identity for life" (ADR 0005) in the database, scoped by form, so a client can't reuse another form's UUID.
    - Amended by [Definition and persistence defects](./27-definition-and-persistence-defects.md): the table also has `UNIQUE (form_id, question_id, type)`, because Postgres only accepts a foreign key whose referenced columns match a unique constraint exactly. The primary key still enforces one type per identity, and the extra constraint is only the target for `form_version_questions`. Every other composite foreign key here already has a matching target.
  - `form_version_questions`: `(version_id, question_id)` primary key, plus `form_id`, `type` and `position`. These are keys only; label, config and options stay in the definition JSONB.
    - `(form_id, question_id, type)` references `question_identities`.
    - `(version_id, form_id)` references `form_versions (id, form_id)`.
  - `responses`: `id`, `form_id`, `version_id`, `respondent_id` (the actor's `sub`, null when anonymous), `limited boolean`, `revision int`, `submitted_at`, `edited_at`.
    - `(version_id, form_id)` references `form_versions (id, form_id)` with `ON DELETE RESTRICT`.
    - `UNIQUE (id, version_id)`, as the target for answers.
    - Amended by [Retries and idempotency for creates and submissions](./26-retries-and-idempotency-for-creates-and-submissions.md) (ADR 0016): a not-null `idempotency_key uuid`, minted by the client, with `UNIQUE NULLS NOT DISTINCT (form_id, respondent_id, idempotency_key)`. It joins the fixed columns the response trigger protects, and it's deleted with its response.
  - `answers`: `(response_id, question_id)` primary key, plus `version_id` and `value jsonb`. The value is the untagged answer from ADR 0005.
    - `(response_id, version_id)` references `responses (id, version_id)` with `ON DELETE CASCADE`.
    - `(version_id, question_id)` references `form_version_questions`.
    - The repository converts between rows and the core's `Answers` object, so the shape at the domain boundary is unchanged.
  - `form_external_refs`: `(form_id, namespace, ref_id)` primary key. It's a mutable association set.
  - `response_external_refs`: `(response_id, namespace, ref_id)` primary key, with `ON DELETE CASCADE`. Written once at submission.
- **Immutability, in custom migrations**:
  - `BEFORE UPDATE OR DELETE` row triggers and `BEFORE TRUNCATE` statement triggers unconditionally reject changes to `form_versions`, `form_version_questions` and `question_identities`. Forms are never deleted, so versions never need to be.
  - A trigger rejects `DELETE` and `TRUNCATE` on `forms`.
    - Amended by [Form lifecycle: deleting or archiving forms](./23-form-lifecycle-deleting-or-archiving-forms.md) (ADR 0014): the `BEFORE DELETE` row trigger rejects the delete only when `EXISTS (SELECT 1 FROM form_versions WHERE form_id = OLD.id)`. `TRUNCATE` stays rejected. `drafts.form_id` and `form_external_refs.form_id` get `ON DELETE CASCADE`.
  - `BEFORE UPDATE` triggers reject changes to columns that must never change:
    - `forms.tenant`
    - `responses.form_id`, `version_id`, `respondent_id`, `submitted_at` and `limited`
    - any `UPDATE` of `response_external_refs` (deletes stay allowed so cascades work)
  - There's no privilege-split role and no row-level security.
  - Tests reset with a fresh PGlite instance, or by dropping and recreating the schema on real Postgres, never by truncating.
- **Drafts and optimistic concurrency**:
  - `revision` is set from one database sequence on every create and save, so it never repeats across draft lifetimes. That prevents a stale editor from overwriting a newer draft that happens to share a revision number with a deleted one. The API treats it as an opaque token.
  - A save carries `expectedRevision`.
    - `null` means "create". It inserts the row with `based_on_version_id` set to the current version (or null), and a primary-key violation becomes a 409 conflict.
    - Otherwise, `UPDATE … WHERE form_id = $1 AND revision = $2`. If zero rows are updated, a follow-up read decides between a 409 conflict and "no draft".
  - Discard and publish check the revision the same way. There's no separate "create draft" operation.
  - Amended by [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md): every draft write (save, including `expectedRevision: null`, discard, publish, and deleting a never-published form) first takes `SELECT … FOR UPDATE` on the form row, scoped to the tenant, the lock publish already takes. Without it, a save could commit between publish's revision check and its draft delete, and an acknowledged save would be lost. Lock order decides the race:
    - Publish first: a later save or discard with a non-null `expectedRevision` finds no draft and gets `NoDraft`. A save with `expectedRevision: null` creates a new draft based on the new current version.
    - Save first: publish sees the new revision and gets `RevisionConflict`.
    - Deleting a never-published form against a save resolves the same way: the loser of the lock sees `RevisionConflict` or `NotFound`.
- **Publish**: one transaction at `READ COMMITTED`.
  1. Lock the form row with `SELECT … FOR UPDATE`, scoped to the actor's tenant.
  2. Check the draft revision.
  3. Load the prior definitions and run `validateForPublish`.
  4. Set `number = max + 1`, with `UNIQUE (form_id, number)` as a backstop.
  5. Insert the version, its `form_version_questions` and any missing `question_identities`.
  6. Set `forms.current_version_id` and `updated_at`.
  7. Delete the draft.

  Any failure rolls back the whole transaction, which covers §12 "failed publication does not partially update the current version". The row lock serialises concurrent publishes, and `test:pg` proves that race on real Postgres.

- **Submit and edit**:
  - Both take `SELECT … FOR SHARE` on the form row, scoped to the tenant. That conflicts with publish's `FOR UPDATE` and with a close, but not with other submissions.
  - Under the lock, submit checks availability, then that the target is the current version (otherwise `version_superseded`), then the response limit. It then inserts the response, its answer rows and its external references.
    - Amended by [Retries and idempotency for creates and submissions](./26-retries-and-idempotency-for-creates-and-submissions.md) (ADR 0016): under the lock, submit first looks up `(form_id, respondent_id, idempotency_key)`. A match returns that response's id and current revision, before any other check. If a concurrent retry wins the race, the unique violation rolls back the transaction and the use case reruns once.
  - An edit checks availability and `WHERE id = $1 AND revision = $2`, returning 409 on a stale copy. It deletes and reinserts the answer rows, increments `revision` and sets `edited_at`. The version never changes.
- **Response limit**:
  - `responses.limited` records whether the form was one per respondent at submission.
  - A partial unique index on `(form_id, respondent_id) WHERE limited` catches the race between simultaneous first submissions. The unique violation maps to `already_responded`.
  - The application first checks for any existing response by this respondent and returns `already_responded`, pointing at the most recent one.
  - Switching an unlimited form to one per respondent is allowed even when duplicates exist, and they stay as valid history.
  - Anonymous submissions to one-per-respondent forms are refused with 401 before any write (ADR 0006).
- **Form settings**: availability, the response limit and the external-reference associations are last-write-wins, with no revision.
- **Tenancy**: only `forms` carries `tenant`. Every repository function takes a branded `TenantId` and reaches drafts, versions, responses, references and analytics by joining through `forms … WHERE tenant = $t`. A miss returns 404. The cross-tenant cases in [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md) are the tests.
- **External references**:
  - Both reference tables are indexed on `(namespace, ref_id)`. The API offers tenant-scoped lookups of forms by reference and of responses by reference (the host needs the latter for limits scoped by reference).
  - Shape limits are checked in Effect Schema at the edge and again as `CHECK` constraints:
    - `namespace`: 1 to 64 characters, matching `^[a-z][a-z0-9_.-]*$`.
    - `ref_id`: 1 to 255 characters, otherwise opaque.
  - Count limits: at most 20 references per response, checked as an array length at the edge, and at most 100 per form, checked by the application under the form row lock. A `CHECK` constraint can't count rows.
  - Amended by [Trust in response external references](./20-trust-in-response-external-references.md) (ADR 0012): a response's references come from the token's `refs` claim, so the 20-reference cap and the shape limits are checked when the claim is validated, and a violation gives 401 `invalid`. The `CHECK` constraints stay.
- **Deletion**:
  - Deleting one response cascades to its answers and references.
  - "All responses for a respondent" deletes every response with that `respondent_id` across all forms in the admin's tenant.
  - Versions and forms are never deleted. The triggers and `ON DELETE RESTRICT` guarantee that no referenced version can disappear (ADR 0001 §9).
    - Amended by [Form lifecycle: deleting or archiving forms](./23-form-lifecycle-deleting-or-archiving-forms.md) (ADR 0014): a form that has never been published can be deleted, with its draft and references, in one transaction under `FOR UPDATE` on the form row. Forms with a version and all versions stay undeletable.
  - Amended by [Personal data classification and erasure](./22-personal-data-classification-and-erasure.md) (ADR 0013): hard deletion of responses is the module's only erasure. Deleting by respondent frees the slot that the partial unique index on `(form_id, respondent_id) WHERE limited` held, so that respondent can submit again to a one-per-respondent form. `form_versions.published_by` is deliberately never erased, and the trigger stays unconditional.
- **Indexes for the MVP**:
  - `responses (form_id, version_id)` for counts by version.
  - `responses (respondent_id)` for respondent lookups and deletion.
  - `answers (version_id, question_id)` for distributions. This replaced `answers (question_id)` in [Analytics queries and cross-version compatibility](./15-analytics-queries-and-cross-version-compatibility.md).
  - The `(namespace, ref_id)` indexes on both reference tables.
  - The keys and unique constraints above.
  - The analytics queries themselves are in [Analytics queries and cross-version compatibility](./15-analytics-queries-and-cross-version-compatibility.md).
- **Migrations**:
  - The module exports one migration Effect, applied through the Effect migrator inside `form_management`. The standalone API server and the reference host run it at startup, and test setup runs it on each fresh database. A host that mounts the API in-process calls it itself, and the module never migrates implicitly.
  - Each schema change is one `drizzle-kit generate` migration, plus a `generate --custom` migration for triggers and checks when needed. The custom one is generated in a separate step afterwards, which avoids the same-second ordering pitfall.
