<script lang="ts">
  import type { AnswerProps } from "#lib/answers/props.ts";

  let { value }: AnswerProps<"phone"> = $props();
</script>

<span>{value}</span>
