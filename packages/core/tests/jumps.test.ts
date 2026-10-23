import { describe, expect, test } from "vite-plus/test";
import { nextDestination, pathOf, type Answers } from "@fb/core/answers";
import {
  jumpIssues,
  pagesOf,
  parseDefinition,
  reachabilityWarnings,
  validateForPublish,
  type Condition,
  type FormDefinition,
} from "@fb/core/definition";
import {
  addJump,
  JUMPS_CAP,
  moveJump,
  movePage,
  removeJump,
  removePage,
  setJump,
} from "@fb/core/editing";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pageId = (n: number) => uuid(100 + n);

const TARGET = "This jump does not go to a later page or the end";
const QUESTION = "This question cannot be reached";
const PAGE = "This page cannot be reached";

const leaf = (
  questionId: string,
  operator: string,
  constant?: string | number | string[],
  row?: string,
): Condition => ({
  questionId,
  operator,
  ...(constant !== undefined ? { constant } : {}),
  ...(row !== undefined ? { row } : {}),
});

const question = (n: number, type: string, config: object, extra: object = {}) => ({
  id: uuid(n),
  type,
  label: `Q${n}`,
  required: false,
  config,
  ...extra,
});

const text = (n: number, extra: object = {}) =>
  question(n, "text", { display: "single_line" }, extra);
const number = (n: number, extra: object = {}) => question(n, "number", { integer: false }, extra);
const single = (n: number, extra: object = {}) =>
  question(
    n,
    "single_choice",
    {
      options: [
        { value: "o-red", label: "Red" },
        { value: "o-green", label: "Green" },
      ],
      display: "radio",
    },
    extra,
  );
const yesNo = (n: number, extra: object = {}) => question(n, "boolean", {}, extra);

const page = (n: number, questions: object[], jumps: object[] = []) => ({
  id: pageId(n),
  questions,
  jumps,
});

const form = (pages: object[]): FormDefinition => {
  const parsed = parseDefinition({ format: 2, title: "Feedback", pages });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.value;
};

