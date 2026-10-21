import { createFormApiClient, type Schemas } from "@fb/api-client";
import { reidentifyQuestion } from "@fb/core/editing";
import { declareLength } from "@fb/http-api/web";
import { type DevUser, devUsers, mintDevToken, mintFormToken } from "../server/dev-users.ts";
import { demoProjects, projectNamespace } from "../server/projects.ts";

type Fetch = (request: Request) => Promise<Response>;

// The module's routes have no prefix, and its handler never looks at the host.
const baseUrl = "http://localhost";

// The handler is called in-process, so no transport declares the bodies' lengths.
const clientWith = (getToken: () => Promise<string>, fetch: Fetch) =>
  createFormApiClient({
    baseUrl,
    getToken,
    fetch: async (request) => fetch(await declareLength(request)),
  });

const ok = <T>(result: { data?: T; error?: unknown; response: Response }): T => {
  if (result.data === undefined) {
    const { status, url } = result.response;
    throw new Error(`Seeding failed: ${status} from ${url}: ${JSON.stringify(result.error)}`);
  }
  return result.data;
};

interface SeededVersion {
  readonly definition: Schemas["FormDefinition"];
  readonly responses: ReadonlyArray<readonly [DevUser | null, Schemas["AnyAnswers"]]>;
}

/**
 * Publishes each definition as the next version of one open form and submits that version's responses while it is
 * current. Tokens are bound to the form. `ref`, when given, is attached before anyone answers and carried on every
 * token: that is how a demo project is seeded.
 */
const seedForm = async (
  fetch: Fetch,
  adminUser: DevUser,
  [first, ...later]: readonly [SeededVersion, ...SeededVersion[]],
  ref?: { readonly namespace: string; readonly refId: string },
) => {
  const admin = clientWith(() => mintDevToken(adminUser), fetch);
  const created = ok(await admin.POST("/forms", { body: { definition: first.definition } }));
  const path = { params: { path: { formId: created.form.id } } };
  const bound = { tenant: devUsers[adminUser].tenant, id: created.form.id };
  const refs = ref === undefined ? [] : [ref];
  let revision = created.draft.revision;
  for (const [index, { definition, responses }] of [first, ...later].entries()) {
    if (index > 0) {
      revision = ok(
        await admin.PUT("/forms/{formId}/draft", {
          ...path,
          body: { expectedRevision: null, definition },
        }),
      ).revision;
    }
    const { version } = ok(
      await admin.POST("/forms/{formId}/draft/publish", {
        ...path,
        body: { expectedRevision: revision },
      }),
    );
    if (index === 0) {
      ok(await admin.PATCH("/forms/{formId}", { ...path, body: { availability: "open" } }));
      if (ref !== undefined) {
        ok(await admin.POST("/forms/{formId}/external-refs", { ...path, body: ref }));
      }
    }
    for (const [user, answers] of responses) {
      const respondent = clientWith(() => mintFormToken(user, bound, refs), fetch);
      ok(
        await respondent.POST("/respond/forms/{formId}/responses", {
          ...path,
          body: { versionId: version.id, answers, idempotencyKey: crypto.randomUUID() },
        }),
      );
    }
  }
};

/**
 * The acme form for analytics: version 2 drops a question; version 3 adds an option, relabels another and widens a
 * number range; version 4 reidentifies the text question, which keeps its type and label but is a new question
 * identity (ADR 0009).
 */
