<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import { Input } from "#lib/components/ui/input/index.js";
  import type { EditorProps } from "#lib/editors/props.ts";
  import {
    checkClass,
    fieldClass,
    nativeInputClass,
    optionalNumber,
    optionalText,
  } from "#lib/fields.ts";

  let { question, setConfig }: EditorProps<QuestionSnapshotOf<"number">> = $props();

  const config = $derived(question.config);
  const display = $derived(config.display ?? "input");

  const wholeIn = (value: number | undefined, low: number, high: number) =>
    value !== undefined && Number.isInteger(value) && value >= low && value <= high;

  const setDisplay = (next: NonNullable<typeof config.display>) => {
    if (next === "nps") setConfig({ ...config, display: next, integer: true, min: 0, max: 10 });
    else if (next === "rating")
      setConfig({
        ...config,
        display: next,
        integer: true,
        min: 1,
        max: wholeIn(config.max, 3, 10) ? config.max : 5,
      });
    else if (next === "scale")
      setConfig({
        ...config,
        display: next,
        integer: true,
        min: config.min === 0 || config.min === 1 ? config.min : 1,
        max: wholeIn(config.max, 2, 10) ? config.max : 5,
      });
    else setConfig({ ...config, display: next });
  };
</script>

<label class={fieldClass}>
  Display
  <select
    class={nativeInputClass}
    aria-label="Display"
    value={display}
    onchange={(event) => setDisplay(event.currentTarget.value as typeof display)}
  >
    <option value="input">Number input</option>
    <option value="rating">Stars</option>
    <option value="scale">Scale</option>
    <option value="slider">Slider</option>
    <option value="nps">NPS</option>
  </select>
</label>

{#if display === "input" || display === "slider"}
  <label class={checkClass}>
    <input
      type="checkbox"
      checked={config.integer}
      onchange={(event) => setConfig({ ...config, integer: event.currentTarget.checked })}
    />
    Whole numbers only
  </label>
  <div class="grid grid-cols-2 gap-2">
    <label class={fieldClass}>
      Minimum
      <Input
        type="number"
        step="any"
        value={config.min ?? ""}
        oninput={(event) =>
          setConfig({ ...config, min: optionalNumber(event.currentTarget.value) })}
      />
    </label>
    <label class={fieldClass}>
      Maximum
      <Input
        type="number"
        step="any"
        value={config.max ?? ""}
        oninput={(event) =>
          setConfig({ ...config, max: optionalNumber(event.currentTarget.value) })}
      />
    </label>
  </div>
{:else if display === "rating"}
  <label class={fieldClass}>
    Stars
    <select
      class={nativeInputClass}
      aria-label="Stars"
      value={config.max ?? ""}
      onchange={(event) =>
        setConfig({
          ...config,
          display: "rating",
          integer: true,
          min: 1,
          max: Number(event.currentTarget.value),
        })}
    >
      {#each [3, 4, 5, 6, 7, 8, 9, 10] as count (count)}
        <option value={count}>{count}</option>
      {/each}
    </select>
  </label>
{:else if display === "scale"}
  <div class="grid grid-cols-2 gap-2">
    <label class={fieldClass}>
      Starts at
      <select
        class={nativeInputClass}
        aria-label="Starts at"
        value={config.min ?? ""}
        onchange={(event) =>
          setConfig({
            ...config,
            display: "scale",
            integer: true,
            min: Number(event.currentTarget.value),
          })}
      >
        <option value={0}>0</option>
        <option value={1}>1</option>
      </select>
    </label>
    <label class={fieldClass}>
      Ends at
      <select
        class={nativeInputClass}
        aria-label="Ends at"
        value={config.max ?? ""}
        onchange={(event) =>
          setConfig({
            ...config,
            display: "scale",
            integer: true,
            max: Number(event.currentTarget.value),
          })}
      >
        {#each [2, 3, 4, 5, 6, 7, 8, 9, 10] as count (count)}
          <option value={count}>{count}</option>
        {/each}
      </select>
    </label>
  </div>
{/if}

{#if display === "scale" || display === "nps"}
  {#if display === "nps"}
    <p class="text-sm text-muted-foreground">Whole numbers from 0 to 10.</p>
  {/if}
  <div class="grid grid-cols-2 gap-2">
    <label class={fieldClass}>
      Low end label
      <Input
        maxlength={100}
        value={config.minLabel ?? ""}
        oninput={(event) =>
          setConfig({ ...config, minLabel: optionalText(event.currentTarget.value) })}
      />
    </label>
    <label class={fieldClass}>
      High end label
      <Input
        maxlength={100}
        value={config.maxLabel ?? ""}
        oninput={(event) =>
          setConfig({ ...config, maxLabel: optionalText(event.currentTarget.value) })}
      />
    </label>
  </div>
{/if}

<label class={fieldClass}>
  Step
  <Input
    type="number"
    step="any"
    min="0"
    value={config.step ?? ""}
    oninput={(event) => setConfig({ ...config, step: optionalNumber(event.currentTarget.value) })}
  />
</label>
