import type { FormApiClient, Schemas } from "@fb/api-client";

export type ExternalRef = Schemas["ExternalRef"];

/** What the admin page shows for one of the host's references. */
export interface ReferenceAdmin {
  /** The tenant's forms carrying the reference. */
  readonly forms: ReadonlyArray<Schemas["FormSummary"]>;
  /** The tenant's other forms, which the reference can be added to. */
  readonly otherForms: ReadonlyArray<Schemas["FormSummary"]>;
  /** The newest responses submitted under the reference, whichever form they answer. */
  readonly responses: ReadonlyArray<Schemas["ResponseSummary"]>;
  /** Where the next page of responses starts, or `null` when there are no more. */
  readonly nextCursor: string | null;
}

const ok = <T>(action: string, result: { data?: T; error?: unknown; response: Response }): T => {
  if (result.data === undefined) {
    const { error } = result;
    const tag =
      typeof error === "object" && error !== null && "_tag" in error ? error._tag : undefined;
    throw new Error(
      `${action} failed with ${result.response.status}${typeof tag === "string" ? ` (${tag})` : ""}`,
    );
  }
  return result.data;
};

const refQuery = ({ namespace, refId }: ExternalRef) => ({ refNamespace: namespace, refId });

const listResponses = (client: FormApiClient, ref: ExternalRef, limit?: number, cursor?: string) =>
  client.GET("/responses", { params: { query: { ...refQuery(ref), limit, cursor } } });

/** Loads the forms and the first page of responses for a reference, as the signed-in admin. */
export const loadReference = async (
  client: FormApiClient,
  ref: ExternalRef,
  limit?: number,
): Promise<ReferenceAdmin> => {
  const [all, carrying, page] = await Promise.all([
    client.GET("/forms"),
    client.GET("/forms", { params: { query: refQuery(ref) } }),
    listResponses(client, ref, limit),
  ]);
  const { forms } = ok("Listing the forms carrying the reference", carrying);
  const held = new Set(forms.map(({ id }) => id));
  const { responses, nextCursor } = ok("Listing the reference's responses", page);
  return {
    forms,
    otherForms: ok("Listing the tenant's forms", all).forms.filter(({ id }) => !held.has(id)),
    responses,
    nextCursor,
  };
};

/** The reference's next page of responses, from a `nextCursor`. */
export const moreResponses = async (
  client: FormApiClient,
  ref: ExternalRef,
  cursor: string,
  limit?: number,
): Promise<Pick<ReferenceAdmin, "responses" | "nextCursor">> =>
  ok("Listing the reference's responses", await listResponses(client, ref, limit, cursor));

const formPath = (formId: string) => ({ path: { formId } });

export const addReference = async (client: FormApiClient, formId: string, ref: ExternalRef) => {
  ok(
    "Adding the reference",
    await client.POST("/forms/{formId}/external-refs", { params: formPath(formId), body: ref }),
  );
};

export const removeReference = async (client: FormApiClient, formId: string, ref: ExternalRef) => {
  ok(
    "Removing the reference",
    await client.DELETE("/forms/{formId}/external-refs", {
      params: { ...formPath(formId), query: ref },
    }),
  );
};
