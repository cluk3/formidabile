# Revise the phased plan and spec

Type: grilling
Status: open
Blocked by: 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29
Map: [Form builder MVP](../map.md)

## Question

With the reopened decisions resolved, what changes in [`spec.md`](../spec.md) so that it again leaves nothing to decide before `/to-tickets`?

Fold in every decision from the reopened tickets: phase contents, deliverables, the seed, and the §12 proof table. Also close the acceptance-criteria gaps the readiness audit found:

- **Accessibility**: axe can't prove full keyboard use or focus moving to the first error ([Frontend framework and renderer embedding strategy](./06-frontend-framework-and-renderer-embedding-strategy.md)). Name the tests that do.
- **Concurrent save and publish**: phase 1 says the race gives `RevisionConflict` and exactly one new version, but not which interleaving wins, or when the loser should get `NoDraft` instead.
- **Security cases**: malformed and oversized tokens and bodies, forged references and retried submissions, according to how the reopened tickets resolved them.
- **The embedding contract as a whole**: [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md) and [Trust in response external references](./20-trust-in-response-external-references.md) both moved it. Re-read the element's inputs, `getToken`, the reference guarantee and custom-renderer items 1 to 7 together, and state in one place what phase 2's `docs/embedding.md` contains.
- **The standalone server**: `apps/api-server` is covered by one startup request. Decide whether that's enough for the second way of serving the API.

Then check the map's **Not yet specified** section is empty before handing off.
