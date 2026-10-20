# ADR-011: Anonymous respondents hold host-signed, form-bound grants

- **Status:** Accepted
- **Date:** 2026-10-20

An anonymous respondent is not "a request with no token". It is a request carrying an anonymous grant: a host-signed token with `anonymous: true`, a `tenant` and a `form`, and no subject or capabilities. A request with no token is a 401 on every endpoint. So every actor still belongs to exactly one tenant, the repository keeps its single tenant-scoped path (ADR-007), and the host, not the module, decides who may reach each form (ADR-001 §3.2). This amends ADR-006, which treated a missing token as an anonymous respondent, and ADR-010, which said anonymous callers have no tenant.

The calls a reader is most likely to "fix" by mistake:

- **A grant is marked explicitly, not by a missing `sub`.** A token without `anonymous` still needs `sub`, so a host that forgets `sub` on a respondent token gets a 401, instead of quietly downgrading that respondent to anonymous. Exactly three claim sets are valid: an identified token (`sub` and `capabilities`), an anonymous grant (`anonymous: true` and `form`, with no `sub` or `capabilities`), and nothing else. Every other combination is a 401. `exp` stays required, and the module sets no maximum lifetime; hosts rate-limit and keep grants to minutes (amended 2026-10-20, see ADR-015). `form` must be a UUID, and `sub` and `tenant` are 1 to 255 characters, otherwise 401 `invalid` (amended 2026-10-20, see ADR-015). Both claim sets may also carry `refs`, and an identified token carrying `refs` must carry `form` too (amended 2026-10-20, see ADR-012).
- **A grant covers one form, while identified tokens cover the tenant.** A grant leaked from one page can't reach any other form. A grant used on another form returns 404, as a cross-tenant request does, so it doesn't confirm the other form exists. The use case checks the bound form before any read, and the repository is unchanged. Identified respondent tokens stay tenant-wide, as ADR-006 has them, unless they carry `refs`, which binds them to one form (amended 2026-10-20, see ADR-012).
- **The actor is a tagged union.** It is `Identified { subject, tenant, capabilities }` or `Anonymous { tenant, formId }`. A custom `ActorResolver` must produce the same union. Both variants gain `refs`, and `Identified` gains an optional `formId` (amended 2026-10-20, see ADR-012).
- **A grant works only on load, the answer schema and submit.** Submitting with a grant to a form limited to one response per respondent, and reading or editing a response with a grant, return 401 `Unauthenticated` with `reason: "identityRequired"`. Admin endpoints return 403, because the actor is authenticated but holds no capability, and the check runs before any lookup.
- **The server tells the renderer who it is, and the renderer never decodes the token.** The respondent load returns `respondent: "anonymous" | "identified"`, and `Unauthenticated` carries `reason: "missing" | "invalid" | "identityRequired"`. The renderer's `getToken` is required, receives `{ formId }`, and returns a string, never `null`.

## Considered options

- **Public by form id.** Rejected. Anyone holding the id of an open, unlimited form could load and submit to it. That needs a second, unscoped repository path, breaks "every actor belongs to exactly one tenant", moves the access decision from the host into the module, and turns time-ordered UUIDv7 ids into bearer secrets. A host that wants public forms can still have them by minting grants from an unauthenticated endpoint.
- **A per-form "public" flag in the module.** Rejected: it's public-by-id with an opt-in, and it still needs the unscoped path.
- **Tenant-wide grants.** Rejected: one leaked grant would open every unlimited form in the tenant.
