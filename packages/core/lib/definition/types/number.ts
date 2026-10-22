import * as z from "zod/mini";
import {
  base,
  DraftText,
  nonEmptyLabel,
  rangeIssues,
  type Issue,
  type QuestionType,
} from "../question-type.ts";

/** End labels are short captions, not question prompts. */
const LABEL_CAP = 100;
/** The step check works in units of 0.0001, so a step has at most this many decimal places. */
const STEP_PLACES = 4;
const STEP_SCALE = 10_000;

const snapshot = z.strictObject({
  ...base,
  type: z.literal("number"),
  config: z.strictObject({
    integer: z.boolean(),
    min: z.optional(z.number()),
    max: z.optional(z.number()),
    /** Presentation only. Absent means a plain input, so a stored number question stays readable. */
    display: z.optional(z.enum(["input", "rating", "scale", "slider", "nps"])),
    /** A positive spacing between accepted values. Absent means any number in range. */
    step: z.optional(z.number()),
    minLabel: z.optional(DraftText(LABEL_CAP)),
    maxLabel: z.optional(DraftText(LABEL_CAP)),
  }),
});

type NumberQuestion = z.output<typeof snapshot>;

const decimalPlaces = (value: number): number => {
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  const text = Object.is(value, -0) ? "0" : value.toString().toLowerCase();
  const [mantissa, exponent = "0"] = text.split("e");
  const fraction = mantissa!.split(".")[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent));
};

/** The value in units of 0.0001, rounded, so a step comparison never depends on binary fractions. */
const scaledUnits = (value: number): bigint | undefined => {
  if (!Number.isFinite(value)) return undefined;
  let text: string;
  try {
    text = value.toFixed(STEP_PLACES);
  } catch {
    return undefined;
  }
  const negative = text.startsWith("-");
  const [whole, frac = ""] = text.slice(negative ? 1 : 0).split(".");
  const units =
    BigInt(whole!) * BigInt(STEP_SCALE) +
    BigInt(frac.padEnd(STEP_PLACES, "0").slice(0, STEP_PLACES));
  return negative ? -units : units;
};

/** `value` is `min + k * step`, or `k * step` when there is no minimum. */
const onStep = (value: number, min: number | undefined, step: number): boolean => {
  const sStep = scaledUnits(step);
  const sValue = scaledUnits(value);
  if (sStep === undefined || sValue === undefined || sStep <= 0n) return false;
  const origin = min === undefined ? 0n : scaledUnits(min);
  if (origin === undefined) return false;
  return (sValue - origin) % sStep === 0n;
};

const stepIssues = (integer: boolean, step: number | undefined): Issue[] => {
  if (step === undefined) return [];
  const issues: Issue[] = [];
  if (!(step > 0))
    issues.push({ path: ["config", "step"], message: "The step must be a positive number" });
  else if (decimalPlaces(step) > STEP_PLACES)
    issues.push({
      path: ["config", "step"],
      message: "The step has at most 4 decimal places",
    });
  if (integer && !Number.isInteger(step))
    issues.push({
      path: ["config", "step"],
      message: "The step must be a whole number when only whole numbers are accepted",
    });
  return issues;
};

const inWholeRange = (value: number | undefined, low: number, high: number) =>
  value !== undefined && Number.isInteger(value) && value >= low && value <= high;

const displayIssues = (config: NumberQuestion["config"]): Issue[] => {
  const { integer, min, max, step, minLabel, maxLabel } = config;
  const issues: Issue[] = [];
  switch (config.display) {
    case "rating":
      if (!integer)
        issues.push({
          path: ["config", "integer"],
          message: "A rating accepts whole numbers only",
        });
      if (min !== 1) issues.push({ path: ["config", "min"], message: "A rating starts at 1" });
      if (!inWholeRange(max, 3, 10))
        issues.push({
          path: ["config", "max"],
          message: "A rating ends on a whole number from 3 to 10",
        });
      break;
    case "scale":
      if (!integer)
        issues.push({ path: ["config", "integer"], message: "A scale accepts whole numbers only" });
      if (min !== 0 && min !== 1)
        issues.push({ path: ["config", "min"], message: "A scale starts at 0 or 1" });
      if (!inWholeRange(max, 2, 10))
        issues.push({
          path: ["config", "max"],
          message: "A scale ends on a whole number from 2 to 10",
        });
      break;
    case "slider":
      if (min === undefined)
        issues.push({ path: ["config", "min"], message: "A slider needs a minimum" });
      if (max === undefined)
        issues.push({ path: ["config", "max"], message: "A slider needs a maximum" });
      if (step === undefined)
        issues.push({ path: ["config", "step"], message: "A slider needs a step" });
      break;
    case "nps":
      if (!integer)
        issues.push({ path: ["config", "integer"], message: "NPS accepts whole numbers only" });
      if (min !== 0) issues.push({ path: ["config", "min"], message: "NPS starts at 0" });
      if (max !== 10) issues.push({ path: ["config", "max"], message: "NPS ends at 10" });
      if (minLabel === undefined || minLabel === "")
        issues.push({ path: ["config", "minLabel"], message: "NPS needs a label at the low end" });
      if (maxLabel === undefined || maxLabel === "")
        issues.push({
          path: ["config", "maxLabel"],
          message: "NPS needs a label at the high end",
        });
      break;
    default:
      break;
  }
  return issues;
};

export const number = {
  snapshot,
  answer: (q) => {
    const { integer, min, max, step } = q.config;
    return (integer ? z.int() : z.number()).check(
      ...(min === undefined ? [] : [z.gte(min)]),
      ...(max === undefined ? [] : [z.lte(max)]),
      ...(step === undefined
        ? []
        : [
            z.refine(
              (value) => typeof value === "number" && onStep(value, min, step),
              "Must fall on a step",
            ),
          ]),
    );
  },
  publishIssues: (q) => {
    const { integer, min, max, step } = q.config;
    const issues: Issue[] = [...nonEmptyLabel(q)];
    if (integer)
      for (const [key, bound] of [
        ["min", min],
        ["max", max],
      ] as const)
        if (bound !== undefined && !Number.isInteger(bound))
          issues.push({
            path: ["config", key],
            message: "Must be a whole number when only whole numbers are accepted",
          });
    issues.push(...rangeIssues(min, max), ...displayIssues(q.config), ...stepIssues(integer, step));
    return issues;
  },
  display: (_q, answer) => String(answer),
} satisfies QuestionType<NumberQuestion, number>;
