<script lang="ts">
  import type { InputProps } from "../inputs.ts";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"single_choice"> = $props();
</script>

{#if question.config.display === "dropdown"}
  <label class="label" part="label" for={field.id}><Prompt {question} /></label>
  <Description {question} {field} />
  <select
    id={field.id}
    class="control"
    part="input"
    bind:value
    aria-invalid={field.invalid ? "true" : undefined}
    aria-describedby={field.describedBy}
  >
    <option value="">Choose an option</option>
    {#each question.config.options as option (option.value)}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
{:else}
  <fieldset
    class="group"
    role="radiogroup"
    aria-labelledby={`${field.id}-legend`}
    aria-invalid={field.invalid ? "true" : undefined}
    aria-describedby={field.describedBy}
  >
    <legend id={`${field.id}-legend`} class="label" part="label"><Prompt {question} /></legend>
    <Description {question} {field} />
    {#each question.config.options as option, index (option.value)}
      <label class="choice">
        <input
          id={index === 0 ? field.id : `${field.id}-${index}`}
          part="input"
          type="radio"
          name={field.id}
          value={option.value}
          bind:group={value}
        />
        {option.label}
      </label>
    {/each}
  </fieldset>
{/if}
