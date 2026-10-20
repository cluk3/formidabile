# 12: Delete never-published forms and change form settings

**What to build:** An admin deletes a form that has never been published, and changes a form's availability and response limit. A form with any published version can never be deleted, even when a delete races a publish.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api); [ADR 0014](../../../docs/adr/0014-only-never-published-forms-can-be-deleted.md); [Form lifecycle: deleting or archiving forms](../../form-builder-mvp/issues/23-form-lifecycle-deleting-or-archiving-forms.md), [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md).

**Blocked by:** 11 (Save drafts and publish immutable versions).

**Status:** ready-for-agent

- [ ] Deleting a form checks `NotFound`, then `FormPublished`, then `RevisionConflict`, in that order. Deleting a never-published form removes its draft by cascade.
- [ ] `PATCH` on a form updates its availability and response limit.
- [ ] Use case: deleting a published form gives `FormPublished`, and deleting with a stale revision gives `RevisionConflict`.
- [ ] `test:pg`: a delete racing a publish ends either with the form gone and no version, or with the version published and `FormPublished`, never both.
- [ ] `http-api`: deleting or changing settings without `forms:manage` gives 403, and another tenant's admin gets 404.
- [ ] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
