<script lang="ts">
  import type { AnswerProps } from "./props.ts";

  let { display }: AnswerProps<"single_choice"> = $props();
</script>

<span>{display}</span>
