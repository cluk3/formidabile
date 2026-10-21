import type { QuestionSnapshot } from "@fb/core/definition";

/** What a question type's editor gets: its question, and the edits it may make to that question's config. */
export type EditorProps<Q extends QuestionSnapshot> = {
  question: Q;
  setConfig(config: Q["config"]): void;
  /** Choice questions only: core's `addOption`, which mints the option's value. */
  addOption(): void;
  /** Choice questions only: core's `removeOption`. */
  removeOption(value: string): void;
};
