<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";

  let {
    display,
  }: {
    question: QuestionSnapshotOf<"single_choice_matrix" | "multiple_choice_matrix">;
    value: Record<string, string> | Record<string, string[]>;
    display: string;
  } = $props();
</script>

<span>{display}</span>
