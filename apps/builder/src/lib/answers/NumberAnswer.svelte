<script lang="ts">
  import type { AnswerProps } from "./props.ts";

  let { display }: AnswerProps<"number"> = $props();
</script>

<span class="tabular-nums">{display}</span>
