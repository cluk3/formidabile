<script lang="ts">
  import { createFormApiClient, type FormApiClient, type Schemas } from "@fb/api-client";
  import { pathOf } from "@fb/core/answers";
  import { pagesOf, parseDefinition, questionsOf, type FormDefinition } from "@fb/core/definition";
  import { tick, untrack } from "svelte";
  import {
    answersFromDrafts,
    checkDrafts,
    checkPage,
    draftsOf,
    questionErrors,
    type Draft,
  } from "./drafts.ts";
  import { nextDestination, pageTitle } from "./paging.ts";
  import { messages, unauthenticated, type ProblemCode } from "./problems.ts";
  import type { RendererProps } from "./props.ts";
  import QuestionCard from "./QuestionCard.svelte";

  const {
    preview,
    apiBaseUrl,
    formId,
    responseId,
    getToken,
    onsubmitted,
    onerror,
    onpagechange,
  }: RendererProps = $props();

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
  let formHeading = $state<HTMLElement>();
  let pageHeading = $state<HTMLElement>();
  /** Index into `pagesOf`. Edit mode and a new response both start on the first page. */
  let pageIndex = $state(0);
  /** Pages the respondent left by Next, newest at the end. Back pops this and does not re-run jumps. */
  let history = $state<number[]>([]);
  /**
   * Bumped when a page should take focus on its heading. Validation failure focuses the invalid field
   * instead, and does not bump this.
   */
  let headingFocus = $state(0);
  let announcedPage = "";
  const controls = "input, select, textarea, button";

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
    pageIndex = 0;
    history = [];
    loaded = { state: "loading" };
    (target === undefined ? openForm(client, formId) : openResponse(client, target)).catch(() =>
      stop("loadFailed"),
    );
  };

  $effect(() => {
    open();
  });

  // The first page of a form, and each later one, focuses its heading. A failed Next focuses the field instead.
  $effect(() => {
    if (view.state !== "answering") {
      if (headingFocus !== 0) headingFocus = 0;
      return;
    }
    if (headingFocus === 0) headingFocus = 1;
  });

  $effect(() => {
    const token = headingFocus;
    if (view.state !== "answering" || token === 0) return;
    // Page index is not a dependency: a validation failure moves the page without taking heading focus.
    // The effect runs after the heading is in the document, so focus is synchronous. Deferring it would
    // land after the respondent's first Tab and steal that focus.
    const index = untrack(() => pageIndex);
    const page = pagesOf(view.form.definition)[index];
    if (page === undefined) return;
    // `focus()` lets the browser scroll the heading into view. Nothing here calls `scrollIntoView`.
    (pageTitle(page) === null ? formHeading : pageHeading)?.focus();
  });

  $effect(() => {
    if (view.state !== "answering") {
      announcedPage = "";
      return;
    }
    const count = pagesOf(view.form.definition).length;
    if (pageIndex < count) return;
    pageIndex = Math.max(0, count - 1);
    history = history.filter((index) => index < pageIndex);
    headingFocus += 1;
  });

  $effect(() => {
    if (view.state !== "answering") return;
    const page = pagesOf(view.form.definition)[pageIndex];
    if (page === undefined) return;
    const detail = { pageId: page.id, title: pageTitle(page) };
    const key = `${detail.pageId ?? ""}\n${detail.title ?? ""}`;
    if (key === announcedPage) return;
    announcedPage = key;
    onpagechange?.(detail);
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

  /** Shows `next` on the page of the first invalid question, in definition order. */
  const revealErrors = (form: Loaded, next: Record<string, string>) => {
    const pages = pagesOf(form.definition);
    const first = questionsOf(form.definition).find((question) => next[question.id] !== undefined);
    const target =
      first === undefined
        ? pageIndex
        : pages.findIndex((candidate) =>
            candidate.questions.some((question) => question.id === first.id),
          );
    if (target >= 0 && target !== pageIndex) {
      const at = history.indexOf(target);
      history =
        at === -1 ? Array.from({ length: target }, (_, index) => index) : history.slice(0, at);
      pageIndex = target;
    }
    return showErrors(next);
  };

  /** Next: the following page, once this page's questions are valid. */
  const goNext = async (form: Loaded, pageId: string | null) => {
    const pages = pagesOf(form.definition);
    const page = pages[pageIndex];
    if (page === undefined) return;
    notice = undefined;
    previewed = false;
    const checked = checkPage(form.definition, drafts, page.questions);
    if (!checked.ok) return revealErrors(form, checked.errors);
    const nextIndex = pages.findIndex((candidate) => candidate.id === pageId);
    if (nextIndex < 0) return;
    errors = {};
    history = [...history, pageIndex];
    pageIndex = nextIndex;
    headingFocus += 1;
  };

  const back = () => {
    const previous = history.at(-1);
    if (previous === undefined || sending) return;
    history = history.slice(0, -1);
    pageIndex = previous;
    errors = {};
    previewed = false;
    headingFocus += 1;
  };

  const refuse = async (error: Refusal) => {
    switch (error._tag) {
      case "ValidationFailed": {
        const next = questionErrors(error.issues);
        if (Object.keys(next).length > 0 && view.state === "answering")
          return revealErrors(view.form, next);
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
        // An unsent Retry leaves the earlier submission as unconfirmed as it was.
        return error instanceof NotSent && notice?.code !== "submitUnconfirmed"
          ? warn({ code: "sendFailed" })
          : unknown();
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
    const pages = pagesOf(form.definition);
    const page = pages[pageIndex];
    if (page !== undefined) {
      const destination = nextDestination(
        form.definition,
        answersFromDrafts(form.definition, drafts),
        page,
      );
      if (destination.kind === "page") return goNext(form, destination.pageId);
    }
    notice = undefined;
    previewed = false;
    const checked = checkDrafts(form.definition, drafts);
    if (!checked.ok) return revealErrors(form, checked.errors);
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
    {@const pages = pagesOf(form.definition)}
    {@const page = pages[pageIndex] ?? pages[0]!}
    {@const heading = pageTitle(page)}
    {@const answers = answersFromDrafts(form.definition, drafts)}
    {@const shown = new Set(
      pathOf(form.definition, answers).questions.map((question) => question.id),
    )}
    {@const atEnd = nextDestination(form.definition, answers, page).kind === "end"}
    <!-- Programmatic focus target when the page has no title of its own. Not in the tab order. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <h2 bind:this={formHeading} class="title" part="title" tabindex="-1">
      {form.definition.title}
    </h2>
    {#if form.definition.description}
      <p class="description" part="description">{form.definition.description}</p>
    {/if}
    {#if form.editing}
      <p class="description" part="description">You're editing the response you sent.</p>
    {/if}
    {#if heading !== null}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <h2 bind:this={pageHeading} class="title" tabindex="-1">{heading}</h2>
    {/if}
    {#if page.description}
      <p class="description">{page.description}</p>
    {/if}
    {@const unconfirmed = notice?.code === "submitUnconfirmed"}
    <form bind:this={formElement} novalidate onsubmit={(event) => submit(event, form)}>
      <fieldset class="answers" disabled={unconfirmed}>
        {#each page.questions.filter( (question) => shown.has(question.id) ) as question (question.id)}
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
      <div class="actions">
        {#if history.length > 0}
          <button
            class="action"
            part="back"
            type="button"
            disabled={unconfirmed || sending}
            onclick={back}
          >
            Back
          </button>
        {/if}
        <button class="submit" part="submit" type="submit" aria-disabled={sending}>
          {#if !atEnd}
            Next
          {:else if form.editing}
            {sending ? "Saving…" : "Save changes"}
          {:else if unconfirmed}
            {sending ? "Sending…" : "Retry"}
          {:else}
            {sending ? "Sending…" : "Submit"}
          {/if}
        </button>
      </div>
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
