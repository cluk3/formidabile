import { describe, expect, test } from "vite-plus/test";
import { parseDefinition, validateForPublish, type Result } from "@fb/core/definition";

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
