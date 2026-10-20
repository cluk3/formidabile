# ADR-015: The module bounds request sizes; hosts bound rates and connections

- **Status:** Accepted
- **Date:** 2026-10-20

The module refuses requests that are too big, and leaves everything that needs traffic state or owns the connection to the host. It enforces a total body limit per kind of endpoint, length caps on identity claims and identifiers, and a database statement timeout. It does no rate limiting, sets no maximum grant lifetime, and adds no handler timeout. Rate limits need state shared across instances and knowledge of the host's proxies, which only the host has (ADR-001 §3). The size limits are part of the module's contract, so they hold identically whether the API runs as the standalone server or as a Fetch handler mounted by a host. This amends ADR-005 (email cap), ADR-006 and ADR-011 (claim limits), ADR-010 (two new error rows) and ADR-012 (how reference lengths are counted).

The calls a reader is most likely to "fix" by mistake:

- **Body limits are totals below the worst case, not derived from the field caps.** Bodies carrying a form definition (create, draft save) or answers (submit, edit) may be at most 1 MiB of UTF-8, and every other request body at most 16 KiB. A definition at every ADR-005 cap at once is about 6 MB of ASCII and more in non-Latin text, and a submission about 2 MB, so the caps can't all be reached together. 1 MiB is about 50 times a realistic form and bounds memory per request; going over it is refused, not supported.
- **A body must declare its length.** A request with a body and no `Content-Length` gets 411 `LengthRequired`. A declared length over the endpoint's limit gets 413 `PayloadTooLarge { limit }`, before any of the body is read. HTTP/1.1 framing makes Node deliver exactly the declared bytes, so on every request reaching a Node server, in either serving mode, the declared length is the true one. Effect's `MaxBodySize` is deliberately not used: it is ignored on the `toWebHandler` path, and on the Node server exceeding it resets the connection instead of answering.
- **Claims are capped and checked again after a custom resolver.** `sub` and `tenant` are 1 to 255 characters and `form` must be a UUID, otherwise 401 `Unauthenticated` with `reason: "invalid"`. A custom `ActorResolver` is held to the same limits. The `respondentId` path parameter and filter are 1 to 255 characters, otherwise 422. An email answer is at most 254 characters (RFC 5321).
- **Every character cap counts Unicode code points.** Zod, JSON Schema and Postgres `char_length` already count code points; Effect Schema's built-in length check counts UTF-16 units, so the module's Effect Schema caps use one shared code-point check instead. Body limits are bytes.
- **There is no token length cap.** The serving Node server's header limit (16 KiB by default, 431 above it) already bounds a token. A `refs` claim near its ADR-012 limits can exceed common header limits, so hosts keep references short.
- **Timeouts sit where the connection and the database are.** The standalone server sets `headersTimeout` to 10 s and `requestTimeout` to 30 s. Under the Fetch handler the host's server owns them. The module's Postgres connections set `statement_timeout` to 30 s in both modes, and a client disconnect already interrupts the handler on both paths.
- **The volumes are advisory.** The demo-scale envelope (100 forms per tenant, 10,000 responses per form) is still not enforced, as decided in Expected load and data volumes.

## Considered options

- **Body limits large enough for every model-valid input.** Rejected: about 20 MB for definitions and 8 MB for answers, held in memory per request, and about 2 MB of storage per anonymous submission.
- **A serialized-size cap in the core model.** Rejected: a new model rule, and a "your answers are too long overall" message in the renderer, for a limit nobody realistic reaches.
- **Counting streamed bytes in the module.** Rejected for the MVP: it needs untested plumbing to hand Effect a buffered request, only to keep chunked uploads that no client of the module sends.
- **Rate limiting in the module, by IP or by grant.** Rejected: it needs shared state, breaks behind proxies, and duplicates what every host's edge already does. Making anonymous grants single-use is left to the retries and idempotency decision (amended 2026-10-20, see ADR-016: rejected, grants stay reusable until they expire).
- **A handler timeout middleware.** Rejected: a second limit competing with the statement timeout.
