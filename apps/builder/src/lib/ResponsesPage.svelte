<script lang="ts">
  import type { FormApiClient, Schemas } from "@fb/api-client";
  import { onMount } from "svelte";
  import { outcome } from "#lib/api.ts";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { fieldClass, nativeInputClass } from "#lib/editors/props.ts";
  import ResponseDetail from "#lib/ResponseDetail.svelte";

  let {
    client,
    formId,
    signInHref,
  }: { client: FormApiClient; formId: string; signInHref: string } = $props();
  const uid = $props.id();

  type Filters = {
    readonly versionId?: string;
    readonly respondentId?: string;
    readonly refNamespace?: string;
    readonly refId?: string;
  };

  let versions = $state.raw<Schemas["VersionSummary"][]>([]);
  let responses = $state.raw<Schemas["ResponseSummary"][] | null>(null);
  let nextCursor = $state<string | null>(null);
  /** The filters the list shows; the fields below are what the admin is typing. */
  let applied = $state.raw<Filters>({});
  let versionId = $state("");
  let respondentId = $state("");
  let refNamespace = $state("");
  let refId = $state("");
  let signedOut = $state(false);
  let loadFailed = $state(false);
  let loading = $state(false);
  let notice = $state<string | null>(null);
  let opened = $state.raw<Schemas["ResponseDetail"] | null>(null);

  /** One page of the list under `filters`, newest first: the first one, or the page after `cursor`. */
  const loadPage = async (filters: Filters, cursor?: string) => {
    loading = true;
    loadFailed = false;
    notice = null;
    const result = await outcome(() =>
      client.GET("/responses", { params: { query: { formId, ...filters, cursor } } }),
    );
    loading = false;
    if (result.kind === "ok") {
      applied = filters;
      responses = [...(cursor === undefined ? [] : (responses ?? [])), ...result.data.responses];
      nextCursor = result.data.nextCursor;
    } else if (result.kind === "signIn") signedOut = true;
    else if (result.kind === "rejected" && result.error._tag === "ValidationFailed") {
      notice = `These filters aren't valid: ${result.error.issues.map((issue) => issue.message).join("; ")}`;
    } else loadFailed = true;
  };

  const open = async (summary: Schemas["ResponseSummary"]) => {
    notice = null;
    const result = await outcome(() =>
      client.GET("/responses/{responseId}", { params: { path: { responseId: summary.id } } }),
    );
    if (result.kind === "ok") opened = result.data;
    else if (result.kind === "signIn") signedOut = true;
    else if (result.kind === "rejected" && result.error._tag === "NotFound") {
      forget(summary.id);
      notice = "This response no longer exists.";
    } else notice = "Couldn't open the response.";
  };

  /** Drops a response that's gone from the list, and from the detail if it's open. */
  const forget = (responseId: string) => {
    responses = responses?.filter((response) => response.id !== responseId) ?? null;
    if (opened?.response.id === responseId) opened = null;
  };

  const loadVersions = async () => {
    const result = await outcome(() =>
      client.GET("/forms/{formId}/versions", { params: { path: { formId } } }),
    );
    if (result.kind === "ok") versions = result.data.versions;
  };

  const optional = (value: string) => (value.trim() === "" ? undefined : value.trim());

  const filter = (event: SubmitEvent) => {
    event.preventDefault();
    const namespace = optional(refNamespace);
    const id = optional(refId);
    if ((namespace === undefined) !== (id === undefined)) {
      notice = "Give both the reference namespace and its id, or neither.";
      return;
    }
    void loadPage({
      versionId: optional(versionId),
      respondentId: optional(respondentId),
      refNamespace: namespace,
      refId: id,
    });
  };

  onMount(() => {
    void loadVersions();
    void loadPage({});
  });
</script>

<section class="flex flex-col gap-6">
  {#if signedOut}
    <p>
      Sign in as someone who can read responses.
      <a class="font-medium underline" href={signInHref}>Sign in</a>
    </p>
  {:else}
    <form class="flex flex-wrap items-end gap-2" onsubmit={filter}>
      <div class={fieldClass}>
        <label for={`${uid}-version`}>Version</label>
        <select id={`${uid}-version`} class={nativeInputClass} bind:value={versionId}>
          <option value="">All versions</option>
          {#each versions as version (version.id)}
            <option value={version.id}>Version {version.number}</option>
          {/each}
        </select>
      </div>
      <label class={fieldClass}>
        Respondent
        <Input bind:value={respondentId} />
      </label>
      <label class={fieldClass}>
        Reference namespace
        <Input bind:value={refNamespace} />
      </label>
      <label class={fieldClass}>
        Reference id
        <Input bind:value={refId} />
      </label>
      <Button type="submit" variant="outline" disabled={loading}>Filter</Button>
    </form>
    {#if notice !== null}
      <p role="status">{notice}</p>
    {/if}

    <h2 id={`${uid}-list`} class="text-lg font-semibold">Responses</h2>
    {#if responses === null && loadFailed}
      <p>
        Couldn't load the responses.
        <Button variant="outline" size="sm" onclick={() => loadPage(applied)}>Retry</Button>
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
            <Button variant="outline" size="sm" onclick={() => open(response)}>Open</Button>
          </li>
        {/each}
      </ul>
      {#if nextCursor !== null}
        {@const cursor = nextCursor}
        <Button variant="outline" disabled={loading} onclick={() => loadPage(applied, cursor)}
          >Load more</Button
        >
      {/if}
      {#if loadFailed}
        <p role="status">Couldn't load more responses.</p>
      {/if}
    {/if}
    {#if opened !== null}
      {#key opened}
        <ResponseDetail detail={opened} close={() => (opened = null)} />
      {/key}
    {/if}
  {/if}
</section>
