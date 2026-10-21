// @ts-check
// Package boundaries, enforced by `vp run boundaries`. packages/README.md explains them.
//
// Every folder under `packages/` is a deep module: its root files are its entry points and anything in a
// subfolder is private. Apps under `apps/` are not modules, but they import packages the same way.
// Rule names are asserted by `boundaries/boundaries.test.ts`, which runs this file against `boundaries/fixtures/`.

const PACKAGES = "packages";
const APPS = "apps";

/** A package's private internals: anything nested inside a package subfolder. Root files stay importable. */
const PACKAGE_INTERNALS = `^${PACKAGES}/[^/]+/[^/]+/`;

const TESTS = "(^|/)tests/";

/** Tooling config at a package or app root (`vite.config.ts`, `drizzle.config.ts`). Not part of any public surface. */
const CONFIG_FILE = "\\.config\\.ts$";

// Resolved paths run through pnpm's store (`node_modules/.pnpm/effect@…/node_modules/effect/…`), and an
// unresolved import is matched by its specifier, so both shapes are covered.
const npmPackages = (/** @type {string} */ names) => `(^|/node_modules/)(${names})(/|$)`;

/** Code that runs in the browser. Tests and tooling config around it run in Node. */
const BROWSER_SAFE = {
  path: [
    `^${PACKAGES}/(core|api-client|renderer)/`,
    `^${APPS}/builder/`,
    `^${APPS}/reference-host/src/`,
  ],
  pathNot: [TESTS, CONFIG_FILE],
};

/**
 * Which code may import which workspace code. Anything else under `packages/` is forbidden, whatever the
 * entry point; the deep-import rules police the entry points themselves. Tests are exempt: integration tests
 * may use any package.
 *
 * @type {Array<{ name: string; from: string; allow: string[]; to?: string }>}
 */
