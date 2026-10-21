# 34: Builder discards drafts, deletes never-published forms and changes settings

**What to build:** An editor discards the draft of a published form, deletes a form that was never published, changes a form's availability and response limit, and sees the form's external references. With ticket 33, this closes §12 bullet 1 end to end and bullet 3 through the UI.

**Sources:** [Spec, phase 3](../../form-builder-mvp/spec.md#phase-3-builder); [ADR 0014](../../../docs/adr/0014-only-never-published-forms-can-be-deleted.md), [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [Form lifecycle: deleting or archiving forms](../../form-builder-mvp/issues/23-form-lifecycle-deleting-or-archiving-forms.md).

**Blocked by:** 12 (Delete never-published forms and change form settings), 24 (Forms carry external references), 32 (Builder edits and saves drafts).

**Status:** ready-for-agent

- [x] An editor can discard the draft of a published form.
- [x] On a never-published form, "Delete form", behind a confirmation step, replaces "Discard draft", and returns to the form list.
- [x] Form settings have the availability toggle and the response limit.
- [x] A form's external references are shown read-only.
- [x] Unknown outcomes on these actions use the shared handling from ticket 31.
- [x] Playwright, builder project: create a form, delete it, and check it's gone from the list.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t34-builder-lifecycle`. `vp run ready` is green locally; the last box stays open until the PR's CI jobs report. Notes for later tickets (33 especially, which also edits `DraftEditor.svelte`):

- `outcome` in `src/lib/api.ts` now returns `ok` for a 204 (openapi-fetch gives `data: undefined` for it, which used to come back as `unknown`). Only no-content endpoints answer 204, so their `data` type is empty anyway.
- `DraftEditor` now always loads `GET /forms/{id}` alongside the draft and keeps it as `form` (`FormDetail`). Its action row holds Save, then "Delete form" when `form.currentVersion === null`, or "Discard draft" when the form is published and has a draft (`revision !== null`). Ticket 33's preview and publish can join that row; after a publish, call `reloadForm()` (rereads only the detail, keeping local edits) or `load()` so the row switches from delete to discard. Save, discard and delete share `busy` and `begin()`.
- A `NotFound` while loading (or on discard and delete) shows "This form no longer exists." instead of the editor. The editor takes an `onDeleted` prop; the route passes `goto("/")`.
- Delete asks first ("Delete permanently" / "Cancel"). `FormPublished` rereads the detail and offers the discard; `RevisionConflict` reuses the save's conflict banner. Unknown outcomes on discard and delete reload the whole form; on a settings change only the detail is reread, so unsaved edits survive.
- `src/lib/FormSettings.svelte` (props `client`, `form`, `saved`, `reload`, `signIn`) sends each change as its own `PATCH`. The "Open for responses" checkbox is disabled on a never-published closed form. External references are a read-only region named "External references" in the editor.
- Tests: `tests/form-lifecycle.browser.test.ts` (a stateful one-form fake host), e2e `e2e/builder/lifecycle.spec.ts`. Fake hosts for `DraftEditor` must now answer `GET /forms/{id}` with a full `FormDetail` (`externalRefs` included).
