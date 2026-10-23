<script lang="ts">
  import { tick } from "svelte";
  import type { InputProps } from "../inputs.ts";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"ranking"> = $props();

  const ranked = $derived(value ?? []);
  const chosen = $derived(new Set(ranked));
  const unranked = $derived(question.config.options.filter((option) => !chosen.has(option.value)));
  const labelOf = (optionValue: string) =>
    question.config.options.find((option) => option.value === optionValue)?.label ?? optionValue;

  const add = (optionValue: string) => {
    if (chosen.has(optionValue)) return;
    value = [...ranked, optionValue];
  };

  /** Moves one ranked option and keeps the keyboard on that same button. */
  const relocate = async (index: number, by: -1 | 1, which: "up" | "down") => {
    const current = value ?? [];
    const nextIndex = index + by;
    if (nextIndex < 0 || nextIndex >= current.length) return;
    const next = [...current];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item!);
    value = next;
    await tick();
    const up = document.getElementById(
      nextIndex === 0 ? field.id : `${field.id}-rank-${nextIndex}-up`,
    );
    const down = document.getElementById(`${field.id}-rank-${nextIndex}-down`);
    const preferred = which === "up" ? up : down;
    const other = which === "up" ? down : up;
    (preferred?.hasAttribute("disabled") ? other : preferred)?.focus();
  };

  const onMoveKey = (event: KeyboardEvent, index: number, which: "up" | "down") => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    void relocate(index, event.key === "ArrowUp" ? -1 : 1, which);
  };
</script>

<fieldset class="group" aria-describedby={field.describedBy}>
  <legend class="label" part="label"><Prompt {question} /></legend>
  <Description {question} {field} />

  <p class="label" id="{field.id}-ranked-label">Your ranking</p>
  {#if ranked.length === 0}
    <p>Nothing ranked yet.</p>
  {/if}
  <ol aria-labelledby="{field.id}-ranked-label">
    {#each ranked as optionValue, index (optionValue)}
      <li class="row">
        <span class="place">{index + 1}.</span>
        <span class="name">{labelOf(optionValue)}</span>
        <button
          id={index === 0 ? field.id : `${field.id}-rank-${index}-up`}
          type="button"
          part="input"
          disabled={index === 0}
          aria-label="Move {labelOf(optionValue)} up"
          onclick={() => relocate(index, -1, "up")}
          onkeydown={(event) => onMoveKey(event, index, "up")}
        >
          Move up
        </button>
        <button
          id="{field.id}-rank-{index}-down"
          type="button"
          part="input"
          disabled={index === ranked.length - 1}
          aria-label="Move {labelOf(optionValue)} down"
          onclick={() => relocate(index, 1, "down")}
          onkeydown={(event) => onMoveKey(event, index, "down")}
        >
          Move down
        </button>
      </li>
    {/each}
  </ol>

  <p class="label" id="{field.id}-pool-label">Not ranked</p>
  <ul aria-labelledby="{field.id}-pool-label">
    {#each unranked as option, index (option.value)}
      <li class="row">
        <span class="name">{option.label}</span>
        <button
          id={ranked.length === 0 && index === 0 ? field.id : undefined}
          type="button"
          part="input"
          onclick={() => add(option.value)}
        >
          Add {option.label}
        </button>
      </li>
    {/each}
  </ul>
</fieldset>

<style>
  .label {
    margin: 0.75rem 0 0.25rem;
  }
  ol,
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    min-block-size: 1.5rem;
  }
  .name {
    flex: 1;
  }
  button {
    font: inherit;
    padding: 0.125rem 0.5rem;
  }
</style>
