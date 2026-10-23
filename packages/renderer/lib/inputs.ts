import type { QuestionSnapshotOf, QuestionTypeName } from "@fb/core/definition";
import type { Component } from "svelte";
import type { DraftOf } from "./drafts.ts";
import BooleanInput from "./inputs/BooleanInput.svelte";
import DateInput from "./inputs/DateInput.svelte";
import EmailInput from "./inputs/EmailInput.svelte";
import MultipleChoiceInput from "./inputs/MultipleChoiceInput.svelte";
import NumberInput from "./inputs/NumberInput.svelte";
import SingleChoiceInput from "./inputs/SingleChoiceInput.svelte";
import TextInput from "./inputs/TextInput.svelte";
import UrlInput from "./inputs/UrlInput.svelte";

/** The ids and state the question card hands its input, for labelling and error linking. */
export type Field = {
  /** The id of the input's first focusable control, which its label points at. */
  readonly id: string;
  readonly descriptionId: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
};

export type InputProps<T extends QuestionTypeName> = {
  question: QuestionSnapshotOf<T>;
  value: DraftOf<T>;
  field: Field;
};

/** Every question type's input. Adding a type to core fails here until it has one. */
export const inputs = {
  text: TextInput,
  email: EmailInput,
  number: NumberInput,
  date: DateInput,
  single_choice: SingleChoiceInput,
  multiple_choice: MultipleChoiceInput,
  boolean: BooleanInput,
  url: UrlInput,
} satisfies { [T in QuestionTypeName]: Component<InputProps<T>, object, "value"> };
