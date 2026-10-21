import { afterAll, expect, test } from "vite-plus/test";
import { resolveProjectForm } from "../server/projects.ts";
import { clientFor, projectForm, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const fetch = (request: Request) => api.handler(request);
const admin = clientFor("acme-admin", fetch);

type Built = Awaited<ReturnType<typeof projectForm>>;
const summary = ({ id, title }: Built) => ({ id, title });

test.each<[string, ReadonlyArray<"unpublished" | "closed" | "open">, (forms: Built[]) => unknown]>([
  ["no forms", [], () => ({ kind: "none" })],
  ["only an unpublished form", ["unpublished"], () => ({ kind: "none" })],
  ["only a closed form", ["closed"], () => ({ kind: "none" })],
  ["one open form", ["open"], ([open]) => ({ kind: "one", form: summary(open!) })],
  [
    "an open and a closed form, so the open one",
    ["open", "closed"],
    ([open]) => ({ kind: "one", form: summary(open!) }),
  ],
  [
    "two open forms, which is ambiguous",
    ["open", "open"],
    (forms) => ({
      kind: "ambiguous",
      forms: expect.arrayContaining(forms.map(summary)),
    }),
  ],
])("a project with %s resolves to it", async (_, states, expected) => {
  const projectId = `acme-${crypto.randomUUID()}`;
  const forms: Built[] = [];
  for (const state of states) forms.push(await projectForm(admin, projectId, state));

  const resolved = await resolveProjectForm(fetch, "acme", projectId);

  expect(resolved).toEqual(expected(forms));
  if (resolved.kind === "ambiguous") expect(resolved.forms).toHaveLength(2);
});

test("a project's forms in another tenant aren't candidates", async () => {
  const projectId = `acme-${crypto.randomUUID()}`;
  await projectForm(clientFor("globex-admin", fetch), projectId, "open");

  expect(await resolveProjectForm(fetch, "acme", projectId)).toEqual({ kind: "none" });
});
