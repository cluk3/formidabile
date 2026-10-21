import { describe, expect, test } from "vite-plus/test";
import { validateAnswers } from "@fb/core/answers";
import { parseDefinition, type FormDefinition, type Result } from "@fb/core/definition";

const ids = {
  name: "00000000-0000-4000-8000-000000000001",
  bio: "00000000-0000-4000-8000-000000000002",
};

const define = (questions: object[]): FormDefinition => {
  const parsed = parseDefinition({ format: 1, title: "Feedback", questions });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.value;
};

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

const text = (id: string, required: boolean) => ({
  id,
  type: "text",
  label: "Question",
  required,
  config: { display: "single_line" },
});

describe("validateAnswers", () => {
  const form = define([text(ids.name, true), text(ids.bio, false)]);

  test("answers are keyed by question identity with untagged values", () => {
    expect(validateAnswers(form, { [ids.name]: "Ada", [ids.bio]: "Mathematician" })).toEqual({
      ok: true,
      value: { [ids.name]: "Ada", [ids.bio]: "Mathematician" },
    });
  });

  test("an unanswered optional question has no key", () => {
    expect(validateAnswers(form, { [ids.name]: "Ada" })).toEqual({
      ok: true,
      value: { [ids.name]: "Ada" },
    });
  });

  test("an unanswered required question is rejected at its key", () => {
    expect(issuePaths(validateAnswers(form, { [ids.bio]: "Mathematician" }))).toEqual([[ids.name]]);
  });

  test("an answer to a question the version doesn't have is rejected", () => {
    const other = "00000000-0000-4000-8000-0000000000ff";
    const result = validateAnswers(form, { [ids.name]: "Ada", [other]: "?" });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues).toEqual([
      expect.objectContaining({ path: [], message: expect.stringContaining(other) }),
    ]);
  });

  test("an unanswered optional question is never null, undefined or blank", () => {
    for (const unanswered of [null, undefined, "", "   "])
      expect(
        issuePaths(validateAnswers(form, { [ids.name]: "Ada", [ids.bio]: unanswered })),
      ).toEqual([[ids.bio]]);
  });

  test("tagged values are rejected", () => {
    expect(
      issuePaths(validateAnswers(form, { [ids.name]: { type: "text", value: "Ada" } })),
    ).toEqual([[ids.name]]);
  });

  test("answers must be an object", () => {
    for (const input of [null, [], "Ada"])
      expect(issuePaths(validateAnswers(form, input))).toEqual([[]]);
  });
});
