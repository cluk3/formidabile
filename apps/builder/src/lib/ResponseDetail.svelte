<script lang="ts">
  import type { Schemas } from "@fb/api-client";
  import { interpretAnswers } from "@fb/core/answers";
  import { parseDefinition } from "@fb/core/definition";
  import type { Snippet } from "svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { answerOf } from "#lib/registry.ts";

  let {
    detail,
    close,
    actions,
  }: {
    detail: Schemas["ResponseDetail"];
    close: () => void;
    /** What the signed-in user may do with the response, under its heading. */
    actions?: Snippet;
  } = $props();
  const uid = $props.id();

  const { response, version } = $derived(detail);
  // Read back through core's structural checks; the answers passed this version's schema when they were stored.
  const interpreted = $derived.by(() => {
    const parsed = parseDefinition(version.definition);
    return parsed.ok ? interpretAnswers(parsed.value, response.answers) : null;
  });
</script>

<section class="flex flex-col gap-3 rounded-md border p-4" aria-labelledby={`${uid}-heading`}>
  <div class="flex items-center gap-2">
    <h3 id={`${uid}-heading`} class="grow font-semibold">
      {response.respondentId === null
        ? "Anonymous response"
        : `Response from ${response.respondentId}`}
    </h3>
    <Button variant="outline" size="sm" onclick={close}>Close</Button>
  </div>
  <p class="text-sm text-muted-foreground">
    Version {version.number}, submitted {new Date(
      response.submittedAt,
    ).toLocaleString()}{response.editedAt === null
      ? ""
      : `, edited ${new Date(response.editedAt).toLocaleString()}`}
  </p>
  {#if response.externalRefs.length > 0}
    <ul class="flex flex-wrap gap-2 text-sm" aria-label="External references">
      {#each response.externalRefs as ref (`${ref.namespace} ${ref.refId}`)}
        <li class="rounded-full border px-2 font-mono">{ref.namespace} {ref.refId}</li>
      {/each}
    </ul>
  {/if}
  {@render actions?.()}
  {#if interpreted === null}
    <p>This version uses a question type the builder doesn't support.</p>
  {:else}
    <dl class="flex flex-col gap-3">
      {#each interpreted as { question, answer } (question.id)}
        {@const Answer = answerOf(question)}
        <div class="flex flex-col gap-1">
          <dt class="text-sm font-medium">{question.label}</dt>
          <dd>
            {#if answer === undefined}
              <span class="text-muted-foreground">Not answered</span>
            {:else}
              <Answer {question} value={answer.value} display={answer.display} />
            {/if}
          </dd>
        </div>
      {/each}
    </dl>
  {/if}
</section>
