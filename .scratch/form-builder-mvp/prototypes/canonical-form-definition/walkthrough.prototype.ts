/**
 * PROTOTYPE, throwaway. Drives form-definition.prototype.ts through the cases that are hard to judge
 * on paper. Run: `pnpm walkthrough` (Node 24 strips the types).
 */
import {
  buildAnswerSchema,
  interpretAnswers,
  parseDefinition,
  validateAnswers,
  validateForPublish,
  type Answers,
  type FormDefinition,
  type Issue,
} from "./form-definition.prototype.ts";
import * as z from "zod/mini";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const Q = {
  name: id(1),
  email: id(2),
  heard: id(3),
  topics: id(4),
  age: id(5),
  start: id(6),
  newsletter: id(7),
  comments: id(8),
  rating: id(9),
  ratingText: id(10),
};

const scenario = (title: string) =>
  console.log(`\n${"=".repeat(100)}\n${title}\n${"=".repeat(100)}`);
const step = (title: string) => console.log(`\n--- ${title}`);
const issues = (list: Issue[]) =>
  list.forEach((i) =>
    console.log(`  ✗ ${i.path.join(".") || "(root)"}: ${i.message}`),
  );
const result = (r: { ok: true } | { ok: false; issues: Issue[] }) =>
  r.ok ? console.log("  ✓ accepted") : issues(r.issues);
const view = (def: FormDefinition, answers: Answers) =>
  console.table(
    interpretAnswers(def, answers).map(({ label, type, answer }) => ({
      label,
      type,
      answer: answer ?? "(skipped)",
    })),
  );

// -------------------------------------------------------------------------------------------------
scenario(
  "1. Draft save is lenient, publish is strict and reports every problem at once",
);

const unfinished = {
  format: 1,
  title: "  ",
  questions: [
    {
      id: Q.name,
      type: "text",
      label: "Your name",
      required: true,
      config: { display: "single_line" },
    },
    {
      id: Q.heard,
      type: "single_choice",
      label: "",
      required: false,
      config: {
        display: "radio",
        options: [{ value: "opt-ad", label: "An ad" }],
      },
    },
    {
      id: Q.age,
      type: "number",
      label: "Age",
      required: false,
      config: { integer: true, min: 120, max: 18 },
    },
  ],
};
step("save draft (structure only)");
result(parseDefinition(unfinished));
step("publish the same definition");
result(validateForPublish(unfinished, []));

step(
  "structurally broken: duplicate identity, duplicate option value, unknown type, extra key",
);
result(
  parseDefinition({
    format: 1,
    title: "x",
    questions: [
      {
        id: Q.name,
        type: "text",
        label: "A",
        required: true,
        config: { display: "single_line" },
      },
      {
        id: Q.name,
        type: "single_choice",
        label: "B",
        required: true,
        config: {
          display: "radio",
          options: [
            { value: "v", label: "1" },
            { value: "v", label: "2" },
          ],
        },
      },
      {
        id: Q.email,
        type: "file_upload",
        label: "C",
        required: true,
        config: {},
      },
      {
        id: Q.age,
        type: "boolean",
        label: "D",
        required: true,
        config: {},
        placeholder: "?",
      },
    ],
  }),
);

step(
  "…the duplicate checks only run once every question parses (Zod skips refinements after an inner failure)",
);
result(
  parseDefinition({
    format: 1,
    title: "x",
    questions: [
      {
        id: Q.name,
        type: "text",
        label: "A",
        required: true,
        config: { display: "single_line" },
      },
      {
        id: Q.name,
        type: "single_choice",
        label: "B",
        required: true,
        config: {
          display: "radio",
          options: [
            { value: "v", label: "1" },
            { value: "v", label: "2" },
          ],
        },
      },
    ],
  }),
);

// -------------------------------------------------------------------------------------------------
scenario("2. Version 1 is published, and its answer schema is derived from it");

const v1Def: FormDefinition = {
  format: 1,
  title: "Workshop sign-up",
  description: "Tell us about yourself.",
  questions: [
    {
      id: Q.name,
      type: "text",
      label: "Your name",
      required: true,
      config: { display: "single_line", maxLength: 80 },
    },
    { id: Q.email, type: "email", label: "Email", required: true, config: {} },
    {
      id: Q.heard,
      type: "single_choice",
      label: "How did you hear about us?",
      required: false,
      config: {
        display: "radio",
        options: [
          { value: "opt-ad", label: "An ad" },
          { value: "opt-friend", label: "A friend" },
          { value: "opt-search", label: "Search" },
        ],
      },
    },
    {
      id: Q.topics,
      type: "multiple_choice",
      label: "Topics",
      required: true,
      config: {
        options: [
          { value: "t-ts", label: "TypeScript" },
          { value: "t-db", label: "Databases" },
          { value: "t-ui", label: "UI" },
        ],
        maxSelected: 2,
      },
    },
    {
      id: Q.age,
      type: "number",
      label: "Age",
      required: false,
      config: { integer: true, min: 18, max: 120 },
    },
    {
      id: Q.start,
      type: "date",
      label: "Preferred start date",
      required: false,
      config: { min: "2026-11-01" },
    },
    {
      id: Q.newsletter,
      type: "boolean",
      label: "Subscribe to the newsletter?",
      required: true,
      config: {},
    },
  ],
};
const published1 = validateForPublish(v1Def, []);
step("publish v1");
result(published1);

