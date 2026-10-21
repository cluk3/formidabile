<script lang="ts">
  import type { FormApiClient, Schemas } from "@fb/api-client";
  import {
    parseDefinition,
    type FormDefinition,
    type Issue,
    type QuestionTypeName,
  } from "@fb/core/definition";
  import { addQuestion, QUESTIONS_CAP } from "@fb/core/editing";
  import { onMount } from "svelte";
  import { outcome, type Outcome } from "#lib/api.ts";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { questionEditors, questionTypeNames } from "#lib/editors/editors.ts";
  import { fieldClass, nativeInputClass, optionalText } from "#lib/editors/props.ts";
  import FormSettings from "#lib/FormSettings.svelte";
  import { webCryptoIds } from "#lib/ids.ts";
  import QuestionCard from "#lib/QuestionCard.svelte";

  let {
    client,
    formId,
    signInHref,
    onDeleted,
  }: {
    client: FormApiClient;
    formId: string;
    signInHref: string;
    /** The form was deleted: leave its editor. */
    onDeleted: () => void;
  } = $props();
  const uid = $props.id();
  const path = $derived({ params: { path: { formId } } });

  let form = $state.raw<Schemas["FormDetail"] | null>(null);
  /** The definition as last loaded or saved; the editor is clean while `definition` is this same object. */
  let saved = $state.raw<FormDefinition | null>(null);
  let definition = $state.raw<FormDefinition | null>(null);
  /** The draft's revision, or `null` while the form has no draft and saving creates one. */
  let revision = $state<string | null>(null);
  let signedOut = $state(false);
  let loadFailed = $state(false);
  let missing = $state(false);
  let busy = $state(false);
  let confirmingDelete = $state(false);
  let notice = $state<string | null>(null);
  let conflict = $state<string | null>(null);
  let issues = $state.raw<Issue[]>([]);
  let newType = $state<QuestionTypeName>("text");

  const tokenUnavailable = "Couldn't get a sign-in token from the host. Try again.";
  const changedSinceOpened = "This draft has changed since you opened it.";

  /** `data` on success. Otherwise the editor shows the sign-in prompt, that the form is gone, or the load failure. */
  const read = async <T>(call: () => Promise<Outcome<T, { _tag: string }>>) => {
    const result = await call();
    if (result.kind === "ok") return result.data;
    if (result.kind === "signIn") signedOut = true;
    else if (result.kind === "rejected" && result.error._tag === "NotFound") missing = true;
    else loadFailed = true;
    return undefined;
  };

  /** Opens a stored definition, read back through core's structural checks. */
  const open = (stored: unknown, at: string | null) => {
    const parsed = parseDefinition(stored);
    if (!parsed.ok) {
      loadFailed = true;
      return;
    }
    definition = saved = parsed.value;
    revision = at;
  };

  /** The form's detail, and its draft or, when it has no draft, its current version's definition. */
  const load = async () => {
    loadFailed = false;
    missing = false;
    confirmingDelete = false;
    conflict = null;
    issues = [];
    const [draft, detail] = await Promise.all([
      read(() => outcome(() => client.GET("/forms/{formId}/draft", path))),
      read(() => outcome(() => client.GET("/forms/{formId}", path))),
    ]);
    if (draft === undefined || detail === undefined) return;
    form = detail;
    if (draft.draft !== null) return open(draft.draft.definition, draft.draft.revision);
    if (detail.currentVersion === null) {
      loadFailed = true;
      return;
    }
    const versionId = detail.currentVersion.id;
    const version = await read(() =>
      outcome(() =>
        client.GET("/forms/{formId}/versions/{versionId}", {
          params: { path: { formId, versionId } },
        }),
      ),
    );
    if (version !== undefined) open(version.definition, null);
  };

  /** Rereads only the form's detail, keeping unsaved edits. */
  const reloadForm = async () => {
    const detail = await read(() => outcome(() => client.GET("/forms/{formId}", path)));
    if (detail !== undefined) form = detail;
  };

  const begin = () => {
    busy = true;
    notice = null;
    conflict = null;
    issues = [];
  };

  /** Discards a published form's draft; the editor then shows the current version. */
  const discard = async () => {
    if (revision === null) return;
    const expectedRevision = revision;
    begin();
    const result = await outcome(() =>
      client.DELETE("/forms/{formId}/draft", {
        params: { path: { formId }, query: { expectedRevision } },
      }),
    );
    busy = false;
    if (result.kind === "ok") {
      await load();
      notice = "Draft discarded";
    } else if (result.kind === "rejected") {
      const { error } = result;
      if (error._tag === "RevisionConflict") conflict = changedSinceOpened;
      else if (error._tag === "NoDraft") {
        await load();
        notice = "This draft was already discarded.";
      } else if (error._tag === "NotFound") missing = true;
      else notice = "The draft couldn't be discarded.";
    } else if (result.kind === "unknown") {
      await load();
      notice = "We couldn't confirm the draft was discarded, so the form has been reloaded.";
    } else if (result.kind === "signIn") {
      signedOut = true;
    } else {
      notice = tokenUnavailable;
    }
  };

  /** Deletes a never-published form, with its draft (ADR 0014). */
  const remove = async () => {
    if (revision === null) return;
    const expectedRevision = revision;
    begin();
    const result = await outcome(() =>
      client.DELETE("/forms/{formId}", {
        params: { path: { formId }, query: { expectedRevision } },
      }),
    );
    busy = false;
    confirmingDelete = false;
    if (result.kind === "ok") {
      onDeleted();
    } else if (result.kind === "rejected") {
      const { error } = result;
      if (error._tag === "FormPublished") {
        await reloadForm();
        notice =
          "This form was published since you opened it, so it can't be deleted. You can discard its draft instead.";
      } else if (error._tag === "RevisionConflict") conflict = changedSinceOpened;
      else if (error._tag === "NotFound") missing = true;
      else notice = "The form couldn't be deleted.";
    } else if (result.kind === "unknown") {
      await load();
      notice = "We couldn't confirm the form was deleted, so it has been reloaded.";
    } else if (result.kind === "signIn") {
      signedOut = true;
    } else {
      notice = tokenUnavailable;
    }
  };

  const edit = (change: (definition: FormDefinition) => FormDefinition) => {
    if (definition === null) return;
    definition = change(definition);
    notice = null;
  };

  const save = async () => {
    if (definition === null) return;
    const sent = definition;
    begin();
    const result = await outcome(() =>
      client.PUT("/forms/{formId}/draft", {
        params: { path: { formId } },
        body: { expectedRevision: revision, definition: sent },
      }),
    );
    busy = false;
    if (result.kind === "ok") {
      // The API stores the definition as core parsed it (trimmed), so the editor catches up unless it changed since.
      const parsed = parseDefinition(result.data.definition);
      saved = parsed.ok ? parsed.value : sent;
      if (definition === sent) definition = saved;
      revision = result.data.revision;
      notice = "Draft saved";
    } else if (result.kind === "rejected") {
      const { error } = result;
      if (error._tag === "RevisionConflict") conflict = changedSinceOpened;
      else if (error._tag === "NoDraft") conflict = "This draft was discarded since you opened it.";
      else if (error._tag === "ValidationFailed") issues = error.issues;
      else notice = "This form no longer exists.";
    } else if (result.kind === "tooLarge") {
      notice = "This form is too large to save";
    } else if (result.kind === "unknown") {
      await load();
      notice = "We couldn't confirm the draft was saved, so it has been reloaded.";
    } else if (result.kind === "signIn") {
      signedOut = true;
    } else {
      notice = tokenUnavailable;
    }
  };

  onMount(load);
