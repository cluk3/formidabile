<script lang="ts">
  import {
    conditionIssues,
    conditionOperators,
    jumpIssues,
    pagesOf,
    reachabilityWarnings,
    type Condition,
    type FormDefinition,
    type Issue,
    type Jump,
    type PageView,
  } from "@fb/core/definition";
  import {
    addJump,
    JUMPS_CAP,
    moveJump,
    removeJump,
    setJump,
    upgradeToFormat2,
    type IdSource,
  } from "@fb/core/editing";
  import { Button } from "#lib/components/ui/button/index.js";
  import { fieldClass, nativeInputClass } from "#lib/fields.ts";
  import ConditionEditor from "#lib/ConditionEditor.svelte";

  let {
    page,
    number,
    definition,
    edit,
    ids,
  }: {
    page: PageView;
    /** 1-based position, used when a format-1 page is upgraded while adding a jump. */
    number: number;
    definition: FormDefinition;
    edit(change: (definition: FormDefinition) => FormDefinition): void;
    ids: IdSource;
  } = $props();

  const uid = $props.id();

  const indexOf = (source: FormDefinition) =>
    source.format === 2 ? source.pages.findIndex((item) => item.id === page.id) : 0;

  const readable = $derived.by(() => {
    const pages = pagesOf(definition);
    const index = page.id === null ? 0 : pages.findIndex((item) => item.id === page.id);
    return pages.slice(0, (index < 0 ? 0 : index) + 1).flatMap((item) => item.questions);
  });

  const targets = $derived.by(() => {
    const pages = pagesOf(definition);
    const index = page.id === null ? 0 : pages.findIndex((item) => item.id === page.id);
    return pages.flatMap((other, at) => {
      if (other.id === null || at <= index) return [];
      return [
        { value: other.id, label: other.title?.trim() ? other.title.trim() : `Page ${at + 1}` },
      ];
    });
  });

  const warningTexts = $derived.by(() => {
    const index =
      page.id === null ? 0 : pagesOf(definition).findIndex((item) => item.id === page.id);
    return reachabilityWarnings(definition)
      .filter((issue) =>
        definition.format === 1 ? true : issue.path[0] === "pages" && issue.path[1] === index,
      )
      .map((issue) => {
        const at = issue.path.at(-1);
        if (issue.path.at(-2) !== "questions" || typeof at !== "number") return issue.message;
        const label = page.questions[at]?.label.trim() || "Untitled question";
        return `${label} cannot be reached`;
      });
  });

  const messagesUnder = (index: number, source: readonly Issue[]) => {
    const prefix = ["pages", indexOf(definition), "jumps", index];
    return source
      .filter((issue) => prefix.every((segment, at) => issue.path[at] === segment))
      .map((issue) => issue.message);
  };

  const revise = (
    update: (definition: Extract<FormDefinition, { format: 2 }>, pageId: string) => FormDefinition,
  ) =>
    edit((current) => {
      const upgraded = current.format === 2 ? current : upgradeToFormat2(current, ids);
      return update(upgraded, page.id ?? upgraded.pages[number - 1]!.id);
    });

  const blank = (): Jump => {
    const question = readable[0]!;
    const operator = conditionOperators[question.type][0]!;
    const condition: Condition =
      operator.constant === "string"
        ? { questionId: question.id, operator: operator.id, constant: "" }
        : operator.constant === "strings"
          ? { questionId: question.id, operator: operator.id, constant: [] }
          : { questionId: question.id, operator: operator.id };
    return { condition, target: targets[0]?.value ?? "end" };
  };

  const chooseTarget = (index: number, jump: Jump, value: string) => {
    const target: Jump["target"] = value === "end" ? "end" : value;
    revise((definition, pageId) =>
      setJump(definition, pageId, index, { condition: jump.condition, target }),
    );
  };
</script>

<section aria-labelledby="{uid}-heading" class="flex flex-col gap-3 border-t pt-3">
  <h4 id="{uid}-heading" class="text-sm font-semibold">Jumps</h4>
  {#if warningTexts.length > 0}
    <ul aria-label="Reachability warnings" class="list-disc pl-5 text-sm text-destructive">
      {#each warningTexts as text, index (index)}
        <li>{text}</li>
      {/each}
    </ul>
  {/if}
  <ol class="flex flex-col gap-3">
    {#each page.jumps as jump, index (index)}
      {@const targetMessages = messagesUnder(index, jumpIssues(definition))}
      {@const conditionMessages = messagesUnder(index, conditionIssues(definition))}
      <li>
        <section aria-label="Jump {index + 1}" class="flex flex-col gap-2 rounded-md border p-3">
          {#if targetMessages.length > 0 || conditionMessages.length > 0}
            <p class="text-sm font-medium text-destructive">Broken</p>
          {/if}
          {#if targetMessages.length > 0}
            <ul aria-label="Jump problems" class="list-disc pl-5 text-sm text-destructive">
              {#each targetMessages as message, messageIndex (messageIndex)}
                <li>{message}</li>
              {/each}
            </ul>
          {/if}
          <ConditionEditor
            purpose="jump"
            condition={jump.condition}
            earlier={readable}
            issues={conditionMessages}
            onchange={(next) => {
              if (next === undefined) return;
              revise((definition, pageId) =>
                setJump(definition, pageId, index, { condition: next, target: jump.target }),
              );
            }}
          />
          <div class={fieldClass}>
            <label for="{uid}-target-{index}">Go to</label>
            <select
              id="{uid}-target-{index}"
              class={nativeInputClass}
              value={jump.target}
              onchange={(event) => chooseTarget(index, jump, event.currentTarget.value)}
            >
              {#each targets as target (target.value)}
                <option value={target.value}>{target.label}</option>
              {/each}
              <option value="end">End of the form</option>
              {#if targetMessages.length > 0}
                <option value={jump.target}>Broken target</option>
              {/if}
            </select>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={index === 0}
              onclick={() =>
                revise((definition, pageId) => moveJump(definition, pageId, index, index - 1))}
              >Move jump up</Button
            >
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={index === page.jumps.length - 1}
              onclick={() =>
                revise((definition, pageId) => moveJump(definition, pageId, index, index + 1))}
              >Move jump down</Button
            >
            <Button
              variant="destructive"
              size="sm"
              type="button"
              onclick={() => revise((definition, pageId) => removeJump(definition, pageId, index))}
              >Remove jump</Button
            >
          </div>
        </section>
      </li>
    {/each}
  </ol>
  <Button
    variant="outline"
    size="sm"
    type="button"
    disabled={page.jumps.length >= JUMPS_CAP || readable.length === 0}
    onclick={() => revise((definition, pageId) => addJump(definition, pageId, blank()))}
    >Add jump</Button
  >
</section>
