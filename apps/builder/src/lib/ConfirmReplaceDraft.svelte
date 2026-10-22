<script lang="ts">
  import { Button } from "#lib/components/ui/button/index.js";

  let {
    versionNumber,
    disabled,
    onConfirm,
    onCancel,
  }: {
    versionNumber: number;
    disabled: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();
</script>

<div role="alert" class="flex flex-wrap items-center gap-2 rounded-md border p-3">
  <p class="grow">
    Replace the open draft with version {versionNumber}? Its edits will be discarded.
  </p>
  <Button variant="default" size="sm" {disabled} onclick={onConfirm}>Replace draft</Button>
  <Button variant="outline" size="sm" {disabled} onclick={onCancel}>Cancel</Button>
</div>
