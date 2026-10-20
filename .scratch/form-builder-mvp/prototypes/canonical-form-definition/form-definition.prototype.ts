/**
 * PROTOTYPE, throwaway. Wayfinder ticket "Canonical form definition model"
 * (.scratch/form-builder-mvp/issues/08-canonical-form-definition-model.md).
 *
 * Question: what shape does the canonical form definition take, so that the builder, the renderer
 * and submission validation share one model (ADR 0001 §4, §6), and how is the answer schema for one
 * form version derived from it?
 *
 * This file is the liftable part: pure `zod/mini`, no DOM, no Effect, no I/O. The walkthrough next to
 * it is the throwaway shell.
 */
import * as z from "zod/mini";

z.config(z.locales.en());

export type Issue = { path: PropertyKey[]; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

const toIssues = (error: z.core.$ZodError): Issue[] =>
  error.issues.map((i) => ({ path: i.path, message: i.message }));

// ---------------------------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------------------------

/** Question identity: minted by the builder, kept across versions while the question keeps its meaning. */
const QuestionId = z.uuid();

/** Trimmed text that may be empty while drafting; publish rules require it to be non-empty. */
const DraftText = (max: number) => z.string().check(z.trim(), z.maxLength(max));

const base = {
  id: QuestionId,
  label: DraftText(500),
  description: z.optional(DraftText(2000)),
  required: z.boolean(),
};

/** Option value: minted by the builder, never derived from the label, stable across versions. */
const ChoiceOption = z.strictObject({
  value: z.string().check(z.minLength(1), z.maxLength(64)),
  label: DraftText(200),
});
export type ChoiceOption = z.output<typeof ChoiceOption>;

const OPTIONS_CAP = 100;

const Count = z.int().check(z.gte(1), z.lte(OPTIONS_CAP));

// ---------------------------------------------------------------------------------------------
// Question types. One module per type: snapshot schema, answer schema builder, publish rules,
// and how an answer reads back in a historical view. Adding a type = one module + one line in
// `QuestionSnapshot` and `questionTypes`; answers, storage and the response API don't change.
// ---------------------------------------------------------------------------------------------

type QuestionType<Q> = {
  /** Zod schema for one answer to `q`, when answered. Optionality is applied by the caller. */
  answer: (q: Q) => z.ZodMiniType;
  /** Completeness rules enforced at publish, beyond the structural schema. Paths are relative to the question. */
  publishIssues: (q: Q) => Issue[];
  /** A stored answer, shown using this version's snapshot. */
  display: (q: Q, answer: never) => string;
};

const TEXT_CAP = 10_000;

const Text = z.strictObject({
  ...base,
  type: z.literal("text"),
  config: z.strictObject({
    maxLength: z.optional(z.int().check(z.gte(1), z.lte(TEXT_CAP))),
    /** Presentation only, like the single-choice display. */
    display: z.enum(["single_line", "multi_line"]),
  }),
});

const Email = z.strictObject({
  ...base,
  type: z.literal("email"),
  config: z.strictObject({}),
});

const NumberQ = z.strictObject({
  ...base,
  type: z.literal("number"),
  config: z.strictObject({
    integer: z.boolean(),
    min: z.optional(z.number()),
    max: z.optional(z.number()),
  }),
});

const DateQ = z.strictObject({
  ...base,
  type: z.literal("date"),
  config: z.strictObject({
    min: z.optional(z.iso.date()),
    max: z.optional(z.iso.date()),
  }),
});

const SingleChoice = z.strictObject({
  ...base,
  type: z.literal("single_choice"),
  config: z.strictObject({
    options: z.array(ChoiceOption).check(z.maxLength(OPTIONS_CAP)),
    /** Presentation only: switching keeps the question identity and its analytics. */
    display: z.enum(["radio", "dropdown"]),
  }),
});

const MultipleChoice = z.strictObject({
  ...base,
  type: z.literal("multiple_choice"),
  config: z.strictObject({
    options: z.array(ChoiceOption).check(z.maxLength(OPTIONS_CAP)),
    minSelected: z.optional(Count),
    maxSelected: z.optional(Count),
  }),
});

const BooleanQ = z.strictObject({
  ...base,
  type: z.literal("boolean"),
  config: z.strictObject({}),
});

export const QuestionSnapshot = z.discriminatedUnion("type", [
  Text,
  Email,
  NumberQ,
  DateQ,
  SingleChoice,
  MultipleChoice,
  BooleanQ,
]);
export type QuestionSnapshot = z.output<typeof QuestionSnapshot>;
export type QuestionTypeName = QuestionSnapshot["type"];
type Of<T extends QuestionTypeName> = Extract<QuestionSnapshot, { type: T }>;

const nonEmptyLabel = (q: { label: string }): Issue[] =>
  q.label === ""
    ? [
        {
          path: ["label"],
          message: "A question needs a label before publishing",
        },
      ]
    : [];

const rangeIssue = <T extends number | string>(
  min: T | undefined,
  max: T | undefined,
  path: PropertyKey[],
): Issue[] =>
  min !== undefined && max !== undefined && min > max
    ? [{ path, message: "Minimum is greater than maximum" }]
    : [];

const optionIssues = (options: ChoiceOption[], atLeast: number): Issue[] => {
  const issues: Issue[] = [];
  if (options.length < atLeast)
    issues.push({
      path: ["config", "options"],
      message: `Needs at least ${atLeast} option(s)`,
    });
  const labels = new Set<string>();
  options.forEach((o, i) => {
    if (o.label === "")
      issues.push({
        path: ["config", "options", i, "label"],
        message: "Option needs a label",
      });
    else if (labels.has(o.label))
      issues.push({
        path: ["config", "options", i, "label"],
        message: "Two options share this label",
      });
    labels.add(o.label);
  });
  return issues;
};

const optionEnum = (options: ChoiceOption[]) =>
  z.enum(options.map((o) => o.value) as [string, ...string[]]);

const optionLabel = (options: ChoiceOption[], value: string) =>
  options.find((o) => o.value === value)?.label ?? `<unknown option ${value}>`;

export const questionTypes: { [T in QuestionTypeName]: QuestionType<Of<T>> } = {
  text: {
    answer: (q) =>
      z
        .string()
        .check(
          z.trim(),
          z.minLength(1),
          z.maxLength(q.config.maxLength ?? TEXT_CAP),
        ),
    publishIssues: nonEmptyLabel,
    display: (_q, a: string) => a,
  },
  email: {
    answer: () => z.email(),
    publishIssues: nonEmptyLabel,
    display: (_q, a: string) => a,
  },
  number: {
    answer: (q) => {
      const { min, max, integer } = q.config;
      const checks = [
        ...(min === undefined ? [] : [z.gte(min)]),
        ...(max === undefined ? [] : [z.lte(max)]),
      ];
      return (integer ? z.int() : z.number()).check(...checks);
    },
    publishIssues: (q) => {
      const { min, max, integer } = q.config;
      const issues = [
        ...nonEmptyLabel(q),
        ...rangeIssue(min, max, ["config", "max"]),
      ];
      if (integer)
        for (const [key, bound] of [
          ["min", min],
          ["max", max],
        ] as const)
          if (bound !== undefined && !Number.isInteger(bound))
            issues.push({
              path: ["config", key],
              message:
                "Must be a whole number when only whole numbers are accepted",
            });
      return issues;
    },
    display: (_q, a: number) => String(a),
  },
  date: {
    answer: (q) => {
      const { min, max } = q.config;
      return z.iso.date().check(
        z.refine((d) => min === undefined || d >= min, {
          message: `Must be on or after ${min}`,
        }),
        z.refine((d) => max === undefined || d <= max, {
          message: `Must be on or before ${max}`,
        }),
      );
    },
    publishIssues: (q) => [
      ...nonEmptyLabel(q),
      ...rangeIssue(q.config.min, q.config.max, ["config", "max"]),
    ],
    display: (_q, a: string) => a,
  },
  single_choice: {
    answer: (q) => optionEnum(q.config.options),
    publishIssues: (q) => [
      ...nonEmptyLabel(q),
      ...optionIssues(q.config.options, 2),
    ],
    display: (q, a: string) => optionLabel(q.config.options, a),
  },
  multiple_choice: {
    answer: (q) => {
      const { options, minSelected, maxSelected } = q.config;
      return z.array(optionEnum(options)).check(
        z.minLength(minSelected ?? 1),
        z.maxLength(maxSelected ?? options.length),
        z.refine((vs) => new Set(vs).size === vs.length, {
          message: "An option was selected twice",
        }),
      );
    },
    publishIssues: (q) => {
      const { options, minSelected, maxSelected } = q.config;
      const issues = [...nonEmptyLabel(q), ...optionIssues(options, 1)];
      issues.push(
        ...rangeIssue(minSelected, maxSelected, ["config", "maxSelected"]),
      );
      for (const [key, count] of [
        ["minSelected", minSelected],
        ["maxSelected", maxSelected],
      ] as const)
        if (count !== undefined && count > options.length)
          issues.push({
            path: ["config", key],
            message: "More than the number of options",
          });
      return issues;
    },
    display: (q, a: string[]) =>
      a.map((v) => optionLabel(q.config.options, v)).join(", "),
  },
  boolean: {
    answer: () => z.boolean(),
    publishIssues: nonEmptyLabel,
    display: (_q, a: boolean) => (a ? "Yes" : "No"),
  },
};

const typeOf = (q: QuestionSnapshot) =>
  questionTypes[q.type] as QuestionType<QuestionSnapshot>;

// ---------------------------------------------------------------------------------------------
// The canonical form definition: the content of a draft and of a form version. Same type for both.
// ---------------------------------------------------------------------------------------------

export const FormDefinition = z
  .strictObject({
    /** Definition format; published versions are never rewritten, so readers accept every format ever written. */
    format: z.literal(1),
    title: DraftText(200),
    description: z.optional(DraftText(5000)),
    /** Array order is display order. */
    questions: z.array(QuestionSnapshot).check(z.maxLength(200)),
  })
  .check(
    z.superRefine((def, ctx) => {
      const ids = new Set<string>();
      def.questions.forEach((q, i) => {
        if (ids.has(q.id))
          ctx.issues.push({
            code: "custom",
            input: q.id,
            path: ["questions", i, "id"],
            message: "Duplicate question identity",
          });
        ids.add(q.id);
        if (q.type !== "single_choice" && q.type !== "multiple_choice") return;
        const values = new Set<string>();
        q.config.options.forEach((o, j) => {
          if (values.has(o.value))
            ctx.issues.push({
              code: "custom",
              input: o.value,
              path: ["questions", i, "config", "options", j, "value"],
              message: "Duplicate option value",
            });
          values.add(o.value);
        });
      });
    }),
  );
export type FormDefinition = z.output<typeof FormDefinition>;

/**
 * Draft save, and reading any stored definition back: structural rules only. Publish rules are not
 * re-run on read, so tightening them later never makes a stored version unreadable.
 */
export const parseDefinition = (input: unknown): Result<FormDefinition> => {
  const r = FormDefinition.safeParse(input);
  return r.success
    ? { ok: true, value: r.data }
    : { ok: false, issues: toIssues(r.error) };
};

/**
 * Publish: structural rules, then completeness rules, then rules against the form's history.
 * Every problem is reported at once.
 */
export const validateForPublish = (
  input: unknown,
  priorVersions: FormDefinition[],
): Result<FormDefinition> => {
  const parsed = parseDefinition(input);
  if (!parsed.ok) return parsed;
  const def = parsed.value;
  const issues: Issue[] = [];
  if (def.title === "")
    issues.push({
      path: ["title"],
      message: "A form needs a title before publishing",
    });
  if (def.questions.length === 0)
    issues.push({
      path: ["questions"],
      message: "A form needs at least one question",
    });

  const historicalType = new Map<string, QuestionTypeName>();
  for (const v of priorVersions)
    for (const q of v.questions) historicalType.set(q.id, q.type);

  def.questions.forEach((q, i) => {
    for (const issue of typeOf(q).publishIssues(q))
      issues.push({ ...issue, path: ["questions", i, ...issue.path] });
    const was = historicalType.get(q.id);
    if (was !== undefined && was !== q.type)
      issues.push({
        path: ["questions", i, "type"],
        message: `This question was "${was}" in an earlier version; a different type needs a new question identity`,
      });
  });
  return issues.length === 0 ? { ok: true, value: def } : { ok: false, issues };
};

// ---------------------------------------------------------------------------------------------
// Answers. A response's answers are a JSON object keyed by question identity; an unanswered optional
// question has no key. Values are untagged: the response's form version says how to read them.
// ---------------------------------------------------------------------------------------------

export type AnswerValue = string | number | boolean | string[];
export type Answers = Record<string, AnswerValue>;

/** Strict schema for one form version's answers. Build once per version and cache. */
export const buildAnswerSchema = (def: FormDefinition) =>
  z.strictObject(
    Object.fromEntries(
      def.questions.map((q) => {
        const answer = typeOf(q).answer(q);
        return [q.id, q.required ? answer : z.optional(answer)];
      }),
    ),
  );

/** Loose "any answers" shape: documents the request body in OpenAPI; the per-version schema does the real check. */
export const AnyAnswers = z.record(
  z.uuid(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
);

export const validateAnswers = (
  def: FormDefinition,
  input: unknown,
): Result<Answers> => {
  const r = buildAnswerSchema(def).safeParse(input);
  return r.success
    ? { ok: true, value: r.data as Answers }
    : { ok: false, issues: toIssues(r.error) };
};

export type InterpretedAnswer = {
  questionId: string;
  label: string;
  type: QuestionTypeName;
  answer: string | null;
};

/** Historical view (ADR 0001 §8.1): every question of the response's own version, in its order. */
export const interpretAnswers = (
  def: FormDefinition,
  answers: Answers,
): InterpretedAnswer[] =>
  def.questions.map((q) => {
    const a = answers[q.id];
    return {
      questionId: q.id,
      label: q.label,
      type: q.type,
      answer: a === undefined ? null : typeOf(q).display(q, a as never),
    };
  });
