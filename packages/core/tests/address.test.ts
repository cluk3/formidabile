import { describe, expect, test } from "vite-plus/test";
import { interpretAnswers, pathOf, validateAnswers, type Answers } from "@fb/core/answers";
import {
  addressLines,
  applicableOperators,
  conditionIssues,
  conditionOperators,
  countryCodes,
  isCountryCode,
  parseDefinition,
  questionsOf,
  validateForPublish,
  type AddressLine,
  type Condition,
  type FormDefinition,
} from "@fb/core/definition";
import { addQuestion } from "@fb/core/editing";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pageId = (n: number) => uuid(100 + n);

const setting = (shown: boolean, required = false) => ({ shown, required });

const linesOf = (
  overrides: Partial<Record<AddressLine, { shown: boolean; required: boolean }>> = {},
) => ({
  ...Object.fromEntries(addressLines.map((line) => [line, setting(true)])),
  ...overrides,
});

const address = (n: number, lines: ReturnType<typeof linesOf> = linesOf(), extra: object = {}) => ({
  id: uuid(n),
  type: "address" as const,
  label: "Home",
  required: false,
  config: { lines },
  ...extra,
});

const text = (n: number, extra: object = {}) => ({
  id: uuid(n),
  type: "text" as const,
  label: `Q${n}`,
  required: false,
  config: { display: "single_line" as const },
  ...extra,
});

