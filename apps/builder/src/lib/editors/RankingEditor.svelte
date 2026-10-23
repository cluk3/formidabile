<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import { RANKING_OPTIONS_MAX } from "@fb/core/editing";
  import ChoiceOptions from "#lib/editors/ChoiceOptions.svelte";
  import type { EditorProps } from "#lib/editors/props.ts";

  let {
    question,
    setConfig,
    addOption,
    removeOption,
  }: EditorProps<QuestionSnapshotOf<"ranking">> = $props();
</script>

<ChoiceOptions
  options={question.config.options}
  setOptions={(options) => setConfig({ ...question.config, options })}
  {addOption}
  {removeOption}
  cap={RANKING_OPTIONS_MAX}
/>
