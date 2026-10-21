# 11: Save drafts and publish immutable versions

**What to build:** An admin saves a form's draft against an expected revision, discards it, and publishes it as an immutable form version, which becomes the current published version. Anyone with an admin read capability reads the versions. A failed publication changes nothing.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api); [ADR 0005](../../../docs/adr/0005-form-definition-model.md), [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md) (`drafts` and `versions` groups); [Persistence model](../../form-builder-mvp/issues/10-persistence-model.md) (draft writes lock the form row), [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md).

**Blocked by:** 10 (Tracer bullet: an admin creates, lists and reads forms over HTTP).

**Status:** ready-for-agent

- [x] The `Draft`, `FormVersion` and version summary envelopes are Effect Schemas in `@fb/server`.
- [x] Every draft write takes `FOR UPDATE` on the form row first.
- [x] Publish runs in one `READ COMMITTED` transaction that inserts the version and its question keys, moves the current published version, and deletes the draft.
- [x] Use case: publish creates v1; editing the draft afterwards leaves v1 unchanged; publishing again creates v2, leaves v1 unchanged and moves the current version.
- [x] Use case: publishing an incomplete draft returns every problem as `ValidationFailed`, and leaves the current version and the draft unchanged.
- [x] Use case: a failure injected after the version row is inserted rolls back everything. There is no version row, the current version is unchanged, and the draft is kept.
- [x] Use case: draft revisions never repeat, and a stale `expectedRevision` gives `RevisionConflict`.
- [x] Use case: publishing and then saving with a stale revision gives `NoDraft`; saving with `expectedRevision: null` after a publish creates a draft based on the new version; saving and then publishing with a stale revision gives `RevisionConflict` and no new version.
- [x] Use case: discarding a never-published form's draft gives `FormNotPublished`.
- [x] `test:pg`: a save and a publish fired at once end in one of the states above. There is exactly one new version, it holds the definition publish expected, and a save that got a 200 is never lost.
- [x] `http-api`: saving or publishing without `forms:manage` gives 403; `acme-analyst` reads versions but not the draft; another tenant's admin gets 404.
- [x] `openapi.json` and the client are regenerated with the `RevisionConflict`, `NoDraft` and `FormNotPublished` errors.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t11-drafts-and-publish`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `@fb/server` exports two more use-case services, both in `FormModuleLive`: `Drafts` (`read`, `save(actor, formId, { expectedRevision, definition })`, `discard(actor, formId, expectedRevision)`) and `Publication` (`publish(actor, formId, expectedRevision)` giving `{ form, version }`, `versions`, `version`). It also exports `FormVersion` and the errors `RevisionConflict`, `NoDraft` and `FormNotPublished` (all 409).
- Check order: save is `NotFound`, then `ValidationFailed` (the parse runs before the transaction), then `NoDraft` or `RevisionConflict`. Discard is `NotFound`, `FormNotPublished`, `NoDraft`, `RevisionConflict`. Publish is `NotFound`, `NoDraft`, `RevisionConflict`, `ValidationFailed`. A save with `expectedRevision: null` while a draft exists gives `RevisionConflict`, decided under the row lock, so no primary-key violation is ever caught.
- Every draft write starts with `lockForm(tx, tenant, formId)` in `lib/persistence/forms.ts`, which gives a branded `LockedForm` (or `undefined`: `NotFound`). The draft-write repositories (`lib/persistence/drafts.ts`, `insertCurrentVersion` in `lib/persistence/versions.ts`) take a `LockedForm`, so they can't be called without the lock. Ticket 12's delete should do the same. Inside a use-case transaction, `dieOnDatabaseError` (`lib/persistence/database.ts`) turns `SqlError` and `EffectDrizzleQueryError` into defects and keeps the domain errors typed.
- Publish validates against every earlier version's definition (`validateForPublish`), inserts question identities with `ON CONFLICT DO NOTHING`, stores the definition as core parsed it, copies the draft's `basedOnVersionId` into `derivedFromVersionId`, and sets `forms.updated_at`. Draft saves and discards leave `forms.updated_at` alone.
- HTTP: `GET`/`PUT`/`DELETE /forms/{formId}/draft` (discard takes `?expectedRevision=`, gives 204) and `POST /forms/{formId}/draft/publish` (201) in the `drafts` group; `GET /forms/{formId}/versions` (`{ versions }`, newest first) and `GET /forms/{formId}/versions/{versionId}` in the `versions` group. Ticket 14's body limits still have to cover the draft save (1 MiB) and publish (16 KiB).
- Test patterns: `packages/server/tests/publication.test.ts` injects a failure partway through publish with a test-only trigger created through `SqlClient` on the PGlite layer. `tests/publication-race.pg.test.ts` fires both calls with `Effect.all(..., { concurrency: "unbounded" })` on `DatabaseTestPostgres`; with the lock removed, both of its tests fail.
