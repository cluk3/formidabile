<script lang="ts">
  import type { AnswerProps } from "#lib/answers/props.ts";

  let { question, value }: AnswerProps<"ranking"> = $props();

  const labels = $derived(
    value.map(
      (picked, index) =>
        `${index + 1}. ${question.config.options.find((option) => option.value === picked)?.label ?? picked}`,
    ),
  );
</script>

<ol>
  {#each labels as label, index (index)}
    <li>{label}</li>
  {/each}
</ol>
