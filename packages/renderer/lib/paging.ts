import { nextDestination as destinationOf, type Answers } from "@fb/core/answers";
import type { FormDefinition, PageView } from "@fb/core/definition";

/**
 * Where Next goes from `page`.
 *
 * Core's path function decides: the first matching jump, otherwise the following page, passing over a
 * page that has no question on the path. `pageId` is that page's id, null for a format-1 definition.
 */
export type NextDestination =
  | { readonly kind: "page"; readonly pageId: string | null }
  | { readonly kind: "end" };

export const nextDestination = (
  definition: FormDefinition,
  answers: Answers,
  page: PageView,
): NextDestination => {
  const destination = destinationOf(definition, answers, page);
  return destination.kind === "end"
    ? { kind: "end" }
    : { kind: "page", pageId: destination.page.id };
};

/** The title a respondent sees. Blank and whitespace-only titles are untitled (`null`). */
export const pageTitle = (page: PageView): string | null => {
  const trimmed = page.title?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};
