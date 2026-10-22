import { describe, expect, test } from "vite-plus/test";
import { validateAnswers } from "@fb/core/answers";
import { parseDefinition, questionsOf, validateForPublish, type Result } from "@fb/core/definition";
import { addQuestion } from "@fb/core/editing";

const id = "00000000-0000-4000-8000-000000000001";

const form = (config: object, label = "Score") => ({
  format: 1,
  title: "Feedback",
  questions: [{ id, type: "number", label, required: false, config }],
});

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

/** Issue paths from publishing one number question, relative to the question. */
const publishPaths = (config: object, label = "Score") =>
  issuePaths(validateForPublish(form(config, label), [])).map((path) => path.slice(2));

const published = (config: object) => {
  const result = parseDefinition(form(config));
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

describe("number display", () => {
  test("structure: input is the default display, and the other four are rating, scale, slider and NPS", () => {
    expect(parseDefinition(form({ integer: false })).ok).toBe(true);
    for (const display of ["input", "rating", "scale", "slider", "nps"])
      expect(parseDefinition(form({ integer: true, display })).ok).toBe(true);
    expect(issuePaths(parseDefinition(form({ integer: false, display: "stars" })))).toEqual([
      ["questions", 0, "config", "display"],
    ]);
  });

  test("structure: a step is an optional finite number, and each end has an optional label", () => {
    expect(parseDefinition(form({ integer: false, step: 0.5 })).ok).toBe(true);
    expect(issuePaths(parseDefinition(form({ integer: false, step: Infinity })))).toEqual([
      ["questions", 0, "config", "step"],
    ]);
    const labelled = parseDefinition(
      form({
        integer: true,
        display: "scale",
        minLabel: "  Not likely  ",
        maxLabel: "Very likely",
      }),
    );
    expect(labelled.ok && questionsOf(labelled.value)[0]).toMatchObject({
      config: { minLabel: "Not likely", maxLabel: "Very likely" },
    });
    expect(
      issuePaths(parseDefinition(form({ integer: false, minLabel: "x".repeat(101) }))),
    ).toEqual([["questions", 0, "config", "minLabel"]]);
  });

  test("publish: a plain number keeps its range rules when the display is left unset", () => {
    expect(publishPaths({ integer: false, min: 0, max: 10 })).toEqual([]);
    expect(publishPaths({ integer: false, min: 3, max: 1 })).toEqual([["config", "max"]]);
    expect(questionsOf(published({ integer: false, min: 0, max: 10 }))[0]).toMatchObject({
      config: { integer: false, min: 0, max: 10 },
    });
  });

  test("publish: a rating is whole numbers from 1 to a maximum of 3 to 10", () => {
    expect(publishPaths({ integer: true, display: "rating", min: 1, max: 3 })).toEqual([]);
    expect(publishPaths({ integer: true, display: "rating", min: 1, max: 10 })).toEqual([]);
    expect(publishPaths({ integer: false, display: "rating", min: 0, max: 11 }, "")).toEqual([
      ["label"],
      ["config", "integer"],
      ["config", "min"],
      ["config", "max"],
    ]);
  });

  test("publish: a scale is whole numbers from 0 or 1 to a maximum of 2 to 10, with optional end labels", () => {
    expect(publishPaths({ integer: true, display: "scale", min: 0, max: 2 })).toEqual([]);
    expect(
      publishPaths({
        integer: true,
        display: "scale",
        min: 1,
        max: 10,
        minLabel: "Low",
        maxLabel: "High",
      }),
    ).toEqual([]);
    expect(publishPaths({ integer: false, display: "scale", min: 2, max: 1 })).toEqual([
      ["config", "max"],
      ["config", "integer"],
      ["config", "min"],
      ["config", "max"],
    ]);
  });

  test("publish: a slider needs a minimum, a maximum and a step", () => {
    expect(
      publishPaths({ integer: false, display: "slider", min: 0, max: 1, step: 0.0001 }),
    ).toEqual([]);
    expect(publishPaths({ integer: true, display: "slider", min: 0, max: 10, step: 2 })).toEqual(
      [],
    );
    expect(publishPaths({ integer: false, display: "slider" })).toEqual([
      ["config", "min"],
      ["config", "max"],
      ["config", "step"],
    ]);
  });

  test("publish: NPS is fixed at whole numbers from 0 to 10, with end labels", () => {
    expect(
      publishPaths({
        integer: true,
        display: "nps",
        min: 0,
        max: 10,
        minLabel: "Not likely",
        maxLabel: "Very likely",
      }),
    ).toEqual([]);
    expect(publishPaths({ integer: true, display: "nps", min: 1, max: 9, step: 0.5 })).toEqual([
      ["config", "min"],
      ["config", "max"],
      ["config", "minLabel"],
      ["config", "maxLabel"],
      ["config", "step"],
    ]);
  });

  test("publish: a step is a positive number with at most 4 decimal places, and a whole number when the question is", () => {
    expect(publishPaths({ integer: false, step: 1.2345 })).toEqual([]);
    expect(publishPaths({ integer: false, step: 0.0001 })).toEqual([]);
    expect(publishPaths({ integer: true, step: 2 })).toEqual([]);
    expect(publishPaths({ integer: false, step: 0 })).toEqual([["config", "step"]]);
    expect(publishPaths({ integer: false, step: -1 })).toEqual([["config", "step"]]);
    expect(publishPaths({ integer: false, step: 0.00001 })).toEqual([["config", "step"]]);
    expect(publishPaths({ integer: false, step: 1e-7 })).toEqual([["config", "step"]]);
    expect(publishPaths({ integer: true, step: 1.5 })).toEqual([["config", "step"]]);
  });

  test("changing the display keeps the question identity", () => {
    const earlier = published({ integer: false, min: 0, max: 100 });
    const next = form({ integer: true, display: "rating", min: 1, max: 5 });
    const result = validateForPublish(next, [earlier]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(questionsOf(result.value)[0]?.id).toBe(id);
  });

  test("a new number question starts as a plain input", () => {
    const blank = parseDefinition({ format: 1, title: "Feedback", questions: [] });
    if (!blank.ok) throw new Error("empty form");
    const edited = addQuestion(blank.value, "number", {
      questionId: () => id,
      optionValue: () => "opt",
      pageId: () => "00000000-0000-4000-8000-000000000099",
    });
    expect(questionsOf(edited)[0]?.config).toEqual({ integer: false, display: "input" });
  });
});

describe("number step", () => {
  const answer = (config: object, value: number) =>
    validateAnswers(published(config), { [id]: value });

  test("a value is the minimum plus a whole number of steps", () => {
    const config = { integer: false, min: 1, step: 2 };
    expect(answer(config, 1).ok).toBe(true);
    expect(answer(config, 5).ok).toBe(true);
    expect(answer(config, 2).ok).toBe(false);
    expect(answer({ integer: false, min: 0.1, step: 0.1 }, 0.3).ok).toBe(true);
    expect(answer({ integer: false, min: 0.1, step: 0.1 }, 0.15).ok).toBe(false);
  });

  test("with no minimum, a value is a whole multiple of the step", () => {
    const config = { integer: false, step: 0.5 };
    expect(answer(config, 0).ok).toBe(true);
    expect(answer(config, -1).ok).toBe(true);
    expect(answer(config, 2.5).ok).toBe(true);
    expect(answer(config, -0.25).ok).toBe(false);
    expect(answer({ integer: false, step: 0.0002 }, 0.0004).ok).toBe(true);
    expect(answer({ integer: false, step: 0.0002 }, 0.0003).ok).toBe(false);
  });

  test("scaling both sides accepts a value floating point would mis-divide", () => {
    expect(answer({ integer: false, step: 0.1 }, 0.1 + 0.2).ok).toBe(true);
    expect(answer({ integer: false, step: 0.1 }, 0.25).ok).toBe(false);
  });

  test("a whole-number question still rejects fractions, and a question with no step accepts any number in range", () => {
    expect(answer({ integer: true, min: 0, max: 10, step: 2 }, 4).ok).toBe(true);
    expect(answer({ integer: true, min: 0, max: 10, step: 2 }, 3).ok).toBe(false);
    expect(answer({ integer: true, step: 1 }, 1.5).ok).toBe(false);
    expect(answer({ integer: false, min: -1.5, max: 2.5 }, 2.25).ok).toBe(true);
  });
});
