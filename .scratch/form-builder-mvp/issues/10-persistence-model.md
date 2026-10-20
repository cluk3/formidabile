# Persistence model

Type: grilling
Status: open
Blocked by: 07, 08
Map: [Form builder MVP](../map.md)

## Question

What is the Postgres and Drizzle schema for forms, drafts, form versions, question snapshots, responses, answers and external references, and how does it enforce the ADR 0001 §5 invariants?

Decide:

- Tables and keys, and what is stored as JSONB versus normalised columns (e.g. whether question snapshots are rows or part of a version document).
- How immutability of published versions is enforced (application only, or also at the database level).
- How atomic publication and the current-published-version pointer are implemented.
- Optimistic concurrency for drafts (revision column and conflict behaviour).
- How answers reference question snapshots so historical responses can be rebuilt (ADR §8.1).
- Indexes needed for the MVP analytics (counts by version, choice distributions).
