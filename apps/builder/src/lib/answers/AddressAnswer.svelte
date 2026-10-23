<script lang="ts">
  import { addressLines, type AddressLine } from "@fb/core/definition";
  import type { AnswerProps } from "#lib/answers/props.ts";

  let { value }: AnswerProps<"address"> = $props();

  const label: Record<AddressLine, string> = {
    line1: "Address line 1",
    line2: "Address line 2",
    city: "City",
    region: "Region",
    postalCode: "Postal code",
    country: "Country",
  };

  const countryName = (code: string) =>
    new Intl.DisplayNames([document.documentElement.lang || navigator.language || "en"], {
      type: "region",
    }).of(code) ?? code;
</script>

<ul>
  {#each addressLines as line (line)}
    {@const part = value[line]}
    {#if part !== undefined}
      <li>
        {label[line]}:
        {line === "country" ? `${countryName(part)} (${part})` : part}
      </li>
    {/if}
  {/each}
</ul>
