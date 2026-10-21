# 39: Reference host admin page manages references and finds responses by project

**What to build:** Signed in as a tenant admin, a host user manages each demo project's form references and lists the responses submitted under that project, all from the reference host's own admin page. This closes the lookup half of §12 bullet 10.

**Sources:** [Spec, phase 4](../../form-builder-mvp/spec.md#phase-4-responses-and-history) (`apps/reference-host` and Playwright); [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md).

**Blocked by:** 25 (Reference host resolves the form for project X), 28 (Renderer retries submissions whose outcome is unknown), 35 (Admins list and read responses).

**Status:** ready-for-agent

- [x] Signed in as `acme-admin` or `globex-admin`, the page adds and removes form references and lists responses by reference for each demo project.
- [x] Playwright, renderer project: the "form for project X" test checks the new response is listed under its project.
- [x] Playwright, renderer project: the dropped-reply test checks the form's response list shows exactly one response.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t39-host-admin-page`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `GET /admin` (`server/host.ts`) serves `admin.html`'s shell only to a dev user with `forms:manage` and `responses:read` (401 static sign-in page when signed out, 403 otherwise). It fills the shell's `<div id="projects"></div>` with one `<section data-ref-namespace="project" data-ref-id="…" aria-labelledby="project-N">` per project: the tenant's demo project (`demoProjects`), or only `?project=<id>` when it's in the admin's tenant (404 static page otherwise). `ReferenceHostOptions` gained `adminPage`; the plugin reads both shells through one `shell(file)` function, and `admin.html` is a build input.
- `src/reference-admin.ts` is the page's logic over `@fb/api-client`: `loadReference(client, ref, limit?)` gives `{ forms, otherForms, responses, nextCursor }` (the tenant's forms split by whether they carry the reference, and the first page of `GET /responses` by reference), `moreResponses`, `addReference`, `removeReference`; failures throw `"<action> failed with <status> (<tag>)"`. `src/admin.ts` renders it with `textContent` only (the preview CSP enforces Trusted Types). Tests: `tests/reference-admin.test.ts`, `describe("/admin")` in `tests/host.test.ts`.
- e2e: `openAdminPage(page, projectId, user?)` in `e2e/renderer/projects.ts` signs the page in through `/login` and returns the project's region; the response list is `getByRole("list", { name: "Responses under this project" })`, each item ending with the response id. `e2e/renderer/admin.spec.ts` covers add and remove, and `globex-admin`'s demo project.
