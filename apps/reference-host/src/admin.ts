import { createFormApiClient, type Schemas } from "@fb/api-client";
import {
  addReference,
  type ExternalRef,
  loadReference,
  moreResponses,
  type ReferenceAdmin,
  removeReference,
} from "./reference-admin.ts";

// The host serves this page only to an admin, so `/token` mints their tenant-wide token.
const client = createFormApiClient({
  baseUrl: new URL("/api", location.href).href,
  getToken: async () => {
    const response = await fetch("/token");
    if (!response.ok) throw new Error(`/token refused with ${response.status}`);
    return ((await response.json()) as { token: string }).token;
  },
});

// Built with `textContent` and no markup strings: the preview's CSP requires Trusted Types for HTML sinks.
const create = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  attributes: Readonly<Record<string, string>> = {},
) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
};

const formState = ({ availability, currentVersion }: Schemas["FormSummary"]) =>
  currentVersion === null ? "never published" : `version ${currentVersion.number}, ${availability}`;

const responseText = (response: Schemas["ResponseSummary"], title: string) =>
  `${title}, version ${response.versionNumber}: submitted ${new Date(response.submittedAt).toLocaleString()} ` +
  `by ${response.respondentId ?? "an anonymous respondent"}` +
  (response.editedAt === null ? "" : `, edited ${new Date(response.editedAt).toLocaleString()}`);

/** Fills in one project's section: its forms, with add and remove, and the responses submitted under it. */
const manage = (section: HTMLElement, ref: ExternalRef, index: number) => {
  const content = create("div");
  const status = create("p", "Loading…", { role: "status" });
  section.append(content, status);
  const ids = { forms: `project-${index}-forms`, responses: `project-${index}-responses` };

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      status.textContent = "";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  };

  const reload = (focus: boolean) =>
    run(async () => {
      render(await loadReference(client, ref));
      if (focus) document.getElementById(ids.forms)?.focus();
    });

  const formsPart = ({ forms, otherForms }: ReferenceAdmin) => {
    const heading = create("h3", "Forms with this project", { id: ids.forms, tabindex: "-1" });
    const held =
      forms.length === 0
        ? create("p", "No form carries this project.")
        : create("ul", undefined, { "aria-labelledby": ids.forms });
    for (const form of forms) {
      const remove = create("button", "Remove", {
        type: "button",
        "aria-label": `Remove ${form.title}`,
      });
      remove.addEventListener("click", () =>
        run(async () => {
          await removeReference(client, form.id, ref);
          await reload(true);
        }),
      );
      const item = create("li", `${form.title} (${formState(form)}) `);
      item.append(remove);
      held.append(item);
    }
    if (otherForms.length === 0) return [heading, held];
    const select = create("select", undefined, { id: `project-${index}-add`, name: "form" });
    for (const form of otherForms)
      select.append(create("option", `${form.title} (${formState(form)})`, { value: form.id }));
    const add = create("form");
    add.append(
      create("label", "Add the project to ", { for: select.id }),
      select,
      create("button", "Add", { type: "submit" }),
    );
    add.addEventListener("submit", (event) => {
      event.preventDefault();
      void run(async () => {
        await addReference(client, select.value, ref);
        await reload(true);
      });
    });
    return [heading, held, add];
  };

  const responsesPart = ({ forms, otherForms, responses, nextCursor }: ReferenceAdmin) => {
    const titles = new Map([...forms, ...otherForms].map(({ id, title }) => [id, title]));
    const heading = create("h3", "Responses under this project", { id: ids.responses });
    if (responses.length === 0) return [heading, create("p", "No responses under this project.")];
    const list = create("ul", undefined, { "aria-labelledby": ids.responses });
    const append = (page: ReadonlyArray<Schemas["ResponseSummary"]>) => {
      for (const response of page) {
        const item = create(
          "li",
          `${responseText(response, titles.get(response.formId) ?? response.formId)} `,
        );
        item.append(create("code", response.id));
        list.append(item);
      }
    };
    append(responses);
    if (nextCursor === null) return [heading, list];
    let cursor = nextCursor;
    const more = create("button", "More responses", { type: "button" });
    more.addEventListener("click", () =>
      run(async () => {
        const page = await moreResponses(client, ref, cursor);
        append(page.responses);
        if (page.nextCursor === null) {
          more.remove();
          heading.setAttribute("tabindex", "-1");
          heading.focus();
        } else cursor = page.nextCursor;
      }),
    );
    return [heading, list, more];
  };

  const render = (admin: ReferenceAdmin) =>
    content.replaceChildren(...formsPart(admin), ...responsesPart(admin));

  void reload(false);
};

document
  .querySelectorAll<HTMLElement>("section[data-ref-namespace][data-ref-id]")
  .forEach((section, index) => {
    const { refNamespace, refId } = section.dataset;
    manage(section, { namespace: refNamespace!, refId: refId! }, index);
  });
