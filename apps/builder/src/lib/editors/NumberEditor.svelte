<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import { Input } from "#lib/components/ui/input/index.js";
  import type { EditorProps } from "#lib/editors/props.ts";
  import { checkClass, fieldClass, optionalNumber } from "#lib/fields.ts";

  let { question, setConfig }: EditorProps<QuestionSnapshotOf<"number">> = $props();
</script>

<label class={checkClass}>
  <input
    type="checkbox"
    checked={question.config.integer}
    onchange={(event) => setConfig({ ...question.config, integer: event.currentTarget.checked })}
  />
  Whole numbers only
</label>
<div class="grid grid-cols-2 gap-2">
  <label class={fieldClass}>
    Minimum
    <Input
      type="number"
      step="any"
      value={question.config.min ?? ""}
      oninput={(event) =>
        setConfig({ ...question.config, min: optionalNumber(event.currentTarget.value) })}
    />
  </label>
  <label class={fieldClass}>
    Maximum
    <Input
      type="number"
      step="any"
      value={question.config.max ?? ""}
      oninput={(event) =>
        setConfig({ ...question.config, max: optionalNumber(event.currentTarget.value) })}
    />
  </label>
</div>
