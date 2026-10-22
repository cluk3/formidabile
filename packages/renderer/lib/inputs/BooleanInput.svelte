<script lang="ts">
  import type { InputProps } from "../inputs.ts";
  import ClearAnswer from "./ClearAnswer.svelte";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"boolean"> = $props();

  const choices = [
    { value: true, label: "Yes" },
    { value: false, label: "No" },
  ];
</script>

{#if question.config.mustBeYes}
  <!-- One checkbox: the only accepted answer is yes, so an unticked box is unanswered. -->
  <Description {question} {field} />
  <label class="choice">
    <input
      id={field.id}
      part="input"
      type="checkbox"
      checked={value === true}
      aria-invalid={field.invalid ? "true" : undefined}
      aria-describedby={field.describedBy}
      onchange={(event) => {
        value = event.currentTarget.checked ? true : undefined;
      }}
    />
    <span class="label" part="label"><Prompt {question} /></span>
  </label>
{:else}
  <!-- Two radios, not a checkbox: an unticked checkbox can't tell "No" from unanswered. -->
  <fieldset
    class="group"
    role="radiogroup"
    aria-labelledby={`${field.id}-legend`}
    aria-invalid={field.invalid ? "true" : undefined}
    aria-describedby={field.describedBy}
  >
    <legend id={`${field.id}-legend`} class="label" part="label"><Prompt {question} /></legend>
    <Description {question} {field} />
    {#each choices as choice, index (choice.label)}
      <label class="choice">
        <input
          id={index === 0 ? field.id : `${field.id}-${index}`}
          part="input"
          type="radio"
          name={field.id}
          value={choice.value}
          bind:group={value}
        />
        {choice.label}
      </label>
    {/each}
    {#if !question.required}
      <ClearAnswer clear={() => (value = undefined)} />
    {/if}
  </fieldset>
{/if}
