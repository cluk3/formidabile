<script lang="ts">
  import type { FormApiClient, Schemas } from "@fb/api-client";
  import { onMount } from "svelte";
  import { outcome } from "#lib/api.ts";
  import { Button } from "#lib/components/ui/button/index.js";

  let {
    client,
    formId,
    signInHref,
  }: { client: FormApiClient; formId: string; signInHref: string } = $props();
  const uid = $props.id();

  let responses = $state.raw<Schemas["ResponseSummary"][] | null>(null);
  let nextCursor = $state<string | null>(null);
  let signedOut = $state(false);
  let loadFailed = $state(false);
  let loading = $state(false);

  /** One page of the list, newest first: the first one, or the page after `cursor`. */
  const loadPage = async (cursor?: string) => {
    loading = true;
    loadFailed = false;
    const result = await outcome(() =>
      client.GET("/responses", { params: { query: { formId, cursor } } }),
    );
    loading = false;
    if (result.kind === "ok") {
      responses = [...(cursor === undefined ? [] : (responses ?? [])), ...result.data.responses];
      nextCursor = result.data.nextCursor;
    } else if (result.kind === "signIn") signedOut = true;
    else loadFailed = true;
  };

  onMount(() => loadPage());
</script>

<section class="flex flex-col gap-6">
  {#if signedOut}
    <p>
      Sign in as someone who can read responses.
      <a class="font-medium underline" href={signInHref}>Sign in</a>
    </p>
  {:else}
    <h2 id={`${uid}-list`} class="text-lg font-semibold">Responses</h2>
    {#if responses === null && loadFailed}
      <p>
        Couldn't load the responses.
        <Button variant="outline" size="sm" onclick={() => loadPage()}>Retry</Button>
      </p>
    {:else if responses === null}
      <p class="text-muted-foreground">Loading…</p>
    {:else if responses.length === 0}
      <p class="text-muted-foreground">No responses</p>
    {:else}
      <ul class="divide-y rounded-md border text-sm" aria-labelledby={`${uid}-list`}>
        {#each responses as response (response.id)}
          <li class="flex flex-wrap items-center gap-4 p-3">
            <span class="font-medium">{response.respondentId ?? "Anonymous"}</span>
            <span class="grow text-muted-foreground">
              Version {response.versionNumber}, submitted {new Date(
                response.submittedAt,
              ).toLocaleString()}
            </span>
          </li>
        {/each}
      </ul>
      {#if nextCursor !== null}
        {@const cursor = nextCursor}
        <Button variant="outline" disabled={loading} onclick={() => loadPage(cursor)}
          >Load more</Button
        >
      {/if}
      {#if loadFailed}
        <p role="status">Couldn't load more responses.</p>
      {/if}
    {/if}
  {/if}
</section>
