<script lang="ts">
  import type { QuestionSnapshotOf } from "@fb/core/definition";
  import { OPTIONS_CAP } from "@fb/core/editing";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";

  type Option = QuestionSnapshotOf<"single_choice">["config"]["options"][number];

  let {
    options,
    setOptions,
    addOption,
    removeOption,
    cap = OPTIONS_CAP,
    legend = "Options",
    item = "option",
  }: {
    options: readonly Option[];
    setOptions(options: Option[]): void;
    addOption(): void;
    removeOption(value: string): void;
    /** Defaults to the choice cap. A ranking stops at 20. */
    cap?: number;
    legend?: string;
    /** Used in the accessible names, for example "column". */
    item?: string;
  } = $props();

  // Choice questions keep the "Option N" name. A matrix passes item "column".
  const fieldLabel = (index: number) =>
    item === "option" ? `Option ${index + 1}` : `${item} ${index + 1}`;
</script>

<fieldset class="flex flex-col gap-2">
  <legend class="mb-1.5 text-sm font-medium">{legend}</legend>
  <ol class="flex flex-col gap-2">
    {#each options as option, i (option.value)}
      <li class="flex items-center gap-2">
        <Input
          aria-label={fieldLabel(i)}
          value={option.label}
          maxlength={200}
          oninput={(event) =>
            setOptions(options.with(i, { ...option, label: event.currentTarget.value }))}
        />
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Remove ${item} ${i + 1}`}
          onclick={() => removeOption(option.value)}>Remove</Button
        >
      </li>
    {/each}
  </ol>
  <Button
    class="self-start"
    variant="outline"
    size="sm"
    disabled={options.length >= cap}
    onclick={addOption}>Add {item}</Button
  >
</fieldset>
