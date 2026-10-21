import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "vite-plus/test/browser-playwright";
import { defaultClientConditions, defineConfig, type Plugin } from "vite-plus";

// ADR 0008: the element's CSS is adopted as a constructable stylesheet, because a strict host CSP blocks the
// `<style>` elements Svelte would inject. In a build, inner components emit external CSS, which this plugin
// inlines into the one bundled module in place of a placeholder string the wrapper imports.
const wrapper = /[\\/]lib[\\/]FormRendererElement\.svelte$/;
const virtualId = "virtual:form-renderer-css";
const placeholder = "__FORM_RENDERER_CSS__";

const elementCss = (isBuild: boolean): Plugin => ({
  name: "form-renderer-css",
  enforce: "post",
  resolveId: (id) => (id === virtualId ? `\0${virtualId}` : undefined),
  load: (id) =>
    id === `\0${virtualId}`
      ? `export default ${JSON.stringify(isBuild ? placeholder : "")};`
      : undefined,
  generateBundle(_, bundle) {
    if (!isBuild) return;
    let css = "";
    for (const [name, file] of Object.entries(bundle)) {
      if (file.type === "asset" && name.endsWith(".css")) {
        css += String(file.source);
        delete bundle[name];
      }
    }
    const chunks = Object.values(bundle).filter(
      (file) => file.type === "chunk" && file.code.includes(placeholder),
    );
    const [chunk] = chunks;
    if (chunks.length !== 1 || chunk?.type !== "chunk") {
      this.error(`expected exactly one chunk containing ${placeholder}, found ${chunks.length}`);
    }
    chunk.code = chunk.code.replace(new RegExp(`(["'\`])${placeholder}\\1`, "g"), () =>
      JSON.stringify(css),
    );
  },
});

export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  const plugins = [
    svelte({
      compilerOptions: { customElement: true },
      // Only the wrapper is a custom element. Inner components are plain components whose CSS is external in a
      // build (adopted by the wrapper) and injected in dev and tests.
      dynamicCompileOptions: ({ filename }) =>
        wrapper.test(filename)
          ? undefined
          : { customElement: false, css: isBuild ? "external" : "injected" },
    }),
    elementCss(isBuild),
  ];
  return {
    plugins,
    resolve: { conditions: ["source", ...defaultClientConditions] },
    build: {
      lib: { entry: "element.ts", formats: ["es"], fileName: "form-renderer" },
      rolldownOptions: { output: { minify: true } },
    },
    run: {
      tasks: {
        build: { command: "vp build", cache: true },
        "check:svelte": {
          command: "svelte-check --tsconfig ./tsconfig.json",
          cache: true,
        },
      },
    },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "renderer-node",
            include: ["tests/**/*.test.ts"],
            exclude: ["tests/**/*.browser.test.ts"],
          },
        },
        {
          extends: true,
          test: {
            name: "renderer-browser",
            include: ["tests/**/*.browser.test.ts"],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  };
});