const form = (questions: object[]): FormDefinition => {
  const parsed = parseDefinition({
    format: 2,
    title: "Feedback",
    pages: [{ id: pageId(1), questions, jumps: [] }],
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.value;
};

const flat = (question: object): FormDefinition => {
  const parsed = parseDefinition({ format: 1, title: "Feedback", questions: [question] });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.value;
};

const leaf = (operator: string, constant?: string[]): Condition => ({
  questionId: uuid(1),
  operator,
  ...(constant === undefined ? {} : { constant }),
});

const followerShown = (source: object, condition: Condition, value: unknown) => {
  const definition = form([source, text(2, { showCondition: condition })]);
  const answers: Answers = value === undefined ? {} : { [uuid(1)]: value as Answers[string] };
  return pathOf(definition, answers).questions.some((question) => question.id === uuid(2));
};

describe("address", () => {
  const home = address(1, linesOf({ line2: setting(false), region: setting(false) }));

  test("the country list is the assigned ISO 3166-1 alpha-2 codes", () => {
    expect(countryCodes).toHaveLength(249);
    expect(new Set(countryCodes).size).toBe(countryCodes.length);
    expect(countryCodes).toEqual(expect.arrayContaining(["GB", "US", "FR", "JP", "AQ"]));
    expect(isCountryCode("GB")).toBe(true);
    expect(isCountryCode("UK")).toBe(false);
    expect(isCountryCode("XK")).toBe(false);
    expect(isCountryCode("gb")).toBe(false);
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    for (const code of countryCodes) expect(names.of(code)).not.toBe(code);
  });

  test("structure: six lines, each shown or hidden and required or optional", () => {
    expect(parseDefinition({ format: 1, title: "Feedback", questions: [home] }).ok).toBe(true);
    const extra = parseDefinition({
      format: 1,
      title: "Feedback",
      questions: [{ ...home, config: { lines: linesOf(), note: true } }],
    });
    expect(extra.ok ? [] : extra.issues.map((issue) => issue.path)).toEqual([
      ["questions", 0, "config"],
    ]);
    const { country: _country, ...missingCountry } = linesOf();
    const missing = parseDefinition({
      format: 1,
      title: "Feedback",
      questions: [{ ...home, config: { lines: missingCountry } }],
    });
    expect(missing.ok).toBe(false);
  });

  test("publish: needs a label and at least one shown line", () => {
    expect(validateForPublish(flat(home), []).ok).toBe(true);
    expect(validateForPublish(flat({ ...home, label: "  " }), []).ok).toBe(false);
    const hidden = address(
      1,
      linesOf({
        line1: setting(false),
        line2: setting(false),
        city: setting(false),
        region: setting(false),
        postalCode: setting(false),
        country: setting(false),
      }),
    );
    const published = validateForPublish(flat(hidden), []);
    expect(published.ok ? [] : published.issues).toEqual([
      { path: ["questions", 0, "config", "lines"], message: "Show at least one line" },
    ]);
  });

  test("a new address shows every line and requires none", () => {
    const empty = parseDefinition({ format: 1, title: "Feedback", questions: [] });
    if (!empty.ok) throw new Error("parse");
    const next = addQuestion(empty.value, "address", {
      questionId: () => uuid(1),
      optionValue: () => "opt",
      pageId: () => pageId(1),
    });
    expect(next.format === 1 && next.questions[0]).toMatchObject({
      type: "address",
      config: { lines: linesOf() },
    });
  });

  test("filled lines only, trimmed, at most 200 code points, with no postal-code format", () => {
    const definition = flat(
      address(1, linesOf({ line2: setting(false), city: setting(true, true) }), {
        required: true,
      }),
    );
    const accepted = validateAnswers(definition, {
      [uuid(1)]: { line1: "  10 High Street  ", city: "London", postalCode: "not a postcode" },
    });
    expect(accepted).toEqual({
      ok: true,
      value: {
        [uuid(1)]: { line1: "10 High Street", city: "London", postalCode: "not a postcode" },
      },
    });

    const emoji = "😀".repeat(200);
    expect(validateAnswers(definition, { [uuid(1)]: { line1: emoji, city: "London" } }).ok).toBe(
      true,
    );
    expect(
      validateAnswers(definition, { [uuid(1)]: { line1: `${emoji}😀`, city: "London" } }).ok,
    ).toBe(false);
    expect(
      validateAnswers(definition, {
        [uuid(1)]: { line1: ` ${"a".repeat(200)}`, city: "London" },
      }).ok,
    ).toBe(true);
    expect(
      validateAnswers(definition, {
        [uuid(1)]: { line1: ` ${"a".repeat(201)}`, city: "London" },
      }).ok,
    ).toBe(false);
  });

  test("an optional address with every line empty has no key, and a filled one needs its required lines", () => {
    const definition = flat(
      address(
        1,
        linesOf({
          line1: setting(true, true),
          line2: setting(false),
          country: setting(true, true),
        }),
      ),
    );
    expect(validateAnswers(definition, {}).ok).toBe(true);
    expect(validateAnswers(definition, { [uuid(1)]: {} }).ok).toBe(false);
    expect(validateAnswers(definition, { [uuid(1)]: { line1: "   " } }).ok).toBe(false);
    expect(validateAnswers(definition, { [uuid(1)]: { line1: "10 High Street" } }).ok).toBe(false);
    expect(validateAnswers(definition, { [uuid(1)]: { country: "GB" } }).ok).toBe(false);
    expect(
      validateAnswers(definition, {
        [uuid(1)]: { line1: "10 High Street", country: "GB", line2: "Flat 2" },
      }).ok,
    ).toBe(false);
    expect(
      validateAnswers(definition, { [uuid(1)]: { line1: "10 High Street", country: "UK" } }).ok,
    ).toBe(false);
    expect(
      validateAnswers(definition, { [uuid(1)]: { line1: "10 High Street", country: "gb" } }).ok,
    ).toBe(false);
    expect(
      validateAnswers(definition, { [uuid(1)]: { line1: "10 High Street", country: "GB" } }),
    ).toEqual({
      ok: true,
      value: { [uuid(1)]: { line1: "10 High Street", country: "GB" } },
    });
  });

  test("a required address still needs an answer", () => {
    const definition = flat(
      address(1, linesOf({ line1: setting(true, true) }), { required: true }),
    );
    expect(validateAnswers(definition, {}).ok).toBe(false);
    expect(validateAnswers(definition, { [uuid(1)]: { line1: "10 High Street" } }).ok).toBe(true);
  });

  test("display reads the filled lines in line order, and skips the empty ones", () => {
    const definition = flat(home);
    const value = { postalCode: "SW1A 1AA", line1: "10 High Street", country: "GB" };
    expect(interpretAnswers(definition, { [uuid(1)]: value }, [uuid(1)])).toEqual([
      {
        question: questionsOf(definition)[0],
        status: "answered",
        answer: { value, display: "10 High Street, SW1A 1AA, GB" },
      },
    ]);
  });

  test("operators are is answered, and country is any of or none of only when country is shown", () => {
    expect(conditionOperators.address.map((operator) => operator.id)).toEqual([
      "country_is_any_of",
      "country_is_none_of",
      "is_answered",
      "is_not_answered",
    ]);
    expect(applicableOperators("address", home.config).map((operator) => operator.id)).toEqual([
      "country_is_any_of",
      "country_is_none_of",
      "is_answered",
      "is_not_answered",
    ]);
    const hidden = address(1, linesOf({ country: setting(false) }));
    expect(applicableOperators("address", hidden.config).map((operator) => operator.id)).toEqual([
      "is_answered",
      "is_not_answered",
    ]);

    const shown = form([home, text(2, { showCondition: leaf("country_is_any_of", ["GB", "IE"]) })]);
    expect(conditionIssues(shown)).toEqual([]);
    const notShown = form([hidden, text(2, { showCondition: leaf("country_is_any_of", ["GB"]) })]);
    expect(conditionIssues(notShown)).toEqual([
      {
        path: ["pages", 0, "questions", 1, "showCondition", "operator"],
        message: "This operator does not fit this question",
      },
    ]);
    const badCode = form([home, text(2, { showCondition: leaf("country_is_any_of", ["UK"]) })]);
    expect(conditionIssues(badCode)).toEqual([
      {
        path: ["pages", 0, "questions", 1, "showCondition", "constant", 0],
        message: "This constant does not fit this operator",
      },
    ]);
  });

  test("country is any of and country is none of read the country line", () => {
    const source = home;
    expect(followerShown(source, leaf("country_is_any_of", ["GB", "IE"]), { country: "IE" })).toBe(
      true,
    );
    expect(followerShown(source, leaf("country_is_any_of", ["GB"]), { country: "FR" })).toBe(false);
    expect(
      followerShown(source, leaf("country_is_any_of", ["GB"]), { line1: "10 High Street" }),
    ).toBe(false);
    expect(followerShown(source, leaf("country_is_any_of", ["GB"]), undefined)).toBe(false);
    expect(followerShown(source, leaf("country_is_none_of", ["FR", "DE"]), { country: "GB" })).toBe(
      true,
    );
    expect(followerShown(source, leaf("country_is_none_of", ["GB"]), { country: "GB" })).toBe(
      false,
    );
    expect(
      followerShown(source, leaf("country_is_none_of", ["FR"]), { line1: "10 High Street" }),
    ).toBe(false);
    expect(followerShown(source, leaf("country_is_none_of", ["UK"]), { country: "GB" })).toBe(
      false,
    );
    expect(followerShown(source, leaf("is_answered"), { line1: "10 High Street" })).toBe(true);
    expect(followerShown(source, leaf("is_answered"), undefined)).toBe(false);
    expect(followerShown(source, leaf("is_not_answered"), undefined)).toBe(true);
    expect(followerShown(source, leaf("is_not_answered"), { country: "GB" })).toBe(false);
    const hidden = address(1, linesOf({ country: setting(false) }));
    expect(followerShown(hidden, leaf("country_is_any_of", ["GB"]), { country: "GB" })).toBe(false);
  });
});
