<script lang="ts">
  import {
    applicableOperators,
    conditionOperators,
    countryCodes,
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
    purpose = "show",
    onchange,
  }: {
    condition: Condition | undefined;
    earlier: readonly QuestionSnapshot[];
    /** Publish problems for this condition. Shown on the outermost group only. */
    issues?: readonly string[];
    /** Group nesting, starting at 1. A third group holds only leaves. */
    depth?: number;
    /** `jump` keeps the condition and names the group for a page jump. */
    purpose?: "show" | "jump";
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
    starts_with: "starts with",
    does_not_start_with: "does not start with",
    starts_before: "starts before",
    starts_on: "starts on",
    starts_after: "starts after",
    ends_before: "ends before",
    ends_on: "ends on",
    ends_after: "ends after",
    country_is_any_of: "country is any of",
    country_is_none_of: "country is none of",
  };

  const offered = (question: QuestionSnapshot) =>
    applicableOperators(question.type, question.config);

  const regionNames = () =>
    new Intl.DisplayNames([document.documentElement.lang || navigator.language || "en"], {
      type: "region",
    });

  const isLeaf = (value: Node): value is Leaf => "questionId" in value;

  const choiceOptions = (
    question: QuestionSnapshot,
  ): readonly { readonly value: string; readonly label: string }[] => {
    if (question.type === "single_choice" || question.type === "multiple_choice")
      return question.config.options;
    if (question.type === "single_choice_matrix" || question.type === "multiple_choice_matrix")
      return question.config.columns;
    return [];
  };

  const matrixRows = (
    question: QuestionSnapshot | undefined,
  ): readonly { readonly value: string; readonly label: string }[] =>
    question?.type === "single_choice_matrix" || question?.type === "multiple_choice_matrix"
      ? question.config.rows
      : [];

  const valuesOf = (question: QuestionSnapshot, operator: ConditionOperator | undefined) => {
    if (operator?.countries) {
      const names = regionNames();
      return countryCodes.map((code) => ({ value: code, label: names.of(code) ?? code }));
    }
    return choiceOptions(question);
  };

  /** A comparison operator names one row. Presence operators may name a row or the whole question. */
  const rowFor = (
    operator: ConditionOperator,
    question: QuestionSnapshot,
    keep: string | undefined,
  ): { row?: string } => {
    if (operator.row !== true) return {};
    const rows = matrixRows(question);
    const row =
      keep !== undefined && rows.some((item) => item.value === keep) ? keep : rows[0]?.value;
    return row === undefined ? {} : { row };
  };

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
    if (operator.constant === "date_time")
      return typeof keep === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(keep)
        ? { constant: keep }
        : {};
    const values = new Set(
      operator.countries ? countryCodes : choiceOptions(question).map((option) => option.value),
    );
    const kept = Array.isArray(keep)
      ? keep.filter((item): item is string => typeof item === "string" && values.has(item))
      : [];
    return { constant: kept };
  };

  const blank = (): Leaf => {
    const question = earlier[0]!;
    const operator = offered(question)[0]!;
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
    const available = offered(question);
    const operator = available.find((item) => item.id === leaf.operator) ?? available[0]!;
    const { row: _row, ...rest } = leafBase(leaf);
    change({
      ...rest,
      questionId,
      operator: operator.id,
      ...rowFor(operator, question, leaf.row),
      ...initialConstant(
        operator,
        question,
        operator.id === leaf.operator ? leaf.constant : undefined,
      ),
    });
  };

  const chooseOperator = (leaf: Leaf, operatorId: string, change: Change) => {
    const question = earlier.find((item) => item.id === leaf.questionId);
    const operator = (question === undefined ? [] : offered(question)).find(
      (item) => item.id === operatorId,
    );
    if (operator === undefined || question === undefined) return;
    const { row: _row, ...rest } = leafBase(leaf);
    change({
      ...rest,
      operator: operator.id,
      ...rowFor(operator, question, leaf.row),
      ...initialConstant(operator, question, leaf.constant),
    });
  };

  const setRow = (leaf: Leaf, raw: string, change: Change) => {
    const { row: _row, ...rest } = leaf;
    change(raw === "" ? rest : { ...rest, row: raw });
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
    const operator =
      question === undefined
        ? undefined
        : conditionOperators[question.type].find((item) => item.id === leaf.operator);
    const ordered =
      question === undefined
        ? [...current]
        : (operator?.countries
            ? countryCodes
            : choiceOptions(question).map((option) => option.value)
          ).filter((item) => current.has(item));
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
    aria-label={level === 1 ? (purpose === "jump" ? "Jump when" : "Show when") : "Condition"}
    class="flex flex-col gap-2 {level === 1 ? '' : 'rounded-md border p-3'}"
  >
    {#if level === 1}
      {#if issues.length > 0}
        <ul
          aria-label={purpose === "jump" ? "Jump condition problems" : "Show condition problems"}
          class="list-disc pl-5 text-sm text-destructive"
        >
          {#each issues as issue, index (index)}
            <li>{issue}</li>
          {/each}
        </ul>
      {/if}
      {#if purpose === "show"}
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
    {/if}

    {#if currentNode !== undefined && isLeaf(currentNode)}
      {@const leaf = currentNode}
      {@const question = earlier.find((item) => item.id === leaf.questionId)}
      {@const operators = question === undefined ? [] : offered(question)}
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
      {#if matrixRows(question).length > 0}
        <div class={fieldClass}>
          <label for="{key}-row">Row</label>
          <select
            id="{key}-row"
            class={nativeInputClass}
            value={leaf.row ?? ""}
            onchange={(event) => setRow(leaf, event.currentTarget.value, change)}
          >
            {#if active?.row !== true}
              <option value="">The whole question</option>
            {/if}
            {#each matrixRows(question) as row (row.value)}
              <option value={row.value}>{row.label.trim() || "Untitled row"}</option>
            {/each}
            {#if leaf.row !== undefined && !matrixRows(question).some((row) => row.value === leaf.row)}
              <option value={leaf.row}>Unknown row</option>
            {/if}
          </select>
        </div>
      {/if}
      {#if active?.constant === "strings" && question !== undefined}
        <fieldset class="flex flex-col gap-1">
          <legend class="text-sm font-medium">Values</legend>
          {#each valuesOf(question, active) as option (option.value)}
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
          {:else if active.constant === "date_time"}
            <input
              class={nativeInputClass}
              type="datetime-local"
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
