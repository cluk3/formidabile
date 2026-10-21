import type { QuestionSnapshot, QuestionSnapshotOf, QuestionTypeName } from "@fb/core/definition";
import type { Component } from "svelte";
import BooleanAnswer from "./answers/BooleanAnswer.svelte";
import ChoiceAnswer from "./answers/ChoiceAnswer.svelte";
import DateAnswer from "./answers/DateAnswer.svelte";
import EmailAnswer from "./answers/EmailAnswer.svelte";
import MultipleChoiceAnswer from "./answers/MultipleChoiceAnswer.svelte";
import NumberAnswer from "./answers/NumberAnswer.svelte";
import type { AnswerProps } from "./answers/props.ts";
import TextAnswer from "./answers/TextAnswer.svelte";
import BooleanEditor from "./editors/BooleanEditor.svelte";
import DateEditor from "./editors/DateEditor.svelte";
import EmailEditor from "./editors/EmailEditor.svelte";
import MultipleChoiceEditor from "./editors/MultipleChoiceEditor.svelte";
import NumberEditor from "./editors/NumberEditor.svelte";
import type { EditorProps } from "./editors/props.ts";
import SingleChoiceEditor from "./editors/SingleChoiceEditor.svelte";
import TextEditor from "./editors/TextEditor.svelte";

/**
 * Every question type in the builder, keyed by core's type name: its name, its editor, and how a response's answer
 * to it reads.
 */
export const registry = {
  text: { name: "Text", editor: TextEditor, answer: TextAnswer },
  email: { name: "Email", editor: EmailEditor, answer: EmailAnswer },
  number: { name: "Number", editor: NumberEditor, answer: NumberAnswer },
  date: { name: "Date", editor: DateEditor, answer: DateAnswer },
  single_choice: { name: "Single choice", editor: SingleChoiceEditor, answer: ChoiceAnswer },
  multiple_choice: {
    name: "Multiple choice",
    editor: MultipleChoiceEditor,
    answer: MultipleChoiceAnswer,
  },
  boolean: { name: "Yes/no", editor: BooleanEditor, answer: BooleanAnswer },
} satisfies {
  [T in QuestionTypeName]: {
    name: string;
    editor: Component<EditorProps<QuestionSnapshotOf<T>>>;
    answer: Component<AnswerProps<T>>;
  };
};

export const questionTypeNames = Object.keys(registry) as QuestionTypeName[];

export const editorOf = (q: QuestionSnapshot) =>
  registry[q.type].editor as Component<EditorProps<QuestionSnapshot>>;

export const answerOf = (q: QuestionSnapshot) =>
  registry[q.type].answer as Component<AnswerProps<QuestionTypeName>>;
