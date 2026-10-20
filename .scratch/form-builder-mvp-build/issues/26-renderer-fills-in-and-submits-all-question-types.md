# 26: Renderer fills in and submits all seven question types

**What to build:** A respondent fills in and submits a form through the real renderer, for all seven question types. This works both as the Svelte component and as `<form-renderer>` on the reference host's project route. The renderer also gains a preview mode that never calls the API, ready for the builder.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) (`@fb/renderer`); [ADR 0003](../../../docs/adr/0003-svelte-renderer-with-two-outputs.md), [ADR 0008](../../../docs/adr/0008-renderer-element-adopts-constructable-stylesheets.md), [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md), [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md), [Renderer styles under strict host CSPs](../../form-builder-mvp/issues/14-renderer-styles-under-strict-host-csps.md).

**Blocked by:** 18 (Answer schemas for all seven question types), 20 (Tracer bullet: an identified respondent loads and submits a response), 25 (Reference host resolves the form for project X).

**Status:** ready-for-agent

- [ ] All seven input components are registered with `satisfies` against core's question types.
- [ ] The renderer loads and submits by itself. `getToken({ formId })` is required and called before every request, and there is no references input.
- [ ] The idempotency key is minted at the first Submit and kept until a 201.
- [ ] Inputs are labelled. Component tests for all seven types show a failed submit moves focus to the first invalid input, and each invalid input has `aria-invalid` and an `aria-describedby` pointing at its error.
- [ ] Component test: a form with an unknown question type is refused.
- [ ] Component test: `getToken` receives `{ formId }`.
- [ ] Component test: preview mode renders a definition and never calls the API.
- [ ] The element wraps the same component tree, with no static `style` attributes in its markup.
- [ ] Playwright, renderer project (Chromium, Firefox, WebKit): load and submit through the project route.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
