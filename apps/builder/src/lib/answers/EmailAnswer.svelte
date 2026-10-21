<script lang="ts">
  import type { AnswerProps } from "./props.ts";

  let { value }: AnswerProps<"email"> = $props();
</script>

<a class="underline" href={`mailto:${value}`}>{value}</a>
