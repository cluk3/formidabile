# 02: HTTP API and generated client shells, with the drift check

**What to build:** `@fb/http-api` and `@fb/api-client` as shells, with the pipeline proving the HTTP contract and the generated client never drift. That means an empty `FormApi`, a stub `createFormModuleHandler` on the `web` entry point, an `openapi` task writing a committed `openapi.json`, and `createFormApiClient({ baseUrl, getToken })` over committed generated schema types.

**Sources:** [Spec, phase 0](../../form-builder-mvp/spec.md#phase-0-repo-setup); [ADR 0004](../../../docs/adr/0004-two-schema-libraries-and-a-generated-browser-client.md); [Effect v4 HTTP API](../../form-builder-mvp/issues/02-effect-v4-http-api-and-openapi-contract.md), [Package layout](../../form-builder-mvp/issues/11-package-layout.md), [CI pipeline](../../form-builder-mvp/issues/17-ci-pipeline.md).

**Blocked by:** 01 (Workspace, toolchain, and the `static` and `test` CI jobs).

**Status:** ready-for-agent

- [ ] Both workspaces have their real names, entry points, tsconfigs and `package.json` exports, as laid out in Package layout.
- [ ] The `openapi` task generates `openapi.json` from the empty `FormApi`, the client's `generate` task produces its schema types from that file, and both outputs are committed.
- [ ] The `static` job's drift check regenerates both files and fails on `git diff --exit-code`. A deliberately stale file is shown failing locally once.
- [ ] A test shows the client calls `getToken` and sends its result as the bearer token, against the stub handler.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
