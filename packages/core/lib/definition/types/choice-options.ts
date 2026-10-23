import * as z from "zod/mini";
import { DraftText, type Issue } from "../question-type.ts";

export const OPTIONS_CAP = 100;

/** An option value is minted by the builder, never derived from the label, and stable across versions. */
const ChoiceOption = z.strictObject({
  value: z.string().check(z.minLength(1), z.maxLength(64)),
  label: DraftText(200),
});
type ChoiceOption = z.output<typeof ChoiceOption>;

export const ChoiceOptions = z.array(ChoiceOption).check(
  z.maxLength(OPTIONS_CAP),
  z.superRefine((options, ctx) => {
    const values = new Set<string>();
    options.forEach((option, i) => {
      if (values.has(option.value))
        ctx.issues.push({
          code: "custom",
          input: option.value,
          path: [i, "value"],
          message: "Duplicate option value",
        });
      values.add(option.value);
    });
  }),
);

export const optionIssues = (
  options: ChoiceOption[],
  atLeast: number,
  key = "options",
): Issue[] => {
  const issues: Issue[] = [];
  if (options.length < atLeast)
    issues.push({
      path: ["config", key],
      message: atLeast === 1 ? "Needs at least one option" : `Needs at least ${atLeast} options`,
    });
  const labels = new Set<string>();
  options.forEach((option, i) => {
    const path = ["config", key, i, "label"];
    if (option.label === "") issues.push({ path, message: "An option needs a label" });
    else if (labels.has(option.label))
      issues.push({ path, message: "Two options share this label" });
    labels.add(option.label);
  });
  return issues;
};

export const optionValue = (options: ChoiceOption[]) =>
  z.enum(options.map((option) => option.value) as [string, ...string[]]);

export const optionLabel = (
  options: readonly { readonly value: string; readonly label: string }[],
  value: string,
) => options.find((option) => option.value === value)?.label ?? `<unknown option ${value}>`;
