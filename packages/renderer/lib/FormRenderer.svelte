<script lang="ts">
  import { createFormApiClient } from "@fb/api-client";
  import { parseDefinition, type FormDefinition } from "@fb/core/definition";
  import type { GetToken } from "./props.ts";

  let { apiBaseUrl, formId, getToken }: { apiBaseUrl: string; formId: string; getToken: GetToken } =
    $props();

  let definition = $state<FormDefinition>();

  $effect(() => {
    const client = createFormApiClient({
      baseUrl: apiBaseUrl,
      getToken: () => getToken({ formId }),
    });
    void client
      .GET("/respond/forms/{formId}", { params: { path: { formId } } })
      .then(({ data }) => {
        if (data === undefined) return;
        const parsed = parseDefinition(data.version.definition);
        if (parsed.ok) definition = parsed.value;
      });
  });
</script>

<section class="root" part="root">
  {#if definition}
    <h2 class="title" part="title">{definition.title}</h2>
  {/if}
</section>

<style>
  .root {
    display: block;
    padding: 1rem;
    font-family: inherit;
  }
  .title {
    margin: 0 0 0.5rem;
    color: rgb(10, 20, 30);
  }
</style>
