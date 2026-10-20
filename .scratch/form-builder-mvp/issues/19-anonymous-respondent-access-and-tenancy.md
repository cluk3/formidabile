# Anonymous respondent access and tenancy

Type: grilling
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

How does a request with no actor reach a form when the module isolates tenants?

The decisions disagree today:

- [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md): every actor belongs to exactly one tenant, and a request with no token is an anonymous respondent.
- [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md) and [Persistence model](./10-persistence-model.md): every repository function takes a branded `TenantId` and reaches everything through a join on `forms … WHERE tenant = $t`.
- [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md): `GET /respond/forms/{formId}` and the submit endpoint accept anonymous respondents on unlimited forms. The same ADR rejects a respondent lookup by reference because anonymous callers "have no tenant".

So the anonymous path has no tenant to pass, and quietly looking the form up by id alone would weaken isolation without anyone deciding it.

Options to weigh:

- **Public by form id**: anyone holding the id of an open, unlimited form can load and submit to it. The repository gets one explicit unscoped respondent path, and the docs state the weaker guarantee. Decide whether form ids are then treated as secrets (UUIDv7 ids are time-ordered).
- **A host-signed anonymous grant**: a token with no subject that carries the tenant, and maybe the form id, so "anonymous" means "a valid token without a subject", never "no token".
- Another mechanism.

Decide also:

- What the renderer's `getToken` contract and the builder's preview become.
- Which ADRs and tickets are amended (ADR 0006, ADR 0007, ADR 0010, [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md), [Persistence model](./10-persistence-model.md), [HTTP API surface](./16-http-api-surface.md), the `docs/embedding.md` contract).
- The unauthorized tests that prove the chosen rule, including an anonymous request to another tenant's form.

## Answer

Recorded as [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md), which amends [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md) and [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md) with inline notes. ADR 0007 is unchanged. **Identified respondent** and **Anonymous respondent** were added to `GLOSSARY.md`. Amendment notes were added to [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md) and [HTTP API surface](./16-http-api-surface.md). The spec is left for [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md) to fold in.

- **Mechanism: a host-signed anonymous grant.** "Anonymous" means a valid token without a subject, never "no token". A request with no token is a 401 on every endpoint. Every actor keeps exactly one tenant, and the repository keeps its single tenant-scoped path. Public access by form id was rejected: it needs an unscoped repository path, breaks the glossary's tenant rule, moves the access decision from the host into the module, and turns UUIDv7 ids into secrets. A host that wants public forms mints grants from an unauthenticated endpoint of its own.
- **Claims** (built-in JWT adapter). Exactly two claim sets are valid, and anything else is a 401 `invalid`:
  - Identified: `iss`, `aud`, `exp`, `sub`, `tenant`, `capabilities` (unchanged).
  - Anonymous grant: `iss`, `aud`, `exp`, `anonymous: true`, `tenant`, `form`, with no `sub` and no `capabilities`.
  - A token with no `sub` and no `anonymous` claim is a 401, so a host bug never quietly downgrades a respondent to anonymous.
  - `exp` is required, with no module-imposed maximum. `docs/embedding.md` recommends short-lived grants.
- **Form binding**: a grant covers one form. Using it on any other form, in the same tenant or another, gives 404. Identified respondent tokens stay tenant-wide, with no optional `form` claim.
- **Actor**: `Identified { subject, tenant, capabilities } | Anonymous { tenant, formId }`. A custom `ActorResolver` must produce the same union. The respondent use cases check `actor.formId === formId` before any read and return `NotFound` on a mismatch. Repository signatures don't change.
- **Where a grant works**:

  | Endpoint                                                         | With an anonymous grant                                                                             |
  | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
  | `GET /respond/forms/{formId}`                                    | 200 for the bound form, with `respondent: "anonymous"`                                              |
  | `GET /respond/forms/{formId}/versions/{versionId}/answer-schema` | 200 for the bound form                                                                              |
  | `POST /respond/forms/{formId}/responses`                         | 201 on an unlimited form, stored with no respondent id. A limited form gives 401 `identityRequired` |
  | `GET` and `PUT /respond/responses/{responseId}`                  | 401 `identityRequired`                                                                              |
  | Any admin endpoint                                               | 403 `Forbidden`, checked before any lookup                                                          |

- **API changes** (amending HTTP API surface):
  - The respondent load adds `respondent: "anonymous" | "identified"`.
  - `Unauthenticated` (401) adds `reason`: `missing` (no token), `invalid` (bad signature, expired, or a malformed claim set) or `identityRequired` (a grant used where an identified respondent is needed).
- **Renderer**: `getToken` is required, typed `(ctx: { formId: string }) => string | Promise<string>`, and called before every request. It never returns `null`. A plain `() => token` still satisfies the type. The renderer never decodes the token: it prompts for sign-in from `respondent` and `responseLimit`, and picks the 401 message from `reason` ("sign in" for `missing` and `identityRequired`, "session expired" for `invalid`).
- **Preview**: unchanged. It never calls the API.
- **Reference host**: the page's `getToken` calls `/token?project=<id>`. For the anonymous dev user, the host mints a grant for that project's tenant and the form it looked up on the server, so the browser never chooses either. Identified dev users ignore the parameter. Amended by [Trust in response external references](./20-trust-in-response-external-references.md): identified dev users no longer ignore it. Every dev user gets a token bound to the project's form, carrying the project as `refs`.
- **Demo seed**: it creates anonymous responses through the API, using grants it signs with the dev secret.
- **Tests**:
  - API integration tests (PGlite, JWT adapter with a test secret):
    1. Load or submit with no token gives 401 `missing`.
    2. A grant for form A used on form B in the same tenant gives 404 on load, answer schema and submit.
    3. A grant for `acme` used on a `globex` form gives 404, even when its `form` claim names that form.
    4. `anonymous` with `sub`, `anonymous` with `capabilities`, `anonymous` without `form`, and a token with neither `sub` nor `anonymous` each give 401 `invalid`.
    5. A grant on a form limited to one response per respondent loads it with `respondent: "anonymous"`, and submitting gives 401 `identityRequired`.
    6. A grant on `GET` or `PUT /respond/responses/{id}` gives 401 `identityRequired`. This replaces "an anonymous edit gives 401".
    7. A grant on an admin endpoint gives 403.
    8. A grant submitting to its open, unlimited form gives 201, and the stored response has no respondent id.
    9. The custom `ActorResolver` integration test also produces an `Anonymous` actor that passes the same checks.
  - Renderer component tests: `getToken` receives `{ formId }`, the sign-in prompt is driven by `respondent: "anonymous"`, and each `reason` maps to its message.
  - Playwright: the anonymous dev user on the reference host submits to an unlimited form, and is prompted to sign in on a form limited to one response per respondent.
