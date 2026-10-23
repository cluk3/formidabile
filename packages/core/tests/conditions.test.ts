import { describe, expect, test } from "vite-plus/test";
import {
  interpretAnswers,
  nextDestination,
  pathOf,
  validateAnswers,
  type Answers,
} from "@fb/core/answers";
import {
  CONDITIONS_CAP,
  conditionIssues,
  conditionOperators,
  pagesOf,
  parseDefinition,
  validateForPublish,
  type Condition,
  type FormDefinition,
  type QuestionTypeName,
} from "@fb/core/definition";
import { clearShowCondition, removeQuestion, setShowCondition } from "@fb/core/editing";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pageId = (n: number) => uuid(100 + n);

const options = [
  { value: "o-red", label: "Red" },
  { value: "o-green", label: "Green" },
  { value: "o-blue", label: "Blue" },
];

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
const email = (n: number, extra: object = {}) => question(n, "email", {}, extra);
const number = (n: number, extra: object = {}) =>
  question(n, "number", { integer: false, display: "input" }, extra);
const date = (n: number, extra: object = {}) => question(n, "date", {}, extra);
const single = (n: number, extra: object = {}) =>
  question(n, "single_choice", { options, display: "radio" }, extra);
const multiple = (n: number, extra: object = {}) =>
  question(n, "multiple_choice", { options }, extra);
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

const shown = (definition: FormDefinition, answers: Answers = {}) =>
  pathOf(definition, answers).questions.map((item) => item.id);

const visited = (definition: FormDefinition, answers: Answers = {}) =>
  pathOf(definition, answers).pages.map((item) => item.id);

/** Whether the follower question is on the path when `source` is answered with `value`. */
const followerShown = (source: object, condition: Condition, value: unknown) => {
  const sourceId = "id" in source && typeof source.id === "string" ? source.id : "";
  const definition = form([page(1, [source]), page(2, [text(50, { showCondition: condition })])]);
  return shown(
    definition,
    value === undefined ? {} : { [sourceId]: value as Answers[string] },
  ).includes(uuid(50));
};

describe("condition operators", () => {
  test("each existing type registers the operators ADR-017 gives it, plus is answered", () => {
    const ids = (type: QuestionTypeName) => conditionOperators[type].map((operator) => operator.id);
    const presence = ["is_answered", "is_not_answered"];
    expect(ids("text")).toEqual([
      "equals",
      "does_not_equal",
      "contains",
      "does_not_contain",
      ...presence,
    ]);
    expect(ids("email")).toEqual(ids("text"));
    expect(ids("number")).toEqual([
      "equal",
      "not_equal",
      "less_than",
      "at_most",
      "greater_than",
      "at_least",
      ...presence,
    ]);
    expect(ids("date")).toEqual(["is_on", "is_before", "is_after", ...presence]);
    expect(ids("single_choice")).toEqual(["is_any_of", "is_none_of", ...presence]);
    expect(ids("multiple_choice")).toEqual([
      "includes_any_of",
      "includes_all_of",
      "includes_none_of",
      ...presence,
    ]);
    expect(ids("boolean")).toEqual(["is_yes", "is_no", ...presence]);
    expect(
      conditionOperators.single_choice.find((operator) => operator.id === "is_any_of")?.options,
    ).toBe(true);
    expect(conditionOperators.text.find((operator) => operator.id === "equals")?.constant).toBe(
      "string",
    );
    expect(conditionOperators.number.find((operator) => operator.id === "equal")?.constant).toBe(
      "number",
    );
    expect(conditionOperators.date.find((operator) => operator.id === "is_on")?.constant).toBe(
      "date",
    );
    expect(conditionOperators.boolean.find((operator) => operator.id === "is_yes")?.constant).toBe(
      "none",
    );
  });
});