const matrix = [
  { name: "core", from: `^${PACKAGES}/core/`, allow: [] },
  { name: "api-client", from: `^${PACKAGES}/api-client/`, allow: [] },
  {
    name: "renderer",
    from: `^${PACKAGES}/renderer/`,
    allow: [`^${PACKAGES}/core/(definition|answers)\\.ts$`, `^${PACKAGES}/api-client/`],
  },
  { name: "server", from: `^${PACKAGES}/server/`, allow: [`^${PACKAGES}/core/`] },
  {
    name: "http-api",
    from: `^${PACKAGES}/http-api/`,
    allow: [`^${PACKAGES}/(server|core)/`],
  },
  {
    name: "api-server",
    from: `^${APPS}/api-server/`,
    allow: [`^${PACKAGES}/(http-api|server)/`],
  },
  {
    // The renderer's component, not its element.
    name: "builder",
    from: `^${APPS}/builder/`,
    allow: [`^${PACKAGES}/(core|api-client)/`, `^${PACKAGES}/renderer/index\\.ts$`],
  },
  {
    // `src/` is the browser page and `server/` the Node plugin, so neither may reach into the other.
    name: "reference-host-src",
    from: `^${APPS}/reference-host/src/`,
    to: `^(${PACKAGES}/|${APPS}/reference-host/server/)`,
    allow: [`^${PACKAGES}/renderer/element\\.ts$`, `^${PACKAGES}/api-client/`],
  },
  {
    name: "reference-host-server",
    from: `^${APPS}/reference-host/server/`,
    to: `^(${PACKAGES}/|${APPS}/reference-host/src/)`,
    allow: [`^${PACKAGES}/http-api/web\\.ts$`],
  },
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // --- Deep modules: import only through entry points -----------------------------------------
    {
      name: "entrypoint-boundary-from-app",
      comment:
        "App code may import a package's entry points (its root files), but nothing inside its subfolders.",
      severity: "error",
      from: { pathNot: `^${PACKAGES}/` },
      to: { path: PACKAGE_INTERNALS },
    },
    {
      name: "entrypoint-boundary-across-packages",
      comment:
        "A package's own files import each other freely, but reach another package only through its entry points.",
      severity: "error",
      from: { path: `^${PACKAGES}/([^/]+)/`, pathNot: `^${PACKAGES}/[^/]+/tests/` },
      to: { path: PACKAGE_INTERNALS, pathNot: `^${PACKAGES}/$1/` },
    },
    {
      name: "tests-through-entrypoints",
      comment:
        "Tests exercise a package through its entry points like everyone else: any package's entry points and their own tests/ fixtures, never any package's internals, not even their own.",
      severity: "error",
      from: { path: `^${PACKAGES}/([^/]+)/tests/` },
      to: { path: PACKAGE_INTERNALS, pathNot: `^${PACKAGES}/$1/tests/` },
    },
    {
      name: "tests-folder-is-private",
      comment:
        "A package's tests/ folder is reachable only from tests: nothing else imports fixtures.",
      severity: "error",
      from: { pathNot: `^${PACKAGES}/[^/]+/tests/` },
      to: { path: `^${PACKAGES}/[^/]+/tests/` },
    },
    {
      name: "no-config-imports",
      comment:
        "Root config files (`vite.config.ts`, `drizzle.config.ts`) are a package's tooling, not entry points. Nothing imports them.",
      severity: "error",
      from: {},
      to: { path: CONFIG_FILE },
    },
    {
      // A vendored shadcn-svelte component may import its siblings in a cycle.
      name: "no-circular",
      comment: "No dependency cycles, except among shadcn-svelte's vendored components/ui/.",
      severity: "error",
      from: { pathNot: "(^|/)components/ui/" },
      to: { circular: true, pathNot: "(^|/)components/ui/" },
    },

    // --- Browser-safe code ----------------------------------------------------------------------
    {
      name: "browser-safe-no-server-libraries",
      comment: "Browser-safe code never imports Effect, Drizzle or jose.",
      severity: "error",
      from: BROWSER_SAFE,
      to: { path: npmPackages("effect|@effect/[^/]+|drizzle-orm|jose") },
    },
    {
      name: "browser-safe-no-node-builtins",
      comment: "Browser-safe code never imports Node built-ins.",
      severity: "error",
      from: BROWSER_SAFE,
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "browser-safe-no-server-packages",
      comment: "Browser-safe code never imports @fb/server or @fb/http-api.",
      severity: "error",
      from: BROWSER_SAFE,
      to: { path: `^${PACKAGES}/(server|http-api)/|^@fb/(server|http-api)(/|$)` },
    },

    // --- Which workspace code may depend on which ------------------------------------------------
    ...matrix.map(({ name, from, allow, to = `^${PACKAGES}/` }) => ({
      name: `dependency-matrix-${name}`,
      comment: `Workspace code ${name} may import only ${allow.length ? allow.join(", ") : "nothing else in the workspace"}. The matrix is in packages/README.md.`,
      severity: /** @type {const} */ ("error"),
      from: { path: from, pathNot: TESTS },
      to: { path: to, pathNot: [from, ...allow] },
    })),
    {
      name: "no-import-of-apps-from-outside",
      comment: "Nothing outside an app imports from apps/.",
      severity: "error",
      from: { path: `^(${PACKAGES}|e2e)/` },
      to: { path: `^${APPS}/` },
    },
    {
      name: "no-import-between-apps",
      comment: "An app never imports another app.",
      severity: "error",
      from: { path: `^${APPS}/([^/]+)/` },
      to: { path: `^${APPS}/`, pathNot: `^${APPS}/$1/` },
    },
  ],
  options: {
    // Build output and generated types are not source, and the renderer's `./element` export points into dist/.
    exclude: { path: "(^|/)(dist|\\.svelte-kit)/" },
    doNotFollow: { path: "node_modules" },
    // Counts `import type`, which a compiled module no longer has.
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      // `source` first, as in `tsconfig.base.json`'s `customConditions`, so packages resolve to their TypeScript.
      conditionNames: ["source", "svelte", "import", "node", "default"],
      extensions: [".ts", ".js", ".svelte", ".json"],
    },
  },
};
