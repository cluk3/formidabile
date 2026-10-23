import * as z from "zod/mini";
import { base, nonEmptyLabel, type QuestionType } from "../question-type.ts";
import { optionIssues } from "./choice-options.ts";
import { matrixAnswer, matrixDisplay, MatrixColumns, MatrixRows, rowIssues } from "./matrix.ts";

const snapshot = z.strictObject({
  ...base,
  type: z.literal("single_choice_matrix"),
  config: z.strictObject({
    rows: MatrixRows,
    columns: MatrixColumns,
  }),
});

type Snapshot = z.output<typeof snapshot>;

/** One column per row. Columns need the same minimum as a single-choice question. */
export const singleChoiceMatrix = {
  snapshot,
  answer: (question) =>
    matrixAnswer(question.config.rows, question.config.columns, question.required, false),
  publishIssues: (question) => [
    ...nonEmptyLabel(question),
    ...rowIssues(question.config.rows),
    ...optionIssues(question.config.columns, 2, "columns"),
  ],
  display: (question, answer) =>
    matrixDisplay(question.config.rows, question.config.columns, answer),
} satisfies QuestionType<Snapshot, Record<string, string>>;
