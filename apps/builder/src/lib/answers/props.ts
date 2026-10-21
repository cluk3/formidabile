import type { QuestionSnapshotOf, QuestionTypeName } from "@fb/core/definition";

/** The value each question type's answer schema accepts. */
type AnswerValue = {
  text: string;
  email: string;
  number: number;
  date: string;
  single_choice: string;
  multiple_choice: string[];
  boolean: boolean;
};

/** What a question type's answer display gets: `interpretAnswers`'s question snapshot, raw value and display text. */
export type AnswerProps<T extends QuestionTypeName> = {
  question: QuestionSnapshotOf<T>;
  value: AnswerValue[T];
  display: string;
};
