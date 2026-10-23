<script lang="ts">
  import type { AnswerProps } from "#lib/answers/props.ts";

  let { value, display }: AnswerProps<"time_of_day"> = $props();
</script>

<time datetime={value}>{display}</time>
