<script lang="ts">
  import type { AnswerProps } from "./props.ts";

  let { value, display }: AnswerProps<"date"> = $props();
</script>

<time datetime={value}>{display}</time>
