<script lang="ts">
  import { createFormApiClient, type FormApiClient, type Schemas } from "@fb/api-client";
  import { parseDefinition, type FormDefinition } from "@fb/core/definition";
  import { tick } from "svelte";
  import { checkDrafts, draftsOf, questionErrors, type Draft } from "./drafts.ts";
  import { messages, unauthenticated, type ProblemCode } from "./problems.ts";
  import type { RendererProps } from "./props.ts";
  import QuestionCard from "./QuestionCard.svelte";

  const { preview, apiBaseUrl, formId, responseId, getToken, onsubmitted, onerror }: RendererProps =
    $props();

  /** A response of the respondent's, saved over the revision its last read returned. */
  type Editing = { readonly responseId: string; readonly revision: string };
  type Loaded = {
    readonly versionId: string;
    readonly definition: FormDefinition;
    readonly editing?: Editing;
  };
  type View =
    | { readonly state: "loading" }
    | { readonly state: "stopped"; readonly code: ProblemCode }
    | { readonly state: "answering"; readonly form: Loaded }
    | { readonly state: "submitted"; readonly edited: boolean };
  /** A refusal shown above Submit while the answers stay, with what the respondent can do next. */
  type Notice =
    | { readonly code: Exclude<ProblemCode, "alreadyResponded"> }
    | { readonly code: "alreadyResponded"; readonly responseId: string };
  type Refusal =
    | Schemas["UnauthenticatedEncoded"]
    | Schemas["NotFoundEncoded"]
    | Schemas["FormNotPublishedEncoded"]
    | Schemas["FormClosedEncoded"]
    | Schemas["VersionSupersededEncoded"]
    | Schemas["AlreadyRespondedEncoded"]
    | Schemas["RevisionConflictEncoded"]
    | Schemas["PayloadTooLargeEncoded"]
    | Schemas["LengthRequiredEncoded"]
    | Schemas["ValidationFailedEncoded"];

  const live = $derived.by(() => {
    if (preview !== undefined) return undefined;
    const client = createFormApiClient({
      baseUrl: apiBaseUrl,
      getToken: () => getToken({ formId }),
    });
    return { formId, responseId, client };
  });

  let loaded = $state<View>({ state: "loading" });
  const view: View = $derived(
    preview === undefined
      ? loaded
      : { state: "answering", form: { versionId: "", definition: preview } },
  );

  let drafts = $state<Record<string, Draft>>({});
  let errors = $state<Record<string, string>>({});
  let notice = $state<Notice>();
  let previewed = $state(false);
  let sending = $state(false);
  // One submission attempt: minted at the first Submit, resent by every later one until a 201 (ADR 0016).
  let idempotencyKey: string | undefined;
  let formElement = $state<HTMLFormElement>();
  const controls = "input, select, textarea";

  const stop = (code: ProblemCode) => {
    loaded = { state: "stopped", code };
    onerror?.({ code, message: messages[code] });
  };
  const warn = (next: Notice) => {
    notice = next;
    onerror?.({ code: next.code, message: messages[next.code] });
  };

  const answer = (form: Loaded, initial: Record<string, Draft>) => {
    drafts = initial;
    errors = {};
    notice = undefined;
    idempotencyKey = undefined;
    loaded = { state: "answering", form };
  };

  // A definition that doesn't parse has a question type this renderer doesn't know, and skipping it could
  // leave a required answer that can never be sent (ADR 0010).
  const known = (definition: unknown) => {
    const parsed = parseDefinition(definition);
    return parsed.ok ? parsed.value : undefined;
  };

  const loadRefusal = (error: Refusal | undefined): ProblemCode => {
    switch (error?._tag) {
      case "Unauthenticated":
        return unauthenticated(error.reason);
      case "FormClosed":
        return "closed";
      case "FormNotPublished":
        return "unavailable";
      case "NotFound":
        return "notFound";
      default:
        return "loadFailed";
    }
  };

  // An edit stays on the response's own version, whatever the form's current one is (ADR 0002).
  const openResponse = async (client: FormApiClient, id: string) => {
    const { data, error } = await client.GET("/respond/responses/{responseId}", {
      params: { path: { responseId: id } },
    });
    if (data === undefined) return stop(loadRefusal(error));
    if (!data.editable) return stop("closed");
    const definition = known(data.version.definition);
    if (definition === undefined) return stop("unsupported");
    answer(
      {
        versionId: data.version.id,
        definition,
        editing: { responseId: id, revision: data.response.revision },
      },
      draftsOf(definition, data.response.answers),
    );
  };

  const openForm = async (client: FormApiClient, formId: string) => {
    const { data, error } = await client.GET("/respond/forms/{formId}", {
      params: { path: { formId } },
    });
    if (data === undefined) return stop(loadRefusal(error));
    // A grant can never send the one response a limited form allows, so the respondent signs in first.
    if (data.respondent === "anonymous" && data.responseLimit === "one_per_respondent")
      return stop("signInRequired");
    if (data.myResponseId !== null) return openResponse(client, data.myResponseId);
    const definition = known(data.version.definition);
    if (definition === undefined) return stop("unsupported");
    answer({ versionId: data.version.id, definition }, {});
  };

  /** Loads the form afresh, or the response `target` (by default the one the host gave) for editing. */
  const open = (target = live?.responseId) => {
    if (live === undefined) return;
    const { client, formId } = live;
    loaded = { state: "loading" };
    (target === undefined ? openForm(client, formId) : openResponse(client, target)).catch(() =>
      stop("loadFailed"),
    );
  };

  $effect(() => {
    open();
  });

  const showErrors = async (next: Record<string, string>) => {
    errors = next;
    await tick();
    // A radio group is marked invalid as a whole, so focus goes to its first radio.
    const invalid = formElement?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const control = invalid?.matches(controls)
      ? invalid
      : invalid?.querySelector<HTMLElement>(controls);
    control?.focus();
  };

  const refuse = async (error: Refusal | undefined, status: number) => {
    if (status === 413) return warn({ code: "tooLarge" });
    switch (error?._tag) {
      case "ValidationFailed": {
        const next = questionErrors(error.issues);
        if (Object.keys(next).length > 0) return showErrors(next);
        break;
      }
      case "Unauthenticated":
        return warn({ code: unauthenticated(error.reason) });
      case "FormClosed":
        return stop("closed");
      case "NotFound":
        return stop("notFound");
      case "VersionSuperseded":
        return warn({ code: "versionSuperseded" });
      case "RevisionConflict":
        return warn({ code: "revisionConflict" });
      case "AlreadyResponded":
        return warn({ code: "alreadyResponded", responseId: error.responseId });
    }
    warn({ code: "sendFailed" });
  };

  const submit = async (event: SubmitEvent, form: Loaded) => {
    event.preventDefault();
    if (sending) return;
    notice = undefined;
    previewed = false;
    const checked = checkDrafts(form.definition, drafts);
    if (!checked.ok) return showErrors(checked.errors);
    errors = {};
    if (live === undefined) {
      previewed = true;
      return;
    }
    const { client, formId } = live;
    const { editing } = form;
    sending = true;
    try {
      const { data, error, response } =
        editing === undefined
          ? await client.POST("/respond/forms/{formId}/responses", {
              params: { path: { formId } },
              body: {
                versionId: form.versionId,
                answers: checked.answers,
                idempotencyKey: (idempotencyKey ??= crypto.randomUUID()),
              },
            })
          : await client.PUT("/respond/responses/{responseId}", {
              params: { path: { responseId: editing.responseId } },
              body: { expectedRevision: editing.revision, answers: checked.answers },
            });
      if (data !== undefined) {
        idempotencyKey = undefined;
        loaded = { state: "submitted", edited: editing !== undefined };
        onsubmitted?.({ responseId: data.responseId });
        return;
      }
      await refuse(error, response.status);
    } catch {
      warn({ code: "sendFailed" });
    } finally {
      sending = false;
    }
  };
