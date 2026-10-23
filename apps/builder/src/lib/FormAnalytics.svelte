<script lang="ts">
  import type { FormApiClient, Schemas } from "@fb/api-client";
  import { onMount } from "svelte";
  import {
    constraintsText,
    countsText,
    numberText,
    offeredEverywhere,
    otherLabelsText,
    resultText,
    share,
    shareText,
    versionsText,
  } from "#lib/analytics.ts";
  import { outcome } from "#lib/api.ts";
  import { Button } from "#lib/components/ui/button/index.js";
  import { registry } from "#lib/registry.ts";

  let {
    client,
    formId,
    signInHref,
  }: {
    client: FormApiClient;
    formId: string;
    signInHref: string;
  } = $props();
  const uid = $props.id();

  let analytics = $state.raw<Schemas["FormAnalytics"] | null>(null);
  let signedOut = $state(false);
  let missing = $state(false);
  let failed = $state(false);

  const load = async () => {
    failed = false;
    const result = await outcome(() =>
      client.GET("/forms/{formId}/analytics", { params: { path: { formId } } }),
    );
    if (result.kind === "ok") analytics = result.data;
    else if (result.kind === "signIn") signedOut = true;
    else if (result.kind === "rejected" && result.error._tag === "Forbidden") signedOut = true;
    else if (result.kind === "rejected" && result.error._tag === "NotFound") missing = true;
    else failed = true;
  };

  onMount(load);

  const tableClass = "w-full text-left text-sm [&_td]:p-2 [&_th]:p-2 [&_tr]:border-b";
  const captionClass = "mb-1 text-left font-medium";
</script>

