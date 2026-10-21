# 12: Delete never-published forms and change form settings

**What to build:** An admin deletes a form that has never been published, and changes a form's availability and response limit. A form with any published version can never be deleted, even when a delete races a publish.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api); [ADR 0014](../../../docs/adr/0014-only-never-published-forms-can-be-deleted.md); [Form lifecycle: deleting or archiving forms](../../form-builder-mvp/issues/23-form-lifecycle-deleting-or-archiving-forms.md), [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md).

**Blocked by:** 11 (Save drafts and publish immutable versions).

**Status:** ready-for-agent

- [x] Deleting a form checks `NotFound`, then `FormPublished`, then `RevisionConflict`, in that order. Deleting a never-published form removes its draft by cascade.
- [x] `PATCH` on a form updates its availability and response limit.
- [x] Use case: deleting a published form gives `FormPublished`, and deleting with a stale revision gives `RevisionConflict`.
- [x] `test:pg`: a delete racing a publish ends either with the form gone and no version, or with the version published and `FormPublished`, never both.
- [x] `http-api`: deleting or changing settings without `forms:manage` gives 403, and another tenant's admin gets 404.
- [x] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t12-delete-and-settings`. The last box stays open until the PR's CI jobs report. Notes for later tickets (34 especially):

- `Forms` gains `delete(actor, formId, expectedRevision)` and `updateSettings(actor, formId, settings)`. `@fb/server` also exports the `FormPublished` error (409, no fields) and the `FormSettings` schema (`{ availability?, responseLimit? }`, each `NullOr`; null or missing leaves it unchanged).
- Delete locks the form row like publish (`READ COMMITTED`) and checks `NotFound`, then `FormPublished` (the form has a current version), then `RevisionConflict` (the draft's revision). The draft goes by cascade. `deleteForm` in `lib/persistence/forms.ts` takes a `LockedForm`; the ticket 09 trigger still refuses deleting a form with any version.
- Settings check order: `ValidationFailed` (neither field set, one issue at path `[]`), then `NotFound`, then `FormNotPublished` (opening a form with no current version). A never-published form can still change its response limit or be set `closed`. The update sets `forms.updated_at`, so the form moves to the top of the list. It takes the row lock too, so an open can't slip past a concurrent check.
- HTTP: `PATCH /forms/{formId}` (body `FormSettings`, 200 `Form`) and `DELETE /forms/{formId}?expectedRevision=` (204) in the `forms` group. Ticket 14's 16 KiB body limit still has to cover the `PATCH`.
- `tests/deletion-race.pg.test.ts` fires delete and publish together for 20 rounds; both orders occur.
