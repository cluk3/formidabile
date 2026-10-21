import type { FormApiClient } from "@fb/api-client";
import { validateAnswers } from "@fb/core/answers";
import { parseDefinition } from "@fb/core/definition";
import { Ajv2020 } from "ajv/dist/2020.js";
import formats from "ajv-formats";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const alice = api.clientWithToken(() =>
  signToken({ sub: "alice", tenant: "acme", capabilities: [] }),
);

const ids = {
  text: "0192f5a0-7c3e-7b1a-9d2e-000000000001",
  email: "0192f5a0-7c3e-7b1a-9d2e-000000000002",
  number: "0192f5a0-7c3e-7b1a-9d2e-000000000003",
  date: "0192f5a0-7c3e-7b1a-9d2e-000000000004",
  boolean: "0192f5a0-7c3e-7b1a-9d2e-000000000005",
  single: "0192f5a0-7c3e-7b1a-9d2e-000000000006",
  multiple: "0192f5a0-7c3e-7b1a-9d2e-000000000007",
};

const options = ["red", "green", "blue"].map((value) => ({ value, label: value }));

/** One question of each type; only the text is required. */
const definition = {
  format: 1 as const,
  title: "Signup",
  questions: [
    {
      id: ids.text,
      type: "text" as const,
      label: "Name",
      required: true,
      config: { maxLength: 5, display: "single_line" as const },
    },
    { id: ids.email, type: "email" as const, label: "Email", required: false, config: {} },
    {
      id: ids.number,
      type: "number" as const,
      label: "Guests",
      required: false,
      config: { integer: true, min: 1, max: 9 },
    },
    {
      id: ids.date,
      type: "date" as const,
      label: "Arrival",
      required: false,
      config: { min: "2027-01-01", max: "2027-12-31" },
    },
    { id: ids.boolean, type: "boolean" as const, label: "Vegan?", required: false, config: {} },
    {
      id: ids.single,
      type: "single_choice" as const,
      label: "Colour",
      required: false,
      config: { options, display: "radio" as const },
    },
    {
      id: ids.multiple,
      type: "multiple_choice" as const,
      label: "Colours",
      required: false,
      config: { options, maxSelected: 2 },
    },
  ],
};

/** An open form in `acme` with one published version. */
const openForm = async () => {
  const created = await admin.POST("/forms", { body: { definition } });
  const { form, draft } = created.data!;
  const published = await admin.POST("/forms/{formId}/draft/publish", {
    params: { path: { formId: form.id } },
    body: { expectedRevision: draft.revision },
  });
  await admin.PATCH("/forms/{formId}", {
    params: { path: { formId: form.id } },
    body: { availability: "open" },
  });
  return { formId: form.id, versionId: published.data!.version.id };
};

const answerSchema = (client: FormApiClient, form: { formId: string; versionId: string }) =>
  client.GET("/respond/forms/{formId}/versions/{versionId}/answer-schema", {
    params: { path: form },
  });

describe("the answer schema", () => {
  test("is the version's JSON Schema 2020-12, marked advisory", async () => {
    const form = await openForm();

    const { data, response } = await answerSchema(alice, form);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      "x-fb-authoritative": false,
      description: expect.stringContaining("the server validates every submission and edit"),
      required: [ids.text],
      additionalProperties: false,
    });
  });

  test("is still served for a version a later publish superseded", async () => {
    const form = await openForm();
    const draft = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: form.formId } },
      body: {
        expectedRevision: null,
        definition: { ...definition, questions: [definition.questions[1]!] },
      },
    });
    await admin.POST("/forms/{formId}/draft/publish", {
      params: { path: { formId: form.formId } },
      body: { expectedRevision: draft.data!.revision },
    });

    const { data, response } = await answerSchema(alice, form);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ required: [ids.text] });
  });

  test("of another form's version gives 404", async () => {
    const a = await openForm();
    const b = await openForm();

    const { error, response } = await answerSchema(alice, { ...a, versionId: b.versionId });

    expect(response.status).toBe(404);
    expect(error).toEqual({ _tag: "NotFound" });
  });

  test("of a closed form gives 409 FormClosed", async () => {
    const form = await openForm();
    await admin.PATCH("/forms/{formId}", {
      params: { path: { formId: form.formId } },
      body: { availability: "closed" },
    });

    const { error, response } = await answerSchema(alice, form);

    expect(response.status).toBe(409);
    expect(error).toEqual({ _tag: "FormClosed" });
  });

  test("gives a respondent from another tenant 404", async () => {
    const form = await openForm();
    const bob = api.clientWithToken(() =>
      signToken({ sub: "bob", tenant: "globex", capabilities: [] }),
    );

    const { error, response } = await answerSchema(bob, form);

    expect(response.status).toBe(404);
    expect(error).toEqual({ _tag: "NotFound" });
  });
});

/** An address of exactly `length` code points that both validators read as an email. */
const emailOf = (length: number) => `${"a".repeat(length - "@example.com".length)}@example.com`;

