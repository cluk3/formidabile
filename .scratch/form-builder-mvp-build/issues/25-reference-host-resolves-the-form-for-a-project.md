# 25: Reference host resolves the form for project X

**What to build:** The reference host's "form for project X" route. The host looks up the project's form by external reference, mounts `<form-renderer>` when there is exactly one open, published candidate, and mints tokens bound to that form carrying the project's `refs`. The renderer is still the placeholder; ticket 26 makes it real.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) (`apps/reference-host`) and [Seed data and the database lifecycle](../../form-builder-mvp/spec.md#seed-data-and-the-database-lifecycle); [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md); [Lookup cardinality for form external references](../../form-builder-mvp/issues/21-lookup-cardinality-for-form-external-references.md).

**Blocked by:** 17 (Demo seed and `seed:reset`), 23 (Anonymous respondents submit under a form-bound grant), 24 (Forms carry external references).

**Status:** ready-for-agent

- [x] `resolveProjectForm(tenant, projectId)` mints a service JWT (subject `reference-host`, the project's tenant, `responses:read` only), queries the in-process handler's form list by the `project` reference, and keeps the candidates that are published and open.
- [x] The route mounts the element for exactly one candidate. It shows a static "No open form for this project" page for none, and an "ambiguous" page listing the candidates' titles for several.
- [x] `/token?project=<id>` checks the project is in the signed-in dev user's tenant, then calls the same `resolveProjectForm`. For exactly one candidate it mints `form` and `refs: [{ namespace: "project", refId: <id> }]` for every dev user, as an anonymous grant expiring after 5 minutes for the anonymous user. For none or several it gives 404.
- [x] The page's `getToken` calls `/token?project=<id>`. The `{ formId }` it's given never picks the form.
- [x] The seed adds demo projects in `acme` and `globex`, attaches each to its form through the API, and creates identified and anonymous responses under the project's `refs`.
- [x] Vitest table test of `resolveProjectForm`: no forms, only unpublished, only closed, one open, open plus closed (the open one wins), and two open (ambiguous).
- [x] Vitest: `/token?project=<id>` gives 404 for none and for several candidates, refuses a project in another tenant, and mints `form` and `refs` for exactly one; the anonymous user's grant expires after 5 minutes; `/token` with no `project` gives 401 for the anonymous user.
- [x] Playwright: the route mounts the element for one candidate. The "no open form" and "ambiguous" pages each seed their own project and assert no `<form-renderer>` is mounted.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t25-project-form`. The last box stays open until the PR's CI jobs report. Notes for later tickets (26 especially):

- `resolveProjectForm(api, tenant, projectId)` lives in `apps/reference-host/server/projects.ts` and returns `{ kind: "none" } | { kind: "one", form } | { kind: "ambiguous", forms }`. The page at `/projects/<id>` and `/token?project=<id>` both call it.
- The host keeps no project records: a project id names its dev tenant before the first `-` (`acme-…`, `globex-…`), capped at 255 code points. Unknown tenants give the no-form page and 404 on `/token`; a project in another tenant gives 403.
- Demo projects: `acme-spring-orders` and `globex-partner-summit` (`demoProjects`), attached by the seed to each tenant's open form, with identified and anonymous responses under the project's `refs`.
- `apps/reference-host/src/project-token.ts` is the page's `getToken`: it always fetches `/token?project=<id>` and ignores the `{ formId }` it's given. Ticket 26 should keep that when the renderer becomes real.
- Tests: `tests/projects.test.ts` (resolver table), `describe("/token?project=")` and `describe("/projects/<id>")` in `tests/host.test.ts`, `tests/project-token.test.ts`, and `e2e/renderer/project-form.spec.ts` (`tests/api.ts`'s `projectForm(client, projectId, state)` builds a form in a given state).

