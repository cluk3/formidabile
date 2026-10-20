# Package layout

Type: grilling
Status: open
Blocked by: 06, 07
Map: [Form builder MVP](../map.md)

## Question

How is the monorepo split into workspace packages and apps so that the ADR 0001 §10 logical boundaries hold, and which package may depend on which?

Decide:

- The packages (e.g. core domain, persistence, API server, API client, renderer core, renderer adapter, builder, analytics) and the apps (e.g. API server app, builder app, reference host).
- The entry points each package exposes, under the deep-module rule.
- The dependency direction between packages (the dependency-cruiser layering rules), e.g. core depends on nothing framework-specific.
- Where shared Zod schemas and the canonical definition live so the builder, renderer and server cannot drift.
