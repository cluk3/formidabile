<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import type { InputProps } from "../inputs.ts";
  import ClearAnswer from "./ClearAnswer.svelte";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  type MatrixQuestion = QuestionSnapshotOf<"single_choice_matrix" | "multiple_choice_matrix">;
  type SingleDraft = Record<string, string>;
  type MultipleDraft = Record<string, string[]>;

  let {
    question,
    value = $bindable(),
    field,
  }: {
    question: MatrixQuestion;
    value: SingleDraft | MultipleDraft | undefined;
    field: InputProps<"single_choice_matrix">["field"];
  } = $props();

  const multiple = $derived(question.type === "multiple_choice_matrix");

  const chosen = (row: string): readonly string[] => {
    const cell = value?.[row];
    if (typeof cell === "string") return cell === "" ? [] : [cell];
    return cell ?? [];
  };

  const write = (next: SingleDraft | MultipleDraft) => {
    value = Object.keys(next).length === 0 ? undefined : next;
  };

  const choose = (row: string, column: string) => {
    write({ ...(value as SingleDraft | undefined), [row]: column });
  };

  const clearRow = (row: string) => {
    if (value === undefined) return;
    const next = { ...value };
    delete next[row];
    write(next);
  };

  const toggle = (row: string, column: string, checked: boolean) => {
    const current: MultipleDraft = { ...(value as MultipleDraft | undefined) };
    const selected = new Set(current[row] ?? []);
    if (checked) selected.add(column);
    else selected.delete(column);
    const ordered = question.config.columns
      .map((item) => item.value)
      .filter((item) => selected.has(item));
    if (ordered.length === 0) delete current[row];
    else current[row] = ordered;
    write(current);
  };
</script>

{#snippet radio(
  row: string,
  rowLabel: string,
  column: string,
  columnLabel: string,
  group: string,
  marked: boolean,
)}
  <input
    id={marked ? field.id : undefined}
    part="input"
    type="radio"
    name={`${field.id}-${row}-${group}`}
    value={column}
    checked={chosen(row).includes(column)}
    aria-label={`${rowLabel}, ${columnLabel}`}
    onchange={() => choose(row, column)}
  />
{/snippet}

{#snippet box(row: string, rowLabel: string, column: string, columnLabel: string, marked: boolean)}
  <input
    id={marked ? field.id : undefined}
    part="input"
    type="checkbox"
    value={column}
    checked={chosen(row).includes(column)}
    aria-label={`${rowLabel}, ${columnLabel}`}
    aria-invalid={field.invalid ? "true" : undefined}
    aria-describedby={field.describedBy}
    onchange={(event) => toggle(row, column, event.currentTarget.checked)}
  />
{/snippet}

<fieldset
  class="group"
  role={multiple ? undefined : "radiogroup"}
  aria-invalid={!multiple && field.invalid ? "true" : undefined}
  aria-describedby={multiple ? undefined : field.describedBy}
>
  <legend class="label" part="label"><Prompt {question} /></legend>
  <Description {question} {field} />
  <!-- The frame is the container. A container cannot query itself, so the switch sits inside it. -->
  <div class="matrix">
    <div class="switch">
      <table class="grid">
        <thead>
          <tr>
            <td></td>
            {#each question.config.columns as column (column.value)}
              <th scope="col">{column.label}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each question.config.rows as row (row.value)}
            <tr>
              <th scope="row">{row.label}</th>
              {#each question.config.columns as column, index (column.value)}
                {@const marked = row === question.config.rows[0] && index === 0}
                <td>
                  {#if multiple}
                    {@render box(row.value, row.label, column.value, column.label, marked)}
                  {:else}
                    {@render radio(
                      row.value,
                      row.label,
                      column.value,
                      column.label,
                      "grid",
                      marked,
                    )}
                  {/if}
                </td>
              {/each}
              {#if !multiple && !question.required}
                <td><ClearAnswer clear={() => clearRow(row.value)} /></td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
      <div class="stacked">
        {#each question.config.rows as row (row.value)}
          <fieldset class="group">
            <legend>{row.label}</legend>
            {#each question.config.columns as column (column.value)}
              <label class="choice">
                {#if multiple}
                  {@render box(row.value, row.label, column.value, column.label, false)}
                {:else}
                  {@render radio(row.value, row.label, column.value, column.label, "stack", false)}
                {/if}
                {column.label}
              </label>
            {/each}
            {#if !multiple && !question.required}
              <ClearAnswer clear={() => clearRow(row.value)} />
            {/if}
          </fieldset>
        {/each}
      </div>
    </div>
  </div>
</fieldset>

<style>
  .matrix {
    container-name: matrix;
    container-type: inline-size;
  }
  .grid {
    display: none;
    width: 100%;
    border-collapse: collapse;
  }
  .grid th,
  .grid td {
    padding: 0.25rem 0.5rem;
    font-weight: normal;
    text-align: center;
  }
  .grid th[scope="row"] {
    text-align: start;
  }
  .stacked {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  /* Wide enough for a row label and the columns. The container is this control, so the host's column decides. */
  @container matrix (min-width: 36rem) {
    .grid {
      display: table;
    }
    .stacked {
      display: none;
      visibility: hidden;
    }
  }
</style>
