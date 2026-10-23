import {
  conditionOperators as registeredOperators,
  type ConditionOperator,
} from "./lib/definition/operators.ts";
import type { QuestionTypeName } from "./lib/definition/form-definition.ts";

export type { Issue, QuestionType, Result } from "./lib/definition/question-type.ts";
export { Condition, CONDITIONS_CAP } from "./lib/definition/condition.ts";
export { conditionIssues } from "./lib/definition/condition-issues.ts";
export { jumpIssues } from "./lib/definition/jump-issues.ts";
export { reachabilityWarnings } from "./lib/definition/reachability.ts";
export type { ConstantKind } from "./lib/definition/operators.ts";

/** A new question type fails here until its operators are registered in one entry. */
export const conditionOperators = registeredOperators satisfies {
  [T in QuestionTypeName]: readonly ConditionOperator[];
};
export type { ConditionOperator };
export {
  FormDefinition,
  JUMPS_CAP,
  PAGES_CAP,
  pagesOf,
  parseDefinition,
  QUESTIONS_CAP,
  QuestionSnapshot,
  questionsOf,
  questionTypes,
  validateForPublish,
  type Jump,
  type JumpTarget,
  type Page,
  type PageView,
  type QuestionSnapshotOf,
  type QuestionTypeName,
} from "./lib/definition/form-definition.ts";
