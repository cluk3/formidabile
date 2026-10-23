import type { QuestionSnapshot, QuestionSnapshotOf, QuestionTypeName } from "@fb/core/definition";
import type { Component } from "svelte";
import BooleanAnswer from "#lib/answers/BooleanAnswer.svelte";
import ChoiceAnswer from "#lib/answers/ChoiceAnswer.svelte";
import DateAnswer from "#lib/answers/DateAnswer.svelte";
import EmailAnswer from "#lib/answers/EmailAnswer.svelte";
import MultipleChoiceAnswer from "#lib/answers/MultipleChoiceAnswer.svelte";
import NumberAnswer from "#lib/answers/NumberAnswer.svelte";
import type { AnswerProps } from "#lib/answers/props.ts";
import RankingAnswer from "#lib/answers/RankingAnswer.svelte";
import TextAnswer from "#lib/answers/TextAnswer.svelte";
import BooleanEditor from "#lib/editors/BooleanEditor.svelte";
import DateEditor from "#lib/editors/DateEditor.svelte";
import EmailEditor from "#lib/editors/EmailEditor.svelte";
import MultipleChoiceEditor from "#lib/editors/MultipleChoiceEditor.svelte";
import NumberEditor from "#lib/editors/NumberEditor.svelte";
import type { EditorProps } from "#lib/editors/props.ts";
import RankingEditor from "#lib/editors/RankingEditor.svelte";
import SingleChoiceEditor from "#lib/editors/SingleChoiceEditor.svelte";
import TextEditor from "#lib/editors/TextEditor.svelte";

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
  ranking: { name: "Ranking", editor: RankingEditor, answer: RankingAnswer },
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
