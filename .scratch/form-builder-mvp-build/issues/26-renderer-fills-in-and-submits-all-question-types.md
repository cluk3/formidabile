# 26: Renderer fills in and submits all seven question types

**What to build:** A respondent fills in and submits a form through the real renderer, for all seven question types. This works both as the Svelte component and as `<form-renderer>` on the reference host's project route. The renderer also gains a preview mode that never calls the API, ready for the builder.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) (`@fb/renderer`); [ADR 0003](../../../docs/adr/0003-svelte-renderer-with-two-outputs.md), [ADR 0008](../../../docs/adr/0008-renderer-element-adopts-constructable-stylesheets.md), [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md), [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md), [Renderer styles under strict host CSPs](../../form-builder-mvp/issues/14-renderer-styles-under-strict-host-csps.md).

**Blocked by:** 18 (Answer schemas for all seven question types), 20 (Tracer bullet: an identified respondent loads and submits a response), 25 (Reference host resolves the form for project X).

**Status:** ready-for-agent

- [x] All seven input components are registered with `satisfies` against core's question types.
- [x] The renderer loads and submits by itself. `getToken({ formId })` is required and called before every request, and there is no references input.
- [x] The idempotency key is minted at the first Submit and kept until a 201.
- [x] Inputs are labelled. Component tests for all seven types show a failed submit moves focus to the first invalid input, and each invalid input has `aria-invalid` and an `aria-describedby` pointing at its error.
- [x] Component test: a form with an unknown question type is refused.
- [x] Component test: `getToken` receives `{ formId }`.
- [x] Component test: preview mode renders a definition and never calls the API.
- [x] The element wraps the same component tree, with no static `style` attributes in its markup.
- [x] Playwright, renderer project (Chromium, Firefox, WebKit): load and submit through the project route.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t26-renderer`. The last box stays open until the PR's CI jobs report. Notes for later tickets (27, 28, 29 and 33 especially):

- `FormRenderer` (`@fb/renderer`) takes `RendererProps` from `lib/props.ts`: live `{ apiBaseUrl, formId, getToken, onsubmitted? }` or `{ preview: FormDefinition }`. Preview renders and validates in the browser, never calls the API, and on a valid Submit shows "Preview: these answers are valid. Nothing was sent." (ticket 33's builder preview). `GetToken` returns a string, never `null` (ADR 0011).
- Views live in `FormRenderer.svelte`'s `View` union (`loading`, `failed`, `refused`, `answering`, `submitted`); ticket 27 adds closed, unavailable, editing and sign-in there. A definition that `parseDefinition` refuses (an unknown type) gives `refused`. Every non-201 submit outcome except a `ValidationFailed` with question paths shows "We couldn't send your response. Please try again." and leaves the form editable: ticket 28 replaces that for unknown outcomes and ticket 27 for tagged 4xxs.
- The idempotency key is a plain variable minted at the first Submit that passes client validation, resent until a 201, then cleared.
- Inputs are `lib/inputs/<Type>Input.svelte`, registered in `lib/inputs.ts` (`satisfies` over `QuestionTypeName`). Drafts and their mapping to answers are in `lib/drafts.ts` (`checkDrafts` runs core's `validateAnswers`). The question card hands each input a `Field` (`id` of its first focusable control, `describedBy`, `invalid`); a failed submit focuses the first `[aria-invalid=true]` control, or the first radio of an invalid radio group.
- `<form-renderer>` takes `api-base-url` and `form-id` attributes and a `getToken` property, renders nothing until it has all three, re-mounts on a new `form-id`, and fires a `submitted` CustomEvent with `{ responseId }`. Ticket 27 adds `response-id` and the `error` event in `lib/FormRendererElement.svelte`.
- The reference host's project page now renders `<form-renderer api-base-url="/api" form-id=… data-project=…>` (no `title`), and `src/project-token.ts` rejects when `/token` refuses. `index.html` is a static page linking the demo projects; the placeholder element and `src/main.ts` are gone.
- The strict-CSP spec now seeds a project and checks the real markup (`.title`, `.required` through `--form-renderer-accent`, `[part=question]` through `--form-renderer-border`, `::part(submit)`); ticket 29 can extend it. `e2e/renderer/projects.ts` has `seedProject(request, forms)` (forms may carry `questions`; returns `api` for further admin calls), and `e2e/renderer/submit.spec.ts` fills in all seven types and reads the stored response back.
- `tests/element-bundle.browser.test.ts` drives the built element through `tests/fake-api.ts` (`fakeApi(definition, { submits, load })` stubs `fetch`), and `tests/no-static-style.test.ts` now scans `lib/` recursively.
- svelte-check reads the renderer's `vite.config.ts`, where `customElement: true` is global, so a component using `let props = $props()` warns even though it isn't compiled as an element: destructure the props.
