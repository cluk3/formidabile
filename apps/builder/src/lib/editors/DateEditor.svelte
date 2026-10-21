<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import { Input } from "#lib/components/ui/input/index.js";
  import type { EditorProps } from "#lib/editors/props.ts";
  import { fieldClass, optionalText } from "#lib/fields.ts";

  let { question, setConfig }: EditorProps<QuestionSnapshotOf<"date">> = $props();
</script>

<div class="grid grid-cols-2 gap-2">
  <label class={fieldClass}>
    Earliest date
    <Input
      type="date"
      value={question.config.min ?? ""}
      oninput={(event) =>
        setConfig({ ...question.config, min: optionalText(event.currentTarget.value) })}
    />
  </label>
  <label class={fieldClass}>
    Latest date
    <Input
      type="date"
      value={question.config.max ?? ""}
      oninput={(event) =>
        setConfig({ ...question.config, max: optionalText(event.currentTarget.value) })}
    />
  </label>
</div>
