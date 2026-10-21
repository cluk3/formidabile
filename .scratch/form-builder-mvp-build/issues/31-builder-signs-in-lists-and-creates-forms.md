# 31: Builder signs in, lists and creates forms

**What to build:** An editor opens the builder, signs in through the host application, sees their tenant's forms, and creates a new one. This ticket also sets up the builder's shared handling of unknown outcomes, which later builder tickets reuse.

**Sources:** [Spec, phase 3](../../form-builder-mvp/spec.md#phase-3-builder); [ADR 0003](../../../docs/adr/0003-svelte-renderer-with-two-outputs.md), [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md) (the builder's unknown outcomes); [Identity, authorization and tenancy seam](../../form-builder-mvp/issues/09-identity-authorization-and-tenancy-seam.md) (the builder admin actor), [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md).

**Blocked by:** 05 (Builder SPA shell), 15 (Reference host serves the API to dev users).

**Status:** ready-for-agent

- [x] The admin actor comes from `config.json`. The builder calls `GET <tokenUrl>` with `credentials: "include"` before each API call, and shows a "Sign in" link to `<loginUrl>` on a 401 or when `forms:manage` is missing.
- [x] The form list shows the tenant's forms, and an editor can create a form.
- [x] On an unknown outcome, the builder says it couldn't confirm the action and reloads: the form list after a create, or the form's detail otherwise.
- [x] Component test: an unknown outcome on create reloads the form list.
- [x] Playwright, builder project: signed in as `acme-admin`, create a form and find it in the list by title.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t31-builder-forms`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `apps/builder/src/lib/api.ts` is the builder's one way to the API. `createBuilderClient(config, fetch?)` wraps `createFormApiClient` and fetches `GET <tokenUrl>` with `credentials: "include"` before every call. It reads the token's `capabilities` claim (no verification) and refuses to send without `forms:manage`. `signInUrl(loginUrl, returnTo)` builds `<loginUrl>?return=<page url>`, which the reference host's `/login` sends back to.
- `outcome(() => client.POST(...))` returns `ok` (`data`), `rejected` (`error`, typed from the endpoint's tagged 4xx, so `error._tag === "ValidationFailed"` narrows), `signIn` (401, or a 403 `Forbidden` for `forms:manage`), `tokenUnavailable` (the token endpoint failed some other way, so the call was never sent), or `unknown` (a rejected fetch, a 5xx, a non-JSON or non-object 2xx, or an untagged 4xx). On `unknown`, say the action couldn't be confirmed and reload what it affected. There's no detail page yet: ticket 32 reloads the form's detail on its own `unknown` outcomes. A 413 `{ limit }` without a `_tag` comes back as `unknown` today, so ticket 32 must check `response.status === 413` before that (for example with a `tooLarge` kind in `outcome`).
- `src/lib/FormsPage.svelte` (props `client`, `signInHref`) is the list and create form. A create posts `{ format: 1, title, questions: [] }` and reloads the list; ticket 32 can navigate to the editor instead. `+page.svelte` builds the client from `data.config`.
- Component tests: `apps/builder/tests/*.browser.test.ts`, the `builder-browser` Vitest project (Chromium), part of the root `test` run. Render with `vitest-browser-svelte` and pass `createBuilderClient(config, fakeFetch)`. Keep components free of `$app/*` so they render without Kit's runtime. The builder's `vite.config.ts` sets `root: import.meta.dirname`, because SvelteKit otherwise resolves `src/` from the working directory and fails under the root `vp test`.
- `@fb/api-client` now exports `Schemas` (`components["schemas"]` of the generated types), for example `Schemas["FormSummary"]`.
- shadcn `button`, `input` and `label` are added. `shadcn-svelte add` also writes `@internationalized/date` with a caret range into the catalog and turns `bits-ui` into `^2.19.5`; revert both after each `add`.
- e2e: `e2e/builder/forms.spec.ts` signs in by clicking "Sign in" and the `acme-admin` button on the host's `/login`, which returns to the builder. `shell.spec.ts` now asserts the "Sign in" link's href instead of the removed API URL text.
