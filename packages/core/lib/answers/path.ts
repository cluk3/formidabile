import { holds, type EvalQuestion } from "../definition/evaluate.ts";
import {
  pagesOf,
  type FormDefinition,
  type PageView,
  type QuestionSnapshot,
} from "../definition/form-definition.ts";

/** The pages a respondent reaches and the questions they are shown, in visit order. */
export type FormPath = {
  readonly pages: readonly PageView[];
  readonly questions: readonly QuestionSnapshot[];
};

/** Where Next goes. A passed-over page is not returned; the walk stops on the next page that is shown. */
export type NextDestination =
  | { readonly kind: "page"; readonly page: PageView }
  | { readonly kind: "end" };

type Step = number | "end";

/**
 * The path those answers produce. Pure and total: a broken condition reads as unanswered, and a jump
 * whose target is not a later page or the end is skipped. A reached page with nothing on the path is
 * passed over — it is not in the result, and its jumps are still checked.
 */
export const pathOf = (
  definition: FormDefinition,
  answers: Readonly<Record<string, unknown>>,
): FormPath => trace(definition, answers).path;

/** The next page that still has a question on the path, or the end of the form. */
export const nextDestination = (
  definition: FormDefinition,
  answers: Readonly<Record<string, unknown>>,
  page: PageView,
): NextDestination => trace(definition, answers).nextFrom(page);

const readRecord = (input: unknown): Readonly<Record<string, unknown>> => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
};

/** `pathOf` for a body that has not been validated yet. Unknown shapes count as no answers. */
export const pathFromInput = (definition: FormDefinition, input: unknown): FormPath =>
  trace(definition, readRecord(input)).path;

const trace = (definition: FormDefinition, answers: Readonly<Record<string, unknown>>) => {
  const pages = pagesOf(definition);
  const questions = new Map<string, EvalQuestion>();
  const pageAnchor: number[] = [];
  let flat = 0;
  pages.forEach((page, pageIndex) => {
    for (const question of page.questions) {
      questions.set(question.id, {
        id: question.id,
        type: question.type,
        flat,
        config: question.config,
      });
      flat += 1;
    }
    pageAnchor[pageIndex] = flat;
  });

  const shown = new Set<string>();
  const visited: PageView[] = [];
  const shownQuestions: QuestionSnapshot[] = [];
  const shownPage = new Set<number>();
  const landed = new Map<number, Step>();

  const classify = (pageIndex: number, base: ReadonlySet<string>) => {
    const local = new Set(base);
    const onPath: QuestionSnapshot[] = [];
    const page = pages[pageIndex]!;
    let cursor = pageAnchor[pageIndex]! - page.questions.length;
    for (const question of page.questions) {
      const condition = question.showCondition;
      const visible =
        condition === undefined ||
        holds(condition, { questions, shown: local, answers, anchor: cursor });
      if (visible) {
        onPath.push(question);
        local.add(question.id);
      }
      cursor += 1;
    }
    return { onPath, local };
  };

  const immediate = (pageIndex: number, local: ReadonlySet<string>): Step => {
    const page = pages[pageIndex]!;
    const anchor = pageAnchor[pageIndex]!;
    for (const jump of page.jumps) {
      if (!holds(jump.condition, { questions, shown: local, answers, anchor })) continue;
      if (jump.target === "end") return "end";
      const target = pages.findIndex((candidate) => candidate.id === jump.target);
      if (target > pageIndex) return target;
    }
    return pageIndex + 1 < pages.length ? pageIndex + 1 : "end";
  };

  let index = 0;
  const guard = new Set<number>();
  while (index < pages.length && !guard.has(index)) {
    guard.add(index);
    const { onPath, local } = classify(index, shown);
    const dest = immediate(index, local);
    landed.set(index, dest);
    if (onPath.length > 0) {
      visited.push(pages[index]!);
      shownQuestions.push(...onPath);
      shownPage.add(index);
      for (const question of onPath) shown.add(question.id);
    }
    if (dest === "end") break;
    index = dest;
  }

  const follow = (start: number): NextDestination => {
    let cursor: Step | undefined = landed.get(start);
    const seen = new Set<number>([start]);
    while (typeof cursor === "number") {
      if (seen.has(cursor)) return { kind: "end" };
      seen.add(cursor);
      if (shownPage.has(cursor)) return { kind: "page", page: pages[cursor]! };
      cursor = landed.get(cursor);
    }
    return { kind: "end" };
  };

  const nextFrom = (page: PageView): NextDestination => {
    const start = pages.findIndex((candidate) => candidate.id === page.id);
    if (start < 0) return { kind: "end" };
    if (landed.has(start)) return follow(start);

    let cursor = start;
    const seen = new Set<number>();
    while (cursor < pages.length) {
      if (seen.has(cursor)) return { kind: "end" };
      seen.add(cursor);
      const { onPath, local } = classify(cursor, shown);
      if (cursor !== start && onPath.length > 0) return { kind: "page", page: pages[cursor]! };
      const dest = immediate(cursor, local);
      if (dest === "end") return { kind: "end" };
      cursor = dest;
    }
    return { kind: "end" };
  };

  return { path: { pages: visited, questions: shownQuestions }, nextFrom };
};