const seedOnboardingSurvey = async (fetch: Fetch) => {
  const ease = crypto.randomUUID();
  const hours = crypto.randomUUID();
  const channel = crypto.randomUUID();
  const recommend = crypto.randomUUID();
  const teamText = crypto.randomUUID();
  const teamTextAgain = crypto.randomUUID();

  const easeQuestion = (options: ReadonlyArray<{ value: string; label: string }>) => ({
    id: ease,
    type: "single_choice" as const,
    label: "How easy was the setup?",
    required: true,
    config: { display: "radio" as const, options: [...options] },
  });
  const hoursQuestion = (max: number) => ({
    id: hours,
    type: "number" as const,
    label: "How many hours did the setup take?",
    required: false,
    config: { integer: true, min: 0, max },
  });
  const channelQuestion = {
    id: channel,
    type: "single_choice" as const,
    label: "How did you find us?",
    required: false,
    config: {
      display: "dropdown" as const,
      options: [
        { value: "search", label: "Search" },
        { value: "friend", label: "A friend" },
      ],
    },
  };
  const recommendQuestion = {
    id: recommend,
    type: "boolean" as const,
    label: "Would you recommend us?",
    required: true,
    config: {},
  };
  const teamTextQuestion = {
    id: teamText,
    type: "text" as const,
    label: "How big is your team?",
    required: false,
    config: { display: "single_line" as const, maxLength: 100 },
  };
  const firstOptions = [
    { value: "easy", label: "Easy" },
    { value: "manageable", label: "OK" },
    { value: "hard", label: "Hard" },
  ];
  const laterOptions = [
    { value: "very_easy", label: "Very easy" },
    { value: "easy", label: "Easy" },
    { value: "manageable", label: "Manageable" },
    { value: "hard", label: "Hard" },
  ];
  const definition = (questions: Schemas["FormDefinition"]["questions"]) => ({
    format: 1 as const,
    title: "Onboarding survey",
    description: "Tell us how setting up went.",
    questions,
  });

  const third = definition([
    easeQuestion(laterOptions),
    hoursQuestion(24),
    recommendQuestion,
    teamTextQuestion,
  ]);
  // The builder's "treat as a new question": same type and content, a new identity.
  const fourth = reidentifyQuestion(third, teamText, {
    questionId: () => teamTextAgain,
    optionValue: () => crypto.randomUUID(),
  });

  await seedForm(fetch, "acme-admin", [
    {
      definition: definition([
        easeQuestion(firstOptions),
        hoursQuestion(8),
        channelQuestion,
        recommendQuestion,
        teamTextQuestion,
      ]),
      responses: [
        [
          "alice",
          {
            [ease]: "easy",
            [hours]: 2,
            [channel]: "search",
            [recommend]: true,
            [teamText]: "About a dozen",
          },
        ],
        [null, { [ease]: "manageable", [recommend]: false }],
      ],
    },
    {
      definition: definition([
        easeQuestion(firstOptions),
        hoursQuestion(8),
        recommendQuestion,
        teamTextQuestion,
      ]),
      responses: [
        ["bob", { [ease]: "hard", [hours]: 8, [recommend]: false, [teamText]: "Just me" }],
        [null, { [ease]: "easy", [hours]: 3, [recommend]: true }],
      ],
    },
    {
      definition: third,
      responses: [
        ["alice", { [ease]: "very_easy", [hours]: 1, [recommend]: true }],
        [null, { [ease]: "manageable", [hours]: 20, [recommend]: true, [teamText]: "Forty" }],
      ],
    },
    {
      definition: fourth,
      responses: [
        ["bob", { [ease]: "very_easy", [hours]: 2, [recommend]: true, [teamTextAgain]: "Twelve" }],
        [null, { [ease]: "easy", [recommend]: true, [teamTextAgain]: "About forty" }],
        [null, { [ease]: "hard", [hours]: 16, [recommend]: false }],
      ],
    },
  ]);
};

/**
 * Seeds each dev tenant's demo project through the module's API: its one open form and a response from a dev user
 * and from the anonymous user. Acme also gets the onboarding survey, with versions for analytics. Published forms
 * can't be deleted, so seeding twice adds a second copy: `seed:reset` drops the schema first.
 */
export const seed = async (fetch: Fetch) => {
  const satisfaction = crypto.randomUUID();
  const ordered = crypto.randomUUID();
  const deliveryDays = crypto.randomUUID();
  const again = crypto.randomUUID();
  const notes = crypto.randomUUID();
  await seedForm(
    fetch,
    "acme-admin",
    [
      {
        definition: {
          format: 1,
          title: "Customer feedback",
          description: "Tell us how your last order went.",
          questions: [
            {
              id: satisfaction,
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
              id: ordered,
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
              id: deliveryDays,
              type: "number",
              label: "How many days did delivery take?",
              required: false,
              config: { integer: true, min: 0, max: 60 },
            },
            {
              id: again,
              type: "boolean",
              label: "Would you order from us again?",
              required: true,
              config: {},
            },
            {
              id: notes,
              type: "text",
              label: "Anything else we should know?",
              required: false,
              config: { display: "multi_line", maxLength: 2000 },
            },
          ],
        },
        responses: [
          [
            "alice",
            {
              [satisfaction]: "very_satisfied",
              [ordered]: ["anvils", "rockets"],
              [deliveryDays]: 3,
              [again]: true,
              [notes]: "The rocket arrived a day early.",
            },
          ],
          [null, { [satisfaction]: "neutral", [deliveryDays]: 12, [again]: false }],
        ],
      },
    ],
    { namespace: projectNamespace, refId: demoProjects.acme },
  );

  const fullName = crypto.randomUUID();
  const workEmail = crypto.randomUUID();
  const arrival = crypto.randomUUID();
  const track = crypto.randomUUID();
  await seedForm(
    fetch,
    "globex-admin",
    [
      {
        definition: {
          format: 1,
          title: "Event registration",
          description: "Register for the Globex partner summit.",
          questions: [
            {
              id: fullName,
              type: "text",
              label: "Full name",
              required: true,
              config: { display: "single_line", maxLength: 200 },
            },
            { id: workEmail, type: "email", label: "Work email", required: true, config: {} },
            {
              id: arrival,
              type: "date",
              label: "Arrival date",
              required: true,
              config: { min: "2027-03-01", max: "2027-03-05" },
            },
            {
              id: track,
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
        responses: [
          [
            "globex-admin",
            {
              [fullName]: "Hank Scorpio",
              [workEmail]: "hank@globex.example",
              [arrival]: "2027-03-02",
              [track]: "engineering",
            },
          ],
          [
            null,
            {
              [fullName]: "Ada Lovelace",
              [workEmail]: "ada@example.com",
              [arrival]: "2027-03-03",
              [track]: "operations",
            },
          ],
        ],
      },
    ],
    { namespace: projectNamespace, refId: demoProjects.globex },
  );

  await seedOnboardingSurvey(fetch);
};
