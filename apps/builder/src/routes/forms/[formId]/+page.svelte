<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { createBuilderClient, signInUrl } from "#lib/api.ts";
  import DraftEditor from "#lib/DraftEditor.svelte";
  import type { PageProps } from "./$types";

  let { data, params }: PageProps = $props();
</script>

<main class="mx-auto max-w-3xl p-8">
  <nav class="flex gap-4 text-sm text-muted-foreground">
    <a class="hover:underline" href="/">All forms</a>
    <a class="hover:underline" href={`/forms/${params.formId}/responses`}>Responses</a>
    <a class="hover:underline" href={`/forms/${params.formId}/analytics`}>Analytics</a>
  </nav>
  <h1 class="mt-2 mb-6 text-2xl font-semibold">Edit form</h1>
  {#key params.formId}
    <DraftEditor
      client={createBuilderClient(data.config)}
      formId={params.formId}
      signInHref={signInUrl(data.config.loginUrl, page.url.href)}
      onDeleted={() => goto("/")}
    />
  {/key}
</main>