const valid = {
  [ids.text]: "Alice",
  [ids.email]: "alice@example.com",
  [ids.number]: 2,
  [ids.date]: "2027-06-15",
  [ids.boolean]: true,
  [ids.single]: "red",
  [ids.multiple]: ["red", "blue"],
};

/** `answers` replaces keys of `valid`; `undefined` removes one. */
const cases: ReadonlyArray<{ name: string; answers: Record<string, unknown>; accepted: boolean }> =
  [
    { name: "every question answered", answers: {}, accepted: true },
    {
      name: "only the required question answered",
      answers: Object.fromEntries(
        Object.keys(valid).map((id) => [id, id === ids.text ? "Alice" : undefined]),
      ),
      accepted: true,
    },
    { name: "the required question missing", answers: { [ids.text]: undefined }, accepted: false },
    { name: "an unknown key", answers: { [crypto.randomUUID()]: "x" }, accepted: false },
    { name: "null for an optional question", answers: { [ids.email]: null }, accepted: false },
    { name: "text at its maximum length", answers: { [ids.text]: "Ada B" }, accepted: true },
    { name: "text over its maximum length", answers: { [ids.text]: "Alicia" }, accepted: false },
    { name: "empty text", answers: { [ids.text]: "" }, accepted: false },
    { name: "blank text", answers: { [ids.text]: " \t " }, accepted: false },
    { name: "text that isn't a string", answers: { [ids.text]: 5 }, accepted: false },
    { name: "a 254-code-point email", answers: { [ids.email]: emailOf(254) }, accepted: true },
    { name: "a 255-code-point email", answers: { [ids.email]: emailOf(255) }, accepted: false },
    { name: "an email without a domain", answers: { [ids.email]: "alice@" }, accepted: false },
    { name: "a number at its maximum", answers: { [ids.number]: 9 }, accepted: true },
    { name: "a number under its minimum", answers: { [ids.number]: 0 }, accepted: false },
    { name: "a number over its maximum", answers: { [ids.number]: 10 }, accepted: false },
    { name: "a fraction for an integer", answers: { [ids.number]: 1.5 }, accepted: false },
    { name: "a number as a string", answers: { [ids.number]: "2" }, accepted: false },
    { name: "a date on its minimum", answers: { [ids.date]: "2027-01-01" }, accepted: true },
    {
      name: "a date that isn't on the calendar",
      answers: { [ids.date]: "2027-02-29" },
      accepted: false,
    },
    {
      name: "a date with a time",
      answers: { [ids.date]: "2027-06-15T10:00:00Z" },
      accepted: false,
    },
    { name: "a date before its minimum", answers: { [ids.date]: "2026-12-31" }, accepted: false },
    { name: "a boolean as a string", answers: { [ids.boolean]: "true" }, accepted: false },
    { name: "false for a boolean", answers: { [ids.boolean]: false }, accepted: true },
    { name: "an unknown single choice", answers: { [ids.single]: "pink" }, accepted: false },
    { name: "a single choice as a list", answers: { [ids.single]: ["red"] }, accepted: false },
    { name: "no multiple choice selected", answers: { [ids.multiple]: [] }, accepted: false },
    {
      name: "more choices than the maximum",
      answers: { [ids.multiple]: ["red", "green", "blue"] },
      accepted: false,
    },
    {
      name: "a choice selected twice",
      answers: { [ids.multiple]: ["red", "red"] },
      accepted: false,
    },
    { name: "an unknown multiple choice", answers: { [ids.multiple]: ["pink"] }, accepted: false },
    { name: "a multiple choice as a string", answers: { [ids.multiple]: "red" }, accepted: false },
  ];

/** Standard JSON Schema can't compare dates, so only the server applies the range (ADR 0010). */
const dateRangeGap = new Set(["a date before its minimum"]);

describe("the answer schema agrees with the server's validation", async () => {
  const form = await openForm();
  const { data: schema } = await answerSchema(alice, form);
  const ajv = new Ajv2020({ allErrors: true });
  formats.default(ajv);
  ajv.addVocabulary(["x-fb-authoritative", "x-fb-minDate", "x-fb-maxDate"]);
  const browser = ajv.compile(schema!);
  const server = parseDefinition(definition);
  if (!server.ok) throw new Error("The test definition doesn't parse");

  test.each(cases)("on $name", ({ name, answers, accepted }) => {
    const input = Object.fromEntries(
      Object.entries({ ...valid, ...answers }).filter(([, value]) => value !== undefined),
    );

    expect(validateAnswers(server.value, input).ok).toBe(accepted);
    expect(browser(input)).toBe(dateRangeGap.has(name) ? true : accepted);
  });

  test("and carries the date range for clients to apply", () => {
    expect(schema).toMatchObject({
      properties: {
        [ids.date]: { "x-fb-minDate": "2027-01-01", "x-fb-maxDate": "2027-12-31" },
      },
    });
  });
});
