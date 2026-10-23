<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import { COLUMNS_CAP, ROWS_CAP } from "@fb/core/editing";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import ChoiceOptions from "#lib/editors/ChoiceOptions.svelte";
  import type { EditorProps } from "#lib/editors/props.ts";

  type Matrix = QuestionSnapshotOf<"single_choice_matrix" | "multiple_choice_matrix">;

  let {
    question,
    setConfig,
    addOption,
    removeOption,
    addRow = () => {},
    removeRow = () => {},
    moveRow = () => {},
  }: EditorProps<Matrix> & {
    addRow?: () => void;
    removeRow?: (value: string) => void;
    moveRow?: (value: string, to: number) => void;
  } = $props();

  const rows = $derived(question.config.rows);
</script>

<fieldset class="flex flex-col gap-2">
  <legend class="mb-1.5 text-sm font-medium">Rows</legend>
  <ol class="flex flex-col gap-2">
    {#each rows as row, index (row.value)}
      <li class="flex items-center gap-2">
        <Input
          aria-label={`Row ${index + 1}`}
          value={row.label}
          maxlength={200}
          oninput={(event) =>
            setConfig({
              ...question.config,
              rows: rows.with(index, { ...row, label: event.currentTarget.value }),
            })}
        />
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Move row ${index + 1} up`}
          disabled={index === 0}
          onclick={() => moveRow(row.value, index - 1)}>Up</Button
        >
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Move row ${index + 1} down`}
          disabled={index === rows.length - 1}
          onclick={() => moveRow(row.value, index + 1)}>Down</Button
        >
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Remove row ${index + 1}`}
          onclick={() => removeRow(row.value)}>Remove</Button
        >
      </li>
    {/each}
  </ol>
  <Button
    class="self-start"
    variant="outline"
    size="sm"
    disabled={rows.length >= ROWS_CAP}
    onclick={addRow}>Add row</Button
  >
</fieldset>
<ChoiceOptions
  options={question.config.columns}
  setOptions={(columns) => setConfig({ ...question.config, columns })}
  {addOption}
  {removeOption}
  legend="Columns"
  item="column"
/>
<p class="text-sm text-muted-foreground">
  A matrix has at most {COLUMNS_CAP} columns.
  {question.type === "single_choice_matrix"
    ? "Each row picks one column."
    : "Each row picks any columns."}
</p>
