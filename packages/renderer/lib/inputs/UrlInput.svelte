<script lang="ts">
  import type { InputProps } from "../inputs.ts";
  import Description from "./Description.svelte";
  import Prompt from "./Prompt.svelte";

  let { question, value = $bindable(), field }: InputProps<"url"> = $props();

  /**
   * `example.com` and `localhost:3000` have no scheme. `http://` and `javascript:` do.
   * The field then shows the `https://` that will be stored.
   */
  const withScheme = (input: string) => {
    const trimmed = input.trim();
    if (trimmed === "") return trimmed;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
    if (scheme === null) return `https://${trimmed}`;
    const name = scheme[1]!;
    const rest = trimmed.slice(name.length + 1);
    if (name.includes(".") || (!rest.startsWith("//") && /^\d/.test(rest)))
      return `https://${trimmed}`;
    return trimmed;
  };

  const showScheme = () => {
    if (value === undefined) return;
    value = withScheme(value);
  };
</script>

<label class="label" part="label" for={field.id}><Prompt {question} /></label>
<Description {question} {field} />
<input
  id={field.id}
  class="control"
  part="input"
  type="url"
  autocomplete="url"
  bind:value
  aria-invalid={field.invalid ? "true" : undefined}
  aria-describedby={field.describedBy}
  onblur={showScheme}
/>
