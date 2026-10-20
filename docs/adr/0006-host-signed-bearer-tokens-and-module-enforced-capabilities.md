# ADR-006: Host-signed bearer tokens and module-enforced capabilities

- **Status:** Accepted
- **Date:** 2026-10-19

The module never authenticates anyone. The host authenticates its users and hands the module an actor, which carries a subject, exactly one tenant and a set of module-defined capabilities (`forms:manage`, `responses:read`, `responses:delete`). The subject must be opaque and pseudonymous, never an email or a name, and the tenant opaque (amended 2026-10-20, see ADR-013). Both are 1 to 255 characters, checked again after a custom resolver, and anything longer is a 401 (amended 2026-10-20, see ADR-015). An anonymous respondent's actor carries a tenant and one form instead of a subject and capabilities (amended 2026-10-20, see ADR-011). Either actor may also carry host-asserted response references, which bind it to one form (amended 2026-10-20, see ADR-012). The actor reaches the module through an `ActorResolver` port. The built-in adapter verifies a host-signed JWT bearer token, and a host that mounts the API in-process may replace that adapter. Browser clients send the same bearer token whichever way the API runs. The module enforces tenant isolation and capabilities itself, which keeps ADR-001 §12 "unauthorized users cannot modify forms or access protected responses" testable inside the module.

The calls a reader is most likely to "fix" by mistake:

- **Capabilities are carried in the actor; there is no host policy port.** The host decides who gets which capability when it signs the token. A per-operation `authorize(actor, action, resource)` callback would let hosts express per-form rules, but it would make every module operation depend on host code, and the §12 authorization tests could no longer run without a host. Per-resource policy is out of scope for the MVP. Admin reads (forms, versions, references) accept either `forms:manage` or `responses:read`, and reading the draft needs `forms:manage` (amended 2026-10-20, see ADR-010).
- **A resource in another tenant returns 404, not 403.** This applies to forms, responses and analytics, and to a respondent who submits to a form in another tenant. A 403 would confirm that the id exists.
- **Anonymous respondents are refused (401) on forms limited to one response per respondent.** The limit needs a stable respondent id, so the response limit doubles as the "identified respondents only" rule, and no separate setting is added. Unlimited forms accept anonymous submissions. A token that is present but invalid is always a 401 and is never treated as anonymous. An anonymous respondent holds a host-signed grant bound to one form, and a request with no token is a 401 (amended 2026-10-20, see ADR-011).

## Considered options

- **The module owns login, with OIDC or its own users.** Rejected: ADR-001 §9 forbids assuming an authentication provider, and every host already has its own.
- **An in-process trusted actor only.** Rejected: it can't reach the standalone server or the browser clients.
- **A host-supplied policy port.** Rejected for the reasons above. It can be added later behind the same `Actor` without changing the token.
