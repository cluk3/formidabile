import { describe, expect, test } from "vite-plus/test";
import { validateAnswers } from "@fb/core/answers";
import { parseDefinition, validateForPublish, type Result } from "@fb/core/definition";

const id = "00000000-0000-4000-8000-000000000001";

const question = (config: { mustBeYes?: boolean }, required = true) => ({
  id,
  type: "boolean" as const,
  label: "I agree to the terms",
  required,
  config,
});

const definition = (config: { mustBeYes?: boolean }, required = true) => ({
  format: 1 as const,
  title: "Consent",
  questions: [question(config, required)],
});

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

const parsed = (config: { mustBeYes?: boolean }, required = true) => {
  const result = parseDefinition(definition(config, required));
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

describe("must be yes", () => {
  test("a boolean can require the answer true", () => {
    const form = parsed({ mustBeYes: true });

    expect(validateAnswers(form, { [id]: true })).toMatchObject({
      ok: true,
      value: { [id]: true },
    });
    expect(validateAnswers(form, { [id]: false }).ok).toBe(false);
    expect(issuePaths(validateAnswers(form, {}))).toEqual([[id]]);
    expect(issuePaths(validateAnswers(form, { [id]: false }))).toEqual([[id]]);
  });

  test("without the setting, yes and no are both answers", () => {
    for (const config of [{}, { mustBeYes: false }]) {
      const form = parsed(config);

      expect(validateAnswers(form, { [id]: true }).ok).toBe(true);
      expect(validateAnswers(form, { [id]: false }).ok).toBe(true);
    }
  });

  test("an optional boolean without the setting may be left unanswered", () => {
    const form = parsed({}, false);

    expect(validateAnswers(form, {}).ok).toBe(true);
  });

  test("the setting is mustBeYes, and an unknown config key is refused", () => {
    expect(parseDefinition(definition({ mustBeYes: true })).ok).toBe(true);
    expect(parseDefinition(definition({ mustBeYes: false })).ok).toBe(true);
    expect(parseDefinition(definition({})).ok).toBe(true);
    expect(issuePaths(parseDefinition(definition({ mustBeChecked: true } as never)))).toEqual([
      ["questions", 0, "config"],
    ]);
  });

  test("the setting makes the question required", () => {
    expect(issuePaths(parseDefinition(definition({ mustBeYes: true }, false)))).toEqual([
      ["questions", 0, "required"],
    ]);
  });

  test("publish accepts the question, because true is an answer it allows", () => {
    const form = definition({ mustBeYes: true });

    expect(validateForPublish(form, [])).toEqual({ ok: true, value: parsed({ mustBeYes: true }) });
    expect(validateAnswers(parsed({ mustBeYes: true }), { [id]: true }).ok).toBe(true);
  });

  test("publish still requires a label", () => {
    expect(
      issuePaths(
        validateForPublish(
          {
            ...definition({ mustBeYes: true }),
            questions: [{ ...question({ mustBeYes: true }), label: "" }],
          },
          [],
        ),
      ),
    ).toEqual([["questions", 0, "label"]]);
  });
});
