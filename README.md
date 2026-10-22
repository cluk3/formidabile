# Formidabile

A reusable, host-agnostic module for defining forms, publishing immutable versions of them, collecting responses against a specific version, and analysing those responses. See [GLOSSARY.md](./GLOSSARY.md) for the vocabulary.

## Prerequisites

- **The global `vp` CLI** ([Vite+](https://viteplus.dev)). Every command below starts with it.
- **Node.js 24.20.0**, as pinned in `.node-version`. `vp` can install and manage it for you.
- **Docker with Compose v2**, for the local Postgres. Only the API server and the Postgres tests need it; `vp test` doesn't.

## Set up

1. Install `vp`, then open a new shell and check it with `vp help`:

   ```bash
   curl -fsSL https://vite.plus | bash
   ```

   The installer offers to manage Node.js and pnpm through its own shims, which picks up this repo's pinned versions automatically. To keep your own Node.js and pnpm, install with `VP_NODE_MANAGER=no VP_PM_MANAGER=no` before `bash` instead.

2. Install dependencies:

   ```bash
   vp install
   ```

   This uses the pinned pnpm 12.14.0 and installs the pre-commit hook, which runs `vp check --fix` on staged files.

3. Start Postgres 18 on `localhost:5432` (user, password and database are all `formidabile`):

   ```bash
   vp run postgres
   ```

   Stop it with `docker compose down`.

## Run the API server

```bash
DATABASE_URL=postgres://formidabile:formidabile@localhost:5432/formidabile \
JWT_ISSUER=http://localhost JWT_AUDIENCE=form-module JWT_SECRET=dev-secret \
vp run @fb/api-server#dev
```

It starts Postgres if it isn't running, applies migrations, listens on `PORT` (default 3000), and restarts when files change. It accepts bearer tokens signed for `JWT_ISSUER` and `JWT_AUDIENCE`, with the HS256 secret `JWT_SECRET`, or with the keys at `JWT_JWKS_URL` when there's no secret.

It serves the same API as `createFormModuleHandler` from `@fb/http-api/web`, the Fetch handler a host mounts. `apps/api-server/tests/parity.test.ts` holds both to that: it sends one table of requests through the server on an ephemeral port and through the handler, on one PGlite database, and expects equal status, `content-type` and body. When behaviour lands that either mode could serve differently, add a row.

## Check and test

| Command             | What it runs                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| `vp check`          | Format, lint and type-check                                                   |
| `vp run boundaries` | The package boundary rules (dependency-cruiser)                               |
| `vp test`           | Unit tests on an in-process PGlite database, with no Docker                   |
| `vp run test:pg`    | The `*.pg.test.ts` tests on real Postgres, starting the compose service first |
| `vp run ready`      | Every CI gate. Run it before opening a PR                                     |

`test:pg` uses the compose database unless you set `DATABASE_URL`.

## Try it by hand

```bash
vp run demo
```

It resets the database to the demo data and serves the [reference host](./apps/reference-host/README.md) on http://localhost:4173 and the builder on http://localhost:4174. Ctrl+C stops both. `vp run demo:keep` starts them without resetting. [docs/manual-testing.md](./docs/manual-testing.md) is a walkthrough of what to try.

## Demo data

```bash
vp run @fb/reference-host#seed:reset
```

It wipes the module's schema in the compose database (or `DATABASE_URL`'s) and seeds a demo project each for the `acme` and `globex` dev tenants: one open form carrying the project's reference, with a response from a dev user and one from the anonymous user. `acme` also gets the "Onboarding survey", whose four versions drop a question, add and relabel options, widen a number range and replace a question with a new one, with responses from `alice`, `bob` and anonymous respondents: open its analytics in the builder to see the per-version breakdown. `vp run e2e` runs it first.

The reference host shows "the form for project X" at `http://localhost:4173/projects/<id>`, for the demo projects `acme-spring-orders` and `globex-partner-summit`. A project's id starts with its tenant and a `-`, so any `acme-…` id is an `acme` project: attach one to forms as the `project` reference to try the "no open form" and "ambiguous" pages.

Signed in as `acme-admin` or `globex-admin`, `http://localhost:4173/admin` manages your tenant's demo project: add the project's reference to a form or remove it, and list the responses submitted under the project. `/admin?project=<id>` does the same for any project in your tenant.

## Without the global `vp`

The `vite-plus` dev dependency puts a project-local `vp` in `node_modules/.bin`, so `pnpm vp <command>` works too.

## Further reading

- [packages/README.md](./packages/README.md): how the packages are laid out, and the database and migration rules.
- [apps/reference-host/README.md](./apps/reference-host/README.md): the host used for manual testing and e2e.
- [docs/manual-testing.md](./docs/manual-testing.md): a hands-on walkthrough of the whole product.
- [docs/embedding.md](./docs/embedding.md): how a host embeds the renderer or writes its own.
- [AGENTS.md](./AGENTS.md): instructions for coding agents.
- [docs/embedding.md](./docs/embedding.md): the host-facing contract for embedding the renderer or writing your own.
- [docs/adr/](./docs/adr/): architecture decisions.
