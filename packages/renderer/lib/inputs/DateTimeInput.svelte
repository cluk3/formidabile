<script lang="ts">
  import type { InputProps } from "../inputs.ts";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"date_time"> = $props();
</script>

<label class="label" part="label" for={field.id}><Prompt {question} /></label>
<Description {question} {field} />
<input
  id={field.id}
  class="control"
  part="input"
  type="datetime-local"
  min={question.config.min}
  max={question.config.max}
  bind:value
  aria-invalid={field.invalid ? "true" : undefined}
  aria-describedby={field.describedBy}
/>
