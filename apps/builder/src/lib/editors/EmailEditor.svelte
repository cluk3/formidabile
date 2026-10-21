<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import type { EditorProps } from "./props.ts";

  let { question }: EditorProps<QuestionSnapshotOf<"email">> = $props();
</script>

<p class="text-sm text-muted-foreground">
  {question.required
    ? "Respondents must enter an email address."
    : "Respondents may enter an email address."}
</p>
