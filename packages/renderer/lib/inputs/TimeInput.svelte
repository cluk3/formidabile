<script lang="ts">
  import type { InputProps } from "../inputs.ts";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"time_of_day"> = $props();
</script>

<label class="label" part="label" for={field.id}><Prompt {question} /></label>
<Description {question} {field} />
<input
  id={field.id}
  class="control"
  part="input"
  type="time"
  min={question.config.earliest}
  max={question.config.latest}
  bind:value
  aria-invalid={field.invalid ? "true" : undefined}
  aria-describedby={field.describedBy}
/>
