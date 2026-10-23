<script lang="ts">
  import type { AnswerProps } from "#lib/answers/props.ts";

  let { value }: AnswerProps<"date_range"> = $props();
</script>

<span>
  <time datetime={value.start}>{value.start}</time>
  to
  <time datetime={value.end}>{value.end}</time>
</span>
