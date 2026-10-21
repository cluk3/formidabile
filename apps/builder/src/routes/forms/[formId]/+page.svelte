<script lang="ts">
  import { page } from "$app/state";
  import { createBuilderClient, signInUrl } from "#lib/api.ts";
  import DraftEditor from "#lib/DraftEditor.svelte";
  import type { PageProps } from "./$types";

  let { data, params }: PageProps = $props();
</script>

<main class="mx-auto max-w-3xl p-8">
  <a class="text-sm text-muted-foreground hover:underline" href="/">All forms</a>
  <h1 class="mt-2 mb-6 text-2xl font-semibold">Edit form</h1>
  {#key params.formId}
    <DraftEditor
      client={createBuilderClient(data.config)}
      formId={params.formId}
      signInHref={signInUrl(data.config.loginUrl, page.url.href)}
    />
  {/key}
</main>
