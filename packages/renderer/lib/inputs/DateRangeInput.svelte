<script lang="ts">
  import type { InputProps } from "../inputs.ts";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"date_range"> = $props();

  const set = (side: "start" | "end", next: string) => {
    value = { start: value?.start ?? "", end: value?.end ?? "", [side]: next };
  };
</script>

<fieldset class="group" aria-describedby={field.describedBy}>
  <legend class="label" part="label"><Prompt {question} /></legend>
  <Description {question} {field} />
  <label class="label" for={field.id}>From</label>
  <input
    id={field.id}
    class="control"
    part="input"
    type="date"
    min={question.config.min}
    max={question.config.max}
    value={value?.start ?? ""}
    oninput={(event) => set("start", event.currentTarget.value)}
    aria-invalid={field.invalid ? "true" : undefined}
    aria-describedby={field.describedBy}
  />
  <label class="label" for="{field.id}-end">To</label>
  <input
    id="{field.id}-end"
    class="control"
    part="input"
    type="date"
    min={question.config.min}
    max={question.config.max}
    value={value?.end ?? ""}
    oninput={(event) => set("end", event.currentTarget.value)}
    aria-invalid={field.invalid ? "true" : undefined}
    aria-describedby={field.describedBy}
  />
</fieldset>
