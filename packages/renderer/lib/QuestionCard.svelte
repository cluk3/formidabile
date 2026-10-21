<script lang="ts">
  import type { QuestionSnapshot, QuestionTypeName } from "@fb/core/definition";
  import type { Component } from "svelte";
  import type { Draft } from "./drafts.ts";
  import { inputs, type InputProps } from "./inputs.ts";

  let {
    question,
    value = $bindable(),
    error,
  }: { question: QuestionSnapshot; value: Draft; error: string | undefined } = $props();

  const id = $props.id();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const Input = $derived(
    inputs[question.type] as Component<InputProps<QuestionTypeName>, object, "value">,
  );
  const field = $derived({
    id: `${id}-input`,
    descriptionId,
    describedBy:
      [question.description ? descriptionId : undefined, error === undefined ? undefined : errorId]
        .filter((part) => part !== undefined)
        .join(" ") || undefined,
    invalid: error !== undefined,
  });
</script>

<div class="question" part="question">
  <Input {question} bind:value {field} />
  {#if error !== undefined}
    <p id={errorId} class="error" part="error">{error}</p>
  {/if}
</div>

<style>
  .question {
    margin: 0 0 1rem;
    padding: 0.75rem;
    border: 1px solid var(--form-renderer-border, rgb(200, 200, 210));
    border-radius: 0.375rem;
  }
  .question :global(.label) {
    display: block;
    margin: 0 0 0.375rem;
    padding: 0;
    font-weight: 600;
  }
  .question :global(.group) {
    margin: 0;
    padding: 0;
    border: 0;
  }
  .question :global(.choice) {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.125rem 0;
  }
  .question :global(.control) {
    box-sizing: border-box;
    width: 100%;
    padding: 0.375rem 0.5rem;
    font: inherit;
    border: 1px solid var(--form-renderer-border, rgb(140, 140, 150));
    border-radius: 0.25rem;
  }
  .question :global([aria-invalid="true"]) {
    outline: 2px solid var(--form-renderer-error, rgb(180, 20, 20));
  }
  .error {
    margin: 0.375rem 0 0;
    color: var(--form-renderer-error, rgb(180, 20, 20));
  }
</style>
