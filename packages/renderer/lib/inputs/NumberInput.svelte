<script lang="ts">
  import type { InputProps } from "../inputs.ts";
  import ClearAnswer from "./ClearAnswer.svelte";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"number"> = $props();

  const SCALE = 10_000;
  const display = $derived(question.config.display ?? "input");

  /** The values a respondent can pick, in units of 0.0001 so a decimal step stays exact. */
  const choices = $derived.by(() => {
    const { min, max, step } = question.config;
    if (min === undefined || max === undefined || !(min <= max)) return [];
    const increment = Math.round((step ?? 1) * SCALE);
    if (increment <= 0) return [];
    const start = Math.round(min * SCALE);
    const end = Math.round(max * SCALE);
    const values: string[] = [];
    for (let cursor = start; cursor <= end && values.length < 21; cursor += increment)
      values.push(String(Number((cursor / SCALE).toFixed(4))));
    return values;
  });

  const radios = $derived(
    (display === "rating" || display === "scale" || display === "nps") && choices.length > 0,
  );

  const snapped = (raw: string) => {
    const { min, step } = question.config;
    const parsed = Number(raw);
    if (min === undefined || step === undefined || !Number.isFinite(parsed)) return raw;
    const start = Math.round(min * SCALE);
    const jump = Math.round(step * SCALE);
    if (jump <= 0) return raw;
    const steps = Math.round((Math.round(parsed * SCALE) - start) / jump);
    return String(Number(((start + steps * jump) / SCALE).toFixed(4)));
  };

  const starName = (choice: string) => (choice === "1" ? "1 star" : `${choice} stars`);
</script>

{#if display === "slider" && question.config.min !== undefined && question.config.max !== undefined}
  <label class="label" part="label" for={field.id}><Prompt {question} /></label>
  <Description {question} {field} />
  <p class="reading">{value === undefined ? "Not answered" : value}</p>
  <input
    id={field.id}
    class="slider"
    class:unset={value === undefined}
    part="input"
    type="range"
    min={question.config.min}
    max={question.config.max}
    step={question.config.step}
    value={value ?? question.config.min}
    aria-valuetext={value === undefined ? "Not answered" : value}
    aria-invalid={field.invalid ? "true" : undefined}
    aria-describedby={field.describedBy}
    oninput={(event) => (value = snapped(event.currentTarget.value))}
  />
{:else if radios}
  <fieldset
    class="group"
    role="radiogroup"
    aria-labelledby={`${field.id}-legend`}
    aria-invalid={field.invalid ? "true" : undefined}
    aria-describedby={field.describedBy}
  >
    <legend id={`${field.id}-legend`} class="label" part="label"><Prompt {question} /></legend>
    <Description {question} {field} />
    <div class="row">
      {#if display !== "rating" && question.config.minLabel}
        <span class="end">{question.config.minLabel}</span>
      {/if}
      {#each choices as choice, index (choice)}
        <label class="choice">
          <input
            id={index === 0 ? field.id : `${field.id}-${index}`}
            part="input"
            type="radio"
            name={field.id}
            value={choice}
            bind:group={value}
          />
          {#if display === "rating"}
            <span class="sr-only">{starName(choice)}</span>
            <span aria-hidden="true"
              >{value !== undefined && Number(value) >= Number(choice) ? "★" : "☆"}</span
            >
          {:else}
            {choice}
          {/if}
        </label>
      {/each}
      {#if display !== "rating" && question.config.maxLabel}
        <span class="end">{question.config.maxLabel}</span>
      {/if}
    </div>
    {#if !question.required}
      <ClearAnswer clear={() => (value = undefined)} />
    {/if}
  </fieldset>
{:else}
  <label class="label" part="label" for={field.id}><Prompt {question} /></label>
  <Description {question} {field} />
  <!-- Not `bind:value`, which would turn the text into a number and lose what the respondent typed. -->
  <input
    id={field.id}
    class="control"
    part="input"
    type="number"
    step={question.config.step ?? (question.config.integer ? 1 : "any")}
    min={question.config.min}
    max={question.config.max}
    value={value ?? ""}
    oninput={(event) => (value = event.currentTarget.value)}
    aria-invalid={field.invalid ? "true" : undefined}
    aria-describedby={field.describedBy}
  />
{/if}

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    align-items: center;
  }
  .end {
    color: var(--form-renderer-muted, rgb(80, 80, 90));
    font-size: 0.875em;
  }
  .reading {
    margin: 0 0 0.375rem;
  }
  .slider {
    width: 100%;
    /* WebKit sizes a slider by its thumb, and an unanswered one has none, so it would collapse to nothing. */
    min-height: 1.5rem;
    margin: 0;
  }
  /* A native slider always has a thumb. Hide it until the respondent moves it. */
  .unset::-webkit-slider-thumb {
    appearance: none;
    opacity: 0;
  }
  .unset::-moz-range-thumb {
    appearance: none;
    opacity: 0;
    border: 0;
    background: transparent;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
