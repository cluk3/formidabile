import * as z from "zod/mini";
import { DraftText, type Issue } from "../question-type.ts";
import { ChoiceOptions, optionLabel } from "./choice-options.ts";

/** ADR-018. A matrix has at most this many rows. */
export const ROWS_CAP = 50;
/** ADR-018. Columns use the option model, capped tighter than a choice question. */
export const COLUMNS_CAP = 12;

const Row = z.strictObject({
  value: z.string().check(z.minLength(1), z.maxLength(64)),
  label: DraftText(200),
});

/** Builder-minted row values, unique, at most {@link ROWS_CAP}. Fewer than one is a publish rule. */
export const MatrixRows = z.array(Row).check(
  z.maxLength(ROWS_CAP),
  z.superRefine((rows, ctx) => {
    const values = new Set<string>();
    rows.forEach((row, i) => {
      if (values.has(row.value))
        ctx.issues.push({
          code: "custom",
          input: row.value,
          path: [i, "value"],
          message: "Duplicate row value",
        });
      values.add(row.value);
    });
  }),
);

/** Columns are options, at most {@link COLUMNS_CAP}. */
export const MatrixColumns = ChoiceOptions.check(z.maxLength(COLUMNS_CAP));

type RowLike = { readonly value: string; readonly label: string };
type ColumnLike = { readonly value: string; readonly label: string };

/** A row needs its own non-empty label. None is not a matrix. */
export const rowIssues = (rows: readonly { readonly label: string }[]): Issue[] => {
  const issues: Issue[] = [];
  if (rows.length < 1) issues.push({ path: ["config", "rows"], message: "Needs at least one row" });
  const labels = new Set<string>();
  rows.forEach((row, i) => {
    const path = ["config", "rows", i, "label"];
    if (row.label === "") issues.push({ path, message: "A row needs a label" });
    else if (labels.has(row.label)) issues.push({ path, message: "Two rows share this label" });
    labels.add(row.label);
  });
  return issues;
};

const oneOf = (values: readonly string[]) => {
  const [first, ...rest] = values;
  if (first === undefined)
    return z.string().check(z.refine(() => false, "This matrix has no columns"));
  return z.enum([first, ...rest]);
};

const cannotAnswer = z
  .strictObject({})
  .check(z.refine(() => false, "This matrix cannot be answered"));

/**
 * One matrix answer: an object keyed by row value. A required matrix names every row. An optional one
 * names any non-empty subset. A multiple-choice cell is a non-empty list of column values.
 */
export const matrixAnswer = (
  rows: readonly { readonly value: string }[],
  columns: readonly { readonly value: string }[],
  required: boolean,
  multiple: boolean,
) => {
  if (rows.length === 0) return cannotAnswer;
  const column = oneOf(columns.map((item) => item.value));
  const cell = multiple
    ? z.array(column).check(
        z.minLength(1),
        z.maxLength(Math.max(columns.length, 1)),
        z.refine(
          (values) => new Set(values).size === values.length,
          "An option was selected twice",
        ),
      )
    : column;
  const object = z.strictObject(
    Object.fromEntries(rows.map((row) => [row.value, required ? cell : z.exactOptional(cell)])),
  );
  if (required) return object;
  return object.check(
    z.refine((answer) => Object.keys(answer).length > 0, "A matrix answer needs a row"),
  );
};

/** Rows in definition order. An unanswered row is left out. */
export const matrixDisplay = (
  rows: readonly RowLike[],
  columns: readonly ColumnLike[],
  answer: Readonly<Record<string, string | readonly string[] | undefined>>,
): string =>
  rows
    .flatMap((row) => {
      const cell = answer[row.value];
      if (cell === undefined) return [];
      const chosen = new Set(typeof cell === "string" ? [cell] : cell);
      const values = columns.map((column) => column.value).filter((value) => chosen.has(value));
      if (values.length === 0) return [];
      return [`${row.label}: ${values.map((value) => optionLabel(columns, value)).join(", ")}`];
    })
    .join("; ");