describe("show conditions", () => {
  test("a question with no condition is shown, and a leaf compares an earlier answer", () => {
    const definition = form([
      page(1, [text(1), text(2, { showCondition: leaf(uuid(1), "equals", "a") })]),
    ]);
    expect(shown(definition)).toEqual([uuid(1)]);
    expect(shown(definition, { [uuid(1)]: "a" })).toEqual([uuid(1), uuid(2)]);
    expect(visited(definition)).toEqual([pageId(1)]);
  });

  test("all holds only when every child does, and any holds when one does", () => {
    const all = form([
      page(1, [
        text(1),
        text(2, {
          showCondition: { all: [leaf(uuid(1), "contains", "a"), leaf(uuid(1), "contains", "b")] },
        }),
      ]),
    ]);
    expect(shown(all, { [uuid(1)]: "ab" })).toEqual([uuid(1), uuid(2)]);
    expect(shown(all, { [uuid(1)]: "a" })).toEqual([uuid(1)]);

    const any = form([
      page(1, [
        text(1),
        text(2, {
          showCondition: { any: [leaf(uuid(1), "equals", "no"), leaf(uuid(1), "equals", "a")] },
        }),
      ]),
    ]);
    expect(shown(any, { [uuid(1)]: "A" })).toEqual([uuid(1), uuid(2)]);
    expect(shown(any, { [uuid(1)]: "c" })).toEqual([uuid(1)]);
  });

  test("an empty all holds and an empty any does not", () => {
    const definition = form([
      page(1, [text(1, { showCondition: { all: [] } }), text(2, { showCondition: { any: [] } })]),
    ]);
    expect(shown(definition)).toEqual([uuid(1)]);
  });

  test("three group levels parse and a fourth does not", () => {
    const nested = { all: [{ any: [{ all: [leaf(uuid(1), "is_answered")] }] }] };
    expect(form([page(1, [text(1), text(2, { showCondition: nested })])]).format).toBe(2);
    const tooDeep = { all: [{ any: [{ all: [{ any: [leaf(uuid(1), "is_answered")] }] }] }] };
    expect(
      parseDefinition({
        format: 2,
        title: "Feedback",
        pages: [page(1, [text(2, { showCondition: tooDeep })])],
      }).ok,
    ).toBe(false);
  });

  test("text and email comparisons fold case, trim, and compose characters", () => {
    expect(followerShown(text(1), leaf(uuid(1), "equals", "émile"), "  Émile ")).toBe(true);
    expect(followerShown(text(1), leaf(uuid(1), "equals", "café"), "Cafe\u0301")).toBe(true);
    expect(followerShown(text(1), leaf(uuid(1), "equals", "Cafe\u0301"), "café")).toBe(true);
    expect(followerShown(text(1), leaf(uuid(1), "equals", "i"), "I")).toBe(true);
    expect(followerShown(text(1), leaf(uuid(1), "equals", "i"), "İ")).toBe(false);
    expect(followerShown(text(1), leaf(uuid(1), "contains", "ELL"), "Hello")).toBe(true);
    expect(
      followerShown(email(1), leaf(uuid(1), "equals", "ada@example.com"), " Ada@Example.com "),
    ).toBe(true);
  });

  test("every operator except is not answered is false when the question is unanswered", () => {
    const cases: [object, Condition][] = [
      [text(1), leaf(uuid(1), "equals", "a")],
      [text(1), leaf(uuid(1), "does_not_equal", "a")],
      [text(1), leaf(uuid(1), "contains", "a")],
      [text(1), leaf(uuid(1), "does_not_contain", "a")],
      [text(1), leaf(uuid(1), "is_answered")],
      [number(1), leaf(uuid(1), "not_equal", 1)],
      [date(1), leaf(uuid(1), "is_before", "2020-01-02")],
      [single(1), leaf(uuid(1), "is_none_of", ["o-red"])],
      [multiple(1), leaf(uuid(1), "includes_none_of", ["o-red"])],
      [yesNo(1), leaf(uuid(1), "is_no")],
    ];
    for (const [source, condition] of cases)
      expect(followerShown(source, condition, undefined)).toBe(false);
    expect(followerShown(text(1), leaf(uuid(1), "is_not_answered"), undefined)).toBe(true);
    expect(followerShown(text(1), leaf(uuid(1), "is_not_answered"), "a")).toBe(false);
    expect(followerShown(text(1), leaf(uuid(1), "is_answered"), "a")).toBe(true);
  });

  test("number, date, choice, and boolean operators compare a present answer", () => {
    const cases: [object, Condition, unknown, boolean][] = [
      [number(1), leaf(uuid(1), "equal", 5), 5, true],
      [number(1), leaf(uuid(1), "equal", 5), 4, false],
      [number(1), leaf(uuid(1), "not_equal", 5), 4, true],
      [number(1), leaf(uuid(1), "not_equal", 5), 5, false],
      [number(1), leaf(uuid(1), "less_than", 5), 4, true],
      [number(1), leaf(uuid(1), "less_than", 5), 5, false],
      [number(1), leaf(uuid(1), "at_most", 5), 5, true],
      [number(1), leaf(uuid(1), "at_most", 5), 6, false],
      [number(1), leaf(uuid(1), "greater_than", 5), 6, true],
      [number(1), leaf(uuid(1), "greater_than", 5), 5, false],
      [number(1), leaf(uuid(1), "at_least", 5), 5, true],
      [number(1), leaf(uuid(1), "at_least", 5), 4, false],
      [date(1), leaf(uuid(1), "is_on", "2020-01-02"), "2020-01-02", true],
      [date(1), leaf(uuid(1), "is_before", "2020-01-02"), "2020-01-01", true],
      [date(1), leaf(uuid(1), "is_before", "2020-01-02"), "2020-01-02", false],
      [date(1), leaf(uuid(1), "is_after", "2020-01-02"), "2020-01-03", true],
      [date(1), leaf(uuid(1), "is_after", "2020-01-02"), "2020-01-02", false],
      [single(1), leaf(uuid(1), "is_any_of", ["o-red", "o-blue"]), "o-blue", true],
      [single(1), leaf(uuid(1), "is_any_of", ["o-red"]), "o-green", false],
      [single(1), leaf(uuid(1), "is_none_of", ["o-red"]), "o-green", true],
      [single(1), leaf(uuid(1), "is_none_of", ["o-red", "o-green"]), "o-green", false],
      [multiple(1), leaf(uuid(1), "includes_any_of", ["o-blue", "o-red"]), ["o-red"], true],
      [multiple(1), leaf(uuid(1), "includes_any_of", ["o-blue"]), ["o-red"], false],
      [
        multiple(1),
        leaf(uuid(1), "includes_all_of", ["o-red", "o-blue"]),
        ["o-blue", "o-red"],
        true,
      ],
      [multiple(1), leaf(uuid(1), "includes_all_of", ["o-red", "o-blue"]), ["o-red"], false],
      [multiple(1), leaf(uuid(1), "includes_none_of", ["o-blue"]), ["o-red"], true],
      [multiple(1), leaf(uuid(1), "includes_none_of", ["o-red"]), ["o-red", "o-blue"], false],
      [yesNo(1), leaf(uuid(1), "is_yes"), true, true],
      [yesNo(1), leaf(uuid(1), "is_yes"), false, false],
      [yesNo(1), leaf(uuid(1), "is_no"), false, true],
      [yesNo(1), leaf(uuid(1), "is_no"), true, false],
    ];
    for (const [source, condition, value, expected] of cases)
      expect(followerShown(source, condition, value)).toBe(expected);
  });

  test("a question off the path counts as unanswered even when an answer is still held", () => {
    const definition = form([
      page(1, [text(1)]),
      page(2, [
        text(2, { showCondition: leaf(uuid(1), "equals", "yes") }),
        text(3, { showCondition: leaf(uuid(2), "equals", "secret") }),
        text(4, { showCondition: leaf(uuid(2), "is_not_answered") }),
      ]),
    ]);
    expect(shown(definition, { [uuid(1)]: "no", [uuid(2)]: "secret" })).toEqual([uuid(1), uuid(4)]);
  });

  test("a missing option reads as unanswered, so is none of does not succeed on the stale value", () => {
    expect(followerShown(single(1), leaf(uuid(1), "is_any_of", ["deleted"]), "o-red")).toBe(false);
    expect(followerShown(single(1), leaf(uuid(1), "is_none_of", ["deleted"]), "o-red")).toBe(false);
    expect(
      followerShown(multiple(1), leaf(uuid(1), "includes_none_of", ["deleted"]), ["o-red"]),
    ).toBe(false);
  });

  test("a reference that is missing, not earlier, or names a row reads as unanswered", () => {
    const definition = form([
      page(1, [
        text(1, { showCondition: leaf(uuid(2), "is_not_answered") }),
        text(2, { showCondition: leaf(uuid(9), "equals", "a") }),
        text(3, { showCondition: leaf(uuid(1), "is_answered", undefined, "row-1") }),
        text(4, { showCondition: leaf(uuid(1), "is_not_answered", undefined, "row-1") }),
        text(5, { showCondition: leaf(uuid(1), "equals") }),
      ]),
    ]);
    expect(shown(definition, { [uuid(1)]: "a" })).toEqual([uuid(1), uuid(4)]);
  });

  test("a nested group can see an earlier answer on the same page", () => {
    const definition = form([
      page(1, [
        text(1),
        text(2, {
          showCondition: {
            all: [
              { any: [leaf(uuid(1), "equals", "no"), leaf(uuid(1), "equals", "a")] },
              leaf(uuid(1), "is_answered"),
            ],
          },
        }),
      ]),
    ]);
    expect(shown(definition, { [uuid(1)]: "A" })).toEqual([uuid(1), uuid(2)]);
  });
});

