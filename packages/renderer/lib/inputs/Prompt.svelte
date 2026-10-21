<script lang="ts">
  import type { QuestionSnapshot } from "@fb/core/definition";

  let { question }: { question: QuestionSnapshot } = $props();
</script>

{question.label}{#if question.required}
  <span class="required">(required)</span>{/if}

<style>
  .required {
    color: var(--form-renderer-accent, rgb(150, 30, 30));
    font-weight: normal;
  }
</style>
