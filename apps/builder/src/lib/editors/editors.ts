import type { QuestionSnapshot, QuestionSnapshotOf, QuestionTypeName } from "@fb/core/definition";
import type { Component } from "svelte";
import BooleanEditor from "./BooleanEditor.svelte";
import DateEditor from "./DateEditor.svelte";
import EmailEditor from "./EmailEditor.svelte";
import MultipleChoiceEditor from "./MultipleChoiceEditor.svelte";
import NumberEditor from "./NumberEditor.svelte";
import type { EditorProps } from "./props.ts";
import SingleChoiceEditor from "./SingleChoiceEditor.svelte";
import TextEditor from "./TextEditor.svelte";

/** Every question type's editor and its name in the builder, keyed by core's type name. */
export const questionEditors = {
  text: { name: "Text", editor: TextEditor },
  email: { name: "Email", editor: EmailEditor },
  number: { name: "Number", editor: NumberEditor },
  date: { name: "Date", editor: DateEditor },
  single_choice: { name: "Single choice", editor: SingleChoiceEditor },
  multiple_choice: { name: "Multiple choice", editor: MultipleChoiceEditor },
  boolean: { name: "Yes/no", editor: BooleanEditor },
} satisfies {
  [T in QuestionTypeName]: { name: string; editor: Component<EditorProps<QuestionSnapshotOf<T>>> };
};

export const questionTypeNames = Object.keys(questionEditors) as QuestionTypeName[];

export const editorOf = (q: QuestionSnapshot) =>
  questionEditors[q.type].editor as Component<EditorProps<QuestionSnapshot>>;
