import {
  questionsOf,
  type FormDefinition,
  type QuestionSnapshot,
  type QuestionSnapshotOf,
} from "@fb/core/definition";
import type {
  AnalyticsConstraints,
  AnalyticsSummary,
  FormAnalytics,
  QuestionAnalytics,
} from "../envelopes.ts";

type Question = QuestionSnapshot;
type ChoiceQuestion = QuestionSnapshotOf<"single_choice" | "multiple_choice">;

export interface NumberAggregate {
  readonly count: number;
  /** All four are null when `count` is 0. */
  readonly min: number | null;
  readonly max: number | null;
  readonly mean: number | null;
  readonly median: number | null;
}

/** The per-form query results, with every version's definition (ADR 0009). */
export interface AnalyticsCounts {
  readonly formId: string;
  /** Every version; the highest-numbered one is current. */
  readonly versions: ReadonlyArray<{
    readonly id: string;
    readonly number: number;
    readonly publishedAt: Date;
    readonly responses: number;
    readonly definition: FormDefinition;
  }>;
  /** Answer rows per version and question. */
  readonly answered: ReadonlyArray<{
    readonly versionId: string;
    readonly questionId: string;
    readonly count: number;
  }>;
  /**
   * Single-choice values, boolean values as `"true"` and `"false"`, and each option selected in a
   * multiple-choice answer, per version and question.
   */
  readonly choices: ReadonlyArray<{
    readonly versionId: string;
    readonly questionId: string;
    readonly value: string;
    readonly count: number;
  }>;
  readonly numbers: ReadonlyArray<
    NumberAggregate & { readonly versionId: string; readonly questionId: string }
  >;
  /** Across every version: medians can't be combined from per-version medians. */
  readonly combinedNumbers: ReadonlyArray<NumberAggregate & { readonly questionId: string }>;
  /**
   * Promoter, passive and detractor counts for every number question. The merge keeps them only for
   * versions whose snapshot uses the NPS display.
   */
  readonly nps: ReadonlyArray<{
    readonly versionId: string;
    readonly questionId: string;
    readonly promoters: number;
    readonly passives: number;
    readonly detractors: number;
  }>;
  /** Sum of 1-based places and first-place counts, per version, question and option. */
  readonly rankings: ReadonlyArray<{
    readonly versionId: string;
    readonly questionId: string;
    readonly value: string;
    readonly positionSum: number;
    readonly firstPlace: number;
  }>;
}

const noNumbers: NumberAggregate = { count: 0, min: null, max: null, mean: null, median: null };

const key = (versionId: string, questionId: string) => `${versionId} ${questionId}`;

/** Where something appeared: a version, and its position there. */
interface Appearance<T> {
  readonly number: number;
  readonly position: number;
  readonly item: T;
}

/**
 * Most recent first: what the latest version has, in its order, then what earlier versions dropped, most
 * recently dropped first, each in its last version's order. Each list of appearances is ascending.
 */
const byRecency = <K, T>(appearances: ReadonlyArray<readonly [K, ReadonlyArray<Appearance<T>>]>) =>
  [...appearances].sort(([, a], [, b]) => {
    const lastA = a.at(-1)!;
    const lastB = b.at(-1)!;
    return lastB.number - lastA.number || lastA.position - lastB.position;
  });

/** The latest label, and every other distinct label with the versions that used it. */
const labelling = (labels: ReadonlyArray<{ readonly number: number; readonly label: string }>) => {
  const label = labels.at(-1)!.label;
  const others = new Map<string, Array<number>>();
  for (const { number, label: other } of labels) {
    if (other === label) continue;
    const versions = others.get(other);
    if (versions === undefined) others.set(other, [number]);
    else versions.push(number);
  }
  return {
    label,
    otherLabels: [...others].map(([other, versions]) => ({ label: other, versions })),
  };
};

const constraintsOf = (question: Question): AnalyticsConstraints | null => {
  switch (question.type) {
    case "number":
      return {
        type: "number",
        integer: question.config.integer,
        min: question.config.min ?? null,
        max: question.config.max ?? null,
      };
    case "multiple_choice":
      return {
        type: "multiple_choice",
        minSelected: question.config.minSelected ?? null,
        maxSelected: question.config.maxSelected ?? null,
      };
    default:
      return null;
  }
};

