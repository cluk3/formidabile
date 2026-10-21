<script lang="ts">
  import { page } from "$app/state";
  import { createBuilderClient, signInUrl } from "#lib/api.ts";
  import FormAnalytics from "#lib/FormAnalytics.svelte";
  import type { PageProps } from "./$types";

  let { data, params }: PageProps = $props();
</script>

<main class="mx-auto max-w-4xl p-8">
  <a class="text-sm text-muted-foreground hover:underline" href={`/forms/${params.formId}`}
    >Back to the form</a
  >
  <h1 class="mt-2 mb-6 text-2xl font-semibold">Analytics</h1>
  {#key params.formId}
    <FormAnalytics
      client={createBuilderClient(data.config)}
      formId={params.formId}
      signInHref={signInUrl(data.config.loginUrl, page.url.href)}
    />
  {/key}
</main>
