import type { Condition } from "./condition.ts";
import {
  constantFits,
  operatorById,
  optionValues,
  questionTypeHasRows,
  rankConstant,
} from "./operators.ts";
import type { Issue } from "./question-type.ts";

type Node =
  | {
      readonly questionId: string;
      readonly operator: string;
      readonly constant?: unknown;
      readonly row?: string;
    }
  | { readonly all: readonly Node[] }
  | { readonly any: readonly Node[] };

type Placed = { readonly type: string; readonly flat: number; readonly config: unknown };

const NOT_EARLIER = "This condition reads a question that is not earlier in the form";
const OPERATOR = "This operator does not fit this question";
const NEEDS_CONSTANT = "This operator needs a constant";
const TAKES_NO_CONSTANT = "This operator takes no constant";
const CONSTANT = "This constant does not fit this operator";
const OPTION = "This condition names an option value the question does not have";
const ROWS = "This question has no rows";
const EMPTY = "A condition group cannot be empty";

type ConditionQuestion = {
  readonly id: string;
  readonly type: string;
  readonly config: unknown;
  readonly showCondition?: Condition;
};

/** The part of a definition {@link conditionIssues} reads. A parsed form definition satisfies it. */
export type ConditionDefinition =
  | { readonly format: 1; readonly questions: readonly ConditionQuestion[] }
  | {
      readonly format: 2;
      readonly pages: readonly {
        readonly questions: readonly ConditionQuestion[];
        readonly jumps: readonly { readonly condition: Condition }[];
      }[];
    };

/**
 * Every condition problem in the definition: a reference that is not earlier, an operator or constant
 * that does not fit the referenced question, an option value it does not have, a row on a type with no
 * rows, or an empty group. Jump conditions are included. The caller reports them with whatever else
 * publish finds.
 */
export const conditionIssues = (definition: ConditionDefinition): Issue[] => {
  const placed = new Map<string, Placed>();
  let flat = 0;
  const questions =
    definition.format === 1
      ? [definition.questions]
      : definition.pages.map((page) => page.questions);
  for (const list of questions)
    for (const question of list)
      placed.set(question.id, { type: question.type, flat: flat++, config: question.config });

  const issues: Issue[] = [];
  const collect = (condition: Condition, path: (string | number)[], anchor: number) =>
    walk(condition as Node, path, anchor, placed, issues);

  if (definition.format === 1) {
    definition.questions.forEach((question, index) => {
      if (question.showCondition !== undefined)
        collect(
          question.showCondition,
          ["questions", index, "showCondition"],
          placed.get(question.id)!.flat,
        );
    });
    return issues;
  }

  flat = 0;
  definition.pages.forEach((page, pageIndex) => {
    page.questions.forEach((question, index) => {
      if (question.showCondition !== undefined)
        collect(
          question.showCondition,
          ["pages", pageIndex, "questions", index, "showCondition"],
          flat,
        );
      flat += 1;
    });
    page.jumps.forEach((jump, index) => {
      collect(jump.condition, ["pages", pageIndex, "jumps", index, "condition"], flat);
    });
  });
  return issues;
};

const walk = (
  node: Node,
  path: (string | number)[],
  anchor: number,
  placed: ReadonlyMap<string, Placed>,
  issues: Issue[],
) => {
  if ("all" in node) {
    if (node.all.length === 0) issues.push({ path, message: EMPTY });
    node.all.forEach((child, index) =>
      walk(child, [...path, "all", index], anchor, placed, issues),
    );
    return;
  }
  if ("any" in node) {
    if (node.any.length === 0) issues.push({ path, message: EMPTY });
    node.any.forEach((child, index) =>
      walk(child, [...path, "any", index], anchor, placed, issues),
    );
    return;
  }

  const question = placed.get(node.questionId);
  if (question === undefined || question.flat >= anchor)
    issues.push({ path: [...path, "questionId"], message: NOT_EARLIER });
  if (question === undefined) return;

  if (node.row !== undefined && !questionTypeHasRows(question.type))
    issues.push({ path: [...path, "row"], message: ROWS });

  const operator = operatorById(question.type, node.operator);
  if (operator === undefined) {
    issues.push({ path: [...path, "operator"], message: OPERATOR });
    return;
  }

  if (operator.constant === "none") {
    if (node.constant !== undefined)
      issues.push({ path: [...path, "constant"], message: TAKES_NO_CONSTANT });
  } else if (node.constant === undefined) {
    issues.push({ path: [...path, "constant"], message: NEEDS_CONSTANT });
  } else if (!constantFits(operator, node.constant)) {
    issues.push({ path: [...path, "constant"], message: CONSTANT });
  } else if (operator.constant === "rank") {
    const rank = rankConstant(node.constant);
    if (rank !== undefined && !optionValues(question.config).has(rank.value))
      issues.push({ path: [...path, "constant", "value"], message: OPTION });
  } else if (operator.options && Array.isArray(node.constant)) {
    const values = optionValues(question.config);
    node.constant.forEach((value, index) => {
      if (typeof value !== "string" || !values.has(value))
        issues.push({ path: [...path, "constant", index], message: OPTION });
    });
  }
};
