<script lang="ts">
  import type { QuestionSnapshot } from "@fb/core/definition";
  import type { Field } from "../inputs.ts";

  let { question, field }: { question: QuestionSnapshot; field: Field } = $props();
</script>

{#if question.description}
  <p id={field.descriptionId} class="description" part="description">{question.description}</p>
{/if}

<style>
  .description {
    margin: 0 0 0.375rem;
    color: var(--form-renderer-muted, rgb(80, 80, 90));
    font-size: 0.875em;
  }
</style>
