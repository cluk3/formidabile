<script lang="ts">
  import type { AnswerProps } from "#lib/answers/props.ts";

  let { display }: AnswerProps<"boolean"> = $props();
</script>

<span>{display}</span>
