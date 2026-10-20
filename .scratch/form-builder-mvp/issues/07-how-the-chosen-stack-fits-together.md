# How the chosen stack fits together

Type: grilling
Status: open
Blocked by: 01, 02, 03, 04
Map: [Form builder MVP](../map.md)

## Question

Given the research on [Vite+ toolchain for a pnpm monorepo](./01-vite-plus-toolchain-for-a-pnpm-monorepo.md), [Effect v4 HTTP API and OpenAPI contract](./02-effect-v4-http-api-and-openapi-contract.md), [Effect v4 with Drizzle and Postgres](./03-effect-v4-with-drizzle-and-postgres.md) and [Zod 4 alongside Effect Schema](./04-zod-4-alongside-effect-schema.md), lock the integration choices:

- Where Zod 4 is used and where Effect Schema is used, and how the canonical definition crosses the HTTP boundary.
- Which Effect plus Drizzle integration path and Postgres driver.
- How the API contract is published to hosts (OpenAPI, typed client, or both).
- The test-database approach for integration tests.
- Any Vite+ caveats that shape the repo setup.
