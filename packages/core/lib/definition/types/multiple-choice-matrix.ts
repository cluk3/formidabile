import * as z from "zod/mini";
import { base, nonEmptyLabel, type QuestionType } from "../question-type.ts";
import { optionIssues } from "./choice-options.ts";
import { matrixAnswer, matrixDisplay, MatrixColumns, MatrixRows, rowIssues } from "./matrix.ts";

const snapshot = z.strictObject({
  ...base,
  type: z.literal("multiple_choice_matrix"),
  config: z.strictObject({
    rows: MatrixRows,
    columns: MatrixColumns,
  }),
});

type Snapshot = z.output<typeof snapshot>;

/**
 * A list of columns per row. There is no per-row selection count: an answered row names at least one
 * column. Columns need the same minimum as a multiple-choice question.
 */
export const multipleChoiceMatrix = {
  snapshot,
  answer: (question) =>
    matrixAnswer(question.config.rows, question.config.columns, question.required, true),
  publishIssues: (question) => [
    ...nonEmptyLabel(question),
    ...rowIssues(question.config.rows),
    ...optionIssues(question.config.columns, 1, "columns"),
  ],
  display: (question, answer) =>
    matrixDisplay(question.config.rows, question.config.columns, answer),
} satisfies QuestionType<Snapshot, Record<string, string[]>>;
