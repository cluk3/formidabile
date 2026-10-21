<script lang="ts">
  import type { InputProps } from "../inputs.ts";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"text"> = $props();
</script>

<label class="label" part="label" for={field.id}><Prompt {question} /></label>
<Description {question} {field} />
{#if question.config.display === "multi_line"}
  <textarea
    id={field.id}
    class="control"
    part="input"
    rows="4"
    bind:value
    aria-invalid={field.invalid ? "true" : undefined}
    aria-describedby={field.describedBy}></textarea>
{:else}
  <input
    id={field.id}
    class="control"
    part="input"
    type="text"
    bind:value
    aria-invalid={field.invalid ? "true" : undefined}
    aria-describedby={field.describedBy}
  />
{/if}
