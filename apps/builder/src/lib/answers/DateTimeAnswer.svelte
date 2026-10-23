<script lang="ts">
  import type { AnswerProps } from "#lib/answers/props.ts";

  let { value, display }: AnswerProps<"date_time"> = $props();
</script>

<time datetime={value}>{display}</time>
