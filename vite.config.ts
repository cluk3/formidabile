import { configDefaults, defineConfig } from "vite-plus";

const generatedFiles = ["packages/http-api/openapi.json", "packages/api-client/lib/schema.d.ts"];

const generatedPaths = generatedFiles.join(" ");

const ignorePatterns = [
  ".agents/**",
  ".claude/**",
  ".scratch/**",
  // Deliberately broken imports for `.dependency-cruiser.cjs`'s own test.
  "boundaries/fixtures/**",
  "packages/server/lib/persistence/migrations/**",
  ...generatedFiles,
];

// shadcn-svelte's generated components are vendored: the CLI owns their formatting and they aren't linted.
const lintIgnorePatterns = [...ignorePatterns, "apps/builder/src/lib/components/ui/**"];

// Tests on real Postgres run only under `test:pg`, which sets TEST_POSTGRES, so `vp test` needs no Docker.
const postgresTests = "**/*.pg.test.ts";
const testPostgres = process.env.TEST_POSTGRES === "1";

// The docker-compose.yml service. CI and local runs use it unless DATABASE_URL says otherwise.
const composeDatabaseUrl = "postgres://formidabile:formidabile@localhost:5432/formidabile";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    svelte: true,
    ignorePatterns,
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: lintIgnorePatterns,
    overrides: [
      {
        // dependency-cruiser sees a `.svelte` file only after Svelte compiles it, which erases `import type`, so
        // a type-only deep import there gets past it. This rule catches it. Every import is checked, not only types.
        files: ["**/*.svelte"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                {
                  group: [
                    "@fb/*/*/**",
                    "@fb/*/lib",
                    "@fb/*/lib/**",
                    "@fb/*/tests",
                    "@fb/*/tests/**",
                  ],
                  message:
                    "Import a package through its entry points, such as `@fb/core/definition`, never its subfolders.",
                },
                {
                  group: ["**/packages/**"],
                  message:
                    "Import a package by its name, such as `@fb/core/definition`, never by relative path.",
                },
              ],
            },
          ],
        },
      },
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "workspace",
          include: testPostgres ? [postgresTests] : configDefaults.include,
          // The renderer's tests need its own config (Svelte, and a browser), so it is a project of its own.
          exclude: [
            ...configDefaults.exclude,
            "e2e/**",
            "packages/renderer/**",
            ...(testPostgres ? [] : [postgresTests]),
          ],
        },
      },
      // Browser tests need no Docker, so they stay out of the Postgres run.
      ...(testPostgres ? [] : ["packages/renderer"]),
    ],
  },
  run: {
    cache: true,
    tasks: {
      check: "vp check",
      boundaries: "depcruise packages apps e2e --config .dependency-cruiser.cjs",
      // `git diff` misses a generated file that isn't tracked, so `ls-files` checks both are committed.
      "check:generated": {
        command: `git diff --exit-code -- ${generatedPaths} && git ls-files --error-unmatch -- ${generatedPaths}`,
        dependsOn: ["@fb/api-client#generate"],
        cache: false,
      },
      // The renderer's browser test imports its built bundle.
      test: { command: "vp test", dependsOn: ["@fb/renderer#build"] },
      "check:svelte": {
        command: "true",
        dependsOn: ["@fb/renderer#check:svelte", "@fb/builder#check:svelte"],
      },
      // Runs Playwright against `vp preview` of the reference host and the builder, which `playwright.config.ts` starts.
      e2e: {
        command: "playwright test --config e2e/playwright.config.ts",
        dependsOn: ["@fb/reference-host#build", "@fb/builder#build"],
        cache: false,
      },
      postgres: {
        command: "docker compose up --wait postgres",
        cache: false,
      },
      "test:pg": {
        command: `TEST_POSTGRES=1 DATABASE_URL="\${DATABASE_URL:-${composeDatabaseUrl}}" vp test`,
        dependsOn: ["postgres"],
        cache: { env: ["DATABASE_URL"] },
      },
      // Runs the same task names as the CI jobs. Vite Task requires a command, so the gates are dependencies.
      ready: {
        command: "true",
        dependsOn: [
          "check",
          "boundaries",
          "check:svelte",
          "check:generated",
          "@fb/server#check:migrations",
          "test",
          "test:pg",
          "e2e",
        ],
      },
    },
  },
});
