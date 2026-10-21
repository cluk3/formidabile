import type { FormDefinition } from "@fb/core/definition";
import { vi } from "vite-plus/test";

export const formId = "0192f0c4-0000-7000-8000-000000000001";
export const versionId = "0192f0c4-0000-7000-8000-0000000000a1";
export const apiBaseUrl = "https://forms.example/api";

export type Recorded = {
  method: string;
  path: string;
  authorization: string | null;
  body: unknown;
};

type Reply = Response | (() => Response | Promise<Response>);

/**
 * Stands in for the form module behind `fetch`: answers the respondent load with `definition`, each submit with
 * the next of `submits` (a 201 when they run out), a response read with its entry in `reads`, and each edit with
 * the next of `edits` (a 200 when they run out). Every request is recorded.
 */
export const fakeApi = (
  definition: unknown,
  {
    submits = [] as Reply[],
    load,
    reads = {},
    edits = [] as Reply[],
  }: { submits?: Reply[]; load?: Reply; reads?: Record<string, Reply>; edits?: Reply[] } = {},
) => {
  const requests: Recorded[] = [];
  let responses = 0;
  const fetch = vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname;
    const text = await request.text();
    requests.push({
      method: request.method,
      path,
      authorization: request.headers.get("authorization"),
      body: text === "" ? undefined : JSON.parse(text),
    });
    const reply = (value: Reply) => (typeof value === "function" ? value() : value);
    if (request.method === "GET" && path === `/api/respond/forms/${formId}`)
      return reply(
        load ??
          Response.json({
            formId,
            responseLimit: "unlimited",
            respondent: "identified",
            version: { id: versionId, number: 1, definition },
            myResponseId: null,
          }),
      );
    if (request.method === "POST" && path === `/api/respond/forms/${formId}/responses`) {
      const next = submits.shift();
      if (next !== undefined) return reply(next);
      responses += 1;
      return Response.json(
        {
          responseId: `0192f0c4-0000-7000-8000-00000000${String(responses).padStart(4, "0")}`,
          revision: "1",
        },
        { status: 201 },
      );
    }
    const responseId = path.match(/^\/api\/respond\/responses\/([^/]+)$/)?.[1];
    const read = responseId === undefined ? undefined : reads[responseId];
    if (request.method === "GET" && read !== undefined) return reply(read);
    if (request.method === "PUT" && responseId !== undefined) {
      const next = edits.shift();
      if (next !== undefined) return reply(next);
      return Response.json({ responseId, revision: "2", editedAt: "2026-10-21T10:00:00.000Z" });
    }
    return Response.json({ _tag: "NotFound" }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return { requests, fetch };
};

const id = (n: number) => `0192f0c4-0000-7000-8000-0000000001${String(n).padStart(2, "0")}`;

/** One question of every type and display, each required unless its label says otherwise. */
export const questions = {
  name: {
    id: id(1),
    type: "text",
    label: "Your name",
    description: "As it should appear on your badge",
    required: true,
    config: { display: "single_line", maxLength: 40 },
  },
  comments: {
    id: id(2),
    type: "text",
    label: "Comments (optional)",
    required: false,
    config: { display: "multi_line" },
  },
  email: { id: id(3), type: "email", label: "Email", required: true, config: {} },
  guests: {
    id: id(4),
    type: "number",
    label: "Guests",
    required: true,
    config: { integer: true, min: 1, max: 10 },
  },
  arrival: {
    id: id(5),
    type: "date",
    label: "Arrival date",
    required: true,
    config: { min: "2026-01-01", max: "2026-12-31" },
  },
  meal: {
    id: id(6),
    type: "single_choice",
    label: "Meal",
    required: true,
    config: {
      display: "radio",
      options: [
        { value: "veg", label: "Vegetarian" },
        { value: "fish", label: "Fish" },
      ],
    },
  },
  size: {
    id: id(7),
    type: "single_choice",
    label: "T-shirt size",
    required: true,
    config: {
      display: "dropdown",
      options: [
        { value: "s", label: "Small" },
        { value: "m", label: "Medium" },
      ],
    },
  },
  workshops: {
    id: id(8),
    type: "multiple_choice",
    label: "Workshops",
    required: true,
    config: {
      options: [
        { value: "svelte", label: "Svelte" },
        { value: "effect", label: "Effect" },
        { value: "zod", label: "Zod" },
      ],
      maxSelected: 2,
    },
  },
  parking: { id: id(9), type: "boolean", label: "Need parking?", required: true, config: {} },
} satisfies Record<string, FormDefinition["questions"][number]>;

/** The respondent's read of their own response `id` to `definition`, on version `versionId`. */
export const responseRead = (
  id: string,
  definition: FormDefinition,
  answers: Record<string, unknown>,
  { editable = true, revision = "1" }: { editable?: boolean; revision?: string } = {},
) =>
  Response.json({
    response: {
      id,
      formId,
      versionId,
      revision,
      answers,
      submittedAt: "2026-10-20T10:00:00.000Z",
      editedAt: null,
    },
    version: { id: versionId, number: 1, definition },
    editable,
  });

export const definitionOf = (
  questions: FormDefinition["questions"],
  title = "Event feedback",
): FormDefinition => ({ format: 1, title, questions });
