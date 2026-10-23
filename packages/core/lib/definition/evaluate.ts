import type { Condition } from "./condition.ts";
import { constantFits, operatorById, optionValues, questionTypeHasRows } from "./operators.ts";

type Node =
  | {
      readonly questionId: string;
      readonly operator: string;
      readonly constant?: unknown;
      readonly row?: string;
    }
  | { readonly all: readonly Node[] }
  | { readonly any: readonly Node[] };

/** A question the evaluator can place. `flat` is its index in display order. */
export type EvalQuestion = {
  readonly id: string;
  readonly type: string;
  readonly flat: number;
  readonly config: unknown;
};

/**
 * One condition check. `anchor` is the display index a reference must be strictly earlier than.
 * `shown` is the questions already on the path; anything else counts as unanswered.
 */
export type EvalState = {
  readonly questions: ReadonlyMap<string, EvalQuestion>;
  readonly shown: ReadonlySet<string>;
  readonly answers: Readonly<Record<string, unknown>>;
  readonly anchor: number;
};

const present = (value: unknown): boolean =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  Array.isArray(value);

const namesMissingOption = (question: EvalQuestion, constant: unknown): boolean => {
  const values = optionValues(question.config);
  return (
    !Array.isArray(constant) ||
    constant.some((value) => typeof value !== "string" || !values.has(value))
  );
};

/**
 * Whether `condition` holds.
 *
 * A reference that cannot be resolved — the question is missing, not earlier than the anchor, or the
 * leaf names a row the type does not have — reads as unanswered, so only `is_not_answered` holds. An
 * option value the question does not have does the same for an option operator. Every other operator
 * is false when the referenced question is unanswered, and a question off the path is unanswered even
 * if `answers` still carries a value. An empty `all` holds; an empty `any` does not.
 */
export const holds = (condition: Condition, state: EvalState): boolean =>
  holdsNode(condition as Node, state);

const holdsNode = (node: Node, state: EvalState): boolean => {
  if ("all" in node) return node.all.every((child) => holdsNode(child, state));
  if ("any" in node) return node.any.some((child) => holdsNode(child, state));

  const question = state.questions.get(node.questionId);
  if (question === undefined || question.flat >= state.anchor)
    return node.operator === "is_not_answered";
  if (node.row !== undefined && !questionTypeHasRows(question.type))
    return node.operator === "is_not_answered";

  const operator = operatorById(question.type, node.operator);
  if (operator === undefined) return false;
  if (!constantFits(operator, node.constant)) return false;
  if (operator.options && namesMissingOption(question, node.constant)) return false;

  const value = state.shown.has(question.id) ? state.answers[question.id] : undefined;
  if (!present(value)) return operator.id === "is_not_answered";
  return operator.matches(value, node.constant);
};