describe("the path", () => {
  test("passes over a page whose questions are all off the path, and still checks its jumps", () => {
    const hidden = text(2, { showCondition: leaf(uuid(1), "equals", "never") });
    const passed = form([page(1, [text(1)]), page(2, [hidden]), page(3, [text(3)])]);
    expect(visited(passed, { [uuid(1)]: "yes" })).toEqual([pageId(1), pageId(3)]);
    expect(shown(passed, { [uuid(1)]: "yes" })).toEqual([uuid(1), uuid(3)]);
    expect(nextDestination(passed, { [uuid(1)]: "yes" }, pagesOf(passed)[0]!)).toEqual({
      kind: "page",
      page: pagesOf(passed)[2],
    });

    const jumpToEnd = form([
      page(1, [text(1)]),
      page(2, [hidden], [{ condition: leaf(uuid(1), "equals", "yes"), target: "end" }]),
      page(3, [text(3)]),
    ]);
    expect(visited(jumpToEnd, { [uuid(1)]: "yes" })).toEqual([pageId(1)]);
    expect(nextDestination(jumpToEnd, { [uuid(1)]: "yes" }, pagesOf(jumpToEnd)[0]!)).toEqual({
      kind: "end",
    });
  });

  test("passes over an empty page and a format-1 page whose questions are all hidden", () => {
    const definition = form([page(1, [text(1)]), page(2, []), page(3, [text(3)])]);
    expect(visited(definition)).toEqual([pageId(1), pageId(3)]);

    const format1 = parseDefinition({
      format: 1,
      title: "Feedback",
      questions: [text(1, { showCondition: { any: [] } })],
    });
    if (!format1.ok || format1.value.format !== 1) throw new Error("format 1");
    expect(pathOf(format1.value, {}).pages).toEqual([]);
    expect(nextDestination(format1.value, {}, pagesOf(format1.value)[0]!)).toEqual({ kind: "end" });
  });

  test("the first matching jump wins, and a target that is not later is skipped", () => {
    const jumps = form([
      page(
        1,
        [text(1)],
        [
          { condition: leaf(uuid(1), "equals", "end"), target: "end" },
          { condition: leaf(uuid(1), "equals", "c"), target: pageId(3) },
        ],
      ),
      page(2, [text(2)]),
      page(3, [text(3)]),
    ]);
    expect(visited(jumps, { [uuid(1)]: "end" })).toEqual([pageId(1)]);
    expect(visited(jumps, { [uuid(1)]: "c" })).toEqual([pageId(1), pageId(3)]);
    expect(visited(jumps, { [uuid(1)]: "other" })).toEqual([pageId(1), pageId(2), pageId(3)]);

    const invalid = form([
      page(
        1,
        [text(1)],
        [
          { condition: leaf(uuid(1), "equals", "bad"), target: pageId(1) },
          { condition: leaf(uuid(1), "equals", "bad"), target: uuid(999) },
          { condition: leaf(uuid(1), "equals", "bad"), target: pageId(3) },
        ],
      ),
      page(2, [text(2)]),
      page(3, [text(3)]),
    ]);
    expect(visited(invalid, { [uuid(1)]: "bad" })).toEqual([pageId(1), pageId(3)]);
    expect(visited(invalid, { [uuid(1)]: "else" })).toEqual([pageId(1), pageId(2), pageId(3)]);
  });

  test("a jump may read a question on its own page", () => {
    const definition = form([
      page(1, [text(1)], [{ condition: leaf(uuid(1), "equals", "skip"), target: "end" }]),
      page(2, [text(2)]),
    ]);
    expect(visited(definition, { [uuid(1)]: "skip" })).toEqual([pageId(1)]);
    expect(visited(definition, { [uuid(1)]: "stay" })).toEqual([pageId(1), pageId(2)]);
    expect(nextDestination(definition, { [uuid(1)]: "stay" }, pagesOf(definition)[1]!)).toEqual({
      kind: "end",
    });
  });

  test("walking next destination visits the same pages as the path", () => {
    const definition = form([
      page(1, [text(1)], [{ condition: leaf(uuid(1), "equals", "jump"), target: pageId(3) }]),
      page(2, [text(2, { showCondition: { any: [] } })]),
      page(3, [text(3)]),
    ]);
    const answers = { [uuid(1)]: "jump" };
    const seen: (string | null)[] = [];
    let pageView = pagesOf(definition)[0]!;
    for (let guard = 0; guard < 6; guard += 1) {
      if (pathOf(definition, answers).pages.some((item) => item.id === pageView.id))
        seen.push(pageView.id);
      const destination = nextDestination(definition, answers, pageView);
      if (destination.kind === "end") break;
      pageView = destination.page;
    }
    expect(seen).toEqual(visited(definition, answers));
  });
});

