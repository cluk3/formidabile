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
DATABASE_URL=postgres://formidabile:formidabile@localhost:5432/formidabile vp run @fb/api-server#dev
```

It starts Postgres if it isn't running, applies migrations, listens on `PORT` (default 3000), and restarts when files change.

## Check and test

| Command             | What it runs                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| `vp check`          | Format, lint and type-check                                                   |
| `vp run boundaries` | The package boundary rules (dependency-cruiser)                               |
| `vp test`           | Unit tests on an in-process PGlite database, with no Docker                   |
| `vp run test:pg`    | The `*.pg.test.ts` tests on real Postgres, starting the compose service first |
| `vp run ready`      | Every CI gate. Run it before opening a PR                                     |

`test:pg` uses the compose database unless you set `DATABASE_URL`.

## Without the global `vp`

The `vite-plus` dev dependency puts a project-local `vp` in `node_modules/.bin`, so `pnpm vp <command>` works too.

## Further reading

- [packages/README.md](./packages/README.md): how the packages are laid out, and the database and migration rules.
- [AGENTS.md](./AGENTS.md): instructions for coding agents.
- [docs/adr/](./docs/adr/): architecture decisions.
