# Identity, authorization and tenancy seam

Type: grilling
Status: resolved
Blocked by: 07
Map: [Form builder MVP](../map.md)

## Question

How does a host application tell the form module who the actor is, and how are permissions evaluated, without the module assuming an authentication provider (ADR 0001 §9)?

Decide:

- The shape of the actor context the host supplies (actor id, tenant or owner scope, roles or capabilities), and how it reaches the API (header, token, in-process call). The API can run as the standalone server or be mounted in-process as a Fetch handler ([How the chosen stack fits together](./07-how-the-chosen-stack-fits-together.md)), so decide how the actor reaches it in each case. Requests from the browser clients (`openapi-fetch`) carry it the same way in both cases.
- Whether the module evaluates permissions itself, delegates to a host-supplied policy port, or both.
- The tenancy and ownership scope for forms in the MVP.
- How a host-identified respondent's identity reaches the module. Both anonymous and identified respondents are required: editing, the one-per-respondent response limit and deletion by respondent all depend on a stable respondent id ([MVP product calls on the ADR open questions](./05-mvp-product-calls-on-the-adr-open-questions.md)).
- The shape of the renderer's credentials hook: what the function returns, and when the renderer calls it ([Frontend framework and renderer embedding strategy](./06-frontend-framework-and-renderer-embedding-strategy.md)). Also how the standalone builder app establishes the admin actor.
- What the reference host uses as a dev stub, and which unauthorized cases the §12 tests must cover.

## Answer

Recorded as [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md). **Tenant** was added to `GLOSSARY.md`.

- **Seam**: an `ActorResolver` port, an Effect `Layer` behind an `HttpApiMiddleware` bearer scheme, that provides an `Actor { subject, tenant, capabilities }`.
  - The built-in adapter verifies a host-signed JWT against a configured `iss` and `aud`, using either an HS256 shared secret or a JWKS URL.
  - A host that mounts the API in-process as a Fetch handler may swap in its own resolver, for example one that reads the host's session cookie. That resolver must produce the same `Actor`.
  - Browser clients always send `Authorization: Bearer <token>`, whether the API runs standalone or in-process.
- **Token claims** (built-in adapter), all checked strictly:
  - `iss`, `aud` and `exp`, checked against configuration.
  - `sub`, required on every token.
  - `tenant`, an opaque string.
  - `capabilities`, an array.
  - A missing claim or an unknown capability gets a 401. A request with no token at all is an anonymous respondent. A token that is present but invalid or expired is always a 401, never anonymous.
  - Amended by [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md): a request with no token is a 401. An anonymous respondent sends a grant with `anonymous: true`, `tenant` and `form`, and no `sub` or `capabilities`. The actor is `Identified { subject, tenant, capabilities }` or `Anonymous { tenant, formId }`.
  - Amended by [Trust in response external references](./20-trust-in-response-external-references.md) (ADR 0012): both claim sets may carry `refs` (at most 20 `{ namespace, refId }`). An identified token carrying `refs` must also carry `form`, and is then bound to that form. The actor becomes `Identified { subject, tenant, capabilities, formId: Option, refs }` or `Anonymous { tenant, formId, refs }`.
  - Amended by [Personal data classification and erasure](./22-personal-data-classification-and-erasure.md) (ADR 0013): `sub` must be opaque and pseudonymous, never an email or a name, and `tenant` must be opaque and never identify one person. The module can't check either, so the embedding contract states both.
  - Amended by [Request limits and abuse controls](./25-request-limits-and-abuse-controls.md) (ADR 0015): `sub` and `tenant` are 1 to 255 Unicode code points, and `form` must be a UUID. Anything else gives 401 `invalid`. A custom `ActorResolver`'s actor is checked against the same limits. There's no token length cap beyond the server's header limit.
- **Capabilities**: the module enforces them itself, and there's no host policy port.
  - `forms:manage`: create a form, save the draft, publish, and change availability, the response limit and external references.
  - `responses:read`: inspect responses and view analytics.
  - `responses:delete`: hard-delete responses.
  - Respondent actions need no capability. Per-resource policy is out of scope.
