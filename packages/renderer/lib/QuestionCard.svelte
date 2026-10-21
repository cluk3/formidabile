<script lang="ts">
  let { label, value }: { label: string; value: string } = $props();
</script>

<p class="card" part="card">
  <span class="label">{label}</span>
  <strong class="value global-marker">{value}</strong>
</p>

<style>
  .card {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--form-renderer-border, rgb(0, 0, 255));
    border-radius: 0.25rem;
  }
  .value {
    color: var(--form-renderer-accent, rgb(0, 128, 0));
  }
  :global(.global-marker) {
    text-decoration: underline;
  }
</style>
