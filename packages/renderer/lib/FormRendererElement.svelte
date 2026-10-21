<svelte:options
  customElement={{
    tag: "form-renderer",
    shadow: "open",
    props: {
      title: { attribute: "title", type: "String" },
    },
    extend: (ce) =>
      class extends ce {
        constructor() {
          super();
          // Svelte attaches the shadow root in the SvelteElement constructor, before this body runs.
          if (!this.shadowRoot) {
            throw new Error("form-renderer: Svelte did not attach a shadow root before extend ran");
          }
          if (css) this.shadowRoot.adoptedStyleSheets = [sheet()];
        }
      },
  }}
/>

<script module lang="ts">
  import css from "virtual:form-renderer-css";

  let shared: CSSStyleSheet | undefined;
  function sheet(): CSSStyleSheet {
    if (!shared) {
      shared = new CSSStyleSheet();
      shared.replaceSync(css);
    }
    return shared;
  }
</script>

<script lang="ts">
  import FormRenderer from "./FormRenderer.svelte";

  let { title = "Placeholder form" }: { title?: string } = $props();
</script>

<FormRenderer {title} />
