# Request limits and abuse controls

Type: grilling
Status: resolved
Blocked by: 19, 24
Map: [Form builder MVP](../map.md)

## Question

Which request limits does the module enforce, which does it leave to the host application, and where is that written down?

- No artifact sets a request body limit, a rate limit or a timeout.
- Anonymous respondents may submit to unlimited forms ([ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md)), but since [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md), submitting needs a host-signed grant bound to one form, with no module-imposed maximum lifetime. Anyone holding an unexpired grant can submit to that form as often as they like.
- A definition can hold 200 questions, and a text answer up to 10,000 characters ([ADR 0005](../../../docs/adr/0005-form-definition-model.md)). Email answers, `sub`, `tenant`, the grant's `form` and respondent ids have no length cap.

Decide:

- The maximum body size for each kind of endpoint, consistent with the model's own caps and the volumes from [Expected load and data volumes](./24-expected-load-and-data-volumes.md).
- Who rate-limits anonymous submissions: the module, or the host application in front of it, and what `docs/embedding.md` says either way.
- Request timeouts on the standalone server and the Fetch handler.
- Length caps on email answers and on the identity claims.
- The status and error tag for an over-limit request, and where it goes in the [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md) error table.
- The tests: an oversized body, an over-long claim.

## Answer

Recorded as [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md), which amends ADR 0005, ADR 0006, ADR 0010, ADR 0011 and ADR 0012. No glossary changes: every new name here is an implementation detail. The facts come from [research/request-limits.md](../research/request-limits.md) (`effect@4.0.5`, `@remix-run/node-fetch-server@1.0.0`, `jose@6.2.13`, `zod@4.6.7`, Node 24).

- **Body limits**: totals at the HTTP edge, in bytes of UTF-8, with no change to the model.
  - Create and draft-save bodies (they carry a definition) and submit and edit bodies (they carry answers): **1 MiB**. Every other request body: **16 KiB**.
  - The field caps can't all be reached at once. A definition at every [ADR 0005](../../../docs/adr/0005-form-definition-model.md) cap is about 6.3 MB of ASCII (about 18 MB of non-Latin text), and a submission about 2 MB (about 6 MB). 1 MiB is about 50 times a realistic 20-question form, and bounds memory at about 20 MiB across the 20 people submitting at once in the [load envelope](./24-expected-load-and-data-volumes.md). ADR 0005 and `docs/embedding.md` say so.
  - Rejected: limits that fit every model-valid input (about 20 MB and 8 MB), and a serialized-size cap in `@fb/core`.
- **Mechanism**: a request with a body must declare its length.
  - No `Content-Length` gives **411 `LengthRequired`**. A declared length over the endpoint's limit gives **413 `PayloadTooLarge { limit }`**. One edge middleware checks both before any of the body is read, identically under the standalone server and the Fetch handler.
  - That is a complete check: HTTP/1.1 framing makes Node deliver exactly the declared bytes in both serving modes. Browsers and `openapi-fetch` always send `Content-Length` for JSON string bodies. A host that builds a `Request` in its own code is trusted code.
  - Effect's `HttpServerRequest.MaxBodySize` is not used. It is ignored on the `toWebHandler` path, which the reference host, the builder and e2e use. On the Node server, exceeding it destroys the socket, so the client sees a connection reset instead of a 413. Effect has no 413 class, so `PayloadTooLarge` and `LengthRequired` are module `Schema.TaggedError`s.
  - Rejected: counting streamed bytes in the module, which needs untested plumbing to hand Effect a buffered request, and keeping `MaxBodySize` as a backstop, which would make the two serving modes behave differently.
- **Errors**: two new rows in the [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md) table, outside the 409 state conflicts: 411 `LengthRequired` (no fields) and 413 `PayloadTooLarge` (`limit`, in bytes). The builder shows "This form is too large to save" and the renderer "Your answers are too long to send". Not 422: the request as a whole is refused before parsing.
- **Rate limits**: owned by the host. The module enforces none, and still sets no maximum grant lifetime ([ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md)).
  - `docs/embedding.md` states that the module doesn't rate-limit, that hosts must rate-limit `/respond` (especially submit) and the endpoint that mints grants, and that grants should live for minutes. That's cheap, because the renderer calls `getToken()` before every request.
  - The reference host mints grants that expire after 5 minutes, and doesn't rate-limit, since it's a demo.
  - Rejected: rate limiting in the module by IP or by grant, which needs shared state and breaks behind proxies. Single-use anonymous grants were handed to [Retries and idempotency for creates and submissions](./26-retries-and-idempotency-for-creates-and-submissions.md), because they overlap with idempotency.
