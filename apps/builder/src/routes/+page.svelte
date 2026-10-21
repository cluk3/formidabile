<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<main class="mx-auto max-w-3xl p-8">
  <h1 class="text-2xl font-semibold">Form builder</h1>
  <p class="mt-2 text-muted-foreground">
    API at <code data-testid="api-base-url">{data.config.apiBaseUrl}</code>
  </p>
</main>