- **Tenancy**:
  - Each actor has exactly one opaque tenant.
  - A form records its tenant at creation, from the creating actor, and the tenant never changes. Responses belong to their form's tenant.
  - Anything across a tenant boundary returns 404, never 403.
- **Respondents**: the respondent id is the actor's `sub`, read within the form's tenant.
  - Anonymous respondents can load and submit to open forms whose response limit is unlimited.
  - Forms limited to one response per respondent require an identified respondent, and an anonymous submission gets a 401.
  - Respondents can read and edit only their own responses. Anyone else gets a 404.
  - A respondent from another tenant submitting to a form gets a 404.
  - Amended by [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md): an anonymous grant reaches only its own form, and any other form gets a 404. Identified respondent tokens stay tenant-wide.
- **Renderer credentials hook**: the optional property `getToken: () => string | null | Promise<string | null>`.
  - The renderer calls it before every request (load, submit and edit). The host owns caching and refresh.
  - If it returns `null`, or the property isn't set, the request goes out anonymous.
  - On a 401, the renderer shows an error state: "you need to sign in" if the request was anonymous, "your session expired" otherwise. It doesn't retry.
  - Amended by [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md): `getToken` is required, typed `(ctx: { formId: string }) => string | Promise<string>`, and never returns `null`. The renderer picks the 401 message from the body's `reason` and learns it is anonymous from the load response's `respondent` field, never by decoding the token.
- **Builder admin actor**: a runtime `config.json`, served next to the static app, provides `apiBaseUrl`, `tokenUrl` and `loginUrl`.
  - Before each API call, the builder calls `GET <tokenUrl>` with `credentials: "include"` and expects `{ token }`.
  - If that returns a 401, or the token lacks `forms:manage`, the builder shows a "Sign in" link to `<loginUrl>`.
  - The host's token endpoint must allow the builder's origin through CORS with credentials.
- **Reference host dev stub**: the reference host mounts the API in-process as a Fetch handler. It uses the built-in JWT adapter with an HS256 dev secret, so it follows the same path as the standalone server.
  - A dev user switcher, where `/login` sets a cookie and `/token` mints the JWT, offers these fixed users:
    - `acme-admin`: all three capabilities.
    - `acme-analyst`: `responses:read` only.
    - `globex-admin`: all three capabilities.
    - `alice` and `bob`: respondents in `acme`.
    - Anonymous.
  - Amended by [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md): `/token?project=<id>` mints the anonymous user a grant for that project's tenant and form, looked up on the server, so the browser never picks either.
  - Amended by [Trust in response external references](./20-trust-in-response-external-references.md): for every dev user, `/token?project=<id>` checks that the project is in the user's tenant, then mints `form` and `refs: [{ namespace: "project", refId: <id> }]`. Without `project`, identified users get a tenant-wide token with no `refs`.
  - Amended by [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md): `/token` for the anonymous dev user without `project` gives 401, because a grant needs `form`. The builder already maps that 401 to its "Sign in" link.
  - A custom `ActorResolver` is proven by an integration test, not by the reference host.
- **§12 unauthorized tests**: API integration tests on PGlite, using the JWT adapter with a test secret.
  - No token, or an expired, wrongly signed or wrong-audience token, on admin endpoints gives a 401.
  - Without `forms:manage`, creating a form, saving a draft, publishing, or changing settings or references gives a 403.
  - Without `responses:read`, reading responses or analytics gives a 403. Without `responses:delete`, deleting gives a 403.
  - An admin of another tenant reading or changing a form, its responses or its analytics gives a 404.
  - One respondent reading or editing another respondent's response gives a 404.
  - An anonymous edit, or an anonymous submission to a form limited to one response per respondent, gives a 401.
  - A respondent from another tenant submitting gives a 404.
  - Amended by [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md), which adds the anonymous-grant cases.
  - Plus one Playwright test: the analyst user can't publish from the builder.