describe("validateAnswers", () => {
  const definition = form([
    page(1, [text(1, { required: true })]),
    page(2, [
      text(2, { required: true, showCondition: leaf(uuid(1), "equals", "yes") }),
      {
        id: uuid(3),
        type: "boolean",
        label: "Consent",
        required: true,
        config: { mustBeYes: true },
        showCondition: leaf(uuid(1), "equals", "yes"),
      },
    ]),
  ]);

  test("a required question off the path is not demanded, and an answer for it is rejected", () => {
    expect(validateAnswers(definition, { [uuid(1)]: "no" })).toEqual({
      ok: true,
      value: { [uuid(1)]: "no" },
    });
    const rejected = validateAnswers(definition, { [uuid(1)]: "no", [uuid(2)]: "hidden" });
    expect(rejected.ok).toBe(false);
    expect(rejected.ok ? [] : rejected.issues.map((issue) => issue.message).join(" ")).toContain(
      uuid(2),
    );
  });

  test("on the path, required and must-be-yes still apply", () => {
    expect(validateAnswers(definition, { [uuid(1)]: "yes" }).ok).toBe(false);
    expect(
      validateAnswers(definition, { [uuid(1)]: "yes", [uuid(2)]: "Ada", [uuid(3)]: false }).ok,
    ).toBe(false);
    expect(
      validateAnswers(definition, { [uuid(1)]: "yes", [uuid(2)]: "Ada", [uuid(3)]: true }),
    ).toEqual({
      ok: true,
      value: { [uuid(1)]: "yes", [uuid(2)]: "Ada", [uuid(3)]: true },
    });
  });

  test("a format-1 definition with no conditions validates as it does today", () => {
    const parsed = parseDefinition({
      format: 1,
      title: "Feedback",
      questions: [text(1, { required: true })],
    });
    if (!parsed.ok) throw new Error("parse");
    expect(validateAnswers(parsed.value, { [uuid(1)]: "Ada" }).ok).toBe(true);
    expect(validateAnswers(parsed.value, {}).ok).toBe(false);
  });
});