step(
  "answer schema for v1, as JSON Schema (server-side only; what OpenAPI-style docs would show)",
);
console.log(
  JSON.stringify(
    z.toJSONSchema(buildAnswerSchema(v1Def), { io: "input" }),
    null,
    2,
  ),
);

const goodAnswers = {
  [Q.name]: "  Ada Lovelace  ",
  [Q.email]: "ada@example.com",
  [Q.heard]: "opt-friend",
  [Q.topics]: ["t-ts", "t-db"],
  [Q.newsletter]: false,
};
step("valid submission (optional age, start date skipped; name gets trimmed)");
const accepted = validateAnswers(v1Def, goodAnswers);
result(accepted);
if (accepted.ok) console.log(" stored answers:", accepted.value);

step("invalid submission");
result(
  validateAnswers(v1Def, {
    [Q.name]: "   ",
    [Q.email]: "not-an-email",
    [Q.heard]: "A friend",
    [Q.topics]: ["t-ts", "t-ts", "t-ui"],
    [Q.age]: 17.5,
    [Q.start]: "2026-10-01",
    [Q.comments]: "a key no question in v1 has",
  }),
);

// -------------------------------------------------------------------------------------------------
scenario(
  "3. Version 2: relabel, remove and add options, switch to dropdown, remove and add questions",
);

const d = structuredClone(v1Def);
const heard = d.questions.find((q) => q.id === Q.heard)!;
if (heard.type === "single_choice") {
  heard.config.display = "dropdown";
  heard.config.options = [
    { value: "opt-ad", label: "An advertisement" },
    { value: "opt-search", label: "Search" },
    { value: "opt-podcast", label: "A podcast" },
  ];
}
d.questions = d.questions.filter((q) => q.id !== Q.age);
d.questions.push({
  id: Q.comments,
  type: "text",
  label: "Anything else?",
  required: false,
  config: { display: "multi_line" },
});

step(
  "draft: changing 'Preferred start date' from date to text, keeping its identity",
);
const typeChanged = structuredClone(d);
typeChanged.questions = typeChanged.questions.map((q) =>
  q.id === Q.start
    ? {
        id: q.id,
        type: "text",
        label: "When would you like to start?",
        required: false,
        config: { display: "single_line" },
      }
    : q,
);
result(validateForPublish(typeChanged, [v1Def]));

step(
  "same change, but the builder mints a new identity (it is a new question)",
);
typeChanged.questions = typeChanged.questions.map((q) =>
  q.id === Q.start ? { ...q, id: id(11) } : q,
);
result(validateForPublish(typeChanged, [v1Def]));

step("publish v2 (keeps the date question as is)");
const published2 = validateForPublish(d, [v1Def]);
result(published2);
const v2Def = d;

// -------------------------------------------------------------------------------------------------
scenario("4. A response stored under v1 after v2 is published");

const stored = accepted.ok ? accepted.value : {};
step(
  "historical view, read with v1's own snapshots ('A friend' was removed in v2, 'Age' too)",
);
view(v1Def, stored);
step(
  "the same answers are NOT valid under v2; nothing is reinterpreted across versions",
);
result(validateAnswers(v2Def, stored));
step("v2 view of a v2 response");
view(v2Def, {
  [Q.name]: "Grace",
  [Q.email]: "grace@example.com",
  [Q.heard]: "opt-podcast",
  [Q.topics]: ["t-ui"],
  [Q.newsletter]: true,
});

// -------------------------------------------------------------------------------------------------
scenario("5. Stored definitions stay readable when publish rules tighten");
step(
  "a stored version whose option list would fail today's publish rules still parses for reading",
);
result(
  parseDefinition({
    ...v1Def,
    questions: [
      {
        ...v1Def.questions[2]!,
        config: {
          display: "radio",
          options: [{ value: "only", label: "Only" }],
        },
      },
    ],
  }),
);

// -------------------------------------------------------------------------------------------------
scenario("6. Publish rejects any question that no answer could satisfy");

const onlyQuestion = (question: FormDefinition["questions"][number]) => ({
  format: 1,
  title: "Unsatisfiable",
  questions: [question],
});
const topics = (config: object) =>
  onlyQuestion({
    id: Q.topics,
    type: "multiple_choice",
    label: "Topics",
    required: true,
    config: { options: [{ value: "t-ts", label: "TypeScript" }], ...config },
  } as FormDefinition["questions"][number]);

step("multiple choice: one option, but at least two must be selected");
result(validateForPublish(topics({ minSelected: 2 }), []));
step("multiple choice: at most zero selected (now a structural error, so draft save rejects it too)");
result(parseDefinition(topics({ maxSelected: 0 })));
step("whole number between 1.2 and 1.8");
result(
  validateForPublish(
    onlyQuestion({
      id: Q.rating,
      type: "number",
      label: "Rating",
      required: false,
      config: { integer: true, min: 1.2, max: 1.8 },
    }),
    [],
  ),
);
step("…the same range is fine when fractions are accepted");
result(
  validateForPublish(
    onlyQuestion({
      id: Q.rating,
      type: "number",
      label: "Rating",
      required: false,
      config: { integer: false, min: 1.2, max: 1.8 },
    }),
    [],
  ),
);
