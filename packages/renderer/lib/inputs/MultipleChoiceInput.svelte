<script lang="ts">
  import type { InputProps } from "../inputs.ts";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"multiple_choice"> = $props();

  // Selections keep the options' order, whatever order they were ticked in.
  const toggle = (optionValue: string, checked: boolean) => {
    const selected = new Set(value);
    if (checked) selected.add(optionValue);
    else selected.delete(optionValue);
    value = question.config.options
      .map((option) => option.value)
      .filter((candidate) => selected.has(candidate));
  };
</script>

<fieldset class="group">
  <legend class="label" part="label"><Prompt {question} /></legend>
  <Description {question} {field} />
  {#each question.config.options as option, index (option.value)}
    <label class="choice">
      <input
        id={index === 0 ? field.id : `${field.id}-${index}`}
        part="input"
        type="checkbox"
        value={option.value}
        checked={value?.includes(option.value) ?? false}
        onchange={(event) => toggle(option.value, event.currentTarget.checked)}
        aria-invalid={field.invalid ? "true" : undefined}
        aria-describedby={field.describedBy}
      />
      {option.label}
    </label>
  {/each}
</fieldset>
