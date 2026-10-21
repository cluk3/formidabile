<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import type { EditorProps } from "./props.ts";

  let { question }: EditorProps<QuestionSnapshotOf<"boolean">> = $props();
</script>

<p class="text-sm text-muted-foreground">
  {question.required
    ? "Respondents must answer yes or no."
    : "Respondents may answer yes or no, or skip the question."}
</p>
