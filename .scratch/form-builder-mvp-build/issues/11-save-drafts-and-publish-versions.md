# 11: Save drafts and publish immutable versions

**What to build:** An admin saves a form's draft against an expected revision, discards it, and publishes it as an immutable form version, which becomes the current published version. Anyone with an admin read capability reads the versions. A failed publication changes nothing.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api); [ADR 0005](../../../docs/adr/0005-form-definition-model.md), [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md) (`drafts` and `versions` groups); [Persistence model](../../form-builder-mvp/issues/10-persistence-model.md) (draft writes lock the form row), [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md).

**Blocked by:** 10 (Tracer bullet: an admin creates, lists and reads forms over HTTP).

**Status:** ready-for-agent

- [ ] The `Draft`, `FormVersion` and version summary envelopes are Effect Schemas in `@fb/server`.
- [ ] Every draft write takes `FOR UPDATE` on the form row first.
- [ ] Publish runs in one `READ COMMITTED` transaction that inserts the version and its question keys, moves the current published version, and deletes the draft.
- [ ] Use case: publish creates v1; editing the draft afterwards leaves v1 unchanged; publishing again creates v2, leaves v1 unchanged and moves the current version.
- [ ] Use case: publishing an incomplete draft returns every problem as `ValidationFailed`, and leaves the current version and the draft unchanged.
- [ ] Use case: a failure injected after the version row is inserted rolls back everything. There is no version row, the current version is unchanged, and the draft is kept.
- [ ] Use case: draft revisions never repeat, and a stale `expectedRevision` gives `RevisionConflict`.
- [ ] Use case: publishing and then saving with a stale revision gives `NoDraft`; saving with `expectedRevision: null` after a publish creates a draft based on the new version; saving and then publishing with a stale revision gives `RevisionConflict` and no new version.
- [ ] Use case: discarding a never-published form's draft gives `FormNotPublished`.
- [ ] `test:pg`: a save and a publish fired at once end in one of the states above. There is exactly one new version, it holds the definition publish expected, and a save that got a 200 is never lost.
- [ ] `http-api`: saving or publishing without `forms:manage` gives 403; `acme-analyst` reads versions but not the draft; another tenant's admin gets 404.
- [ ] `openapi.json` and the client are regenerated with the `RevisionConflict`, `NoDraft` and `FormNotPublished` errors.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
