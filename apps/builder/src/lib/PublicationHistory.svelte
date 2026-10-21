<script lang="ts">
  import type { FormApiClient, Schemas } from "@fb/api-client";
  import { parseDefinition, type FormDefinition } from "@fb/core/definition";
  import { FormRenderer } from "@fb/renderer";
  import { outcome } from "#lib/api.ts";
  import { Button } from "#lib/components/ui/button/index.js";

  let {
    client,
    form,
    signIn,
  }: {
    client: FormApiClient;
    form: Schemas["FormDetail"];
    signIn: () => void;
  } = $props();
  const uid = $props.id();

  type Reading = { readonly number: number; readonly definition: FormDefinition | null };

  let versions = $state.raw<Schemas["VersionSummary"][] | null>(null);
  let failed = $state(false);
  let reading = $state.raw<Reading | null>(null);
  let notice = $state<string | null>(null);

  const currentId = $derived(form.currentVersion?.id ?? null);
  const basedOn = $derived.by(() => {
    const id = form.draft?.basedOnVersionId;
    if (id === undefined || id === null) return undefined;
    if (id === form.currentVersion?.id) return form.currentVersion.number;
    return versions?.find((version) => version.id === id)?.number;
  });

  /** The versions list, newest first, as of the current version `at`. */
  const loadVersions = async (at: string) => {
    failed = false;
    const result = await outcome(() =>
      client.GET("/forms/{formId}/versions", { params: { path: { formId: form.id } } }),
    );
    if (at !== currentId) return;
    if (result.kind === "ok") versions = result.data.versions;
    else if (result.kind === "signIn") signIn();
    else failed = true;
  };

  $effect(() => {
    if (currentId !== null) void loadVersions(currentId);
  });

  const read = async (version: Schemas["VersionSummary"]) => {
    notice = null;
    const result = await outcome(() =>
      client.GET("/forms/{formId}/versions/{versionId}", {
        params: { path: { formId: form.id, versionId: version.id } },
      }),
    );
    if (result.kind === "ok") {
      const parsed = parseDefinition(result.data.definition);
      reading = { number: version.number, definition: parsed.ok ? parsed.value : null };
    } else if (result.kind === "signIn") signIn();
    else notice = `Couldn't read version ${version.number}.`;
  };
</script>

<section class="flex flex-col gap-3" aria-labelledby={`${uid}-heading`}>
  <h2 id={`${uid}-heading`} class="text-lg font-semibold">Publication history</h2>
  {#if form.currentVersion === null}
    <p class="text-sm text-muted-foreground">Not published yet.</p>
  {:else}
    <p>Version {form.currentVersion.number} is current.</p>
    <p class="text-sm text-muted-foreground">
      {#if form.draft === null}
        No unpublished draft: the editor shows version {form.currentVersion.number}.
      {:else if basedOn === undefined}
        An unpublished draft is open in the editor.
      {:else}
        An unpublished draft, based on version {basedOn}, is open in the editor.
      {/if}
    </p>
    {#if failed}
      <p>
        Couldn't load the publication history.
        <Button
          variant="outline"
          size="sm"
          onclick={() => currentId !== null && loadVersions(currentId)}>Retry</Button
        >
      </p>
    {:else if versions === null}
      <p class="text-muted-foreground">Loading…</p>
    {:else}
      <ul class="divide-y rounded-md border text-sm">
        {#each versions as version (version.id)}
          <li class="flex flex-wrap items-center gap-4 p-3">
            <span class="font-medium">Version {version.number}</span>
            {#if version.isCurrent}
              <span class="rounded-full border px-2 text-xs">Current</span>
            {/if}
            <span class="grow text-muted-foreground">
              Published {new Date(version.publishedAt).toLocaleString()} by {version.publishedBy}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Read version ${version.number}`}
              onclick={() => read(version)}>Read</Button
            >
          </li>
        {/each}
      </ul>
    {/if}
    {#if notice !== null}
      <p role="status">{notice}</p>
    {/if}
    {#if reading !== null}
      <section class="rounded-md border" aria-labelledby={`${uid}-reading`}>
        <div class="flex items-center gap-2 px-4 pt-4">
          <h3 id={`${uid}-reading`} class="grow font-semibold">Version {reading.number}</h3>
          <Button variant="outline" size="sm" onclick={() => (reading = null)}>Close</Button>
        </div>
        {#if reading.definition === null}
          <p class="p-4">This version uses a question type the builder doesn't support.</p>
        {:else}
          {#key reading}
            <FormRenderer preview={reading.definition} />
          {/key}
        {/if}
      </section>
    {/if}
  {/if}
</section>
