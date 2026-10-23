<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import { Input } from "#lib/components/ui/input/index.js";
  import type { EditorProps } from "#lib/editors/props.ts";
  import { fieldClass, optionalText } from "#lib/fields.ts";

  let { question, setConfig }: EditorProps<QuestionSnapshotOf<"time_of_day">> = $props();
</script>

<div class="grid grid-cols-2 gap-2">
  <label class={fieldClass}>
    Earliest time
    <Input
      type="time"
      value={question.config.earliest ?? ""}
      oninput={(event) =>
        setConfig({ ...question.config, earliest: optionalText(event.currentTarget.value) })}
    />
  </label>
  <label class={fieldClass}>
    Latest time
    <Input
      type="time"
      value={question.config.latest ?? ""}
      oninput={(event) =>
        setConfig({ ...question.config, latest: optionalText(event.currentTarget.value) })}
    />
  </label>
</div>
