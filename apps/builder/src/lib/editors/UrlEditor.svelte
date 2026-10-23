<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import type { EditorProps } from "#lib/editors/props.ts";

  let { question }: EditorProps<QuestionSnapshotOf<"url">> = $props();
</script>

<p class="text-sm text-muted-foreground">
  {question.required
    ? "Respondents must enter an http or https URL."
    : "Respondents may enter an http or https URL."}
</p>
