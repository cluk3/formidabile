<script lang="ts">
  import type { AnswerProps } from "#lib/answers/props.ts";

  let { display }: AnswerProps<"number"> = $props();
</script>

<span class="tabular-nums">{display}</span>
