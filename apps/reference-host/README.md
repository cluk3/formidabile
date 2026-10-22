# Reference host

A small host application for trying the form module by hand and for the Playwright suite. It does what a real host does and nothing more:

- mounts the module's API in-process at `/api`;
- signs in dev users and mints the JWTs the module expects;
- embeds `<form-renderer>` on a "form for project X" page;
- manages a project's form references and lists its responses.

It is not a product. The signing secret is public, and "signing in" means picking a user from a list.

## Run it

From the repository root, with Docker running:

```bash
vp run demo
```

This starts Postgres, wipes and re-seeds the demo data, builds both apps, and previews them:

| App            | URL                   |
| -------------- | --------------------- |
| Reference host | http://localhost:4173 |
| Builder        | http://localhost:4174 |

Press Ctrl+C to stop both. `vp run demo:keep` starts the same servers without touching the data, so you can restart without losing what you created. Both ports are fixed: the builder's `config.json` points at 4173, and the host's CORS list allows only 4174.

The host runs through `vp preview`, not `vp dev`, because only preview serves the strict Content Security Policy (ADR 0008). The dev server injects CSS as `<style>` elements, which that policy blocks. After a code change, stop the demo and start it again: preview builds first, but doesn't watch.

`vp run e2e` starts the same two servers and reuses any that are already listening, and it resets the database first. Stop the demo before running it.

[docs/manual-testing.md](../../docs/manual-testing.md) walks through what to try.

## Pages and routes

| Path                  | What it does                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                   | Links to the demo projects, the sign-in page and the admin page.                                                                                                   |
| `/login`              | The dev user switcher. `POST` sets the `dev-user` cookie (or clears it for anonymous) and redirects to `return`, which must be a path on this host or the builder. |
| `/token`              | `{ token }`: a five-minute, tenant-wide identified token for the signed-in user. 401 for the anonymous user. The builder reads this with its cookie.               |
| `/token?project=<id>` | A token bound to the project's one open form, carrying the project's reference. See below.                                                                         |
| `/projects/<id>`      | "The form for project X": mounts `<form-renderer>` when exactly one published, open form carries the project's reference.                                          |
| `/admin`              | Add and remove a project's form references, and list the responses submitted under it. Tenant admins only. `/admin?project=<id>` picks another project.            |
| `/api/*`              | The module's HTTP API. The `/api` prefix is removed before the module sees the path, and the schema is migrated before the first request.                          |

### Projects

The host keeps no project records. A project id starts with its tenant and a `-`, so any `acme-…` id is an `acme` project. The demo projects are `acme-spring-orders` and `globex-partner-summit`.

A project's form is found by its external reference: `{ namespace: "project", refId: <id> }`. `/projects/<id>` shows:

- the form, for exactly one published, open candidate;
- a static "No open form for this project" page, for none;
- an "ambiguous" page listing the candidates' titles, for several.

`/token?project=<id>` mints a token only in the same cases: 404 for none or several candidates, 404 for an id that names no tenant, and 403 for a signed-in user from another tenant. For one candidate, the token carries `form` and `refs`: identified for a signed-in user, and an anonymous grant expiring after five minutes for the anonymous user.

## Dev users

The users, their tenants and their capabilities are in [`server/dev-users.ts`](./server/dev-users.ts):

| User           | Tenant   | Capabilities                                         |
| -------------- | -------- | ---------------------------------------------------- |
| `acme-admin`   | `acme`   | `forms:manage`, `responses:read`, `responses:delete` |
| `acme-analyst` | `acme`   | `responses:read`                                     |
| `globex-admin` | `globex` | `forms:manage`, `responses:read`, `responses:delete` |
| `alice`        | `acme`   | none (a respondent)                                  |
| `bob`          | `acme`   | none (a respondent)                                  |
| anonymous      | none     | none (a form-bound grant only)                       |

Tokens are signed with HS256, issuer `reference-host`, audience `form-module`, and the public secret in `dev-users.ts`.

## Demo data

`vp run @fb/reference-host#seed:reset` drops the `form_management` schema and seeds it again, through the module's own API and never with direct inserts. Published forms can't be deleted, so a reset is the only way back to a clean demo.

- Each of `acme` and `globex` gets a demo project with one open form carrying the project's reference, a response from a dev user and one from the anonymous user.
- `acme` also gets the "Onboarding survey". Its four versions drop a question, add and relabel options, widen a number range and reidentify a question, with responses from `alice`, `bob` and anonymous respondents. Its analytics show every cross-version case.

No test depends on this data.

## Configuration

| Variable       | Default                                                         | Used for                           |
| -------------- | --------------------------------------------------------------- | ---------------------------------- |
| `DATABASE_URL` | `postgres://formidabile:formidabile@localhost:5432/formidabile` | The API, the seed and `seed:reset` |

`seed:reset` runs `psql` through `docker compose exec` on the compose Postgres, so it expects that service even when `DATABASE_URL` points elsewhere.

## Layout

| Path      | Contents                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| `server/` | The Vite plugin (`plugin.ts`) and the routes it serves (`host.ts`), dev users and tokens, project resolution. |
| `src/`    | The browser code of the project page and the admin page.                                                      |
| `seed/`   | The demo seed.                                                                                                |
| `tests/`  | Vitest tests: routes, token minting, project resolution, the admin page and the seed.                         |

Run its tests with `vp test apps/reference-host`. The Playwright specs that drive it are in `e2e/renderer/`.

## Further reading

- [docs/embedding.md](../../docs/embedding.md): what a real host does, which this one imitates.
- [packages/README.md](../../packages/README.md): the dev users and the seed in the context of the whole repository.
- [ADR 0011](../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md) and [ADR 0012](../../docs/adr/0012-response-references-are-host-signed-claims.md): why tokens are bound to a form and carry references.