describe("interpretAnswers", () => {
  test("reports the stored path as answered, skipped, or not shown, without recomputing it", () => {
    const definition = form([
      page(1, [single(1), text(2, { showCondition: leaf(uuid(1), "is_any_of", ["o-red"]) })]),
    ]);
    const answers = { [uuid(1)]: "o-red", [uuid(2)]: "kept" };
    expect(interpretAnswers(definition, answers, [uuid(1)])).toEqual([
      {
        question: pages(definition)[0]!.questions[0],
        status: "answered",
        answer: { value: "o-red", display: "Red" },
      },
      { question: pages(definition)[0]!.questions[1], status: "not_shown" },
    ]);
    expect(interpretAnswers(definition, { [uuid(1)]: "o-red" }, [uuid(1), uuid(2)])[1]).toEqual({
      question: pages(definition)[0]!.questions[1],
      status: "skipped",
    });
  });
});

describe("publish checks", () => {
  test("reports every condition problem at once, including jump conditions, and a valid condition publishes", () => {
    const show = {
      all: [
        leaf(uuid(9), "equals", "a"),
        leaf(uuid(1), "equals"),
        leaf(uuid(1), "is_answered", "x"),
        leaf(uuid(1), "equal", 1),
        leaf(uuid(2), "is_any_of", ["nope", "o-red"]),
        leaf(uuid(1), "equals", "a", "row-1"),
        { any: [] },
        { all: [{ any: [] }] },
        leaf(uuid(4), "is_answered"),
      ],
    };
    const definition = form([
      page(
        1,
        [text(1), single(2), text(3, { showCondition: show })],
        [
          { condition: leaf(uuid(3), "is_answered"), target: pageId(2) },
          { condition: leaf(uuid(4), "equals", "a"), target: "end" },
        ],
      ),
      page(2, [text(4)]),
    ]);
    const prefix = ["pages", 0, "questions", 2, "showCondition", "all"];
    const expected = [
      {
        path: [...prefix, 0, "questionId"],
        message: "This condition reads a question that is not earlier in the form",
      },
      { path: [...prefix, 1, "constant"], message: "This operator needs a constant" },
      { path: [...prefix, 2, "constant"], message: "This operator takes no constant" },
      { path: [...prefix, 3, "operator"], message: "This operator does not fit this question" },
      {
        path: [...prefix, 4, "constant", 0],
        message: "This condition names an option value the question does not have",
      },
      { path: [...prefix, 5, "row"], message: "This question has no rows" },
      { path: [...prefix, 6], message: "A condition group cannot be empty" },
      { path: [...prefix, 7, "all", 0], message: "A condition group cannot be empty" },
      {
        path: [...prefix, 8, "questionId"],
        message: "This condition reads a question that is not earlier in the form",
      },
      {
        path: ["pages", 0, "jumps", 1, "condition", "questionId"],
        message: "This condition reads a question that is not earlier in the form",
      },
    ];
    expect(conditionIssues(definition)).toEqual(expected);
    expect(validateForPublish(definition, [])).toEqual({ ok: false, issues: expected });

    const valid = form([
      page(
        1,
        [text(1), text(2, { showCondition: leaf(uuid(1), "equals", "a") })],
        [{ condition: leaf(uuid(2), "is_answered"), target: "end" }],
      ),
    ]);
    expect(conditionIssues(valid)).toEqual([]);
    expect(validateForPublish(valid, []).ok).toBe(true);
  });

  test("a constant that is not a real date, or the wrong shape, does not fit", () => {
    const definition = form([
      page(1, [
        date(1),
        text(2),
        text(3, { showCondition: leaf(uuid(1), "is_on", "2020-02-31") }),
        text(4, { showCondition: leaf(uuid(2), "equals", 1) }),
      ]),
    ]);
    expect(conditionIssues(definition).map((issue) => issue.message)).toEqual([
      "This constant does not fit this operator",
      "This constant does not fit this operator",
    ]);
  });

  test("format 1 checks the same rules along the flat list", () => {
    const parsed = parseDefinition({
      format: 1,
      title: "Feedback",
      questions: [text(1, { showCondition: leaf(uuid(2), "equals", "a") }), text(2)],
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    expect(conditionIssues(parsed.value)).toEqual([
      {
        path: ["questions", 0, "showCondition", "questionId"],
        message: "This condition reads a question that is not earlier in the form",
      },
    ]);
  });
});

describe("condition caps", () => {
  const leaves = (n: number) => Array.from({ length: n }, () => leaf(uuid(1), "is_answered"));

  test("a text constant is at most 500 code points and an option list at most 100", () => {
    const withConstant = (constant: unknown) =>
      parseDefinition({
        format: 1,
        title: "Feedback",
        questions: [
          text(1, { showCondition: { questionId: uuid(2), operator: "equals", constant } }),
        ],
      });
    expect(withConstant("😀".repeat(500)).ok).toBe(true);
    expect(withConstant("😀".repeat(501)).ok).toBe(false);
    expect(withConstant(Array.from({ length: 100 }, () => "v")).ok).toBe(true);
    expect(withConstant(Array.from({ length: 101 }, () => "v")).ok).toBe(false);
  });

  test("a definition accepts 1,000 leaves, counting jumps, and rejects 1,001", () => {
    const body = (extraJump: boolean) => ({
      format: 2 as const,
      title: "Feedback",
      pages: [
        page(
          1,
          [text(1, { showCondition: { all: leaves(CONDITIONS_CAP) } })],
          extraJump ? [{ condition: leaf(uuid(1), "is_answered"), target: "end" }] : [],
        ),
      ],
    });
    expect(parseDefinition(body(false)).ok).toBe(true);
    const over = parseDefinition(body(true));
    expect(over.ok).toBe(false);
    expect(over.ok ? [] : over.issues).toEqual([
      { path: ["pages"], message: "A form has at most 1000 conditions" },
    ]);
  });
});

describe("editing a show condition", () => {
  const deepFreeze = <T>(value: T): T => {
    if (typeof value === "object" && value !== null) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  };

  test("sets and clears a condition without mutating the definition or the question it names", () => {
    const original = deepFreeze(form([page(1, [text(1), text(2)])]));
    const condition = leaf(uuid(1), "equals", "a");
    const set = setShowCondition(original, uuid(2), condition);
    expect(pages(set)[0]!.questions[1]!.showCondition).toEqual(condition);
    expect(pages(original)[0]!.questions[1]).not.toHaveProperty("showCondition");
    const cleared = clearShowCondition(set, uuid(2));
    expect(pages(cleared)[0]!.questions[1]).not.toHaveProperty("showCondition");
    expect(clearShowCondition(cleared, uuid(2))).toEqual(cleared);
    expect(() => setShowCondition(original, uuid(9), condition)).toThrow(RangeError);
  });

  test("removing the referenced question leaves the condition in place", () => {
    const definition = setShowCondition(
      form([page(1, [text(1), text(2)])]),
      uuid(2),
      leaf(uuid(1), "equals", "a"),
    );
    const removed = removeQuestion(definition, uuid(1));
    expect(pages(removed)[0]!.questions[0]!.showCondition).toEqual(leaf(uuid(1), "equals", "a"));
  });
});
