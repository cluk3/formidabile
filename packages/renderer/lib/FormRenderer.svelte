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
  type Submission = {
    readonly versionId: string;
    readonly answers: Schemas["AnyAnswers"];
    readonly idempotencyKey: string;
  };
  /** A refusal shown above Submit while the answers stay, with what the respondent can do next. */
  type Notice =
    | { readonly code: Exclude<ProblemCode, "alreadyResponded" | "submitUnconfirmed"> }
    | { readonly code: "alreadyResponded"; readonly responseId: string }
    | { readonly code: "submitUnconfirmed"; readonly submission: Submission };
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
  const refusals = {
    Unauthenticated: true,
    NotFound: true,
    FormNotPublished: true,
    FormClosed: true,
    VersionSuperseded: true,
    AlreadyResponded: true,
    RevisionConflict: true,
    PayloadTooLarge: true,
    LengthRequired: true,
    ValidationFailed: true,
  } satisfies Record<Refusal["_tag"], true>;
  const isRefusal = (error: unknown): error is Refusal => {
    const tag =
      typeof error === "object" && error !== null ? Reflect.get(error, "_tag") : undefined;
    return typeof tag === "string" && Object.hasOwn(refusals, tag);
  };
  type Reply = {
    readonly data?: { readonly responseId: unknown };
    readonly error?: unknown;
    readonly response: Response;
  };

  /** The host's `getToken` failed, so the request was never sent. */
  class NotSent extends Error {}

  const live = $derived.by(() => {
    if (preview !== undefined) return undefined;
    const client = createFormApiClient({
      baseUrl: apiBaseUrl,
      getToken: async () => {
        try {
          return await getToken({ formId });
        } catch {
          throw new NotSent();
        }
      },
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

  const refuse = async (error: Refusal) => {
    switch (error._tag) {
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

  // Only a reply the contract describes is definite. A rejected `fetch`, a 5xx, or any other reply may follow a
  // commit, so `unknown` decides what the respondent can do (ADR 0016).
  const settle = async (send: () => Promise<Reply>, edited: boolean, unknown: () => void) => {
    sending = true;
    try {
      let reply: Reply;
      try {
        reply = await send();
      } catch (error) {
        return error instanceof NotSent ? warn({ code: "sendFailed" }) : unknown();
      }
      const { data, error, response } = reply;
      if (response.ok && typeof data?.responseId === "string") {
        idempotencyKey = undefined;
        loaded = { state: "submitted", edited };
        onsubmitted?.({ responseId: data.responseId });
      } else if (response.status === 413) {
        warn({ code: "tooLarge" });
      } else if (response.ok || response.status >= 500 || !isRefusal(error)) {
        unknown();
      } else {
        notice = undefined;
        await refuse(error);
      }
    } finally {
      sending = false;
    }
  };

  // Retry resends exactly what may already be stored, so the key returns that response (ADR 0016).
  const post = (client: FormApiClient, formId: string, submission: Submission) =>
    settle(
      () =>
        client.POST("/respond/forms/{formId}/responses", {
          params: { path: { formId } },
          body: submission,
        }),
      false,
      () => warn({ code: "submitUnconfirmed", submission }),
    );

  const submit = async (event: SubmitEvent, form: Loaded) => {
    event.preventDefault();
    if (sending) return;
    if (live !== undefined && notice?.code === "submitUnconfirmed")
      return post(live.client, live.formId, notice.submission);
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
    if (editing === undefined)
      return post(client, formId, {
        versionId: form.versionId,
        answers: checked.answers,
        idempotencyKey: (idempotencyKey ??= crypto.randomUUID()),
      });
    return settle(
      () =>
        client.PUT("/respond/responses/{responseId}", {
          params: { path: { responseId: editing.responseId } },
          body: { expectedRevision: editing.revision, answers: checked.answers },
        }),
      true,
      () => warn({ code: "editUnconfirmed" }),
    );
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
    {@const unconfirmed = notice?.code === "submitUnconfirmed"}
    <form bind:this={formElement} novalidate onsubmit={(event) => submit(event, form)}>
      <fieldset class="answers" disabled={unconfirmed}>
        {#each form.definition.questions as question (question.id)}
          <QuestionCard {question} bind:value={drafts[question.id]} error={errors[question.id]} />
        {/each}
      </fieldset>
      {#if notice !== undefined}
        {@const current = notice}
        <p class="notice" role="alert">{messages[current.code]}</p>
        {#if current.code === "versionSuperseded"}
          <p class="actions">
            <button class="action" part="action" type="button" onclick={() => open()}>
              Reload
            </button>
          </p>
        {:else if (current.code === "revisionConflict" || current.code === "editUnconfirmed") && form.editing}
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
        {:else if unconfirmed}
          {sending ? "Sending…" : "Retry"}
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
  .answers {
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
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
