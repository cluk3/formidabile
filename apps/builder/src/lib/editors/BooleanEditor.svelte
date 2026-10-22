<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import { checkClass } from "#lib/fields.ts";
  import type { EditorProps } from "#lib/editors/props.ts";

  let { question, setConfig }: EditorProps<QuestionSnapshotOf<"boolean">> = $props();

  const mustBeYes = $derived(question.config.mustBeYes === true);

  // The setting makes the question required, including when Required is cleared while it stays on.
  $effect(() => {
    if (mustBeYes && !question.required) setConfig(question.config, true);
  });
</script>

<label class={checkClass}>
  <input
    type="checkbox"
    checked={mustBeYes}
    onchange={(event) => {
      if (event.currentTarget.checked) setConfig({ mustBeYes: true }, true);
      else setConfig({});
    }}
  />
  Must be yes
</label>
<p class="text-sm text-muted-foreground">
  {#if mustBeYes}
    Respondents see one checkbox and must check it.
  {:else if question.required}
    Respondents must answer yes or no.
  {:else}
    Respondents may answer yes or no, or skip the question.
  {/if}
</p>
