import { configDefaults, defineConfig } from "vite-plus";

const generatedFiles = ["packages/http-api/openapi.json", "packages/api-client/lib/schema.d.ts"];

const generatedPaths = generatedFiles.join(" ");

const ignorePatterns = [".agents/**", ".claude/**", ".scratch/**", ...generatedFiles];

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
      // `git diff` misses a generated file that isn't tracked, so `ls-files` checks both are committed.
      "check:generated": {
        command: `git diff --exit-code -- ${generatedPaths} && git ls-files --error-unmatch -- ${generatedPaths}`,
        dependsOn: ["@fb/api-client#generate"],
        cache: false,
      },
      test: "vp test",
      // Runs the same task names as the CI jobs. Vite Task requires a command, so the gates are dependencies.
      ready: {
        command: "true",
        dependsOn: ["check", "check:generated", "test"],
      },
    },
  },
});
