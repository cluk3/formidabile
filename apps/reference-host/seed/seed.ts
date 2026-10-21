import { createFormApiClient, type FormApiClient } from "@fb/api-client";
import { declareLength } from "@fb/http-api/web";
import { type DevUser, mintDevToken } from "../server/dev-users.ts";

type Fetch = (request: Request) => Promise<Response>;

// The module's routes have no prefix, and its handler never looks at the host.
const baseUrl = "http://localhost";

// The handler is called in-process, so no transport declares the bodies' lengths.
const clientFor = (user: DevUser, fetch: Fetch) =>
  createFormApiClient({
    baseUrl,
    getToken: () => mintDevToken(user),
    fetch: async (request) => fetch(await declareLength(request)),
  });

const ok = <T>(result: { data?: T; error?: unknown; response: Response }): T => {
  if (result.data === undefined) {
    const { status, url } = result.response;
    throw new Error(`Seeding failed: ${status} from ${url}: ${JSON.stringify(result.error)}`);
  }
  return result.data;
};

const publish = async (
  client: FormApiClient,
  { draft }: { readonly draft: { readonly formId: string; readonly revision: string } },
) =>
  ok(
    await client.POST("/forms/{formId}/draft/publish", {
      params: { path: { formId: draft.formId } },
      body: { expectedRevision: draft.revision },
    }),
  );

/**
 * Creates and publishes each dev tenant's first form through the module's API, signed as that tenant's dev admin.
 * Published forms can't be deleted, so seeding twice adds a second copy: `seed:reset` drops the schema first.
 */
export const seed = async (fetch: Fetch) => {
  const acme = clientFor("acme-admin", fetch);
  await publish(
    acme,
    ok(
      await acme.POST("/forms", {
        body: {
          definition: {
            format: 1,
            title: "Customer feedback",
            description: "Tell us how your last order went.",
            questions: [
              {
                id: crypto.randomUUID(),
                type: "single_choice",
                label: "How satisfied are you with your order?",
                required: true,
                config: {
                  display: "radio",
                  options: [
                    { value: "very_satisfied", label: "Very satisfied" },
                    { value: "satisfied", label: "Satisfied" },
                    { value: "neutral", label: "Neutral" },
                    { value: "dissatisfied", label: "Dissatisfied" },
                  ],
                },
              },
              {
                id: crypto.randomUUID(),
                type: "multiple_choice",
                label: "What did you order?",
                required: false,
                config: {
                  options: [
                    { value: "anvils", label: "Anvils" },
                    { value: "rockets", label: "Rockets" },
                    { value: "magnets", label: "Magnets" },
                  ],
                },
              },
              {
                id: crypto.randomUUID(),
                type: "number",
                label: "How many days did delivery take?",
                required: false,
                config: { integer: true, min: 0, max: 60 },
              },
              {
                id: crypto.randomUUID(),
                type: "boolean",
                label: "Would you order from us again?",
                required: true,
                config: {},
              },
              {
                id: crypto.randomUUID(),
                type: "text",
                label: "Anything else we should know?",
                required: false,
                config: { display: "multi_line", maxLength: 2000 },
              },
            ],
          },
        },
      }),
    ),
  );

  const globex = clientFor("globex-admin", fetch);
  await publish(
    globex,
    ok(
      await globex.POST("/forms", {
        body: {
          definition: {
            format: 1,
            title: "Event registration",
            description: "Register for the Globex partner summit.",
            questions: [
              {
                id: crypto.randomUUID(),
                type: "text",
                label: "Full name",
                required: true,
                config: { display: "single_line", maxLength: 200 },
              },
              {
                id: crypto.randomUUID(),
                type: "email",
                label: "Work email",
                required: true,
                config: {},
              },
              {
                id: crypto.randomUUID(),
                type: "date",
                label: "Arrival date",
                required: true,
                config: { min: "2027-03-01", max: "2027-03-05" },
              },
              {
                id: crypto.randomUUID(),
                type: "single_choice",
                label: "Which track will you attend?",
                required: true,
                config: {
                  display: "dropdown",
                  options: [
                    { value: "engineering", label: "Engineering" },
                    { value: "sales", label: "Sales" },
                    { value: "operations", label: "Operations" },
                  ],
                },
              },
            ],
          },
        },
      }),
    ),
  );
};
