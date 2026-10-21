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
