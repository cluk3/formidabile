<script lang="ts">
  import { addressLines, type AddressLine, type QuestionSnapshotOf } from "@fb/core/definition";
  import { checkClass } from "#lib/fields.ts";
  import type { EditorProps } from "#lib/editors/props.ts";

  let { question, setConfig }: EditorProps<QuestionSnapshotOf<"address">> = $props();

  const label: Record<AddressLine, string> = {
    line1: "Line 1",
    line2: "Line 2",
    city: "City",
    region: "Region",
    postalCode: "Postal code",
    country: "Country",
  };

  const setShown = (line: AddressLine, shown: boolean) => {
    const lines = question.config.lines;
    const shownCount = addressLines.filter((item) => lines[item].shown).length;
    if (!shown && lines[line].shown && shownCount === 1) return;
    setConfig({
      lines: {
        ...lines,
        [line]: { shown, required: shown ? lines[line].required : false },
      },
    });
  };

  const setRequired = (line: AddressLine, required: boolean) => {
    const lines = question.config.lines;
    if (!lines[line].shown) return;
    setConfig({ lines: { ...lines, [line]: { shown: true, required } } });
  };
</script>

<p class="text-sm text-muted-foreground">
  Choose which lines to ask. A required line must be filled once any line is filled.
</p>
{#each addressLines as line (line)}
  {@const setting = question.config.lines[line]}
  <fieldset class="flex flex-wrap gap-3">
    <legend class="text-sm font-medium">{label[line]}</legend>
    <label class={checkClass}>
      <input
        type="checkbox"
        checked={setting.shown}
        onchange={(event) => {
          if (!event.currentTarget.checked && setting.shown) {
            const shownCount = addressLines.filter(
              (item) => question.config.lines[item].shown,
            ).length;
            if (shownCount === 1) {
              event.currentTarget.checked = true;
              return;
            }
          }
          setShown(line, event.currentTarget.checked);
        }}
      />
      Shown
    </label>
    <label class={checkClass}>
      <input
        type="checkbox"
        checked={setting.required}
        disabled={!setting.shown}
        onchange={(event) => setRequired(line, event.currentTarget.checked)}
      />
      Required
    </label>
  </fieldset>
{/each}
