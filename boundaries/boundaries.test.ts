import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vite-plus/test";

// Runs the repo's `.dependency-cruiser.cjs` against `fixtures/`, a miniature of the repo layout in which every
// forbidden import appears once and the allowed ones sit beside them. A rule that stops firing, or one that
// starts flagging a legitimate import, changes this list.

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
const config = fileURLToPath(new URL("../.dependency-cruiser.cjs", import.meta.url));
const cli = fileURLToPath(
  new URL("../node_modules/dependency-cruiser/bin/dependency-cruiser.mjs", import.meta.url),
);

interface Violation {
  rule: string;
  from: string;
  to: string;
}

interface CruiseResult {
  summary: { violations: Array<{ rule: { name: string }; from: string; to: string }> };
}

const expected: Violation[] = [
  // Deep-import rules.
  {
    rule: "entrypoint-boundary-from-app",
    from: "apps/api-server/uses-internals.ts",
    to: "packages/server/lib/impl.ts",
  },
  {
    rule: "entrypoint-boundary-across-packages",
    from: "packages/http-api/index.ts",
    to: "packages/server/lib/impl.ts",
  },
  {
    rule: "tests-through-entrypoints",
    from: "packages/core/tests/deep.ts",
    to: "packages/core/lib/impl.ts",
  },
  {
    rule: "tests-folder-is-private",
    from: "packages/server/index.ts",
    to: "packages/server/tests/helper.ts",
  },
  // Root config files belong to their package's tooling.
  {
    rule: "no-config-imports",
    from: "packages/server/tests/imports-config.ts",
    to: "packages/server/drizzle.config.ts",
  },
  // Cycles, except among shadcn-svelte's vendored components.
  {
    rule: "no-circular",
    from: "packages/core/lib/cycle-a.ts",
    to: "packages/core/lib/cycle-b.ts",
  },
  // Browser-safe code.
  {
    rule: "browser-safe-no-server-libraries",
    from: "packages/api-client/lib/uses-effect.ts",
    to: "effect/http",
  },
  {
    rule: "browser-safe-no-node-builtins",
    from: "packages/renderer/lib/uses-node.ts",
    to: "fs",
  },
  {
    rule: "browser-safe-no-node-builtins",
    from: "apps/reference-host/src/uses-node.ts",
    to: "fs",
  },
  {
    rule: "browser-safe-no-server-packages",
    from: "packages/renderer/lib/uses-server.ts",
    to: "packages/server/index.ts",
  },
  // The dependency matrix, one row at a time.
  {
    rule: "dependency-matrix-core",
    from: "packages/core/lib/uses-api-client.ts",
    to: "packages/api-client/index.ts",
  },
  {
    rule: "dependency-matrix-api-client",
    from: "packages/api-client/lib/uses-core.ts",
    to: "packages/core/definition.ts",
  },
  {
    rule: "dependency-matrix-renderer",
    from: "packages/renderer/lib/uses-editing.ts",
    to: "packages/core/editing.ts",
  },
  {
    rule: "dependency-matrix-renderer",
    from: "packages/renderer/lib/uses-server.ts",
    to: "packages/server/index.ts",
  },
  {
    rule: "dependency-matrix-server",
    from: "packages/server/lib/uses-http-api.ts",
    to: "packages/http-api/index.ts",
  },
  {
    rule: "dependency-matrix-http-api",
    from: "packages/http-api/lib/uses-renderer.ts",
    to: "packages/renderer/index.ts",
  },
  {
    rule: "dependency-matrix-api-server",
    from: "apps/api-server/uses-core.ts",
    to: "packages/core/definition.ts",
  },
  {
    rule: "dependency-matrix-builder",
    from: "apps/builder/src/lib/uses-element.ts",
    to: "packages/renderer/element.ts",
  },
  {
    rule: "dependency-matrix-reference-host-src",
    from: "apps/reference-host/src/uses-renderer-index.ts",
    to: "packages/renderer/index.ts",
  },
  {
    rule: "dependency-matrix-reference-host-src",
    from: "apps/reference-host/src/uses-server-dir.ts",
    to: "apps/reference-host/server/plugin.ts",
  },
  {
    rule: "dependency-matrix-reference-host-server",
    from: "apps/reference-host/server/uses-http-api-index.ts",
    to: "packages/http-api/index.ts",
  },
  // Nothing imports from `apps/`.
  {
    rule: "no-import-of-apps-from-outside",
    from: "e2e/uses-app.ts",
    to: "apps/builder/src/lib/ok.ts",
  },
  {
    rule: "no-import-between-apps",
    from: "apps/api-server/uses-other-app.ts",
    to: "apps/builder/src/lib/ok.ts",
  },
];

const key = ({ rule, from, to }: Violation) => `${rule}: ${from} -> ${to}`;

let actual: Violation[];

beforeAll(() => {
  const run = spawnSync(
    process.execPath,
    [cli, "packages", "apps", "e2e", "--config", config, "--output-type", "json"],
    { cwd: fixtures, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (!run.stdout)
    throw new Error(`depcruise produced no report (exit ${run.status}): ${run.stderr}`);
  const result: CruiseResult = JSON.parse(run.stdout);
  actual = result.summary.violations.map(({ rule, from, to }) => ({ rule: rule.name, from, to }));
});

describe("dependency-cruiser config", () => {
  test.each(expected.map((violation) => [key(violation), violation] as const))(
    "fails %s",
    (_name, violation) => {
      expect(actual.map(key)).toContain(key(violation));
    },
  );

  test("flags nothing else: every allowed import in the fixtures stays clean", () => {
    expect(actual.map(key).toSorted()).toEqual(expected.map(key).toSorted());
  });
});
