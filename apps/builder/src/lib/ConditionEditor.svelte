<script lang="ts">
  import {
    conditionOperators,
    type Condition,
    type ConditionOperator,
    type QuestionSnapshot,
  } from "@fb/core/definition";
  import { Button } from "#lib/components/ui/button/index.js";
  import { checkClass, fieldClass, nativeInputClass } from "#lib/fields.ts";

  /** A condition node. Nested groups share this shape; the root value is a {@link Condition}. */
  type Leaf = {
    questionId: string;
    operator: string;
    constant?: string | number | string[];
    row?: string;
  };
  type Node = Leaf | { all: Node[] } | { any: Node[] };
  type Change = (condition: Condition | undefined) => void;

  let {
    condition,
    earlier,
    issues = [],
    depth = 1,
    onchange,
  }: {
    condition: Condition | undefined;
    earlier: readonly QuestionSnapshot[];
    /** Publish problems for this condition. Shown on the outermost group only. */
    issues?: readonly string[];
    /** Group nesting, starting at 1. A third group holds only leaves. */
    depth?: number;
    onchange: Change;
  } = $props();

  const uid = $props.id();

  const operatorLabel: Record<string, string> = {
    equals: "equals",
    does_not_equal: "does not equal",
    contains: "contains",
    does_not_contain: "does not contain",
    equal: "=",
    not_equal: "≠",
    less_than: "<",
    at_most: "≤",
    greater_than: ">",
    at_least: "≥",
    is_on: "is on",
    is_at: "is at",
    is_before: "is before",
    is_after: "is after",
    is_any_of: "is any of",
    is_none_of: "is none of",
    includes_any_of: "includes any of",
    includes_all_of: "includes all of",
    includes_none_of: "includes none of",
    is_yes: "is yes",
    is_no: "is no",
    is_answered: "is answered",
    is_not_answered: "is not answered",
  };

  const isLeaf = (value: Node): value is Leaf => "questionId" in value;

  const choiceOptions = (
    question: QuestionSnapshot,
  ): readonly { readonly value: string; readonly label: string }[] =>
    question.type === "single_choice" || question.type === "multiple_choice"
      ? question.config.options
      : [];

  const initialConstant = (
    operator: ConditionOperator,
    question: QuestionSnapshot,
    keep: unknown,
  ): { constant?: string | number | string[] } => {
    if (operator.constant === "none") return {};
    if (operator.constant === "string") return { constant: typeof keep === "string" ? keep : "" };
    if (operator.constant === "number") return typeof keep === "number" ? { constant: keep } : {};
    if (operator.constant === "date" || operator.constant === "time")
      return typeof keep === "string" ? { constant: keep } : {};
    const values = new Set(choiceOptions(question).map((option) => option.value));
    const kept = Array.isArray(keep)
      ? keep.filter((item): item is string => typeof item === "string" && values.has(item))
      : [];
    return { constant: kept };
  };

  const blank = (): Leaf => {
    const question = earlier[0]!;
    const operator = conditionOperators[question.type][0]!;
    return {
      questionId: question.id,
      operator: operator.id,
      ...initialConstant(operator, question, undefined),
    };
  };

  const leafBase = (leaf: Leaf): Leaf => ({
    questionId: leaf.questionId,
    operator: leaf.operator,
    ...(leaf.row === undefined ? {} : { row: leaf.row }),
  });

  const chooseQuestion = (leaf: Leaf, questionId: string, change: Change) => {
    const question = earlier.find((item) => item.id === questionId);
    if (question === undefined) return;
    const available = conditionOperators[question.type];
    const operator = available.find((item) => item.id === leaf.operator) ?? available[0]!;
    change({
      ...leafBase(leaf),
      questionId,
      operator: operator.id,
      ...initialConstant(
        operator,
        question,
        operator.id === leaf.operator ? leaf.constant : undefined,
      ),
    });
  };

  const chooseOperator = (leaf: Leaf, operatorId: string, change: Change) => {
    const question = earlier.find((item) => item.id === leaf.questionId);
    const operator = (question === undefined ? [] : conditionOperators[question.type]).find(
      (item) => item.id === operatorId,
    );
    if (operator === undefined || question === undefined) return;
    change({
      ...leafBase(leaf),
      operator: operator.id,
      ...initialConstant(operator, question, leaf.constant),
    });
  };

  const setConstant = (
    leaf: Leaf,
    constant: string | number | string[] | undefined,
    change: Change,
  ) =>
    change({
      ...leafBase(leaf),
      ...(constant === undefined ? {} : { constant }),
    });

  const toggleValue = (leaf: Leaf, value: string, checked: boolean, change: Change) => {
    const question = earlier.find((item) => item.id === leaf.questionId);
    const current = new Set(Array.isArray(leaf.constant) ? leaf.constant : []);
    if (checked) current.add(value);
    else current.delete(value);
    const ordered =
      question === undefined
        ? [...current]
        : choiceOptions(question)
            .map((option) => option.value)
            .filter((item) => current.has(item));
    setConstant(leaf, ordered, change);
  };

  const childrenOf = (group: Node): Node[] => {
    if (isLeaf(group)) return [];
    return "all" in group ? [...group.all] : [...group.any];
  };

  const replaceChild = (
    group: Node,
    index: number,
    next: Condition | undefined,
    change: Change,
  ) => {
    if (isLeaf(group)) return;
    const children = childrenOf(group);
    const updated =
      next === undefined
        ? children.toSpliced(index, 1)
        : children.toSpliced(index, 1, next as Node);
    change("all" in group ? { all: updated } : { any: updated });
  };

  const addChild = (group: Node, child: Node, change: Change) => {
    if (isLeaf(group)) return;
    const children = [...childrenOf(group), child];
    change("all" in group ? { all: children } : { any: children });
  };

  const setKind = (group: Node, kind: "all" | "any", change: Change) => {
    if (isLeaf(group)) return;
    const children = childrenOf(group);
    change(kind === "all" ? { all: children } : { any: children });
  };
