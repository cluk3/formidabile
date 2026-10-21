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
 * Stands in for the form module behind `fetch`: answers the respondent load with `definition`, and each submit
 * with the next of `submits` (a 201 when they run out). Every request is recorded.
 */
export const fakeApi = (
  definition: unknown,
  { submits = [] as Reply[], load }: { submits?: Reply[]; load?: Reply } = {},
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
    return Response.json({ _tag: "NotFound" }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return { requests, fetch };
};

export const definitionOf = (
  questions: FormDefinition["questions"],
  title = "Event feedback",
): FormDefinition => ({ format: 1, title, questions });
