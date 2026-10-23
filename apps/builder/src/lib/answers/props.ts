import type { AddressLine, QuestionSnapshotOf, QuestionTypeName } from "@fb/core/definition";

/** The value each question type's answer schema accepts. */
type AnswerValue = {
  text: string;
  email: string;
  number: number;
  date: string;
  single_choice: string;
  multiple_choice: string[];
  boolean: boolean;
  ranking: string[];
  phone: string;
  url: string;
  time_of_day: string;
  date_time: string;
  date_range: { start: string; end: string };
  address: { [K in AddressLine]?: string };
  single_choice_matrix: Record<string, string>;
  multiple_choice_matrix: Record<string, string[]>;
};

/** What a question type's answer display gets: `interpretAnswers`'s question snapshot, raw value and display text. */
export type AnswerProps<T extends QuestionTypeName> = {
  question: QuestionSnapshotOf<T>;
  value: AnswerValue[T];
  display: string;
};
