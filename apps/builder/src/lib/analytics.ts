import type { Schemas } from "@fb/api-client";

type Summary = Schemas["AnalyticsSummary"];
type Constraints = Schemas["AnalyticsConstraints"];

/** `count / base` as a whole percentage, or null when nothing could have chosen it. */
export const share = (count: number, base: number): number | null =>
  base === 0 ? null : Math.round((count / base) * 100);

export const shareText = (percent: number | null) => (percent === null ? "—" : `${percent}%`);

export const numberText = (value: number | null) =>
  value === null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

/** "Version 2", "Versions 1 and 2", "Versions 1, 2 and 4". */
export const versionsText = (numbers: ReadonlyArray<number>) => {
  if (numbers.length === 1) return `Version ${numbers[0]}`;
  return `Versions ${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)}`;
};

/** The labels other versions gave, e.g. `“OK” in version 1`. */
export const otherLabelsText = (others: Schemas["QuestionAnalytics"]["otherLabels"]) =>
  others
    .map(({ label, versions }) => `“${label}” in ${versionsText(versions).toLowerCase()}`)
    .join(", ");

const responses = (count: number) => `${count} ${count === 1 ? "response" : "responses"}`;

/** A question's counts over every version, and the responses to versions that didn't ask it. */
export const countsText = ({ combined }: Schemas["QuestionAnalytics"]) => {
  const counts = `${responses(combined.responses)}: ${combined.shown} shown, ${combined.answered} answered, ${combined.skipped} skipped, ${combined.notShown} not shown.`;
  return combined.absentResponses === 0
    ? counts
    : `${counts} Not asked in ${responses(combined.absentResponses)}, to versions without it.`;
};

/** Whether every option was offered in the same versions, so their shares share one base. */
export const offeredEverywhere = (options: ReadonlyArray<{ offeredIn: ReadonlyArray<number> }>) =>
  options.every(({ offeredIn }) => offeredIn.join() === options[0]?.offeredIn.join());

/** One version's result, in a table cell. Text, email and date questions have none beyond their counts. */
export const resultText = (summary: Summary) => {
  switch (summary.type) {
    case "single_choice":
    case "multiple_choice":
      return summary.options.map((option) => `${option.label}: ${option.count}`).join(" · ");
    case "boolean":
      return `Yes: ${summary.trueCount} · No: ${summary.falseCount}`;
    case "number": {
      const stats =
        summary.count === 0
          ? "No answers"
          : `Min ${numberText(summary.min)} · Max ${numberText(summary.max)} · Mean ${numberText(summary.mean)} · Median ${numberText(summary.median)}`;
      const { nps } = summary;
      if (nps === undefined) return stats;
      return `NPS ${numberText(nps.score)} · Promoters ${nps.promoters} · Passives ${nps.passives} · Detractors ${nps.detractors}. ${stats}`;
    }
    default:
      return "";
  }
};

const range = (min: number | null, max: number | null) => {
  if (min !== null && max !== null) return ` from ${numberText(min)} to ${numberText(max)}`;
  if (min !== null) return ` from ${numberText(min)}`;
  if (max !== null) return ` up to ${numberText(max)}`;
  return "";
};

/** What a version allowed, so changed ranges show side by side; null when it allowed anything. */
export const constraintsText = (constraints: Constraints | null) => {
  if (constraints === null) return null;
  if (constraints.type === "number") {
    const { integer, min, max } = constraints;
    if (!integer && min === null && max === null) return null;
    return `Allowed: ${integer ? "whole numbers" : "numbers"}${range(min, max)}`;
  }
  const { minSelected, maxSelected } = constraints;
  if (minSelected === null && maxSelected === null) return null;
  return `Allowed: choosing${range(minSelected, maxSelected)} options`;
};
