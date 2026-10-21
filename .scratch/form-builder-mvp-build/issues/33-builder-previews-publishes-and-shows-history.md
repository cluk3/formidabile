# 33: Builder previews, publishes and shows publication history

**What to build:** An editor previews a draft without ever creating a response, publishes it as a form version, and sees the form's publication history. Edit and publish again, and both versions show in the history.

**Sources:** [Spec, phase 3](../../form-builder-mvp/spec.md#phase-3-builder); [ADR 0003](../../../docs/adr/0003-svelte-renderer-with-two-outputs.md), [ADR 0005](../../../docs/adr/0005-form-definition-model.md); [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md).

**Blocked by:** 26 (Renderer fills in and submits all seven question types), 32 (Builder edits and saves drafts).

**Status:** ready-for-agent

- [x] Preview uses the renderer component's preview mode, which never calls the API.
- [x] Publishing shows every `ValidationFailed` problem at once.
- [x] Publication history shows the versions list, reads one version, and indicates the current published version against the outstanding draft.
- [x] An unknown outcome on publish uses the shared handling from ticket 31.
- [x] Playwright, builder project: create, edit, preview (asserting no `/respond` request is made), save, publish v1, edit and publish v2, and see both versions in the history.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t33-builder-publish`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `DraftEditor`'s action row is now Save, Preview (a toggle with `aria-pressed`), Publish, then Delete form or Discard draft. Preview mounts `FormRenderer` from `@fb/renderer` with `preview={definition}` (the unsaved edits included) in a region named "Preview".
- Publish posts `{ expectedRevision }` to `POST /forms/{id}/draft/publish` and is disabled until the draft is saved (`revision !== null && definition === saved`). On a 201 it calls `load()` (the API deletes the draft, so the editor shows the new current version) and says "Published version N". `ValidationFailed` fills the shared issues list, headed "The draft couldn't be published:" (`refused` picks the verb); `RevisionConflict` reuses the conflict banner; `NoDraft` and unknown outcomes reload the whole form.
- A successful save now also writes the returned draft summary into `form.draft`, so anything reading the detail sees the outstanding draft without a reload.
- `src/lib/PublicationHistory.svelte` (props `client`, `form`, `signIn`) is the region "Publication history". It reads `GET /forms/{id}/versions` whenever `form.currentVersion.id` changes (never for an unpublished form, which shows "Not published yet."), marks `isCurrent` with a "Current" badge, states the current version against `form.draft` ("An unpublished draft, based on version N, …" or "No unpublished draft: …"), and "Read version N" shows that version through the renderer's preview mode in a region named "Version N".
- Tests: `tests/publication.browser.test.ts` (a stateful one-form fake host with versions and publish), e2e `e2e/builder/publication.spec.ts`. In builder browser tests `toHaveTextContent` didn't match a substring of a list item's text, so assert with `getByText(..., { exact: true })` inside the item.
- The renderer's question label's accessible name has no space before "(required)" (`Name(required)`), from `lib/inputs/Prompt.svelte`'s whitespace; left to the renderer tickets.