const pages = (definition: FormDefinition) => {
  if (definition.format !== 2) throw new Error("expected format 2");
  return definition.pages;
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const visited = (definition: FormDefinition, answers: Answers = {}) =>
  pathOf(definition, answers).pages.map((item) => item.id);

const toEnd = { condition: leaf(uuid(1), "equals", "end"), target: "end" as const };
const toThird = { condition: leaf(uuid(1), "equals", "later"), target: pageId(3) };

describe("next destination", () => {
  test("takes the first matching jump, and otherwise the next page", () => {
    const definition = form([
      page(1, [text(1)], [toEnd, toThird]),
      page(2, [text(2)]),
      page(3, [text(3)]),
    ]);
    const views = pagesOf(definition);

    expect(nextDestination(definition, { [uuid(1)]: "end" }, views[0]!)).toEqual({ kind: "end" });
    expect(nextDestination(definition, { [uuid(1)]: "later" }, views[0]!)).toEqual({
      kind: "page",
      page: views[2],
    });
    expect(nextDestination(definition, { [uuid(1)]: "stay" }, views[0]!)).toEqual({
      kind: "page",
      page: views[1],
    });
    expect(visited(definition, { [uuid(1)]: "later" })).toEqual([pageId(1), pageId(3)]);
  });

  test("passes over a page with nothing on the path and follows that page's jump", () => {
    const hidden = text(2, { showCondition: leaf(uuid(1), "equals", "never") });
    const definition = form([
      page(1, [text(1)], [{ condition: leaf(uuid(1), "equals", "skip"), target: pageId(2) }]),
      page(2, [hidden], [{ condition: leaf(uuid(1), "equals", "skip"), target: pageId(4) }]),
      page(3, [text(3)]),
      page(4, [text(4)]),
    ]);
    const views = pagesOf(definition);
    const answers = { [uuid(1)]: "skip" };

    expect(nextDestination(definition, answers, views[0]!)).toEqual({
      kind: "page",
      page: views[3],
    });
    expect(visited(definition, answers)).toEqual([pageId(1), pageId(4)]);

    const toTheEnd = form([
      page(1, [text(1)]),
      page(2, [hidden], [{ condition: leaf(uuid(1), "equals", "skip"), target: "end" }]),
      page(3, [text(3)]),
    ]);
    expect(nextDestination(toTheEnd, answers, pagesOf(toTheEnd)[0]!)).toEqual({ kind: "end" });
    expect(visited(toTheEnd, answers)).toEqual([pageId(1)]);
  });

  test("skips a jump whose target is not a later page or the end", () => {
    const definition = form([
      page(
        1,
        [text(1)],
        [
          { condition: leaf(uuid(1), "equals", "go"), target: pageId(1) },
          { condition: leaf(uuid(1), "equals", "go"), target: uuid(999) },
          { condition: leaf(uuid(1), "equals", "go"), target: pageId(3) },
        ],
      ),
      page(2, [text(2)]),
      page(3, [text(3)]),
    ]);
    const answers = { [uuid(1)]: "go" };

    expect(nextDestination(definition, answers, pagesOf(definition)[0]!)).toEqual({
      kind: "page",
      page: pagesOf(definition)[2],
    });
    expect(pathOf(definition, answers).questions.map((item) => item.id)).toEqual([
      uuid(1),
      uuid(3),
    ]);
    expect(visited(definition, { [uuid(1)]: "else" })).toEqual([pageId(1), pageId(2), pageId(3)]);
  });

  test("a jump may read a question on its own page, and that condition publishes", () => {
    const definition = form([
      page(1, [text(1), text(2)], [{ condition: leaf(uuid(2), "equals", "leave"), target: "end" }]),
      page(2, [text(3)]),
    ]);

    expect(nextDestination(definition, { [uuid(2)]: "leave" }, pagesOf(definition)[0]!)).toEqual({
      kind: "end",
    });
    expect(nextDestination(definition, { [uuid(2)]: "stay" }, pagesOf(definition)[0]!)).toEqual({
      kind: "page",
      page: pagesOf(definition)[1],
    });
    expect(validateForPublish(definition, []).ok).toBe(true);
    expect(jumpIssues(definition)).toEqual([]);
  });
});

describe("editing jumps", () => {
  const first = { condition: leaf(uuid(1), "equals", "a"), target: "end" as const };
  const second = { condition: leaf(uuid(1), "is_answered"), target: pageId(2) };

  const twoPages = () => deepFreeze(form([page(1, [text(1)]), page(2, [text(2)])]));

  test("adds, edits, reorders, and removes jumps without mutating the definition", () => {
    const original = twoPages();
    const added = addJump(original, pageId(1), first);
    expect(pages(added)[0]!.jumps).toEqual([first]);
    expect(pages(original)[0]!.jumps).toEqual([]);

    const both = addJump(added, pageId(1), second);
    expect(pages(both)[0]!.jumps).toEqual([first, second]);

    const edited = setJump(both, pageId(1), 0, { ...first, target: pageId(2) });
    expect(pages(edited)[0]!.jumps[0]!.target).toBe(pageId(2));
    expect(pages(both)[0]!.jumps[0]!.target).toBe("end");

    const reordered = moveJump(edited, pageId(1), 0, 1);
    expect(pages(reordered)[0]!.jumps).toEqual([second, { ...first, target: pageId(2) }]);

    const removed = removeJump(reordered, pageId(1), 0);
    expect(pages(removed)[0]!.jumps).toEqual([{ ...first, target: pageId(2) }]);
    expect(deepFreeze(removed)).toEqual(removed);
  });

  test("accepts 20 jumps on a page and refuses a 21st, a missing page, and a bad index", () => {
    let definition = twoPages();
    for (let index = 0; index < JUMPS_CAP; index += 1)
      definition = addJump(definition, pageId(1), first);
    expect(pages(definition)[0]!.jumps).toHaveLength(JUMPS_CAP);
    expect(() => addJump(definition, pageId(1), first)).toThrow(
      `A page has at most ${JUMPS_CAP} jumps`,
    );

    const format1 = parseDefinition({ format: 1, title: "Feedback", questions: [text(1)] });
    if (!format1.ok) throw new Error("format 1");
    expect(() => addJump(format1.value, pageId(1), first)).toThrow(
      "Pages are edited on a format 2 definition",
    );
    expect(() => addJump(twoPages(), uuid(9), first)).toThrow(`No page ${uuid(9)}`);
    expect(() => removeJump(twoPages(), pageId(1), 0)).toThrow("No jump 0 among 0 jumps");
    expect(() => setJump(definition, pageId(1), JUMPS_CAP, first)).toThrow(
      `No jump ${JUMPS_CAP} among ${JUMPS_CAP} jumps`,
    );
    expect(() => moveJump(definition, pageId(1), 0, JUMPS_CAP)).toThrow(
      `No position ${JUMPS_CAP} among ${JUMPS_CAP} jumps`,
    );
  });

  test("deleting or moving a jump's target earlier leaves the jump in place", () => {
    const definition = addJump(twoPages(), pageId(1), second);
    const removed = removePage(definition, pageId(2));
    expect(pages(removed)[0]!.jumps).toEqual([second]);
    expect(jumpIssues(removed)).toEqual([
      { path: ["pages", 0, "jumps", 0, "target"], message: TARGET },
    ]);

    const moved = movePage(definition, pageId(2), 0);
    expect(pages(moved)[1]!.jumps).toEqual([second]);
    expect(jumpIssues(moved)).toEqual([
      { path: ["pages", 1, "jumps", 0, "target"], message: TARGET },
    ]);
  });
});

describe("publish", () => {
  test("refuses a jump that does not go to a later page or the end, and an empty jump condition", () => {
    const definition = form([
      page(
        1,
        [text(1)],
        [
          { condition: { any: [] }, target: pageId(1) },
          { condition: leaf(uuid(1), "is_answered"), target: "end" },
        ],
      ),
      page(2, [text(2)]),
    ]);

    expect(jumpIssues(definition)).toEqual([
      { path: ["pages", 0, "jumps", 0, "target"], message: TARGET },
    ]);
    const published = validateForPublish(definition, []);
    expect(published.ok).toBe(false);
    if (published.ok) return;
    expect(published.issues).toEqual([
      {
        path: ["pages", 0, "jumps", 0, "condition"],
        message: "A condition group cannot be empty",
      },
      { path: ["pages", 0, "jumps", 0, "target"], message: TARGET },
    ]);
  });

  test("accepts a later page and the end, and refuses an unknown page id", () => {
    const valid = form([
      page(
        1,
        [text(1)],
        [
          { condition: leaf(uuid(1), "is_answered"), target: pageId(2) },
          { condition: leaf(uuid(1), "equals", "a"), target: "end" },
        ],
      ),
      page(2, [text(2)]),
    ]);
    expect(jumpIssues(valid)).toEqual([]);
    expect(validateForPublish(valid, []).ok).toBe(true);

    const unknown = form([
      page(1, [text(1)], [{ condition: leaf(uuid(1), "is_answered"), target: uuid(999) }]),
      page(2, [text(2)]),
    ]);
    expect(jumpIssues(unknown)).toEqual([
      { path: ["pages", 0, "jumps", 0, "target"], message: TARGET },
    ]);
    expect(validateForPublish(unknown, []).ok).toBe(false);
  });
});

describe("reachability warnings", () => {
  const contradiction = {
    all: [leaf(uuid(1), "equals", "a"), leaf(uuid(1), "does_not_equal", "a")],
  };

  test("an all group of an operator and its complement warns, and publish still accepts it", () => {
    const definition = form([
      page(1, [
        text(1),
        number(2),
        yesNo(3),
        single(4),
        text(5, { showCondition: contradiction }),
        text(6, {
          showCondition: { all: [leaf(uuid(2), "less_than", 5), leaf(uuid(2), "at_least", 5)] },
        }),
        text(7, { showCondition: { all: [leaf(uuid(3), "is_yes"), leaf(uuid(3), "is_no")] } }),
        text(8, {
          showCondition: {
            all: [leaf(uuid(4), "is_any_of", ["o-red"]), leaf(uuid(4), "is_none_of", ["o-red"])],
          },
        }),
        text(9, {
          showCondition: {
            all: [leaf(uuid(1), "equals", "a"), { all: [leaf(uuid(1), "does_not_equal", "a")] }],
          },
        }),
        text(10, {
          showCondition: {
            any: [
              { all: [leaf(uuid(1), "is_answered"), leaf(uuid(1), "is_not_answered")] },
              { all: [leaf(uuid(3), "is_yes"), leaf(uuid(3), "is_no")] },
            ],
          },
        }),
      ]),
    ]);

    expect(reachabilityWarnings(definition)).toEqual([
      { path: ["pages", 0, "questions", 4], message: QUESTION },
      { path: ["pages", 0, "questions", 5], message: QUESTION },
      { path: ["pages", 0, "questions", 6], message: QUESTION },
      { path: ["pages", 0, "questions", 7], message: QUESTION },
      { path: ["pages", 0, "questions", 8], message: QUESTION },
      { path: ["pages", 0, "questions", 9], message: QUESTION },
    ]);
    expect(validateForPublish(definition, []).ok).toBe(true);
  });

  test("does not warn for an any of complements, a different constant, or a different question", () => {
    const definition = form([
      page(1, [
        text(1),
        text(2, {
          showCondition: {
            any: [leaf(uuid(1), "equals", "a"), leaf(uuid(1), "does_not_equal", "a")],
          },
        }),
        text(3, {
          showCondition: {
            all: [leaf(uuid(1), "equals", "a"), leaf(uuid(1), "does_not_equal", "b")],
          },
        }),
        text(4, {
          showCondition: {
            all: [leaf(uuid(1), "equals", "a"), leaf(uuid(2), "does_not_equal", "a")],
          },
        }),
        text(5, {
          showCondition: {
            any: [contradiction, leaf(uuid(1), "is_answered")],
          },
        }),
        text(6, { showCondition: { all: [] } }),
        text(7, {
          showCondition: {
            all: [leaf(uuid(1), "equals", "a", "row-1"), leaf(uuid(1), "does_not_equal", "a")],
          },
        }),
      ]),
    ]);

    expect(reachabilityWarnings(definition)).toEqual([]);
  });

  test("a page whose questions are all contradictions cannot be reached", () => {
    const definition = form([
      page(1, [text(1)]),
      page(2, [
        text(2, { showCondition: contradiction }),
        text(3, {
          showCondition: { all: [leaf(uuid(1), "is_answered"), leaf(uuid(1), "is_not_answered")] },
        }),
      ]),
    ]);

    expect(reachabilityWarnings(definition)).toEqual([
      { path: ["pages", 1, "questions", 0], message: QUESTION },
      { path: ["pages", 1, "questions", 1], message: QUESTION },
      { path: ["pages", 1], message: PAGE },
    ]);
    expect(validateForPublish(definition, []).ok).toBe(true);
  });

  test("a contradictory jump is not a warning, and an empty any hides the question", () => {
    const jumped = form([
      page(1, [text(1)], [{ condition: contradiction, target: "end" }]),
      page(2, [text(2)]),
    ]);
    expect(reachabilityWarnings(jumped)).toEqual([]);
    expect(validateForPublish(jumped, []).ok).toBe(true);

    const hidden = form([page(1, [text(1), text(2, { showCondition: { any: [] } })])]);
    expect(reachabilityWarnings(hidden)).toEqual([
      { path: ["pages", 0, "questions", 1], message: QUESTION },
    ]);
  });

  test("format 1 warns on the flat list and has no jump targets to check", () => {
    const parsed = parseDefinition({
      format: 1,
      title: "Feedback",
      questions: [text(1), text(2, { showCondition: contradiction })],
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

    expect(jumpIssues(parsed.value)).toEqual([]);
    expect(reachabilityWarnings(parsed.value)).toEqual([
      { path: ["questions", 1], message: QUESTION },
    ]);
  });
});
