# 16: Serving-mode parity test

**What to build:** Proof that `apps/api-server` and `createFormModuleHandler` serve the same API. One fixed table of requests goes through both: the server's layer on an ephemeral port, and the Fetch handler. Each row must give an equal status, `content-type` and body. Later tickets add rows as new behaviour lands.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api) (tests that close the phase); [Revise the phased plan and spec](../../form-builder-mvp/issues/30-revise-the-phased-plan-and-spec.md) (the standalone server).

**Blocked by:** 13 (Every token claim set is validated), 14 (Request body limits at the edge).

**Status:** ready-for-agent

- [x] The test runs under `vp test` on PGlite.
- [x] The rows are: one success; a 401 with each `reason` phase 1 can raise; a 403; a 404; a 409; a 422; a 411 sent chunked over a raw socket; and a 413.
- [x] Adding a case means adding one table row.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t16-parity-test`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- The test is `apps/api-server/tests/parity.test.ts`. `rows` maps a name to `{ status, request, chunked? }`: `request` builds a fresh Fetch `Request` (path on `http://localhost`, made with the `request(method, path, { claims | token, body })` helper) each time it's sent, and `status` is the expected one, so a row can't pass by both modes failing alike. Each row goes to the Node server (`ServerLive({ port: 0 })`) by `fetch` and to `createFormModuleHandler` through `declareLength`; `chunked: true` sends it instead over a raw socket with `Transfer-Encoding: chunked` (and raw to the handler, undeclared).
- Both modes share one PGlite database, seeded once in `beforeAll` with one published form (`publishedFormId`) in `acme`. A row must leave the database as it found it, since it runs twice: use refused requests, or reads. Ticket 20's submit and replay rows will need their own fixture (an open form) and an idempotency key that makes the second send a replay; compare the replay, not the first submit, or seed the first submit in `beforeAll`.
- `createFormModuleHandler` now takes `database: Layer<Database>` in place of `databaseUrl`, for tests on PGlite. The handler builds that layer (and `dispose()` releases it), so to share a database the test passes `Layer.succeed(Database, ...)` taken from the server's runtime.
- The 401 rows are `missing` and `invalid` (a token signed with another secret); phase 2 adds `identityRequired`.
