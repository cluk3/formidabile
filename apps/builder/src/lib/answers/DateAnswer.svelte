<script lang="ts">
  import type { AnswerProps } from "#lib/answers/props.ts";

  let { value, display }: AnswerProps<"date"> = $props();
</script>

<time datetime={value}>{display}</time>