</script>

<section class="root" part="root">
  {#if view.state === "loading"}
    <p class="status" role="status">Loading the form…</p>
  {:else if view.state === "stopped"}
    <p class="status" role="alert">{messages[view.code]}</p>
  {:else if view.state === "submitted"}
    <p class="status" role="status">
      {view.edited ? "Your changes were saved." : "Thank you, your response was received."}
    </p>
  {:else}
    {@const form = view.form}
    <h2 class="title" part="title">{form.definition.title}</h2>
    {#if form.definition.description}
      <p class="description" part="description">{form.definition.description}</p>
    {/if}
    {#if form.editing}
      <p class="description" part="description">You're editing the response you sent.</p>
    {/if}
    <form bind:this={formElement} novalidate onsubmit={(event) => submit(event, form)}>
      {#each form.definition.questions as question (question.id)}
        <QuestionCard {question} bind:value={drafts[question.id]} error={errors[question.id]} />
      {/each}
      {#if notice !== undefined}
        {@const current = notice}
        <p class="notice" role="alert">{messages[current.code]}</p>
        {#if current.code === "versionSuperseded"}
          <p class="actions">
            <button class="action" part="action" type="button" onclick={() => open()}>
              Reload
            </button>
          </p>
        {:else if current.code === "revisionConflict" && form.editing}
          {@const { responseId } = form.editing}
          <p class="actions">
            <button class="action" part="action" type="button" onclick={() => open(responseId)}>
              Reload
            </button>
            <button class="action" part="action" type="button" onclick={() => (notice = undefined)}>
              Stay
            </button>
          </p>
        {:else if current.code === "alreadyResponded"}
          <p class="actions">
            <button
              class="action"
              part="action"
              type="button"
              onclick={() => open(current.responseId)}
            >
              Edit your response
            </button>
          </p>
        {/if}
      {:else if previewed}
        <p class="notice" role="status">Preview: these answers are valid. Nothing was sent.</p>
      {/if}
      <button class="submit" part="submit" type="submit" aria-disabled={sending}>
        {#if form.editing}
          {sending ? "Saving…" : "Save changes"}
        {:else}
          {sending ? "Sending…" : "Submit"}
        {/if}
      </button>
    </form>
  {/if}
</section>

<style>
  .root {
    display: block;
    padding: 1rem;
    color: var(--form-renderer-text, rgb(10, 20, 30));
    font-family: inherit;
  }
  .title {
    margin: 0 0 0.5rem;
    color: rgb(10, 20, 30);
  }
  .description {
    margin: 0 0 1rem;
  }
  .notice {
    color: var(--form-renderer-error, rgb(180, 20, 20));
  }
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  .submit,
  .action {
    padding: 0.5rem 1rem;
    font: inherit;
  }
</style>
