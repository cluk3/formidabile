import { phoneOperators } from "./types/phone.ts";

/** What a leaf compares an answer with. `date` is an ISO calendar day; `time` is `HH:MM`; `strings` is an option-value list. */
export type ConstantKind = "none" | "string" | "number" | "date" | "time" | "strings";

/**
 * One operator a question type accepts. A later question type registers its row by appending one entry
 * to {@link conditionOperators}; `matches` is only called when the question was answered.
 */
export type ConditionOperator = {
  readonly id: string;
  readonly constant: ConstantKind;
  /** Each constant string must be an option value of the referenced question. */
  readonly options?: boolean;
  /** Set by a matrix operator. A `row` on any other type is rejected at publish. */
  readonly row?: boolean;
  matches(answer: unknown, constant: unknown): boolean;
};

const define = (
  id: string,
  constant: ConstantKind,
  matches: ConditionOperator["matches"],
  options = false,
): ConditionOperator => ({
  id,
  constant,
  ...(options ? { options: true } : {}),
  matches,
});

/** NFC, trim, then locale-independent lowercase. `toLowerCase` ignores the runtime locale (ADR-017). */
const fold = (value: unknown): string | undefined =>
  typeof value === "string" ? value.normalize("NFC").trim().toLowerCase() : undefined;

const textIs =
  (compare: (answer: string, constant: string) => boolean) =>
  (answer: unknown, constant: unknown) => {
    const left = fold(answer);
    const right = fold(constant);
    return left !== undefined && right !== undefined && compare(left, right);
  };

const textOperators = [
  define(
    "equals",
    "string",
    textIs((answer, constant) => answer === constant),
  ),
  define(
    "does_not_equal",
    "string",
    textIs((answer, constant) => answer !== constant),
  ),
  define(
    "contains",
    "string",
    textIs((answer, constant) => answer.includes(constant)),
  ),
  define(
    "does_not_contain",
    "string",
    textIs((answer, constant) => !answer.includes(constant)),
  ),
];

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const numberIs =
  (compare: (answer: number, constant: number) => boolean) =>
  (answer: unknown, constant: unknown) =>
    finite(answer) && finite(constant) && compare(answer, constant);

const numberOperators = [
  define(
    "equal",
    "number",
    numberIs((answer, constant) => answer === constant),
  ),
  define(
    "not_equal",
    "number",
    numberIs((answer, constant) => answer !== constant),
  ),
  define(
    "less_than",
    "number",
    numberIs((answer, constant) => answer < constant),
  ),
  define(
    "at_most",
    "number",
    numberIs((answer, constant) => answer <= constant),
  ),
  define(
    "greater_than",
    "number",
    numberIs((answer, constant) => answer > constant),
  ),
  define(
    "at_least",
    "number",
    numberIs((answer, constant) => answer >= constant),
  ),
];

/** A real calendar day, zero-padded, compared as text so no time zone is involved. */
export const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const dateIs =
  (compare: (answer: string, constant: string) => boolean) =>
  (answer: unknown, constant: unknown) =>
    isIsoDate(answer) && isIsoDate(constant) && compare(answer, constant);

const dateOperators = [
  define(
    "is_on",
    "date",
    dateIs((answer, constant) => answer === constant),
  ),
  define(
    "is_before",
    "date",
    dateIs((answer, constant) => answer < constant),
  ),
  define(
    "is_after",
    "date",
    dateIs((answer, constant) => answer > constant),
  ),
];

/** `HH:MM` on a 24-hour clock, zero-padded, with no seconds, so it compares as text. */
const isTimeOfDay = (value: unknown): value is string =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

const timeIs =
  (compare: (answer: string, constant: string) => boolean) =>
  (answer: unknown, constant: unknown) =>
    isTimeOfDay(answer) && isTimeOfDay(constant) && compare(answer, constant);

const timeOperators = [
  define(
    "is_at",
    "time",
    timeIs((answer, constant) => answer === constant),
  ),
  define(
    "is_before",
    "time",
    timeIs((answer, constant) => answer < constant),
  ),
  define(
    "is_after",
    "time",
    timeIs((answer, constant) => answer > constant),
  ),
];

