<script lang="ts">
  import type { AnswerProps } from "./props.ts";

  let { display }: AnswerProps<"boolean"> = $props();
</script>

<span>{display}</span>
