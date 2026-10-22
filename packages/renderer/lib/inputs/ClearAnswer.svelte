<script lang="ts">
  let { clear }: { clear: () => void } = $props();
</script>

<button type="button" class="clear" onclick={clear}>Clear answer</button>

<style>
  .clear {
    margin-top: 0.5rem;
    padding: 0.125rem 0.5rem;
    font: inherit;
    color: inherit;
    background: transparent;
    border: 1px solid var(--form-renderer-border, rgb(140, 140, 150));
    border-radius: 0.25rem;
    cursor: pointer;
  }
</style>
