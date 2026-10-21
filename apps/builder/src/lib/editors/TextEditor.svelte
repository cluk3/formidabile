<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import { Input } from "#lib/components/ui/input/index.js";
  import type { EditorProps } from "#lib/editors/props.ts";
  import { checkClass, fieldClass, optionalNumber } from "#lib/fields.ts";

  let { question, setConfig }: EditorProps<QuestionSnapshotOf<"text">> = $props();
</script>

<label class={checkClass}>
  <input
    type="checkbox"
    checked={question.config.display === "multi_line"}
    onchange={(event) =>
      setConfig({
        ...question.config,
        display: event.currentTarget.checked ? "multi_line" : "single_line",
      })}
  />
  Long answer
</label>
<label class={fieldClass}>
  Maximum length
  <Input
    type="number"
    min={1}
    max={10_000}
    step={1}
    value={question.config.maxLength ?? ""}
    oninput={(event) =>
      setConfig({ ...question.config, maxLength: optionalNumber(event.currentTarget.value) })}
  />
</label>
