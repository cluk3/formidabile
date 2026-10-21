<script lang="ts">
  import type { InputProps } from "../inputs.ts";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"number"> = $props();
</script>

<label class="label" part="label" for={field.id}><Prompt {question} /></label>
<Description {question} {field} />
<!-- Not `bind:value`, which would turn the text into a number and lose what the respondent typed. -->
<input
  id={field.id}
  class="control"
  part="input"
  type="number"
  step={question.config.integer ? 1 : "any"}
  min={question.config.min}
  max={question.config.max}
  value={value ?? ""}
  oninput={(event) => (value = event.currentTarget.value)}
  aria-invalid={field.invalid ? "true" : undefined}
  aria-describedby={field.describedBy}
/>
