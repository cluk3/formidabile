# 39: Reference host admin page manages references and finds responses by project

**What to build:** Signed in as a tenant admin, a host user manages each demo project's form references and lists the responses submitted under that project, all from the reference host's own admin page. This closes the lookup half of §12 bullet 10.

**Sources:** [Spec, phase 4](../../form-builder-mvp/spec.md#phase-4-responses-and-history) (`apps/reference-host` and Playwright); [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md).

**Blocked by:** 25 (Reference host resolves the form for project X), 28 (Renderer retries submissions whose outcome is unknown), 35 (Admins list and read responses).

**Status:** ready-for-agent

- [ ] Signed in as `acme-admin` or `globex-admin`, the page adds and removes form references and lists responses by reference for each demo project.
- [ ] Playwright, renderer project: the "form for project X" test checks the new response is listed under its project.
- [ ] Playwright, renderer project: the dropped-reply test checks the form's response list shows exactly one response.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