/** Combines the query results with the version definitions into the `FormAnalytics` body (ADR 0009). */
export const mergeAnalytics = (counts: AnalyticsCounts): FormAnalytics => {
  const versions = [...counts.versions].sort((a, b) => a.number - b.number);
  const current = versions.at(-1)?.number;

  const answered = new Map(counts.answered.map((row) => [key(row.versionId, row.questionId), row]));
  const numbers = new Map(counts.numbers.map((row) => [key(row.versionId, row.questionId), row]));
  const combinedNumbers = new Map(counts.combinedNumbers.map((row) => [row.questionId, row]));
  const nps = new Map(counts.nps.map((row) => [key(row.versionId, row.questionId), row]));
  const rankings = new Map<string, Map<string, { positionSum: number; firstPlace: number }>>();
  for (const row of counts.rankings) {
    const at = key(row.versionId, row.questionId);
    const values = rankings.get(at) ?? new Map<string, { positionSum: number; firstPlace: number }>();
    values.set(row.value, {
      positionSum: Number(row.positionSum),
      firstPlace: Number(row.firstPlace),
    });
    rankings.set(at, values);
  }
  const choices = new Map<string, Map<string, number>>();
  for (const row of counts.choices) {
    const at = key(row.versionId, row.questionId);
    const values = choices.get(at) ?? new Map<string, number>();
    values.set(row.value, (values.get(row.value) ?? 0) + row.count);
    choices.set(at, values);
  }

  interface Snapshot {
    readonly versionId: string;
    readonly responses: number;
    readonly answered: number;
    readonly values: ReadonlyMap<string, number>;
    readonly ranking: ReadonlyMap<string, { positionSum: number; firstPlace: number }>;
    readonly question: Question;
  }
  const appearances = new Map<string, Array<Appearance<Snapshot>>>();
  for (const version of versions)
    questionsOf(version.definition).forEach((question, position) => {
      const at = key(version.id, question.id);
      const list = appearances.get(question.id) ?? [];
      list.push({
        number: version.number,
        position,
        item: {
          versionId: version.id,
          responses: version.responses,
          answered: answered.get(at)?.count ?? 0,
          values: choices.get(at) ?? new Map(),
          ranking: rankings.get(at) ?? new Map(),
          question,
        },
      });
      appearances.set(question.id, list);
    });

  /** Promoters' share minus detractors' share, in percentage points. Null when nobody answered. */
  const npsPercent = (promoters: number, detractors: number, answeredCount: number) =>
    answeredCount === 0 ? null : Math.round(((promoters - detractors) / answeredCount) * 100);

  /** Set only when this version's snapshot uses the NPS display. */
  const npsOf = (question: Question, versionId: string, answeredCount: number) => {
    if (question.type !== "number" || question.config.display !== "nps") return undefined;
    const buckets = nps.get(key(versionId, question.id));
    const promoters = buckets?.promoters ?? 0;
    const passives = buckets?.passives ?? 0;
    const detractors = buckets?.detractors ?? 0;
    return {
      promoters,
      passives,
      detractors,
      answered: answeredCount,
      score: npsPercent(promoters, detractors, answeredCount),
    };
  };

  /** A version's own choice summary lists only the options it offered. */
  const versionSummary = (
    number: number,
    { question, answered, values, versionId, ranking }: Snapshot,
  ): AnalyticsSummary => {
    switch (question.type) {
      case "single_choice":
      case "multiple_choice":
        return {
          type: question.type,
          options: question.config.options.map((option) => ({
            value: option.value,
            label: option.label,
            otherLabels: [],
            count: values.get(option.value) ?? 0,
            base: answered,
            offeredIn: [number],
          })),
        };
      case "boolean":
        return {
          type: "boolean",
          trueCount: values.get("true") ?? 0,
          falseCount: values.get("false") ?? 0,
        };
      case "number": {
        const { count, min, max, mean, median } =
          numbers.get(key(versionId, question.id)) ?? noNumbers;
        const summary = { type: "number" as const, count, min, max, mean, median };
        const score = npsOf(question, versionId, answered);
        return score === undefined ? summary : { ...summary, nps: score };
      }
      case "ranking":
        return {
          type: "ranking",
          options: question.config.options.map((option) => {
            const row = ranking.get(option.value);
            return {
              value: option.value,
              label: option.label,
              otherLabels: [],
              meanPosition: answered === 0 ? null : (row?.positionSum ?? 0) / answered,
              firstPlace: row?.firstPlace ?? 0,
              base: answered,
              offeredIn: [number],
            };
          }),
        };
      default:
        return { type: question.type };
    }
  };

  const combinedSummary = (
    snapshots: ReadonlyArray<Appearance<Snapshot>>,
    question: Question,
  ): AnalyticsSummary => {
    switch (question.type) {
      case "single_choice":
      case "multiple_choice": {
        // Options match by value, never by label.
        const offers = new Map<string, Array<Appearance<{ label: string; snapshot: Snapshot }>>>();
        for (const { number, item } of snapshots)
          (item.question as ChoiceQuestion).config.options.forEach((option, position) => {
            const list = offers.get(option.value) ?? [];
            list.push({ number, position, item: { label: option.label, snapshot: item } });
            offers.set(option.value, list);
          });
        return {
          type: question.type,
          options: byRecency([...offers]).map(([value, offered]) => ({
            value,
            ...labelling(offered.map(({ number, item }) => ({ number, label: item.label }))),
            count: offered.reduce(
              (sum, { item }) => sum + (item.snapshot.values.get(value) ?? 0),
              0,
            ),
            base: offered.reduce((sum, { item }) => sum + item.snapshot.answered, 0),
            offeredIn: offered.map(({ number }) => number),
          })),
        };
      }
      case "boolean":
        return {
          type: "boolean",
          trueCount: snapshots.reduce((sum, { item }) => sum + (item.values.get("true") ?? 0), 0),
          falseCount: snapshots.reduce((sum, { item }) => sum + (item.values.get("false") ?? 0), 0),
        };
      case "number": {
        const { count, min, max, mean, median } = combinedNumbers.get(question.id) ?? noNumbers;
        const summary = { type: "number" as const, count, min, max, mean, median };
        const scores = snapshots.flatMap(({ item }) => {
          const score = npsOf(item.question, item.versionId, item.answered);
          return score === undefined ? [] : [score];
        });
        if (scores.length === 0) return summary;
        const promoters = scores.reduce((sum, score) => sum + score.promoters, 0);
        const passives = scores.reduce((sum, score) => sum + score.passives, 0);
        const detractors = scores.reduce((sum, score) => sum + score.detractors, 0);
        const answered = scores.reduce((sum, score) => sum + score.answered, 0);
        return {
          ...summary,
          nps: {
            promoters,
            passives,
            detractors,
            answered,
            score: npsPercent(promoters, detractors, answered),
          },
        };
      }
      case "ranking": {
        const offers = new Map<
          string,
          Array<Appearance<{ label: string; snapshot: Snapshot }>>
        >();
        for (const { number, item } of snapshots)
          if (item.question.type === "ranking")
            item.question.config.options.forEach((option, position) => {
              const list = offers.get(option.value) ?? [];
              list.push({ number, position, item: { label: option.label, snapshot: item } });
              offers.set(option.value, list);
            });
        return {
          type: "ranking",
          options: byRecency([...offers]).map(([value, offered]) => {
            const base = offered.reduce((sum, { item }) => sum + item.snapshot.answered, 0);
            const positionSum = offered.reduce(
              (sum, { item }) => sum + (item.snapshot.ranking.get(value)?.positionSum ?? 0),
              0,
            );
            return {
              value,
              ...labelling(offered.map(({ number, item }) => ({ number, label: item.label }))),
              meanPosition: base === 0 ? null : positionSum / base,
              firstPlace: offered.reduce(
                (sum, { item }) => sum + (item.snapshot.ranking.get(value)?.firstPlace ?? 0),
                0,
              ),
              base,
              offeredIn: offered.map(({ number }) => number),
            };
          }),
        };
      }
      default:
        return { type: question.type };
    }
  };

  const questions = byRecency([...appearances]).map(([, snapshots]): QuestionAnalytics => {
    const latest = snapshots.at(-1)!;
    const question = latest.item.question;
    const present = new Map(snapshots.map((snapshot) => [snapshot.number, snapshot.item]));
    const responses = snapshots.reduce((sum, { item }) => sum + item.responses, 0);
    const answeredCount = snapshots.reduce((sum, { item }) => sum + item.answered, 0);
    return {
      questionId: question.id,
      type: question.type,
      ...labelling(snapshots.map(({ number, item }) => ({ number, label: item.question.label }))),
      inCurrentVersion: latest.number === current,
      combined: {
        responses,
        answered: answeredCount,
        skipped: responses - answeredCount,
        absentResponses: versions
          .filter((version) => !present.has(version.number))
          .reduce((sum, version) => sum + version.responses, 0),
        summary: combinedSummary(snapshots, question),
      },
      byVersion: versions.map((version) => {
        const snapshot = present.get(version.number);
        if (snapshot === undefined) return { version: version.number, present: false as const };
        return {
          version: version.number,
          present: true as const,
          responses: snapshot.responses,
          answered: snapshot.answered,
          skipped: snapshot.responses - snapshot.answered,
          summary: versionSummary(version.number, snapshot),
          constraints: constraintsOf(snapshot.question),
        };
      }),
    };
  });

  return {
    formId: counts.formId,
    totalResponses: versions.reduce((sum, version) => sum + version.responses, 0),
    versions: versions.map((version) => ({
      versionId: version.id,
      number: version.number,
      publishedAt: version.publishedAt,
      responses: version.responses,
    })),
    questions,
  };
};
