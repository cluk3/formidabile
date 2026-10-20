# 16: Serving-mode parity test

**What to build:** Proof that `apps/api-server` and `createFormModuleHandler` serve the same API. One fixed table of requests goes through both: the server's layer on an ephemeral port, and the Fetch handler. Each row must give an equal status, `content-type` and body. Later tickets add rows as new behaviour lands.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api) (tests that close the phase); [Revise the phased plan and spec](../../form-builder-mvp/issues/30-revise-the-phased-plan-and-spec.md) (the standalone server).

**Blocked by:** 13 (Every token claim set is validated), 14 (Request body limits at the edge).

**Status:** ready-for-agent

- [ ] The test runs under `vp test` on PGlite.
- [ ] The rows are: one success; a 401 with each `reason` phase 1 can raise; a 403; a 404; a 409; a 422; a 411 sent chunked over a raw socket; and a 413.
- [ ] Adding a case means adding one table row.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
