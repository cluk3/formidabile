# 27: Renderer handles edits, version changes and refusals

**What to build:** The renderer handles everything after the first submit, and every way the module can refuse. That means editing an existing response, a new version being published mid-session, closed and unavailable forms, sign-in prompts, and a clear message for each error.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) (`@fb/renderer`); [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md), [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md), [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md); [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md), [Anonymous respondent access and tenancy](../../form-builder-mvp/issues/19-anonymous-respondent-access-and-tenancy.md).

**Blocked by:** 22 (Respondents edit their own response), 23 (Anonymous respondents submit under a form-bound grant), 26 (Renderer fills in and submits all seven question types).

**Status:** ready-for-agent

- [x] The renderer goes straight to editing through `myResponseId`, and edits a given response through `response-id`.
- [x] On `RevisionConflict` the respondent chooses to reload or stay. On `VersionSuperseded` the renderer prompts a reload.
- [x] The closed state shows for a closed form, and the unavailable state for `FormNotPublished`.
- [x] The sign-in prompt is driven by `respondent` and `responseLimit`. A component test shows it follows `respondent: "anonymous"`.
- [x] Component test: each 401 `reason` maps to its message.
- [x] Component test: a 413 shows "Your answers are too long to send".
- [x] Playwright, renderer project (three browsers): load, submit and edit; publish v2 behind an open form, submit, see the reload prompt, then submit on v2.
- [x] Playwright, renderer project: the anonymous dev user submits to an unlimited form, and is prompted to sign in on a form limited to one response per respondent.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t27-renderer-states`. The last box stays open until the PR's CI jobs report. Notes for later tickets (28, 29, 30 and 33 especially):

- `RendererProps` (live) gains `responseId?` (edit that response on its own version) and `onerror?(RendererError)`. The element maps `response-id` to `responseId`, re-mounts when `form-id` or `response-id` changes, and fires an `error` CustomEvent whose `detail` is `RendererError` `{ code, message }`. `code` is a `ProblemCode` from `lib/problems.ts`, where every message lives: `signInRequired`, `sessionExpired`, `closed`, `unavailable`, `notFound`, `unsupported`, `loadFailed`, `sendFailed`, `tooLarge`, `versionSuperseded`, `revisionConflict`, `alreadyResponded`. `error` fires each time one is shown; per-question validation errors never fire it.
- `submitted` fires after an edit's 200 too, with the same `{ responseId }`; the edit view shows "Your changes were saved." and its button reads "Save changes" ("Saving…").
- Views in `FormRenderer.svelte`: `loading`, `stopped` (one `ProblemCode` instead of the form), `answering` (a `Loaded` with optional `editing: { responseId, revision }`), `submitted` (`edited`). Refusals above Submit that keep the answers are a `Notice` (`tooLarge`, a 401, `versionSuperseded` with Reload, `revisionConflict` with Reload and Stay, `alreadyResponded` with "Edit your response", `sendFailed`). `open(target?)` reloads the form, or a response for editing; every load resets drafts, errors, the notice and the idempotency key.
- The load: 401 by `reason`, 409 `FormClosed` → closed, 409 `FormNotPublished` → unavailable, 404 → not found; `respondent: "anonymous"` on a `one_per_respondent` form stops at the sign-in prompt before the form shows; `myResponseId` reads that response and edits it. A read with `editable: false` shows the closed state. Submit and edit: a 413 (by status, whatever the body) → "Your answers are too long to send.", 409 `FormClosed` and 404 replace the form, a 401 keeps the answers.
- Ticket 28: every outcome that isn't a 2xx, a 413 or a known `_tag` still lands on `sendFailed` in `refuse` (and a rejected `fetch` in `submit`'s `catch`), for submits and edits alike; that's what 28 replaces. Edits mint no idempotency key.
- `lib/drafts.ts` gains `draftsOf(definition, answers)`, the inverse of the answer mapping, dropping an answer that doesn't fit its question's type.
- Tests: `tests/form-renderer-states.browser.test.ts` (component) and `tests/element-states.browser.test.ts` (built bundle). `fakeApi` takes `reads` (by response id) and `edits` (PUT replies, a 200 with revision `"2"` when they run out); `responseRead(id, definition, answers, { editable, revision })` builds a read.
- Reference host: `src/project.ts` listens for the element's `error` and, on `signInRequired` or `sessionExpired`, adds a "Sign in" link to `/login?return=<page>`. e2e: `e2e/renderer/edits.spec.ts` and `e2e/renderer/sign-in.spec.ts`; `seedProject`'s `api` also takes `PUT`.
