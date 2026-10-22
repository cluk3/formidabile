import type { Answers } from "@fb/core/answers";
import { pagesOf, type FormDefinition, type PageView } from "@fb/core/definition";

/**
 * Where Next goes from `page`.
 *
 * Ticket 03 replaces this body with the path function from `@fb/core/answers`: the first matching
 * jump, otherwise the following page, passing over a page that has no question on the path. `answers`
 * is already part of the call so that function can decide from the respondent's answers. Until then
 * the next page is simply the following one, and the last page ends the form.
 */
export type NextDestination =
  | { readonly kind: "page"; readonly pageId: string | null }
  | { readonly kind: "end" };

export const nextDestination = (
  definition: FormDefinition,
  answers: Answers,
  page: PageView,
): NextDestination => {
  void answers;
  const pages = pagesOf(definition);
  const index = pages.findIndex((candidate) => candidate.id === page.id);
  const next = pages[index + 1];
  if (index < 0 || next === undefined) return { kind: "end" };
  return { kind: "page", pageId: next.id };
};

/** The title a respondent sees. Blank and whitespace-only titles are untitled (`null`). */
export const pageTitle = (page: PageView): string | null => {
  const trimmed = page.title?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};