- **Length caps**: every character cap counts Unicode code points.
  - Zod 4 (`maxLength`), JSON Schema and Postgres `char_length` already count code points. Effect Schema's built-in length check counts UTF-16 units, so the module's Effect Schema caps (claims, parameters, the ADR 0012 reference shapes) use one shared code-point check instead. How every duplicated contract is checked against the others stays with [Definition and persistence defects](./27-definition-and-persistence-defects.md).
  - An email answer: at most **254** characters (RFC 5321), added to the email type, so longer gives 422 `ValidationFailed`. `z.email()` has no cap of its own. The answer-schema output gains `maxLength: 254`.
  - The `sub` and `tenant` claims: **1 to 255**, opaque, no pattern. The `form` claim: a UUID. Anything else gives 401 `Unauthenticated` with `reason: "invalid"`. A custom `ActorResolver`'s actor is checked against the same limits after it runs.
  - The `respondentId` path parameter and query filter: 1 to 255, otherwise 422 `ValidationFailed`.
- **Tokens**: no token length cap in the module. Node's header limit (16 KiB by default, 431 above it) bounds the token on every request reaching a Node server, in both serving modes. `jose` decodes the protected header and hashes the payload before rejecting a bad signature, and that bound makes the cost negligible. An ASCII `refs` claim at its limits is already about 9.7 KB once encoded, so a module cap of 8 KiB would refuse valid tokens. `docs/embedding.md` warns hosts to keep references short.
- **Timeouts**:
  - `apps/api-server` sets `headersTimeout` to 10 s and `requestTimeout` to 30 s in its own `createServer(...)` call (Node's defaults are 60 s and 300 s). `NodeHttpServer.layer`'s options only reach `listen`.
  - Under the Fetch handler, the host's server owns connection and request timeouts, and `docs/embedding.md` says so.
  - The module's Postgres connections, built from `databaseUrl` in both serving modes, set `statement_timeout` to 30 s through `@effect/sql-pg`'s `startupParameters`. The load envelope's worst analytics read is several seconds.
  - No handler timeout middleware. A client disconnect already interrupts the handler on both paths.
- **Tests**:
  - **`@fb/http-api`, through the Fetch handler**:
    - A draft save and a submit declaring 1 MiB plus one byte, and a `PATCH /forms` declaring 16 KiB plus one byte, each give 413 with the class's `limit`.
    - A definition body just under 1 MiB is accepted.
    - A chunked body with no `Content-Length` gives 411.
    - A 256-character `sub`, a 256-character `tenant`, a non-UUID `form`, and a custom resolver whose `subject` is 256 characters each give 401 `invalid`.
    - A `sub` of 255 emoji passes, and one of 256 emoji fails.
    - A 256-character `respondentId` gives 422.
  - **`@fb/core`**: a 254-character email answer passes, and a 255-character one fails. The answer-schema contract test gains the email case.
  - **`apps/api-server`, in its `test:pg` smoke test**: one oversized submit gives 413, and `SHOW statement_timeout` on a module connection returns `30s`.
    - Amended by [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md): the 413 check moves to the `apps/api-server` serving-mode parity test, which sends 411 and 413 requests through both serving modes. The smoke test keeps `statement_timeout`.
  - No tests for Node's timeouts, which are plain configuration, and a timing test would fail at random on CI.
- **Map**: no new tickets. [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md) folds this into `spec.md` and decides the phases. A suggested placement: the edge middleware, error rows and claim caps in phase 1, the renderer's 413 message and the `docs/embedding.md` sections in phase 2, the server timeouts and `statement_timeout` with the server and persistence layers, and the security cases in the §12 proof table.
