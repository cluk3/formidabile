<script lang="ts">
  import type { FormDefinition, QuestionSnapshot, QuestionTypeName } from "@fb/core/definition";
  import {
    addOption,
    changeQuestionType,
    moveQuestion,
    moveQuestionTo,
    reidentifyQuestion,
    removeOption,
    removeQuestion,
    replaceQuestion,
    type IdSource,
  } from "@fb/core/editing";
  import { tick } from "svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { checkClass, fieldClass, nativeInputClass, optionalText } from "#lib/fields.ts";
  import { editorOf, questionTypeNames, registry } from "#lib/registry.ts";

  let {
    question,
    index,
    count,
    edit,
    ids,
    atStart,
    atEnd,
    destinations = [],
  }: {
    question: QuestionSnapshot;
    index: number;
    count: number;
    edit(change: (definition: FormDefinition) => FormDefinition): void;
    ids: IdSource;
    /** Move up stops here. Omitted, the question stops at the start of the form. */
    atStart?: boolean;
    /** Move down stops here. Omitted, the question stops at the end of the form. */
    atEnd?: boolean;
    /** Other pages this question can move to, labelled as the builder shows them. */
    destinations?: readonly { readonly id: string; readonly label: string }[];
  } = $props();
  const uid = $props.id();
  const upDisabled = $derived(atStart ?? index === 0);
  const downDisabled = $derived(atEnd ?? index === count - 1);

  const Editor = $derived(editorOf(question));
  let moveUp = $state<HTMLElement | null>(null);
  let moveDown = $state<HTMLElement | null>(null);

  const set = (next: QuestionSnapshot) =>
    edit((definition) => replaceQuestion(definition, question.id, () => next));

  /** Keyboard focus follows the question: the same button, or the other one once this one is disabled at an end. */
  const move = async (by: -1 | 1) => {
    edit((definition) => moveQuestion(definition, question.id, index + by));
    await tick();
    const [same, other] = by === -1 ? [moveUp, moveDown] : [moveDown, moveUp];
    (same?.hasAttribute("disabled") ? other : same)?.focus();
  };
</script>

<section aria-label={`Question ${index + 1}`} class="flex flex-col gap-3 rounded-md border p-4">
  <div class="flex flex-wrap items-end gap-2">
    <label class="{fieldClass} grow">
      Label
      <Input
        value={question.label}
        maxlength={500}
        oninput={(event) => set({ ...question, label: event.currentTarget.value })}
      />
    </label>
    <div class={fieldClass}>
      <label for={`${uid}-type`}>Type</label>
      <select
        id={`${uid}-type`}
        class={nativeInputClass}
        value={question.type}
        onchange={(event) => {
          const type = event.currentTarget.value as QuestionTypeName;
          edit((definition) => changeQuestionType(definition, question.id, type, ids));
        }}
      >
        {#each questionTypeNames as type (type)}
          <option value={type}>{registry[type].name}</option>
        {/each}
      </select>
    </div>
  </div>
  <div class={fieldClass}>
    <label for={`${uid}-description`}>Description</label>
    <textarea
      id={`${uid}-description`}
      class={nativeInputClass}
      rows={2}
      maxlength={2000}
      value={question.description ?? ""}
      oninput={(event) =>
        set({ ...question, description: optionalText(event.currentTarget.value) })}></textarea>
  </div>
  <label class={checkClass}>
    <input
      type="checkbox"
      checked={question.required}
      onchange={(event) => set({ ...question, required: event.currentTarget.checked })}
    />
    Required
  </label>

  <Editor
    {question}
    setConfig={(config, required) =>
      set({
        ...question,
        config,
        ...(required === undefined ? {} : { required }),
      } as QuestionSnapshot)}
    addOption={() => edit((definition) => addOption(definition, question.id, ids))}
    removeOption={(value) => edit((definition) => removeOption(definition, question.id, value))}
  />

  <div class="flex flex-wrap gap-2 border-t pt-3">
    <Button
      variant="outline"
      size="sm"
      bind:ref={moveUp}
      disabled={upDisabled}
      onclick={() => move(-1)}>Move up</Button
    >
    <Button
      variant="outline"
      size="sm"
      bind:ref={moveDown}
      disabled={downDisabled}
      onclick={() => move(1)}>Move down</Button
    >
    {#if destinations.length > 0}
      <div class={fieldClass}>
        <label for="{uid}-move">Move to page</label>
        <select
          id="{uid}-move"
          class={nativeInputClass}
          onchange={(event) => {
            const pageId = event.currentTarget.value;
            event.currentTarget.value = "";
            if (pageId === "") return;
            edit((definition) => {
              if (definition.format !== 2) return definition;
              const target = definition.pages.find((item) => item.id === pageId);
              if (target === undefined) return definition;
              return moveQuestionTo(definition, question.id, pageId, target.questions.length);
            });
          }}
        >
          <option value="">Choose a page</option>
          {#each destinations as destination (destination.id)}
            <option value={destination.id}>{destination.label}</option>
          {/each}
        </select>
      </div>
    {/if}
    <Button
      variant="outline"
      size="sm"
      title="Analytics stop combining its answers with this question's earlier ones"
      onclick={() => edit((definition) => reidentifyQuestion(definition, question.id, ids))}
      >Treat as a new question</Button
    >
    <Button
      variant="destructive"
      size="sm"
      onclick={() => edit((definition) => removeQuestion(definition, question.id))}
      >Remove question</Button
    >
  </div>
</section>
