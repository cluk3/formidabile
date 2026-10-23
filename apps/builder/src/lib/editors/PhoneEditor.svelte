<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import type { EditorProps } from "#lib/editors/props.ts";

  let { question }: EditorProps<QuestionSnapshotOf<"phone">> = $props();
</script>

<p class="text-sm text-muted-foreground">
  {question.required
    ? "Respondents must enter a phone number with a country code."
    : "Respondents may enter a phone number with a country code."}
</p>