{#snippet bar(percent: number | null)}
  <span class="flex items-center gap-2">
    <span class="h-2 w-24 rounded-full bg-muted" aria-hidden="true">
      <span class="block h-full rounded-full bg-primary" style:width={`${percent ?? 0}%`}></span>
    </span>
    {shareText(percent)}
  </span>
{/snippet}

{#snippet combinedTable(question: Schemas["QuestionAnalytics"])}
  {@const summary = question.combined.summary}
  {#if summary.type === "single_choice" || summary.type === "multiple_choice"}
    <table class={tableClass}>
      <caption class={captionClass}>All versions</caption>
      <thead>
        <tr><th>Option</th><th>Chosen</th><th>Share</th><th>Offered in</th></tr>
      </thead>
      <tbody>
        {#each summary.options as option (option.value)}
          <tr>
            <th scope="row" class="font-normal">{option.label}</th>
            <td>{option.count}</td>
            <td>{@render bar(share(option.count, option.base))}</td>
            <td>
              {versionsText(option.offeredIn)}
              {#if option.otherLabels.length > 0}
                ({otherLabelsText(option.otherLabels)})
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if !offeredEverywhere(summary.options)}
      <p class="text-sm text-muted-foreground">
        Some options weren't offered in every version. Each share counts only the answers from
        versions that offered the option, so the shares don't add up to 100%.
      </p>
    {/if}
  {:else if summary.type === "ranking"}
    <table class={tableClass}>
      <caption class={captionClass}>All versions</caption>
      <thead>
        <tr>
          <th>Option</th><th>Mean position</th><th>First place</th><th>Share of first</th><th
            >Offered in</th
          >
        </tr>
      </thead>
      <tbody>
        {#each summary.options as option (option.value)}
          <tr>
            <th scope="row" class="font-normal">{option.label}</th>
            <td>{numberText(option.meanPosition)}</td>
            <td>{option.firstPlace}</td>
            <td>{@render bar(share(option.firstPlace, option.base))}</td>
            <td>
              {versionsText(option.offeredIn)}
              {#if option.otherLabels.length > 0}
                ({otherLabelsText(option.otherLabels)})
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if !offeredEverywhere(summary.options)}
      <p class="text-sm text-muted-foreground">
        Some options weren't offered in every version. Each mean counts only the answers from
        versions that offered the option.
      </p>
    {/if}
  {:else if summary.type === "boolean"}
    {@const answered = summary.trueCount + summary.falseCount}
    <table class={tableClass}>
      <caption class={captionClass}>All versions</caption>
      <thead>
        <tr><th>Answer</th><th>Count</th><th>Share</th></tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row" class="font-normal">Yes</th>
          <td>{summary.trueCount}</td>
          <td>{@render bar(share(summary.trueCount, answered))}</td>
        </tr>
        <tr>
          <th scope="row" class="font-normal">No</th>
          <td>{summary.falseCount}</td>
          <td>{@render bar(share(summary.falseCount, answered))}</td>
        </tr>
      </tbody>
    </table>
  {:else if summary.type === "single_choice_matrix" || summary.type === "multiple_choice_matrix"}
    <table class={tableClass}>
      <caption class={captionClass}>All versions</caption>
      <thead>
        <tr><th>Row</th><th>Column</th><th>Count</th><th>Share</th></tr>
      </thead>
      <tbody>
        {#each summary.cells as cell (`${cell.row}\0${cell.column}`)}
          <tr>
            <th scope="row" class="font-normal">{cell.rowLabel}</th>
            <td>{cell.columnLabel}</td>
            <td>{cell.count}</td>
            <td>{@render bar(cell.share)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if summary.type === "number"}
    <table class={tableClass}>
      <caption class={captionClass}>All versions</caption>
      <tbody>
        {#each [["Answers", summary.count], ["Minimum", summary.min], ["Maximum", summary.max], ["Mean", summary.mean], ["Median", summary.median]] as const as [name, value] (name)}
          <tr>
            <th scope="row" class="font-normal">{name}</th>
            <td>{numberText(value)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if summary.nps}
      {@const nps = summary.nps}
      <table class={tableClass}>
        <caption class={captionClass}>NPS</caption>
        <thead>
          <tr><th>Group</th><th>Count</th><th>Share</th></tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" class="font-normal">Promoters</th>
            <td>{nps.promoters}</td>
            <td>{@render bar(share(nps.promoters, nps.answered))}</td>
          </tr>
          <tr>
            <th scope="row" class="font-normal">Passives</th>
            <td>{nps.passives}</td>
            <td>{@render bar(share(nps.passives, nps.answered))}</td>
          </tr>
          <tr>
            <th scope="row" class="font-normal">Detractors</th>
            <td>{nps.detractors}</td>
            <td>{@render bar(share(nps.detractors, nps.answered))}</td>
          </tr>
          <tr>
            <th scope="row" class="font-normal">Score</th>
            <td colspan="2">{numberText(nps.score)}</td>
          </tr>
        </tbody>
      </table>
    {/if}
  {/if}
{/snippet}

<section class="flex flex-col gap-8">
  {#if signedOut}
    <p>
      Sign in as someone who can read responses.
      <a class="font-medium underline" href={signInHref}>Sign in</a>
    </p>
  {:else if missing}
    <p>This form doesn't exist.</p>
  {:else if failed}
    <p>
      Couldn't load the analytics.
      <Button variant="outline" size="sm" onclick={load}>Retry</Button>
    </p>
  {:else if analytics === null}
    <p class="text-muted-foreground">Loading…</p>
  {:else if analytics.versions.length === 0}
    <p>This form hasn't been published, so it has no responses yet.</p>
  {:else}
    <table class={tableClass}>
      <caption class={captionClass}>Responses by version</caption>
      <thead>
        <tr><th>Version</th><th>Responses</th><th>Published</th></tr>
      </thead>
      <tbody>
        {#each analytics.versions as version (version.versionId)}
          <tr>
            <th scope="row" class="font-normal">Version {version.number}</th>
            <td>{version.responses}</td>
            <td>{new Date(version.publishedAt).toLocaleString()}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">All versions</th>
          <td>{analytics.totalResponses}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    {#each analytics.questions as question, index (question.questionId)}
      <section class="flex flex-col gap-3" aria-labelledby={`${uid}-question-${index}`}>
        <div>
          <h2 id={`${uid}-question-${index}`} class="text-lg font-semibold">{question.label}</h2>
          <p class="text-sm text-muted-foreground">{registry[question.type].name}</p>
          {#if !question.inCurrentVersion}
            <p class="text-sm text-muted-foreground">Not in the current version.</p>
          {/if}
          {#if question.otherLabels.length > 0}
            <p class="text-sm text-muted-foreground">
              Also labelled {otherLabelsText(question.otherLabels)}.
            </p>
          {/if}
        </div>
        <p>{countsText(question)}</p>
        <table class={tableClass}>
          <caption class={captionClass}>Answered, skipped and not shown</caption>
          <thead>
            <tr><th>Outcome</th><th>Count</th><th>Share of responses</th></tr>
          </thead>
          <tbody>
            {#each [["Answered", question.combined.answered], ["Skipped", question.combined.skipped], ["Not shown", question.combined.notShown]] as const as [name, count] (name)}
              <tr>
                <th scope="row" class="font-normal">{name}</th>
                <td>{count}</td>
                <td>{@render bar(share(count, question.combined.responses))}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {@render combinedTable(question)}
        <table class={tableClass}>
          <caption class={captionClass}>By version</caption>
          <thead>
            <tr>
              <th>Version</th>
              <th>Responses</th>
              <th>Shown</th>
              <th>Answered</th>
              <th>Skipped</th>
              <th>Not shown</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {#each question.byVersion as entry (entry.version)}
              <tr>
                <th scope="row" class="font-normal">Version {entry.version}</th>
                {#if entry.present}
                  {@const allowed = constraintsText(entry.constraints)}
                  <td>{entry.responses}</td>
                  <td>{entry.shown}</td>
                  <td>{entry.answered}</td>
                  <td>{entry.skipped}</td>
                  <td>{entry.notShown}</td>
                  <td>
                    <span class="block">{resultText(entry.summary)}</span>
                    {#if allowed !== null}
                      <span class="block text-muted-foreground">{allowed}</span>
                    {/if}
                  </td>
                {:else}
                  <td colspan="6" class="text-muted-foreground">Not in this version</td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/each}
  {/if}
</section>
