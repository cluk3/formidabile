<script lang="ts">
  import {
    pagesOf,
    questionsOf,
    type FormDefinition,
    type QuestionTypeName,
  } from "@fb/core/definition";
  import { addPage, PAGES_CAP, upgradeToFormat2, type IdSource } from "@fb/core/editing";
  import { Button } from "#lib/components/ui/button/index.js";
  import { fieldClass, nativeInputClass } from "#lib/fields.ts";
  import PageEditor from "#lib/PageEditor.svelte";
  import { questionTypeNames, registry } from "#lib/registry.ts";

  let {
    definition,
    edit,
    ids,
  }: {
    definition: FormDefinition;
    edit(change: (definition: FormDefinition) => FormDefinition): void;
    ids: IdSource;
  } = $props();
  const uid = $props.id();
  let newType = $state<QuestionTypeName>("text");

  const pages = $derived(pagesOf(definition));
  const totalQuestions = $derived(questionsOf(definition).length);
</script>

<ol class="flex flex-col gap-4">
  {#each pages as page, index (page.id ?? "only")}
    {@const offset = pages.slice(0, index).reduce((sum, item) => sum + item.questions.length, 0)}
    <li>
      <PageEditor
        {page}
        number={index + 1}
        pageCount={pages.length}
        {offset}
        {totalQuestions}
        {definition}
        definitionPages={pages}
        {edit}
        {ids}
        {newType}
      />
    </li>
  {/each}
</ol>

<div class="flex flex-wrap items-end gap-2">
  <div class={fieldClass}>
    <label for="{uid}-new-type">New question type</label>
    <select id="{uid}-new-type" class={nativeInputClass} bind:value={newType}>
      {#each questionTypeNames as type (type)}
        <option value={type}>{registry[type].name}</option>
      {/each}
    </select>
  </div>
  <Button
    variant="outline"
    disabled={pages.length >= PAGES_CAP}
    onclick={() =>
      edit((current) =>
        addPage(current.format === 2 ? current : upgradeToFormat2(current, ids), ids),
      )}>Add page</Button
  >
</div>
