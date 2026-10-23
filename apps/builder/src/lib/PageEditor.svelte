<script lang="ts">
  import type { FormDefinition, PageView, QuestionTypeName } from "@fb/core/definition";
  import {
    addQuestion,
    movePage,
    QUESTIONS_CAP,
    removePage,
    setPageDescription,
    setPageTitle,
    upgradeToFormat2,
    type IdSource,
  } from "@fb/core/editing";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { fieldClass, nativeInputClass, optionalText } from "#lib/fields.ts";
  import QuestionCard from "#lib/QuestionCard.svelte";

  let {
    page,
    number,
    pageCount,
    offset,
    totalQuestions,
    definitionPages,
    edit,
    ids,
    newType,
  }: {
    page: PageView;
    /** 1-based position. Untitled pages are labelled "Page N" from this, in the builder only. */
    number: number;
    pageCount: number;
    offset: number;
    totalQuestions: number;
    definitionPages: readonly PageView[];
    edit(change: (definition: FormDefinition) => FormDefinition): void;
    ids: IdSource;
    newType: QuestionTypeName;
  } = $props();
  const uid = $props.id();
  const heading = $derived(page.title?.trim() ? page.title.trim() : `Page ${number}`);
  const destinations = $derived(
    definitionPages.flatMap((other, index) => {
      if (other.id === null || other.id === page.id) return [];
      return [
        { id: other.id, label: other.title?.trim() ? other.title.trim() : `Page ${index + 1}` },
      ];
    }),
  );

  const revise = (
    update: (definition: Extract<FormDefinition, { format: 2 }>, pageId: string) => FormDefinition,
  ) =>
    edit((definition) => {
      const current = definition.format === 2 ? definition : upgradeToFormat2(definition, ids);
      return update(current, page.id ?? current.pages[number - 1]!.id);
    });
</script>

<section aria-labelledby="{uid}-heading" class="flex flex-col gap-4 rounded-md border p-4">
  <div class="flex flex-wrap items-center gap-2">
    <h3 id="{uid}-heading" class="grow text-lg font-semibold">{heading}</h3>
    <Button
      variant="outline"
      size="sm"
      disabled={number === 1}
      onclick={() => revise((definition, pageId) => movePage(definition, pageId, number - 2))}
      >Move page up</Button
    >
    <Button
      variant="outline"
      size="sm"
      disabled={number === pageCount}
      onclick={() => revise((definition, pageId) => movePage(definition, pageId, number))}
      >Move page down</Button
    >
    <Button
      variant="destructive"
      size="sm"
      disabled={pageCount === 1}
      onclick={() => revise((definition, pageId) => removePage(definition, pageId))}
      >Remove page</Button
    >
  </div>
  <label class={fieldClass}>
    Page title
    <Input
      value={page.title ?? ""}
      maxlength={200}
      oninput={(event) => {
        const title = optionalText(event.currentTarget.value);
        revise((definition, pageId) => setPageTitle(definition, pageId, title));
      }}
    />
  </label>
  <div class={fieldClass}>
    <label for="{uid}-description">Page description</label>
    <textarea
      id="{uid}-description"
      class={nativeInputClass}
      rows={2}
      maxlength={5000}
      value={page.description ?? ""}
      oninput={(event) => {
        const description = optionalText(event.currentTarget.value);
        revise((definition, pageId) => setPageDescription(definition, pageId, description));
      }}></textarea>
  </div>
  <ol class="flex flex-col gap-4">
    {#each page.questions as question, index (question.id)}
      <li>
        <QuestionCard
          {question}
          index={offset + index}
          count={totalQuestions}
          atStart={index === 0}
          atEnd={index === page.questions.length - 1}
          {destinations}
          {edit}
          {ids}
        />
      </li>
    {/each}
  </ol>
  <Button
    variant="outline"
    disabled={totalQuestions >= QUESTIONS_CAP}
    onclick={() => revise((definition, pageId) => addQuestion(definition, newType, ids, pageId))}
    >Add question</Button
  >
</section>