</script>

{#snippet branch(current: Condition | undefined, level: number, key: string, change: Change)}
  {@const currentNode = current === undefined ? undefined : (current as Node)}
  <section
    aria-label={level === 1 ? "Show when" : "Condition"}
    class="flex flex-col gap-2 {level === 1 ? '' : 'rounded-md border p-3'}"
  >
    {#if level === 1}
      {#if issues.length > 0}
        <ul aria-label="Show condition problems" class="list-disc pl-5 text-sm text-destructive">
          {#each issues as issue, index (index)}
            <li>{issue}</li>
          {/each}
        </ul>
      {/if}
      {#if currentNode === undefined}
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={earlier.length === 0}
          onclick={() => change(blank())}>Only show when…</Button
        >
      {:else}
        <Button variant="outline" size="sm" type="button" onclick={() => change(undefined)}
          >Always show</Button
        >
      {/if}
    {/if}

    {#if currentNode !== undefined && isLeaf(currentNode)}
      {@const leaf = currentNode}
      {@const question = earlier.find((item) => item.id === leaf.questionId)}
      {@const operators = question === undefined ? [] : conditionOperators[question.type]}
      {@const active = operators.find((operator) => operator.id === leaf.operator)}
      <div class={fieldClass}>
        <label for="{key}-question">Question</label>
        <select
          id="{key}-question"
          class={nativeInputClass}
          value={leaf.questionId}
          onchange={(event) => chooseQuestion(leaf, event.currentTarget.value, change)}
        >
          {#each earlier as item (item.id)}
            <option value={item.id}>{item.label.trim() || "Untitled question"}</option>
          {/each}
          {#if question === undefined}
            <option value={leaf.questionId}>Unknown question</option>
          {/if}
        </select>
      </div>
      <div class={fieldClass}>
        <label for="{key}-operator">Operator</label>
        <select
          id="{key}-operator"
          class={nativeInputClass}
          value={leaf.operator}
          onchange={(event) => chooseOperator(leaf, event.currentTarget.value, change)}
        >
          {#each operators as operator (operator.id)}
            <option value={operator.id}>{operatorLabel[operator.id] ?? operator.id}</option>
          {/each}
          {#if active === undefined}
            <option value={leaf.operator}>{operatorLabel[leaf.operator] ?? leaf.operator}</option>
          {/if}
        </select>
      </div>
      {#if active?.constant === "strings" && question !== undefined}
        <fieldset class="flex flex-col gap-1">
          <legend class="text-sm font-medium">Values</legend>
          {#each choiceOptions(question) as option (option.value)}
            <label class={checkClass}>
              <input
                type="checkbox"
                checked={Array.isArray(leaf.constant) && leaf.constant.includes(option.value)}
                onchange={(event) =>
                  toggleValue(leaf, option.value, event.currentTarget.checked, change)}
              />
              {option.label.trim() || option.value}
            </label>
          {/each}
        </fieldset>
      {:else if active !== undefined && active.constant !== "none" && active.constant !== "strings"}
        <label class={fieldClass}>
          Value
          {#if active.constant === "number"}
            <input
              class={nativeInputClass}
              type="number"
              value={typeof leaf.constant === "number" ? String(leaf.constant) : ""}
              oninput={(event) => {
                const raw = event.currentTarget.value;
                setConstant(
                  leaf,
                  raw === "" || !Number.isFinite(Number(raw)) ? undefined : Number(raw),
                  change,
                );
              }}
            />
          {:else if active.constant === "date"}
            <input
              class={nativeInputClass}
              type="date"
              value={typeof leaf.constant === "string" ? leaf.constant : ""}
              oninput={(event) => setConstant(leaf, event.currentTarget.value || undefined, change)}
            />
          {:else if active.constant === "time"}
            <input
              class={nativeInputClass}
              type="time"
              value={typeof leaf.constant === "string" ? leaf.constant : ""}
              oninput={(event) => setConstant(leaf, event.currentTarget.value || undefined, change)}
            />
          {:else}
            <input
              class={nativeInputClass}
              type="text"
              value={typeof leaf.constant === "string" ? leaf.constant : ""}
              oninput={(event) => setConstant(leaf, event.currentTarget.value, change)}
            />
          {/if}
        </label>
      {/if}
      {#if level === 1}
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={earlier.length === 0}
          onclick={() => change({ all: [leaf, blank()] })}>Combine with another condition</Button
        >
      {:else}
        <Button variant="outline" size="sm" type="button" onclick={() => change(undefined)}
          >Remove</Button
        >
      {/if}
    {:else if currentNode !== undefined}
      {@const group = currentNode}
      {@const kind = "all" in group ? "all" : "any"}
      <div class={fieldClass}>
        <label for="{key}-match">Match</label>
        <select
          id="{key}-match"
          class={nativeInputClass}
          value={kind}
          onchange={(event) =>
            setKind(group, event.currentTarget.value === "any" ? "any" : "all", change)}
        >
          <option value="all">All of these</option>
          <option value="any">Any of these</option>
        </select>
      </div>
      {#each childrenOf(group) as child, index (index)}
        {@render branch(child as Condition, level + 1, `${key}-${index}`, (next) =>
          replaceChild(group, index, next, change),
        )}
      {/each}
      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={earlier.length === 0}
          onclick={() => addChild(group, blank(), change)}>Add condition</Button
        >
        {#if level < 3}
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={earlier.length === 0}
            onclick={() => addChild(group, { all: [blank()] }, change)}>Add group</Button
          >
        {/if}
        {#if level !== 1}
          <Button variant="outline" size="sm" type="button" onclick={() => change(undefined)}
            >Remove</Button
          >
        {/if}
      </div>
    {/if}
  </section>
{/snippet}

{@render branch(condition, depth, uid, onchange)}
