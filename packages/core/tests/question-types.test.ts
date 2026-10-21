import { describe, expect, test } from "vite-plus/test";
import {
  parseDefinition,
  questionTypes,
  validateForPublish,
  type Result,
} from "@fb/core/definition";

const id = "00000000-0000-4000-8000-000000000001";

const withQuestion = (question: object) => ({
  format: 1,
  title: "Feedback",
  questions: [{ id, label: "Question", required: true, ...question }],
});

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

/** Issue paths from parsing one question, relative to the question. */
const structureIssues = (question: object) =>
  issuePaths(parseDefinition(withQuestion(question))).map((path) => path.slice(2));

/** Issue paths from publishing one question, relative to the question. */
const publishIssues = (question: object) =>
  issuePaths(validateForPublish(withQuestion(question), [])).map((path) => path.slice(2));

describe("text", () => {
  const text = { type: "text", config: { display: "multi_line", maxLength: 10_000 } };

  test("structure: a display, and an optional maxLength from 1 to 10,000", () => {
    expect(structureIssues(text)).toEqual([]);
    expect(structureIssues({ ...text, config: { display: "single_line" } })).toEqual([]);
    expect(structureIssues({ ...text, config: { display: "paragraph" } })).toEqual([
      ["config", "display"],
    ]);
    expect(
      structureIssues({ ...text, config: { display: "single_line", maxLength: 10_001 } }),
    ).toEqual([["config", "maxLength"]]);
    expect(
      structureIssues({ ...text, config: { display: "single_line", maxLength: 2.5 } }),
    ).toEqual([["config", "maxLength"]]);
  });

  test("structure: a maxLength of 0, which no answer fits, doesn't parse", () => {
    expect(structureIssues({ ...text, config: { display: "single_line", maxLength: 0 } })).toEqual([
      ["config", "maxLength"],
    ]);
  });

  test("publish: needs a label", () => {
    expect(publishIssues(text)).toEqual([]);
    expect(publishIssues({ ...text, label: "  " })).toEqual([["label"]]);
  });
});

describe("email", () => {
  const email = { type: "email", config: {} };
  const answer = questionTypes.email.answer();

  test("structure: has no config", () => {
    expect(structureIssues(email)).toEqual([]);
    expect(structureIssues({ ...email, config: { domain: "example.com" } })).toEqual([["config"]]);
  });

  test("publish: needs a label", () => {
    expect(publishIssues(email)).toEqual([]);
    expect(publishIssues({ ...email, label: "" })).toEqual([["label"]]);
  });

  test("answers are capped at 254 code points", () => {
    const address = (length: number) => `${"a".repeat(length - "@example.com".length)}@example.com`;
    expect(answer.safeParse(address(254)).success).toBe(true);
    expect(answer.safeParse(address(255)).success).toBe(false);
  });

  test("answers must be email addresses", () => {
    expect(answer.safeParse("not an address").success).toBe(false);
  });
});

describe("number", () => {
  const number = { type: "number", config: { integer: false, min: -1.5, max: 2.5 } };

  test("structure: an integer flag, and optional finite bounds", () => {
    expect(structureIssues(number)).toEqual([]);
    expect(structureIssues({ ...number, config: { integer: true } })).toEqual([]);
    expect(structureIssues({ ...number, config: { min: 1 } })).toEqual([["config", "integer"]]);
    expect(structureIssues({ ...number, config: { integer: false, max: Infinity } })).toEqual([
      ["config", "max"],
    ]);
  });

  test("publish: needs a label", () => {
    expect(publishIssues(number)).toEqual([]);
    expect(publishIssues({ ...number, label: "" })).toEqual([["label"]]);
  });

  test("publish: the minimum is no greater than the maximum", () => {
    expect(publishIssues({ ...number, config: { integer: false, min: 3, max: 3 } })).toEqual([]);
    expect(publishIssues({ ...number, config: { integer: false, min: 3.5, max: 3 } })).toEqual([
      ["config", "max"],
    ]);
  });

  test("publish: an integer question with fractional bounds is rejected", () => {
    expect(publishIssues({ ...number, config: { integer: true, min: 1.2, max: 1.8 } })).toEqual([
      ["config", "min"],
      ["config", "max"],
    ]);
    expect(publishIssues({ ...number, config: { integer: true, min: -2, max: 5 } })).toEqual([]);
  });
});

describe("date", () => {
  const date = { type: "date", config: { min: "2026-01-01", max: "2026-12-31" } };

  test("structure: optional calendar-date bounds", () => {
    expect(structureIssues(date)).toEqual([]);
    expect(structureIssues({ ...date, config: {} })).toEqual([]);
    expect(structureIssues({ ...date, config: { min: "2026-01-01T00:00:00Z" } })).toEqual([
      ["config", "min"],
    ]);
  });

  test("publish: needs a label", () => {
    expect(publishIssues(date)).toEqual([]);
    expect(publishIssues({ ...date, label: "" })).toEqual([["label"]]);
  });

  test("publish: the earliest date is no later than the latest", () => {
    expect(publishIssues({ ...date, config: { min: "2026-05-01", max: "2026-05-01" } })).toEqual(
      [],
    );
    expect(publishIssues({ ...date, config: { min: "2026-05-02", max: "2026-05-01" } })).toEqual([
      ["config", "max"],
    ]);
  });
});

