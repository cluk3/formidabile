import type { QuestionSnapshot } from "@fb/core/definition";

/** What a question type's editor gets: its question, and the edits it may make to that question's config. */
export type EditorProps<Q extends QuestionSnapshot> = {
  question: Q;
  /**
   * Replaces the question's config. `required`, when passed, is set in the same edit, so a constraint
   * such as must-be-yes can make the question required.
   */
  setConfig(config: Q["config"], required?: boolean): void;
  /** Choice questions only: core's `addOption`, which mints the option's value. */
  addOption(): void;
  /** Choice questions only: core's `removeOption`. */
  removeOption(value: string): void;
};
