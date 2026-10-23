import { devTenants, mintServiceToken } from "./dev-users.ts";

type Fetch = (request: Request) => Promise<Response>;

/** The external reference namespace the host files its projects under. */
export const projectNamespace = "project";

/** The demo projects the seed attaches to each dev tenant's first form. */
export const demoProjects = {
  acme: "acme-spring-orders",
  globex: "globex-partner-summit",
} as const;

/**
 * A second acme project, holding the paged demo form: show conditions, a jump, and every question type the
 * iteration added. It is separate from `demoProjects` so `acme-spring-orders` still resolves to one form.
 */
export const pagedDemoProject = "acme-trip-planner";

/**
 * The tenant a project belongs to, or `null` for no project. The host keeps no project records: an id names its
 * dev tenant before the first `-` (`acme-spring-orders`), so tests make up projects of their own. Ids are capped
 * at the 255 code points a reference's `refId` may hold.
 */
export const projectTenant = (projectId: string): string | null =>
  Array.from(projectId).length <= 255
    ? (devTenants.find((tenant) => projectId.startsWith(`${tenant}-`)) ?? null)
    : null;

export interface ProjectFormCandidate {
  readonly id: string;
  readonly title: string;
}

/** Which form "the form for project X" is: the one open, published form carrying the project's reference. */
export type ProjectForm =
  | { readonly kind: "none" }
  | { readonly kind: "one"; readonly form: ProjectFormCandidate }
  | { readonly kind: "ambiguous"; readonly forms: ReadonlyArray<ProjectFormCandidate> };

// The fields of the module's `FormSummary` the host decides on.
interface FormSummary {
  readonly id: string;
  readonly title: string;
  readonly availability: "open" | "closed";
  readonly currentVersion: unknown;
}

/**
 * Looks the project's forms up through the module's (unprefixed) handler, as the host's own service, and keeps the
 * candidates: published and open. Unpublished forms can't be loaded, and a closed one is a project's past form.
 * The page and `/token` both ask this, so they never disagree, and the browser never names the form.
 */
export const resolveProjectForm = async (
  api: Fetch,
  tenant: string,
  projectId: string,
): Promise<ProjectForm> => {
  const url = new URL("http://reference-host/forms");
  url.searchParams.set("refNamespace", projectNamespace);
  url.searchParams.set("refId", projectId);
  const response = await api(
    new Request(url, {
      headers: { authorization: `Bearer ${await mintServiceToken(tenant)}` },
    }),
  );
  if (!response.ok)
    throw new Error(`Looking up project ${projectId}'s forms gave ${response.status}`);
  const { forms } = (await response.json()) as { forms: ReadonlyArray<FormSummary> };
  const candidates = forms
    .filter((form) => form.currentVersion !== null && form.availability === "open")
    .map(({ id, title }) => ({ id, title }));
  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length === 1) return { kind: "one", form: candidates[0]! };
  return { kind: "ambiguous", forms: candidates };
};
