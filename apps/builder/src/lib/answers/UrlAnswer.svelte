<script lang="ts">
  import type { AnswerProps } from "#lib/answers/props.ts";

  let { value }: AnswerProps<"url"> = $props();
</script>

<span class="break-all">{value}</span>
