<script lang="ts">
  import { createFormApiClient } from "@fb/api-client";
  import { parseDefinition, type FormDefinition } from "@fb/core/definition";
  import { tick } from "svelte";
  import { checkDrafts, questionErrors, type Draft } from "./drafts.ts";
  import type { RendererProps } from "./props.ts";
  import QuestionCard from "./QuestionCard.svelte";

  let props: RendererProps = $props();

  type Loaded = { readonly versionId: string; readonly definition: FormDefinition };
  type View =
    | { readonly state: "loading" }
    | { readonly state: "failed" }
    | { readonly state: "refused" }
    | { readonly state: "answering"; readonly form: Loaded }
    | { readonly state: "submitted" };

  const live = $derived.by(() => {
    if (props.preview !== undefined) return undefined;
    const { apiBaseUrl, formId, getToken, onsubmitted } = props;
    const client = createFormApiClient({
      baseUrl: apiBaseUrl,
      getToken: () => getToken({ formId }),
    });
    return { formId, onsubmitted, client };
  });

  let loaded = $state<View>({ state: "loading" });
  const view: View = $derived(
    props.preview === undefined
      ? loaded
      : { state: "answering", form: { versionId: "", definition: props.preview } },
  );

  let drafts = $state<Record<string, Draft>>({});
  let errors = $state<Record<string, string>>({});
  let notice = $state<string>();
  let sending = $state(false);
  // One submission attempt: minted at the first Submit, resent by every later one until a 201 (ADR 0016).
  let idempotencyKey: string | undefined;
  let formElement = $state<HTMLFormElement>();
  const controls = "input, select, textarea";

  $effect(() => {
    if (live === undefined) return;
    const { client, formId } = live;
    loaded = { state: "loading" };
    client
      .GET("/respond/forms/{formId}", { params: { path: { formId } } })
      .then(({ data }) => {
        if (data === undefined) return (loaded = { state: "failed" });
        // A definition that doesn't parse has a question type this renderer doesn't know, and skipping it could
        // leave a required answer that can never be sent (ADR 0010).
        const parsed = parseDefinition(data.version.definition);
        loaded = parsed.ok
          ? { state: "answering", form: { versionId: data.version.id, definition: parsed.value } }
          : { state: "refused" };
      })
      .catch(() => (loaded = { state: "failed" }));
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

  const submit = async (event: SubmitEvent, form: Loaded) => {
    event.preventDefault();
    if (sending) return;
    notice = undefined;
    const checked = checkDrafts(form.definition, drafts);
    if (!checked.ok) return showErrors(checked.errors);
    errors = {};
    if (live === undefined) {
      notice = "Preview: these answers are valid. Nothing was sent.";
      return;
    }
    const { client, formId, onsubmitted } = live;
    idempotencyKey ??= crypto.randomUUID();
    sending = true;
    try {
      const { data, error } = await client.POST("/respond/forms/{formId}/responses", {
        params: { path: { formId } },
        body: { versionId: form.versionId, answers: checked.answers, idempotencyKey },
      });
      if (data !== undefined) {
        idempotencyKey = undefined;
        loaded = { state: "submitted" };
        onsubmitted?.({ responseId: data.responseId });
        return;
      }
      if (error?._tag === "ValidationFailed") {
        const next = questionErrors(error.issues);
        if (Object.keys(next).length > 0) return await showErrors(next);
      }
      notice = "We couldn't send your response. Please try again.";
    } catch {
      notice = "We couldn't send your response. Please try again.";
    } finally {
      sending = false;
    }
  };
</script>

<section class="root" part="root">
  {#if view.state === "loading"}
    <p class="status" role="status">Loading the form…</p>
  {:else if view.state === "failed"}
    <p class="status" role="alert">This form couldn't be loaded.</p>
  {:else if view.state === "refused"}
    <p class="status" role="alert">
      This form uses a question type this renderer doesn't support, so it can't be shown.
    </p>
  {:else if view.state === "submitted"}
    <p class="status" role="status">Thank you, your response was received.</p>
  {:else}
    {@const form = view.form}
    <h2 class="title" part="title">{form.definition.title}</h2>
    {#if form.definition.description}
      <p class="description" part="description">{form.definition.description}</p>
    {/if}
    <form bind:this={formElement} novalidate onsubmit={(event) => submit(event, form)}>
      {#each form.definition.questions as question (question.id)}
        <QuestionCard {question} bind:value={drafts[question.id]} error={errors[question.id]} />
      {/each}
      {#if notice !== undefined}
        <p class="notice" role="alert">{notice}</p>
      {/if}
      <button class="submit" part="submit" type="submit" aria-disabled={sending}>
        {sending ? "Sending…" : "Submit"}
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
  .submit {
    padding: 0.5rem 1rem;
    font: inherit;
  }
</style>