const options = (...labels: string[]) => labels.map((label, i) => ({ value: `v${i}`, label }));

describe("single choice", () => {
  const single = {
    type: "single_choice",
    config: { display: "radio", options: options("A", "B") },
  };

  test("structure: options with values and labels, and a display", () => {
    expect(structureIssues(single)).toEqual([]);
    expect(structureIssues({ ...single, config: { display: "dropdown", options: [] } })).toEqual(
      [],
    );
    expect(structureIssues({ ...single, config: { display: "list", options: [] } })).toEqual([
      ["config", "display"],
    ]);
    expect(
      structureIssues({
        ...single,
        config: { display: "radio", options: [{ value: "", label: "A" }] },
      }),
    ).toEqual([["config", "options", 0, "value"]]);
  });

  test("structure: at most 100 options, each label at most 200 code points", () => {
    const many = (n: number) => options(...Array.from({ length: n }, (_, i) => `Option ${i}`));
    expect(
      structureIssues({ ...single, config: { display: "radio", options: many(100) } }),
    ).toEqual([]);
    expect(
      structureIssues({ ...single, config: { display: "radio", options: many(101) } }),
    ).toEqual([["config", "options"]]);
    expect(
      structureIssues({
        ...single,
        config: { display: "radio", options: options("😀".repeat(201)) },
      }),
    ).toEqual([["config", "options", 0, "label"]]);
  });

  test("structure: option values are unique within the question", () => {
    const twice = [
      { value: "a", label: "A" },
      { value: "a", label: "B" },
    ];
    expect(structureIssues({ ...single, config: { display: "radio", options: twice } })).toEqual([
      ["config", "options", 1, "value"],
    ]);
  });

  test("publish: needs a label and at least two options", () => {
    expect(publishIssues(single)).toEqual([]);
    expect(publishIssues({ ...single, label: "" })).toEqual([["label"]]);
    expect(
      publishIssues({ ...single, config: { display: "radio", options: options("A") } }),
    ).toEqual([["config", "options"]]);
  });

  test("publish: every option needs a label of its own", () => {
    expect(
      publishIssues({ ...single, config: { display: "radio", options: options("A", "", "A") } }),
    ).toEqual([
      ["config", "options", 1, "label"],
      ["config", "options", 2, "label"],
    ]);
  });
});

describe("multiple choice", () => {
  const multiple = (config: object = {}) => ({
    type: "multiple_choice",
    config: { options: options("A", "B", "C"), ...config },
  });

  test("structure: options, and optional selection counts", () => {
    expect(structureIssues(multiple())).toEqual([]);
    expect(structureIssues(multiple({ minSelected: 1, maxSelected: 100 }))).toEqual([]);
    expect(structureIssues(multiple({ minSelected: 1.5, maxSelected: 101 }))).toEqual([
      ["config", "minSelected"],
      ["config", "maxSelected"],
    ]);
  });

  test("structure: maxSelected 0 doesn't parse", () => {
    expect(structureIssues(multiple({ maxSelected: 0 }))).toEqual([["config", "maxSelected"]]);
  });

  test("structure: option values are unique within the question", () => {
    const twice = [
      { value: "a", label: "A" },
      { value: "a", label: "B" },
    ];
    expect(structureIssues(multiple({ options: twice }))).toEqual([
      ["config", "options", 1, "value"],
    ]);
  });

  test("publish: needs a label, and one option with a label of its own", () => {
    expect(publishIssues(multiple({ options: options("A") }))).toEqual([]);
    expect(publishIssues({ ...multiple(), label: "" })).toEqual([["label"]]);
    expect(publishIssues(multiple({ options: [] }))).toEqual([["config", "options"]]);
    expect(publishIssues(multiple({ options: options("", "B", "B") }))).toEqual([
      ["config", "options", 0, "label"],
      ["config", "options", 2, "label"],
    ]);
  });

  test("publish: minSelected above the number of options is rejected", () => {
    expect(publishIssues(multiple({ minSelected: 3 }))).toEqual([]);
    expect(publishIssues(multiple({ minSelected: 4 }))).toEqual([["config", "minSelected"]]);
  });

  test("publish: maxSelected above the number of options is rejected", () => {
    expect(publishIssues(multiple({ maxSelected: 3 }))).toEqual([]);
    expect(publishIssues(multiple({ maxSelected: 4 }))).toEqual([["config", "maxSelected"]]);
  });

  test("publish: minSelected is no greater than maxSelected", () => {
    expect(publishIssues(multiple({ minSelected: 2, maxSelected: 2 }))).toEqual([]);
    expect(publishIssues(multiple({ minSelected: 3, maxSelected: 2 }))).toEqual([
      ["config", "maxSelected"],
    ]);
  });
});

describe("boolean", () => {
  const boolean = { type: "boolean", config: {} };

  test("structure: has no config", () => {
    expect(structureIssues(boolean)).toEqual([]);
    expect(structureIssues({ ...boolean, config: { mustBeChecked: true } })).toEqual([["config"]]);
  });

  test("publish: needs a label, and always accepts an answer", () => {
    expect(publishIssues(boolean)).toEqual([]);
    expect(publishIssues({ ...boolean, label: "" })).toEqual([["label"]]);
  });
});
