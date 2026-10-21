# 32: Builder edits and saves drafts for all seven question types

**What to build:** An editor edits a form's draft with all seven question types, reorders questions from the keyboard, and saves explicitly. Every definition change goes through core's editing operations, so the builder never invents its own rules.

**Sources:** [Spec, phase 3](../../form-builder-mvp/spec.md#phase-3-builder); [ADR 0005](../../../docs/adr/0005-form-definition-model.md) (editing rules), [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md); [Definition and persistence defects](../../form-builder-mvp/issues/27-definition-and-persistence-defects.md) (the id source), [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md).

**Blocked by:** 08 (Draft editing operations), 11 (Save drafts and publish immutable versions), 31 (Builder signs in, lists and creates forms).

**Status:** ready-for-agent

- [x] All seven editor components are registered with `satisfies` against core's question types.
- [x] Every definition change goes through core's editing operations, including `reidentifyQuestion`, with an id source built on Web Crypto.
- [x] Move-up and move-down buttons reorder questions, and keyboard focus follows the moved question (component test).
- [x] Save is explicit. On `RevisionConflict` the editor chooses to reload or stay.
- [x] Component test: a 413 shows "This form is too large to save".
- [x] An unknown outcome on save uses the shared handling from ticket 31.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t32-builder-drafts`. The last box stays open until the PR's CI jobs report. Notes for later tickets (33 and 34 especially):

- `@fb/core/editing` now also exports `removeQuestion(def, id)` and the caps `QUESTIONS_CAP` (200) and `OPTIONS_CAP` (100), so the builder disables "Add question" and "Add option" at the caps instead of catching `RangeError`.
- `outcome` in `src/lib/api.ts` has a `tooLarge` kind for any 413, checked before the tagged-4xx and `unknown` handling, whatever the body (ticket 14's `PayloadTooLarge { limit }`, or a proxy's untagged 413), so `PayloadTooLarge` never reaches a `rejected` branch. The create form and the editor both show "This form is too large to save".
- The editor is the route `/forms/[formId]` (`src/routes/forms/[formId]/+page.svelte`) around `src/lib/DraftEditor.svelte` (props `client`, `formId`, `signInHref`); each title in the form list links there. It loads `GET /forms/{id}/draft`; with no draft it reads `GET /forms/{id}` and the current version's definition, and the first save sends `expectedRevision: null`. Stored definitions go through core's `parseDefinition` before editing. The editor is clean while its definition is the same object as the last loaded or saved one (`$state.raw`), and after a save it takes the API's parsed (trimmed) definition unless it was edited meanwhile. Ticket 33's preview and publish, and 34's discard, delete and settings, can sit beside its Save button; an unknown outcome there should call the editor's `load` like save does.
- `RevisionConflict` and `NoDraft` on save show "Reload" (rereads the draft, losing local edits) and "Keep my changes". `ValidationFailed` lists every issue message. An unknown outcome reloads the draft and says "We couldn't confirm the draft was saved".
- Question editors: `src/lib/editors/editors.ts` maps each core type name to `{ name, editor }` with `satisfies`; every editor takes `EditorProps<Q>` (`question`, `setConfig`, `addOption`, `removeOption`). `src/lib/QuestionCard.svelte` holds the shared fields and the move, "Treat as a new question" (`reidentifyQuestion`) and remove buttons, and moves focus with the question (to the other move button at either end). Each question is a region named "Question N".
- Tests: `apps/builder/tests/fake-host.ts` (`config`, `json`, `fakeHost(api)`, which answers `/token` with an admin token and passes `"<METHOD> <path under /api>"` to `api`); `tests/draft-editor.browser.test.ts`; e2e `e2e/builder/drafts.spec.ts`. Vitest's `getByLabelText` matches exactly but Playwright's `getByLabel` matches substrings ("Option 1" also finds "Remove option 1"), so e2e passes `{ exact: true }`. A `<label>` wrapping a `<select>` gets the options' text in its name, so selects and textareas use `for`/`id` (`$props.id()`).
