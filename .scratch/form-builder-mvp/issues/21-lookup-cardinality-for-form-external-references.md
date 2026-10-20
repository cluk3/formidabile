# Lookup cardinality for form external references

Type: grilling
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

When a host looks up "the form for entity X", what happens if X is associated with no form, or with several?

- [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md) makes form references a many-to-many association set, so one `{ namespace, refId }` can point at several forms in a tenant.
- [HTTP API surface](./16-http-api-surface.md): `GET /forms?refNamespace=…&refId=…` returns `{ forms: FormSummary[] }`.
- Phase 2 of the spec has the reference host's "form for project X" route mount `<form-renderer>` with _that_ form id, singular.

As things stand, whoever implements the reference host has to invent which form wins.

Decide:

- Whether one reference may point at only one form per tenant, enforced by the module, or several forms are allowed and the host chooses.
- If several are allowed, the rule the reference host uses (for example, only open forms, the most recently updated, or a list for the user to pick from), and whether the module needs anything extra to support it.
- What the reference host shows for zero matches and for several, and the e2e coverage for both.

## Answer

No ADR, no ADR edit and no glossary change: the module's behaviour is unchanged, [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md) already makes form references an association set, and adding uniqueness later is cheap. **External reference** in `GLOSSARY.md` already covers it. Clarifying notes were added to [HTTP API surface](./16-http-api-surface.md) and [Trust in response external references](./20-trust-in-response-external-references.md). The spec is left for [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md).

- **Cardinality: many, and the module never chooses.** One `{ namespace, refId }` may sit on any number of forms in a tenant. What "the form for X" means is host policy about its own entities, which ADR 0001 §3 keeps out of the module. Rejected: a unique index on `(tenant, namespace, refId)` with a new 409 (it imposes one host's meaning on every namespace), and uniqueness opt-in per namespace (it needs a namespace registry).
- **Module surface: unchanged.** `GET /forms?refNamespace=…&refId=…` returns every form in the caller's tenant carrying the reference, as `FormSummary[]` sorted by `updatedAt` descending. An unknown reference returns 200 `{ forms: [] }`, never 404. There's no `availability` or `published` filter: the host filters on `FormSummary` fields, and a filter can be added later without breaking clients.
- **The reference host's rule**: one server-side function, `resolveProjectForm(tenant, projectId)` in `apps/reference-host/server/`, looks up forms by `{ namespace: "project", refId }` and keeps the **candidates**: forms with a current version and `availability: open`. Unpublished forms are dropped because their load gives `FormNotPublished`. Closed forms are dropped so a project that moved from a closed form to a new open one isn't ambiguous. The function returns one of three states:
  - **No candidate**: a static "No open form for this project" page, with no renderer mounted. This includes a project whose only form is closed. The renderer's closed state is covered by its own tests, not by this route.
  - **Exactly one**: the page mounts `<form-renderer>` with that form id, as before.
  - **Several**: a static "ambiguous" page listing the candidates' titles and asking an admin to close or detach all but one, with no renderer mounted. The reference host treats several open forms on one project as a misconfiguration and reports it. Rejected: a picker (the browser would then choose the form, amending ticket 20's guarantee, for a feature the §12 bar doesn't need) and a tie-break such as the newest `publishedAt` (arbitrary, and publishing another form would silently change what respondents see).
- **`/token?project=<id>`** calls the same `resolveProjectForm`. So the page and the token can't disagree, and the browser still never names the form. It mints `form` and `refs` only for exactly one candidate. For zero or several it gives 404, after the existing check that the project belongs to the user's tenant.
- **Admin screen (phase 4)**: attaching a project to a second open form shows no warning. The project page's ambiguous state is where the misconfiguration shows.
- **Demo seed**: still one form per demo project. Tests seed their own zero-form and multi-form projects.
- **`docs/embedding.md`** (phase 2) states that the lookup returns every form carrying the reference, that an unknown reference gives an empty list, and that choosing among them is the host's job.
- **Tests**:
  1. `http-api`: one reference on two forms in the same tenant returns both. The same reference on a form in another tenant isn't returned. An unknown reference gives 200 with an empty list.
  2. Reference host, Vitest: a table test of `resolveProjectForm` covering no forms, only unpublished, only closed, one open, open plus closed (the open one is chosen), and two open (ambiguous).
  3. Reference host server, Vitest: `/token?project=<id>` gives 404 for zero and for several candidates, and mints `form` and `refs` for exactly one.
  4. Playwright, renderer project (all three browsers), next to the existing "form for project X" test: one test for the zero page and one for the ambiguous page. Each seeds its own project and forms through the API and asserts that no `<form-renderer>` is mounted.
