<script lang="ts">
  import { page } from "$app/state";
  import { createBuilderClient, signInUrl } from "#lib/api.ts";
  import FormsPage from "#lib/FormsPage.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<main class="mx-auto max-w-3xl p-8">
  <h1 class="mb-6 text-2xl font-semibold">Form builder</h1>
  <FormsPage
    client={createBuilderClient(data.config)}
    signInHref={signInUrl(data.config.loginUrl, page.url.href)}
  />
</main>
