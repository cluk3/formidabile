<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import { Input } from "#lib/components/ui/input/index.js";
  import ChoiceOptions from "#lib/editors/ChoiceOptions.svelte";
  import type { EditorProps } from "#lib/editors/props.ts";
  import { fieldClass, optionalNumber } from "#lib/fields.ts";

  let {
    question,
    setConfig,
    addOption,
    removeOption,
  }: EditorProps<QuestionSnapshotOf<"multiple_choice">> = $props();
</script>

<ChoiceOptions
  options={question.config.options}
  setOptions={(options) => setConfig({ ...question.config, options })}
  {addOption}
  {removeOption}
/>
<div class="grid grid-cols-2 gap-2">
  <label class={fieldClass}>
    Fewest selections
    <Input
      type="number"
      min={1}
      step={1}
      value={question.config.minSelected ?? ""}
      oninput={(event) =>
        setConfig({ ...question.config, minSelected: optionalNumber(event.currentTarget.value) })}
    />
  </label>
  <label class={fieldClass}>
    Most selections
    <Input
      type="number"
      min={1}
      step={1}
      value={question.config.maxSelected ?? ""}
      oninput={(event) =>
        setConfig({ ...question.config, maxSelected: optionalNumber(event.currentTarget.value) })}
    />
  </label>
</div>
