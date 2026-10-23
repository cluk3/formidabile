import type { FormDefinition } from "./form-definition.ts";
import type { Issue } from "./question-type.ts";

const QUESTION = "This question cannot be reached";
const PAGE = "This page cannot be reached";

/**
 * Operators that cannot both hold for one question. Each names its complement. A constant, when the
 * operator has one, has to be the same value; a different constant is a different comparison.
 */
const complements: Readonly<Record<string, string>> = {
  equals: "does_not_equal",
  does_not_equal: "equals",
  contains: "does_not_contain",
  does_not_contain: "contains",
  equal: "not_equal",
  not_equal: "equal",
  less_than: "at_least",
  at_least: "less_than",
  greater_than: "at_most",
  at_most: "greater_than",
  is_any_of: "is_none_of",
  is_none_of: "is_any_of",
  includes_any_of: "includes_none_of",
  includes_none_of: "includes_any_of",
  is_yes: "is_no",
  is_no: "is_yes",
  is_answered: "is_not_answered",
  is_not_answered: "is_answered",
};

type Leaf = {
  readonly questionId: string;
  readonly operator: string;
  readonly constant?: unknown;
  readonly row?: string;
};

type Node = Leaf | { readonly all: readonly Node[] } | { readonly any: readonly Node[] };

type Forces = { readonly impossible: boolean; readonly leaves: readonly Leaf[] };

const sameValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
};

const sameLeaf = (left: Leaf, right: Leaf): boolean =>
  left.questionId === right.questionId &&
  left.operator === right.operator &&
  left.row === right.row &&
  sameValue(left.constant, right.constant);

/** True when the leaves demand an operator and its complement from one question. */
const contradicts = (leaves: readonly Leaf[]): boolean => {
  for (let i = 0; i < leaves.length; i += 1) {
    for (let j = i + 1; j < leaves.length; j += 1) {
      const left = leaves[i]!;
      const right = leaves[j]!;
      if (left.questionId !== right.questionId || left.row !== right.row) continue;
      if (complements[left.operator] !== right.operator) continue;
      if (sameValue(left.constant, right.constant)) return true;
    }
  }
  return false;
};

const isLeaf = (node: Node): node is Leaf => "questionId" in node;

/**
 * What has to hold for `node` to hold. An `all` group forces every child. An `any` group forces only
 * what every possible child forces. A complement pair in those forces means the node never holds.
 */
const forcesOf = (node: Node): Forces => {
  if (isLeaf(node)) return { impossible: false, leaves: [node] };
  const children = ("all" in node ? node.all : node.any).map((child) => forcesOf(child));
  if ("all" in node) {
    if (children.some((child) => child.impossible)) return { impossible: true, leaves: [] };
    const leaves = children.flatMap((child) => child.leaves);
    return contradicts(leaves) ? { impossible: true, leaves: [] } : { impossible: false, leaves };
  }
  const possible = children.filter((child) => !child.impossible);
  if (possible.length === 0) return { impossible: true, leaves: [] };
  const [first, ...rest] = possible;
  const leaves = first!.leaves.filter((leaf) =>
    rest.every((child) => child.leaves.some((other) => sameLeaf(leaf, other))),
  );
  return contradicts(leaves) ? { impossible: true, leaves: [] } : { impossible: false, leaves };
};

const impossible = (condition: unknown): boolean => forcesOf(condition as Node).impossible;

/**
 * Best-effort warnings for a question or a page no respondent can be shown. The minimum case is an
 * `all` group that requires one question to satisfy an operator and its complement. An empty `any`
 * never holds either. Nothing here is a publish error: publish has no reachability rule (ADR-017).
 */
export const reachabilityWarnings = (definition: FormDefinition): Issue[] => {
  const issues: Issue[] = [];
  const lists =
    definition.format === 1
      ? [definition.questions]
      : definition.pages.map((page) => page.questions);
  lists.forEach((list, pageIndex) => {
    let hidden = list.length > 0;
    list.forEach((question, index) => {
      if (question.showCondition === undefined || !impossible(question.showCondition)) {
        hidden = false;
        return;
      }
      issues.push({
        path:
          definition.format === 1 ? ["questions", index] : ["pages", pageIndex, "questions", index],
        message: QUESTION,
      });
    });
    if (hidden)
      issues.push({
        path: definition.format === 1 ? ["questions"] : ["pages", pageIndex],
        message: PAGE,
      });
  });
  return issues;
};
