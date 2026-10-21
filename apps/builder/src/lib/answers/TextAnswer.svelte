<script lang="ts">
  import type { AnswerProps } from "./props.ts";

  let { value }: AnswerProps<"text"> = $props();
</script>

<span class="whitespace-pre-wrap">{value}</span>
