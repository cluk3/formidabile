import { describe, expect, test } from "vite-plus/test";
import { interpretAnswers, pathOf, validateAnswers, type Answers } from "@fb/core/answers";
import {
  conditionOperators,
  parseDefinition,
  questionTypes,
  validateForPublish,
  type Condition,
  type FormDefinition,
  type Result,
} from "@fb/core/definition";

const id = "00000000-0000-4000-8000-000000000001";

const urlQuestion = (extra: object = {}) => ({
  id,
  label: "Website",
  required: true,
  type: "url",
  config: {},
  ...extra,
});

const withQuestion = (question: object) => ({
  format: 1 as const,
  title: "Links",
  questions: [question],
});

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

const structureIssues = (question: object) =>
  issuePaths(parseDefinition(withQuestion(question))).map((path) => path.slice(2));

const publishIssues = (question: object) =>
  issuePaths(validateForPublish(withQuestion(question), [])).map((path) => path.slice(2));

const parsed = (question: object = urlQuestion()) => {
  const result = parseDefinition(withQuestion(question));
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  if (result.value.format !== 1) throw new Error("expected format 1");
  return result.value;
};

const answer = questionTypes.url.answer();

const accepted = (value: string) => {
  const result = answer.safeParse(value);
  return result.success ? result.data : undefined;
};

describe("url", () => {
  test("structure: has no config", () => {
    expect(structureIssues(urlQuestion())).toEqual([]);
    expect(structureIssues(urlQuestion({ config: { placeholder: "https://" } }))).toEqual([
      ["config"],
    ]);
  });

  test("publish: needs a label", () => {
    expect(publishIssues(urlQuestion())).toEqual([]);
    expect(publishIssues(urlQuestion({ label: "  " }))).toEqual([["label"]]);
  });

  test("an answer is a trimmed http or https URL with a host, stored as typed", () => {
    expect(accepted("https://example.com")).toBe("https://example.com");
    expect(accepted("http://example.com")).toBe("http://example.com");
    expect(accepted("  HTTPS://Example.COM/Path  ")).toBe("HTTPS://Example.COM/Path");
    expect(accepted("https://example.com/a/b")).toBe("https://example.com/a/b");
    expect(accepted("http://localhost")).toBe("http://localhost");
    expect(accepted("http://127.0.0.1:8080/a")).toBe("http://127.0.0.1:8080/a");
    expect(accepted("http://[::1]/")).toBe("http://[::1]/");
    expect(accepted("https://user:pass@example.com/a?q=1#h")).toBe(
      "https://user:pass@example.com/a?q=1#h",
    );
    expect(accepted("http:///path")).toBe("http:///path");
    expect(accepted("https://münchen.de/ä")).toBe("https://münchen.de/ä");

    expect(accepted("example.com")).toBeUndefined();
    expect(accepted("ftp://example.com")).toBeUndefined();
    expect(accepted("javascript:alert(1)")).toBeUndefined();
    expect(accepted("mailto:ada@example.com")).toBeUndefined();
    expect(accepted("http://")).toBeUndefined();
    expect(accepted("https://")).toBeUndefined();
    expect(accepted("http:example.com")).toBeUndefined();
    expect(accepted("https:/example.com")).toBeUndefined();
    expect(accepted("http://?q=1")).toBeUndefined();
    expect(accepted("")).toBeUndefined();
    expect(accepted("   ")).toBeUndefined();
    expect(accepted("https://exa\tmple.com")).toBeUndefined();
  });

  test("an answer is at most 2,048 code points", () => {
    const prefix = "https://example.com/";
    const room = 2048 - Array.from(prefix).length;
    const within = prefix + "a".repeat(room);
    const withEmoji = prefix + "😀" + "a".repeat(room - 1);
    expect(Array.from(within).length).toBe(2048);
    expect(Array.from(withEmoji).length).toBe(2048);
    expect(withEmoji.length).toBe(2049);
    expect(accepted(within)).toBe(within);
    expect(accepted(withEmoji)).toBe(withEmoji);
    expect(accepted(within + "a")).toBeUndefined();
  });

  test("validateAnswers trims and keeps the typed URL", () => {
    const result = validateAnswers(parsed(), { [id]: "  https://Example.COM/a  " });
    expect(result).toEqual({ ok: true, value: { [id]: "https://Example.COM/a" } });
  });

  test("display is the URL text", () => {
    const definition = parsed(urlQuestion({ required: false }));
    const shown = interpretAnswers(definition, { [id]: "https://Example.COM/a" }, [id]);
    expect(shown).toEqual([
      {
        question: definition.questions[0],
        status: "answered",
        answer: { value: "https://Example.COM/a", display: "https://Example.COM/a" },
      },
    ]);
  });
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pageId = (n: number) => uuid(100 + n);

const leaf = (questionId: string, operator: string, constant?: string): Condition => ({
  questionId,
  operator,
  ...(constant === undefined ? {} : { constant }),
});

const form = (questions: object[]): FormDefinition => {
  const result = parseDefinition({
    format: 2,
    title: "Links",
    pages: [
      { id: pageId(1), questions: [questions[0]], jumps: [] },
      { id: pageId(2), questions: [questions[1]], jumps: [] },
    ],
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const followerShown = (condition: Condition, value?: string) => {
  const definition = form([
    { id: uuid(1), type: "url", label: "Website", required: false, config: {} },
    {
      id: uuid(2),
      type: "url",
      label: "Follow up",
      required: false,
      config: {},
      showCondition: condition,
    },
  ]);
  const answers: Answers = value === undefined ? {} : { [uuid(1)]: value };
  return pathOf(definition, answers).questions.some((question) => question.id === uuid(2));
};

describe("url conditions", () => {
  test("offer the text operators, compared like text", () => {
    expect(conditionOperators.url.map((operator) => operator.id)).toEqual([
      "equals",
      "does_not_equal",
      "contains",
      "does_not_contain",
      "is_answered",
      "is_not_answered",
    ]);

    const site = "HTTPS://Example.COM/docs";
    expect(followerShown(leaf(uuid(1), "equals", "https://example.com/docs"), site)).toBe(true);
    expect(followerShown(leaf(uuid(1), "equals", "https://other.example"), site)).toBe(false);
    expect(followerShown(leaf(uuid(1), "does_not_equal", "https://other.example"), site)).toBe(
      true,
    );
    expect(followerShown(leaf(uuid(1), "contains", "example.com"), site)).toBe(true);
    expect(followerShown(leaf(uuid(1), "contains", "missing"), site)).toBe(false);
    expect(followerShown(leaf(uuid(1), "does_not_contain", "missing"), site)).toBe(true);
    expect(followerShown(leaf(uuid(1), "is_answered"), site)).toBe(true);
    expect(followerShown(leaf(uuid(1), "is_not_answered"), site)).toBe(false);
    expect(followerShown(leaf(uuid(1), "equals", "https://example.com"))).toBe(false);
    expect(followerShown(leaf(uuid(1), "is_not_answered"))).toBe(true);
    expect(followerShown(leaf(uuid(1), "is_answered"))).toBe(false);
  });
});
