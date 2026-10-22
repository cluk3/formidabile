<script lang="ts">
  import type { FormApiClient, Schemas } from "@fb/api-client";
  import { parseDefinition, type FormDefinition } from "@fb/core/definition";
  import { FormRenderer } from "@fb/renderer";
  import { outcome, settleWrite, type Outcome } from "#lib/api.ts";
  import { Button } from "#lib/components/ui/button/index.js";
  import ConfirmReplaceDraft from "#lib/ConfirmReplaceDraft.svelte";
  import { definitionAsCopy } from "#lib/duplicate-title.ts";

  let {
    client,
    form,
    signIn,
    onDuplicated,
    onRestored,
    onRevisionConflict,
  }: {
    client: FormApiClient;
    form: Schemas["FormDetail"];
    signIn: () => void;
    /** A new form was created from a definition: open it. */
    onDuplicated: (formId: string) => void;
    /** The draft was replaced: reload the editor. */
    onRestored: () => void | Promise<void>;
    /** A save landed after the revision this restore sent. */
    onRevisionConflict: () => void;
  } = $props();
  const uid = $props.id();

  type Reading = { readonly number: number; readonly definition: FormDefinition | null };
  type PendingRestore = { id: string; number: number; revision: string | null };

  let versions = $state.raw<Schemas["VersionSummary"][] | null>(null);
  let failed = $state(false);
  let reading = $state.raw<Reading | null>(null);
  let notice = $state<string | null>(null);
  let busy = $state(false);
  let restoring = $state.raw<PendingRestore | null>(null);

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

  const storedDefinition = (value: unknown): object | undefined =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;

  const reportRead = async (result: Outcome<unknown, { _tag: string }>, message: string) => {
    await settleWrite(result, {
      ok: () => undefined,
      rejected: () => (notice = message),
      unknown: () => (notice = message),
      signIn,
      notice: (text) => (notice = text),
    });
  };

  /** Reads a stored definition and posts it as a new form, changing only the title. */
  const postCopy = async (definition: object) => {
    const result = await outcome(() =>
      client.POST("/forms", {
        // The generated schema names the formats this build parses. The body is the stored JSON.
        body: { definition: definitionAsCopy(definition) as Schemas["FormDefinition"] },
      }),
    );
    busy = false;
    await settleWrite(result, {
      ok: ({ form: created }) => onDuplicated(created.id),
      rejected: (error) => {
        notice =
          error._tag === "ValidationFailed"
            ? `The form couldn't be duplicated: ${error.issues.map((issue) => issue.message).join("; ")}`
            : "The form couldn't be duplicated.";
      },
      unknown: () => {
        notice = "We couldn't confirm the form was duplicated.";
      },
      signIn,
      notice: (text) => (notice = text),
    });
  };

  const duplicateDraft = async () => {
    notice = null;
    restoring = null;
    busy = true;
    const readDraft = await outcome(() =>
      client.GET("/forms/{formId}/draft", { params: { path: { formId: form.id } } }),
    );
    if (readDraft.kind !== "ok") {
      busy = false;
      await reportRead(readDraft, "Couldn't read the draft to duplicate it.");
      return;
    }
    const definition = storedDefinition(readDraft.data.draft?.definition);
    if (definition === undefined) {
      busy = false;
      notice = "This form has no draft to duplicate.";
      return;
    }
    await postCopy(definition);
  };

  const duplicateVersion = async (version: Schemas["VersionSummary"]) => {
    notice = null;
    restoring = null;
    busy = true;
    const readVersion = await outcome(() =>
      client.GET("/forms/{formId}/versions/{versionId}", {
        params: { path: { formId: form.id, versionId: version.id } },
      }),
    );
    if (readVersion.kind !== "ok") {
      busy = false;
      await reportRead(readVersion, `Couldn't read version ${version.number}.`);
      return;
    }
    const definition = storedDefinition(readVersion.data.definition);
    if (definition === undefined) {
      busy = false;
      notice = `Couldn't read version ${version.number}.`;
      return;
    }
    await postCopy(definition);
  };

  const askRestore = (version: Schemas["VersionSummary"]) => {
    notice = null;
    const revision = form.draft?.revision ?? null;
    if (revision === null) {
      void commitRestore({ id: version.id, number: version.number, revision: null });
      return;
    }
    restoring = { id: version.id, number: version.number, revision };
  };

  /** Reads the version and saves it as the draft. It does not publish. */
  const commitRestore = async (pending: PendingRestore) => {
    restoring = null;
    busy = true;
    notice = null;
    const readVersion = await outcome(() =>
      client.GET("/forms/{formId}/versions/{versionId}", {
        params: { path: { formId: form.id, versionId: pending.id } },
      }),
    );
    if (readVersion.kind !== "ok") {
      busy = false;
      await reportRead(readVersion, `Couldn't read version ${pending.number}.`);
      return;
    }
    const saved = await outcome(() =>
      client.PUT("/forms/{formId}/draft", {
        params: { path: { formId: form.id } },
        body: { expectedRevision: pending.revision, definition: readVersion.data.definition },
      }),
    );
    busy = false;
    await settleWrite(saved, {
      ok: async () => {
        notice = `Restored version ${pending.number} into the draft.`;
        await onRestored();
      },
      rejected: (error) => {
        if (error._tag === "RevisionConflict") onRevisionConflict();
        else if (error._tag === "ValidationFailed") {
          notice = `The version couldn't be restored: ${error.issues.map((issue) => issue.message).join("; ")}`;
        } else if (error._tag === "NoDraft") {
          notice = "This draft was discarded since you opened it.";
        } else notice = "The version couldn't be restored.";
      },
      unknown: async () => {
        notice = "We couldn't confirm the version was restored, so the form has been reloaded.";
        await onRestored();
      },
      signIn,
      notice: (text) => (notice = text),
    });
  };
</script>

<section class="flex flex-col gap-3" aria-labelledby={`${uid}-heading`}>
  <h2 id={`${uid}-heading`} class="text-lg font-semibold">Publication history</h2>
  {#if form.currentVersion === null}
    <p class="text-sm text-muted-foreground">Not published yet.</p>
    <div>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        aria-label="Duplicate draft"
        onclick={duplicateDraft}>Duplicate</Button
      >
    </div>
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
    {#if form.draft !== null}
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          aria-label="Duplicate draft"
          onclick={duplicateDraft}>Duplicate</Button
        >
      </div>
    {/if}
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
              disabled={busy}
              aria-label={`Read version ${version.number}`}
              onclick={() => read(version)}>Read</Button
            >
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label={`Duplicate version ${version.number}`}
              onclick={() => duplicateVersion(version)}>Duplicate</Button
            >
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label={`Restore version ${version.number}`}
              onclick={() => askRestore(version)}>Restore</Button
            >
          </li>
        {/each}
      </ul>
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
  {#if restoring !== null}
    <ConfirmReplaceDraft
      versionNumber={restoring.number}
      disabled={busy}
      onConfirm={() => {
        const pending = restoring;
        if (pending !== null) void commitRestore(pending);
      }}
      onCancel={() => (restoring = null)}
    />
  {/if}
  {#if notice !== null}
    <p role="status">{notice}</p>
  {/if}
</section>
