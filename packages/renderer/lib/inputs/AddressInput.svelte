<script lang="ts">
  import { addressLines, countryCodes, type AddressLine } from "@fb/core/definition";
  import type { InputProps } from "../inputs.ts";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"address"> = $props();

  const lineLabel: Record<AddressLine, string> = {
    line1: "Address line 1",
    line2: "Address line 2",
    city: "City",
    region: "Region",
    postalCode: "Postal code",
    country: "Country",
  };

  const autocomplete = {
    line1: "address-line1",
    line2: "address-line2",
    city: "address-level2",
    region: "address-level1",
    postalCode: "postal-code",
    country: "country",
  } as const satisfies Record<AddressLine, string>;

  const shown = $derived(addressLines.filter((line) => question.config.lines[line].shown));

  const countries = $derived.by(() => {
    const locale = document.documentElement.lang || navigator.language || "en";
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return countryCodes
      .map((code) => ({ code, name: names.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  });

  const setLine = (line: AddressLine, next: string) => {
    value = { ...value, [line]: next };
  };
</script>

<fieldset class="group" aria-describedby={field.describedBy}>
  <legend class="label" part="label"><Prompt {question} /></legend>
  <Description {question} {field} />
  <div class="lines">
    {#each shown as line, index (line)}
      {@const controlId = index === 0 ? field.id : `${field.id}-${line}`}
      {@const caption = question.config.lines[line].required
        ? `${lineLabel[line]} (required)`
        : lineLabel[line]}
      <div class="line">
        <label for={controlId}>{caption}</label>
        {#if line === "country"}
          <select
            id={controlId}
            class="control"
            part="input"
            autocomplete={autocomplete.country}
            value={value?.country ?? ""}
            aria-invalid={field.invalid ? "true" : undefined}
            aria-describedby={field.describedBy}
            onchange={(event) => setLine("country", event.currentTarget.value)}
          >
            <option value="">Select a country</option>
            {#each countries as country (country.code)}
              <option value={country.code}>{country.name}</option>
            {/each}
          </select>
        {:else}
          <input
            id={controlId}
            class="control"
            part="input"
            type="text"
            autocomplete={autocomplete[line]}
            value={value?.[line] ?? ""}
            aria-invalid={field.invalid ? "true" : undefined}
            aria-describedby={field.describedBy}
            oninput={(event) => setLine(line, event.currentTarget.value)}
          />
        {/if}
      </div>
    {/each}
  </div>
</fieldset>

<style>
  .lines {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .line {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
</style>
