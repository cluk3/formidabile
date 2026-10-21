<script lang="ts">
  import type { AnswerProps } from "./props.ts";

  let { question, value }: AnswerProps<"multiple_choice"> = $props();

  // Core's display text joins the labels with ", ", which a label may contain too, so each one gets its own item.
  const labels = $derived(
    value.map(
      (picked) =>
        question.config.options.find((option) => option.value === picked)?.label ?? picked,
    ),
  );
</script>

<ul class="list-disc pl-5">
  {#each labels as label, i (i)}
    <li>{label}</li>
  {/each}
</ul>
