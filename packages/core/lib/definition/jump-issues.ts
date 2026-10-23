import type { Issue } from "./question-type.ts";

const TARGET = "This jump does not go to a later page or the end";

/** The part of a definition {@link jumpIssues} reads. A parsed form definition satisfies it. */
type JumpDefinition =
  | { readonly format: 1 }
  | {
      readonly format: 2;
      readonly pages: readonly {
        readonly id: string;
        readonly jumps: readonly { readonly target: string }[];
      }[];
    };

/**
 * Every jump whose target is not a later page or the end of the form. Publish reports these with the
 * condition problems. A draft may still hold one: deleting the target page, or moving it earlier, leaves
 * the jump in place (ADR-017).
 */
export const jumpIssues = (definition: JumpDefinition): Issue[] => {
  if (definition.format !== 2) return [];
  const issues: Issue[] = [];
  definition.pages.forEach((page, pageIndex) => {
    page.jumps.forEach((jump, jumpIndex) => {
      const later =
        jump.target === "end" ||
        definition.pages.some(
          (candidate, index) => index > pageIndex && candidate.id === jump.target,
        );
      if (!later)
        issues.push({
          path: ["pages", pageIndex, "jumps", jumpIndex, "target"],
          message: TARGET,
        });
    });
  });
  return issues;
};
