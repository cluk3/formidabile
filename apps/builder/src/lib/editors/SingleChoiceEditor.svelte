<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import ChoiceOptions from "#lib/editors/ChoiceOptions.svelte";
  import type { EditorProps } from "#lib/editors/props.ts";
  import { checkClass } from "#lib/fields.ts";

  let {
    question,
    setConfig,
    addOption,
    removeOption,
  }: EditorProps<QuestionSnapshotOf<"single_choice">> = $props();

  const displays = [
    ["radio", "Radio buttons"],
    ["dropdown", "Dropdown"],
  ] as const;
</script>

<ChoiceOptions
  options={question.config.options}
  setOptions={(options) => setConfig({ ...question.config, options })}
  {addOption}
  {removeOption}
/>
<fieldset class="flex gap-4">
  <legend class="mb-1.5 text-sm font-medium">Shown as</legend>
  {#each displays as [display, label] (display)}
    <label class={checkClass}>
      <input
        type="radio"
        name={`${question.id}-display`}
        checked={question.config.display === display}
        onchange={() => setConfig({ ...question.config, display })}
      />
      {label}
    </label>
  {/each}
</fieldset>
