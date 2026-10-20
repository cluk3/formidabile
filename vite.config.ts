import { configDefaults, defineConfig } from "vite-plus";

const ignorePatterns = [
  ".agents/**",
  ".claude/**",
  ".scratch/**",
  "packages/http-api/openapi.json",
  "packages/api-client/lib/schema.d.ts",
];

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
    ignorePatterns,
  },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
  run: {
    cache: true,
    tasks: {
      check: "vp check",
      test: "vp test",
      // Runs the same task names as the CI jobs. Vite Task requires a command, so the gates are dependencies.
      ready: {
        command: "true",
        dependsOn: ["check", "test"],
      },
    },
  },
});
