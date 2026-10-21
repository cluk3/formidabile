<svelte:options
  customElement={{
    tag: "form-renderer",
    shadow: "open",
    props: {
      apiBaseUrl: { attribute: "api-base-url", type: "String" },
      formId: { attribute: "form-id", type: "String" },
      responseId: { attribute: "response-id", type: "String" },
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
  import type { RendererError } from "./problems.ts";
  import type { GetToken } from "./props.ts";

  let {
    apiBaseUrl,
    formId,
    responseId,
    getToken,
  }: { apiBaseUrl?: string; formId?: string; responseId?: string; getToken?: GetToken } = $props();

  const element = $host();
  const onsubmitted = (detail: { readonly responseId: string }) =>
    element.dispatchEvent(new CustomEvent("submitted", { detail }));
  const onerror = (detail: RendererError) =>
    element.dispatchEvent(new CustomEvent("error", { detail }));
</script>

<!-- Nothing renders until the host has given all three required inputs; `response-id` is optional. -->
{#if apiBaseUrl && formId && getToken}
  {#key `${formId} ${responseId ?? ""}`}
    <FormRenderer
      {apiBaseUrl}
      {formId}
      responseId={responseId || undefined}
      {getToken}
      {onsubmitted}
      {onerror}
    />
  {/key}
{/if}