const stringList = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;

const singleOperators = [
  define(
    "is_any_of",
    "strings",
    (answer, constant) => {
      const values = stringList(constant);
      return typeof answer === "string" && values !== undefined && values.includes(answer);
    },
    true,
  ),
  define(
    "is_none_of",
    "strings",
    (answer, constant) => {
      const values = stringList(constant);
      return typeof answer === "string" && values !== undefined && !values.includes(answer);
    },
    true,
  ),
];

const selected = (
  answer: unknown,
  constant: unknown,
): { answer: string[]; constant: string[] } | undefined => {
  const chosen = stringList(answer);
  const values = stringList(constant);
  return chosen === undefined || values === undefined
    ? undefined
    : { answer: chosen, constant: values };
};

const multipleOperators = [
  define(
    "includes_any_of",
    "strings",
    (answer, constant) => {
      const lists = selected(answer, constant);
      return lists !== undefined && lists.constant.some((value) => lists.answer.includes(value));
    },
    true,
  ),
  define(
    "includes_all_of",
    "strings",
    (answer, constant) => {
      const lists = selected(answer, constant);
      return lists !== undefined && lists.constant.every((value) => lists.answer.includes(value));
    },
    true,
  ),
  define(
    "includes_none_of",
    "strings",
    (answer, constant) => {
      const lists = selected(answer, constant);
      return lists !== undefined && lists.constant.every((value) => !lists.answer.includes(value));
    },
    true,
  ),
];

const booleanOperators = [
  define("is_yes", "none", (answer) => answer === true),
  define("is_no", "none", (answer) => answer === false),
];

/** Present on every type. `matches` runs only after the evaluator has decided the question was answered. */
const presence = [
  define("is_answered", "none", () => true),
  define("is_not_answered", "none", () => false),
];

const withPresence = (operators: readonly ConditionOperator[]) => [...operators, ...presence];

/**
 * Operators keyed by question type. Adding a type appends one key; `form-definition.ts` checks the key
 * against `QuestionTypeName`, and the evaluator never switches on the type name itself.
 */
export const conditionOperators = {
  text: withPresence(textOperators),
  email: withPresence(textOperators),
  number: withPresence(numberOperators),
  date: withPresence(dateOperators),
  single_choice: withPresence(singleOperators),
  multiple_choice: withPresence(multipleOperators),
  boolean: withPresence(booleanOperators),
  phone: withPresence(phoneOperators),
  url: withPresence(textOperators),
  time_of_day: withPresence(timeOperators),
};

const operatorsFor = (type: string): readonly ConditionOperator[] =>
  Object.hasOwn(conditionOperators, type)
    ? conditionOperators[type as keyof typeof conditionOperators]
    : [];

export const operatorById = (type: string, id: string): ConditionOperator | undefined =>
  operatorsFor(type).find((operator) => operator.id === id);

/** A type has rows when one of its operators says so. No current type does. */
export const questionTypeHasRows = (type: string): boolean =>
  operatorsFor(type).some((operator) => operator.row === true);

const ANY_OF_CAP = 100;

export const constantFits = (operator: ConditionOperator, constant: unknown): boolean => {
  switch (operator.constant) {
    case "none":
      return constant === undefined;
    case "string":
      return typeof constant === "string";
    case "date":
      return isIsoDate(constant);
    case "time":
      return isTimeOfDay(constant);
    case "number":
      return finite(constant);
    case "strings":
      return (
        Array.isArray(constant) &&
        constant.length > 0 &&
        constant.length <= ANY_OF_CAP &&
        constant.every((value) => typeof value === "string")
      );
  }
};

export const optionValues = (config: unknown): ReadonlySet<string> => {
  if (typeof config !== "object" || config === null || !("options" in config)) return new Set();
  const { options } = config;
  if (!Array.isArray(options)) return new Set();
  const values = new Set<string>();
  for (const option of options) {
    if (
      typeof option === "object" &&
      option !== null &&
      "value" in option &&
      typeof option.value === "string"
    )
      values.add(option.value);
  }
  return values;
};
