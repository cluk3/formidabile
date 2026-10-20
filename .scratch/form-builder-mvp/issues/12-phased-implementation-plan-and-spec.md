# Phased implementation plan and spec

Type: grilling
Status: open
Blocked by: 05, 06, 07, 08, 09, 10, 11
Map: [Form builder MVP](../map.md)

## Question

What is the phased implementation plan from an empty repo to the ADR 0001 §12 bar, and does the resulting spec at `.scratch/form-builder-mvp/spec.md` leave nothing to decide before implementation?

Decide:

- Phase 0 (repo setup) contents: workspace, Vite+, dependency-cruiser, Postgres for local development and tests, Playwright, CI.
- The order of the vertical slices after that (e.g. create and publish, then submit, then historical view, then analytics, then host integration), and the exit criteria of each, tied to the §12 demonstration list.
- Which §12 invariants each phase's automated tests prove.
- Writing the spec itself, ready for `/to-tickets`.
