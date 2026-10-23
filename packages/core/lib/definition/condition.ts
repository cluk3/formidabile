import * as z from "zod/mini";
import { RANKING_OPTIONS_MAX } from "./ranking-limit.ts";

/** ADR-017: a definition holds at most this many leaf conditions, counting show conditions and jumps. */
export const CONDITIONS_CAP = 1000;
/** ADR-017: a text constant is at most 500 code points. Comparison trims later, so this stores the text as written. */
const TEXT_CONSTANT_CAP = 500;
/** ADR-017: an "any of" list is at most 100 values, the same bound as `OPTIONS_CAP`. */
const ANY_OF_CAP = 100;

/**
 * A constant a condition compares with an answer. Which constant an operator needs, and whether it fits the
 * question, is a publish rule. The shape is what draft save accepts.
 */
/** An option value and how far down the ranking still counts as the top. */
const rankConstant = z.strictObject({
  value: z.string().check(z.minLength(1), z.maxLength(64)),
  n: z.int().check(z.gte(1), z.lte(RANKING_OPTIONS_MAX)),
});

const constant = z.union([
  z.string().check(z.maxLength(TEXT_CONSTANT_CAP)),
  z.number(),
  z.boolean(),
  z.array(z.string()).check(z.maxLength(ANY_OF_CAP)),
  rankConstant,
]);

/**
 * A leaf names a question identity and an operator. `constant` is omitted when the operator needs none.
 * `row` names one matrix row. A type without rows rejects it at publish.
 */
const leaf = z.strictObject({
  questionId: z.uuid(),
  operator: z.string().check(z.minLength(1), z.maxLength(64)),
  constant: z.optional(constant),
  row: z.optional(z.string().check(z.minLength(1), z.maxLength(64))),
});

/** A group holds conditions. An empty group parses; publish is what rejects it. */
const group = <T>(item: z.ZodMiniType<T, unknown>) =>
  z.union([z.strictObject({ all: z.array(item) }), z.strictObject({ any: z.array(item) })]);

// Three group levels (ADR-017). The innermost group holds only leaves, so a fourth group does not parse.
const group3 = group(leaf);
const node2 = z.union([leaf, group3]);
const group2 = group(node2);
const node1 = z.union([leaf, group2]);
const group1 = group(node1);

/**
 * A condition tree: one comparison, or an `all` / `any` group nested at most three levels. Operators are not
 * checked here.
 */
export const Condition = z.union([leaf, group1]);
export type Condition = z.output<typeof Condition>;

type ConditionNode =
  | { readonly questionId: string }
  | { readonly all: readonly ConditionNode[] }
  | { readonly any: readonly ConditionNode[] };

/** How many leaves a condition contributes to {@link CONDITIONS_CAP}. Groups themselves are free. */
export const conditionCount = (condition: Condition): number => {
  const walk = (node: ConditionNode): number => {
    if ("questionId" in node) return 1;
    const children = "all" in node ? node.all : node.any;
    return children.reduce((sum, child) => sum + walk(child), 0);
  };
  return walk(condition as ConditionNode);
};
