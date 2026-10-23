import { describe, expect, test } from "vite-plus/test";
import { nextDestination, pathOf, validateAnswers } from "@fb/core/answers";
import {
  conditionIssues,
  pagesOf,
  parseDefinition,
  questionsOf,
  type Condition,
  type FormDefinition,
} from "@fb/core/definition";
import {
  changeQuestionType,
  moveQuestion,
  moveQuestionTo,
  reidentifyQuestion,
  removeOption,
  removePage,
  removeQuestion,
} from "@fb/core/editing";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pageId = (n: number) => uuid(1000 + n);

/** Mints `uuid(101)`, `uuid(102)`…, in call order. */
const idSource = () => {
  let questions = 100;
  let options = 0;
  let pages = 2000;
  return {
    questionId: () => uuid(++questions),
    optionValue: () => `minted-${++options}`,
    pageId: () => uuid(++pages),
  };
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

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

const options = [
  { value: "o-red", label: "Red" },
  { value: "o-green", label: "Green" },
  { value: "o-blue", label: "Blue" },
];

const text = (n: number, extra: object = {}) => ({
  id: uuid(n),
  type: "text" as const,
  label: `Q${n}`,
  required: false,
  config: { display: "single_line" as const },
  ...extra,
});

const single = (n: number, extra: object = {}) => ({
  id: uuid(n),
  type: "single_choice" as const,
  label: `Q${n}`,
  required: false,
  config: { options, display: "radio" as const },
  ...extra,
});

const page = (n: number, questions: object[], jumps: object[] = []) => ({
  id: pageId(n),
  questions,
  jumps,
});

/** Parsed and frozen, so an editing function that mutates its input throws. */
const form = (pages: object[]): FormDefinition => {
  const parsed = parseDefinition({ format: 2, title: "Feedback", pages });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return deepFreeze(parsed.value);
};

const shown = (definition: FormDefinition, answers: Record<string, string | string[]> = {}) =>
  pathOf(definition, answers).questions.map((question) => question.id);

const roundTrip = (definition: FormDefinition) => {
  const parsed = parseDefinition(definition);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(parsed.value).toEqual(definition);
};

describe("deleting and moving leaves show conditions in place", () => {
  test("removing a question leaves every condition that names it", () => {
    const definition = form([
      page(1, [text(1)]),
      page(2, [
        text(2, { showCondition: leaf(uuid(1), "equals", "a") }),
        text(3, {
          showCondition: {
            all: [leaf(uuid(1), "contains", "b"), leaf(uuid(2), "is_answered")],
          },
        }),
      ]),
    ]);

    const edited = removeQuestion(definition, uuid(1));

    expect(questionsOf(edited).map((question) => question.showCondition)).toEqual([
      leaf(uuid(1), "equals", "a"),
      { all: [leaf(uuid(1), "contains", "b"), leaf(uuid(2), "is_answered")] },
    ]);
    expect(conditionIssues(edited).map((issue) => issue.message)).toEqual([
      "This condition reads a question that is not earlier in the form",
      "This condition reads a question that is not earlier in the form",
    ]);
    roundTrip(edited);
  });

  test("removing an option leaves the condition that names its value", () => {
    const definition = form([
      page(1, [
        single(1),
        text(2, { showCondition: leaf(uuid(1), "is_any_of", ["o-red", "o-blue"]) }),
      ]),
    ]);

    const edited = removeOption(definition, uuid(1), "o-red");

    expect(questionsOf(edited)[1]?.showCondition).toEqual(
      leaf(uuid(1), "is_any_of", ["o-red", "o-blue"]),
    );
    expect(conditionIssues(edited)).toEqual([
      {
        path: ["pages", 0, "questions", 1, "showCondition", "constant", 0],
        message: "This condition names an option value the question does not have",
      },
    ]);
    roundTrip(edited);
  });

  test("moving a question below a condition that reads it leaves the condition", () => {
    const definition = form([
      page(1, [text(1), text(2, { showCondition: leaf(uuid(1), "equals", "a") })]),
    ]);

    const edited = moveQuestion(definition, uuid(1), 1);

    expect(questionsOf(edited).map((question) => question.id)).toEqual([uuid(2), uuid(1)]);
    expect(questionsOf(edited)[0]?.showCondition).toEqual(leaf(uuid(1), "equals", "a"));
    expect(conditionIssues(edited)).toEqual([
      {
        path: ["pages", 0, "questions", 0, "showCondition", "questionId"],
        message: "This condition reads a question that is not earlier in the form",
      },
    ]);
    roundTrip(edited);
  });

  test("moving a question to a later page leaves the condition that read it", () => {
    const definition = form([
      page(1, [text(1), text(2, { showCondition: leaf(uuid(1), "equals", "a") })]),
      page(2, [text(3)]),
    ]);

    const edited = moveQuestionTo(definition, uuid(1), pageId(2), 0);

    expect(questionsOf(edited)[0]?.showCondition).toEqual(leaf(uuid(1), "equals", "a"));
    expect(questionsOf(edited).map((question) => question.id)).toEqual([uuid(2), uuid(1), uuid(3)]);
    expect(conditionIssues(edited).map((issue) => issue.message)).toEqual([
      "This condition reads a question that is not earlier in the form",
    ]);
    roundTrip(edited);
  });

  test("removing a page leaves conditions and jumps on other pages that name it", () => {
    const definition = form([
      page(1, [text(1)]),
      page(
        2,
        [text(2, { showCondition: leaf(uuid(1), "equals", "a") })],
        [{ condition: leaf(uuid(1), "is_answered"), target: pageId(1) }],
      ),
    ]);

    const edited = removePage(definition, pageId(1));

    if (edited.format !== 2) throw new Error("format 2");
    expect(edited.pages).toHaveLength(1);
    expect(questionsOf(edited)[0]?.showCondition).toEqual(leaf(uuid(1), "equals", "a"));
    expect(edited.pages[0]?.jumps).toEqual([
      { condition: leaf(uuid(1), "is_answered"), target: pageId(1) },
    ]);
    roundTrip(edited);
  });
});

describe("treat as a new question", () => {
  test("rewrites every condition that names the old identity and keeps option values", () => {
    const definition = form([
      page(
        1,
        [
          single(1),
          text(2, {
            showCondition: {
              all: [
                { any: [leaf(uuid(1), "is_any_of", ["o-red"]), leaf(uuid(1), "is_answered")] },
                leaf(uuid(1), "is_none_of", ["o-blue"]),
              ],
            },
          }),
        ],
        [{ condition: leaf(uuid(1), "is_answered"), target: pageId(2) }],
      ),
      page(2, [text(3, { showCondition: leaf(uuid(2), "equals", "keep") })]),
    ]);

    const edited = reidentifyQuestion(definition, uuid(1), idSource());

    expect(questionsOf(edited).map((question) => question.id)).toEqual([
      uuid(101),
      uuid(2),
      uuid(3),
    ]);
    expect(questionsOf(edited)[0]).toMatchObject({
      type: "single_choice",
      config: { options, display: "radio" },
    });
    expect(questionsOf(edited)[1]?.showCondition).toEqual({
      all: [
        { any: [leaf(uuid(101), "is_any_of", ["o-red"]), leaf(uuid(101), "is_answered")] },
        leaf(uuid(101), "is_none_of", ["o-blue"]),
      ],
    });
    expect(questionsOf(edited)[2]?.showCondition).toEqual(leaf(uuid(2), "equals", "keep"));
    if (edited.format !== 2) throw new Error("format 2");
    expect(edited.pages[0]?.jumps[0]?.condition).toEqual(leaf(uuid(101), "is_answered"));
    expect(conditionIssues(edited)).toEqual([]);
    roundTrip(edited);
  });

  test("rewrites a format 1 show condition", () => {
    const parsed = parseDefinition({
      format: 1,
      title: "Feedback",
      questions: [text(1), text(2, { showCondition: leaf(uuid(1), "equals", "a") })],
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));

    const edited = reidentifyQuestion(deepFreeze(parsed.value), uuid(1), idSource());

    expect(questionsOf(edited)[0]?.id).toBe(uuid(101));
    expect(questionsOf(edited)[1]?.showCondition).toEqual(leaf(uuid(101), "equals", "a"));
    roundTrip(edited);
  });

  test("keeps a row value on the leaf while pointing it at the new identity", () => {
    const definition = form([
      page(1, [text(1), text(2, { showCondition: leaf(uuid(1), "equals", "a", "row-1") })]),
    ]);

    const edited = reidentifyQuestion(definition, uuid(1), idSource());

    expect(questionsOf(edited)[1]?.showCondition).toEqual(leaf(uuid(101), "equals", "a", "row-1"));
    expect(conditionIssues(edited)).toEqual([
      {
        path: ["pages", 0, "questions", 1, "showCondition", "row"],
        message: "This question has no rows",
      },
    ]);
  });

  test("changing the question type leaves conditions on the old identity", () => {
    const definition = form([
      page(1, [text(1), text(2, { showCondition: leaf(uuid(1), "equals", "a") })]),
    ]);

    const edited = changeQuestionType(definition, uuid(1), "email", idSource());

    expect(questionsOf(edited)[0]).toMatchObject({ id: uuid(101), type: "email" });
    expect(questionsOf(edited)[1]?.showCondition).toEqual(leaf(uuid(1), "equals", "a"));
    expect(conditionIssues(edited).map((issue) => issue.message)).toEqual([
      "This condition reads a question that is not earlier in the form",
    ]);
  });
});

describe("a broken reference counts as unanswered", () => {
  test("a removed question is unanswered, so only is not answered holds", () => {
    const definition = form([
      page(1, [
        text(1),
        text(2, { showCondition: leaf(uuid(1), "equals", "a") }),
        text(3, { showCondition: leaf(uuid(1), "is_not_answered") }),
      ]),
    ]);

    expect(shown(removeQuestion(definition, uuid(1)))).toEqual([uuid(3)]);
  });

  test("a question moved below the condition is unanswered even when it has the matching answer", () => {
    const definition = form([
      page(1, [
        text(1),
        text(2, { showCondition: leaf(uuid(1), "equals", "a") }),
        text(3, { showCondition: leaf(uuid(1), "is_not_answered") }),
      ]),
    ]);

    const edited = moveQuestion(definition, uuid(1), 2);

    expect(shown(edited, { [uuid(1)]: "a" })).toEqual([uuid(3), uuid(1)]);
  });

  test("a removed option value is unanswered, so is none of does not show the question", () => {
    const definition = form([
      page(1, [
        single(1),
        text(2, { showCondition: leaf(uuid(1), "is_none_of", ["o-red"]) }),
        text(3, { showCondition: leaf(uuid(1), "is_any_of", ["o-red"]) }),
      ]),
    ]);

    expect(shown(removeOption(definition, uuid(1), "o-red"), { [uuid(1)]: "o-blue" })).toEqual([
      uuid(1),
    ]);
  });

  test("a jump condition that names a missing question counts as unanswered", () => {
    const definition = form([
      page(
        1,
        [text(1)],
        [
          { condition: leaf(uuid(9), "equals", "go"), target: "end" },
          { condition: leaf(uuid(9), "is_not_answered"), target: pageId(3) },
        ],
      ),
      page(2, [text(2)]),
      page(3, [text(3)]),
    ]);

    expect(pathOf(definition, {}).pages.map((page) => page.id)).toEqual([pageId(1), pageId(3)]);
    expect(nextDestination(definition, {}, pagesOf(definition)[0]!)).toEqual({
      kind: "page",
      page: pagesOf(definition)[2],
    });
  });

  test("a required question hidden by a broken condition does not block answers", () => {
    const definition = form([
      page(1, [
        text(1),
        { ...text(2), required: true, showCondition: leaf(uuid(1), "equals", "a") },
      ]),
    ]);

    expect(validateAnswers(removeQuestion(definition, uuid(1)), {})).toEqual({
      ok: true,
      value: {},
    });
  });
});