</script>

<section class="flex flex-col gap-6">
  {#if signedOut}
    <p>
      Sign in as an admin who can manage forms.
      <a class="font-medium underline" href={signInHref}>Sign in</a>
    </p>
  {:else if loadFailed}
    <p>
      Couldn't load this form.
      <Button variant="outline" size="sm" onclick={load}>Retry</Button>
    </p>
  {:else if missing}
    {#if notice !== null}
      <p role="status">{notice}</p>
    {/if}
    <p>This form no longer exists.</p>
  {:else if definition === null || form === null}
    <p class="text-muted-foreground">Loading…</p>
  {:else}
    <div class="flex flex-wrap items-center gap-4">
      <Button onclick={save} disabled={busy || definition === saved}>Save</Button>
      {#if form.currentVersion === null}
        <Button
          variant="destructive"
          disabled={busy || confirmingDelete}
          onclick={() => (confirmingDelete = true)}>Delete form</Button
        >
      {:else if revision !== null}
        <Button variant="outline" disabled={busy} onclick={discard}>Discard draft</Button>
      {/if}
      {#if notice !== null}
        <p role="status">{notice}</p>
      {/if}
    </div>

    {#if confirmingDelete}
      <div role="alert" class="flex flex-wrap items-center gap-2 rounded-md border p-3">
        <p class="grow">
          Delete this form? It has never been published, so it and its draft are removed for good.
        </p>
        <Button variant="destructive" size="sm" disabled={busy} onclick={remove}
          >Delete permanently</Button
        >
        <Button variant="outline" size="sm" onclick={() => (confirmingDelete = false)}
          >Cancel</Button
        >
      </div>
    {/if}

    {#if conflict !== null}
      <div role="alert" class="flex flex-wrap items-center gap-2 rounded-md border p-3">
        <p class="grow">{conflict} Reload it, losing your changes, or keep editing yours.</p>
        <Button variant="outline" size="sm" onclick={load}>Reload</Button>
        <Button variant="outline" size="sm" onclick={() => (conflict = null)}
          >Keep my changes</Button
        >
      </div>
    {/if}
    {#if issues.length > 0}
      <div role="alert" class="rounded-md border p-3">
        <p>The draft couldn't be saved:</p>
        <ul class="list-disc pl-5">
          {#each issues as issue, i (i)}
            <li>{issue.message}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <label class={fieldClass}>
      Form title
      <Input
        value={definition.title}
        maxlength={200}
        oninput={(event) => {
          const title = event.currentTarget.value;
          edit((d) => ({ ...d, title }));
        }}
      />
    </label>
    <div class={fieldClass}>
      <label for={`${uid}-description`}>Form description</label>
      <textarea
        id={`${uid}-description`}
        class={nativeInputClass}
        rows={3}
        maxlength={5000}
        value={definition.description ?? ""}
        oninput={(event) => {
          const description = optionalText(event.currentTarget.value);
          edit((d) => ({ ...d, description }));
        }}></textarea>
    </div>

    <ol class="flex flex-col gap-4">
      {#each definition.questions as question, index (question.id)}
        <li>
          <QuestionCard
            {question}
            {index}
            count={definition.questions.length}
            {edit}
            ids={webCryptoIds}
          />
        </li>
      {/each}
    </ol>

    <div class="flex items-end gap-2">
      <div class={fieldClass}>
        <label for={`${uid}-new-type`}>New question type</label>
        <select id={`${uid}-new-type`} class={nativeInputClass} bind:value={newType}>
          {#each questionTypeNames as type (type)}
            <option value={type}>{questionEditors[type].name}</option>
          {/each}
        </select>
      </div>
      <Button
        variant="outline"
        disabled={definition.questions.length >= QUESTIONS_CAP}
        onclick={() => edit((d) => addQuestion(d, newType, webCryptoIds))}>Add question</Button
      >
    </div>

    <FormSettings
      {client}
      {form}
      saved={(settings) => {
        if (form !== null) form = { ...form, ...settings };
      }}
      reload={reloadForm}
      signIn={() => (signedOut = true)}
    />

    <section class="flex flex-col gap-3" aria-labelledby={`${uid}-refs`}>
      <h2 id={`${uid}-refs`} class="text-lg font-semibold">External references</h2>
      {#if form.externalRefs.length === 0}
        <p class="text-sm text-muted-foreground">None. The host attaches references to the form.</p>
      {:else}
        <ul class="divide-y rounded-md border text-sm">
          {#each form.externalRefs as ref (`${ref.namespace} ${ref.refId}`)}
            <li class="flex gap-4 p-3">
              <span class="font-mono text-muted-foreground">{ref.namespace}</span>
              <span class="font-mono">{ref.refId}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</section>
