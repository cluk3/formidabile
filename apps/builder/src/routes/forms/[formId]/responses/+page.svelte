<script lang="ts">
  import { page } from "$app/state";
  import { createBuilderClient, signInUrl } from "#lib/api.ts";
  import ResponsesPage from "#lib/ResponsesPage.svelte";
  import type { PageProps } from "./$types";

  let { data, params }: PageProps = $props();
</script>

<main class="mx-auto max-w-3xl p-8">
  <nav class="flex gap-4 text-sm text-muted-foreground">
    <a class="hover:underline" href="/">All forms</a>
    <a class="hover:underline" href={`/forms/${params.formId}`}>Edit form</a>
  </nav>
  <h1 class="mt-2 mb-6 text-2xl font-semibold">Form responses</h1>
  {#key params.formId}
    <ResponsesPage
      client={createBuilderClient(data.config)}
      formId={params.formId}
      signInHref={signInUrl(data.config.loginUrl, page.url.href)}
    />
  {/key}
</main>
