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
type MatrixQuestion = QuestionSnapshotOf<"single_choice_matrix" | "multiple_choice_matrix">;

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
  /** Stored path rows per version and question: responses that were shown it. */
  readonly shown: ReadonlyArray<{
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
  /** Column selections in a matrix, per version, question, row and column. */
  readonly matrixCells: ReadonlyArray<{
    readonly versionId: string;
    readonly questionId: string;
    readonly row: string;
    readonly column: string;
    readonly count: number;
  }>;
  /** Answered rows of a matrix, per version and question. The cell base is summed from these. */
  readonly matrixAnsweredRows: ReadonlyArray<{
    readonly versionId: string;
    readonly questionId: string;
    readonly row: string;
    readonly count: number;
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
  const shown = new Map(counts.shown.map((row) => [key(row.versionId, row.questionId), row]));
  const numbers = new Map(counts.numbers.map((row) => [key(row.versionId, row.questionId), row]));
  const combinedNumbers = new Map(counts.combinedNumbers.map((row) => [row.questionId, row]));
  const nps = new Map(counts.nps.map((row) => [key(row.versionId, row.questionId), row]));
  const matrixCells = new Map(
    counts.matrixCells.map((cell) => [
      `${cell.versionId} ${cell.questionId} ${cell.row} ${cell.column}`,
      cell.count,
    ]),
  );
  const matrixRows = new Map(
    counts.matrixAnsweredRows.map((row) => [
      `${row.versionId} ${row.questionId} ${row.row}`,
      row.count,
    ]),
  );
  const cellCount = (versionId: string, questionId: string, row: string, column: string) =>
    matrixCells.get(`${versionId} ${questionId} ${row} ${column}`) ?? 0;
  const answeredRows = (versionId: string, questionId: string, row: string) =>
    matrixRows.get(`${versionId} ${questionId} ${row}`) ?? 0;
  /** Whole percentage. Null when no answered row could have chosen the column. */
  const shareOf = (selected: number, base: number) =>
    base === 0 ? null : Math.round((selected / base) * 100);
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
    readonly shown: number;
    readonly answered: number;
    readonly values: ReadonlyMap<string, number>;
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
          shown: shown.get(at)?.count ?? 0,
          answered: answered.get(at)?.count ?? 0,
          values: choices.get(at) ?? new Map(),
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
    { question, answered, values, versionId }: Snapshot,
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
      case "single_choice_matrix":
      case "multiple_choice_matrix":
        return {
          type: question.type,
          cells: question.config.rows.flatMap((row) =>
            question.config.columns.map((column) => {
              const selected = cellCount(versionId, question.id, row.value, column.value);
              const base = answeredRows(versionId, question.id, row.value);
              return {
                row: row.value,
                rowLabel: row.label,
                otherRowLabels: [],
                column: column.value,
                columnLabel: column.label,
                otherColumnLabels: [],
                count: selected,
                base,
                share: shareOf(selected, base),
              };
            }),
          ),
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
      case "single_choice_matrix":
      case "multiple_choice_matrix":
        return combinedMatrix(snapshots, question);
      default:
        return { type: question.type };
    }
  };

  const combinedMatrix = (
    snapshots: ReadonlyArray<Appearance<Snapshot>>,
    question: MatrixQuestion,
  ): AnalyticsSummary => {
    const pairs = new Map<
      string,
      Array<
        Appearance<{
          readonly row: string;
          readonly column: string;
          readonly rowLabel: string;
          readonly columnLabel: string;
          readonly snapshot: Snapshot;
        }>
      >
    >();
    for (const { number, item } of snapshots) {
      const snapshot = item.question;
      if (snapshot.type !== "single_choice_matrix" && snapshot.type !== "multiple_choice_matrix")
        continue;
      if (snapshot.type !== question.type) continue;
      snapshot.config.rows.forEach((row, rowIndex) => {
        snapshot.config.columns.forEach((column, columnIndex) => {
          const id = `${row.value}\0${column.value}`;
          const list = pairs.get(id) ?? [];
          list.push({
            number,
            position: rowIndex * 1000 + columnIndex,
            item: {
              row: row.value,
              column: column.value,
              rowLabel: row.label,
              columnLabel: column.label,
              snapshot: item,
            },
          });
          pairs.set(id, list);
        });
      });
    }
    return {
      type: question.type,
      cells: byRecency([...pairs]).map(([, offered]) => {
        const { row, column } = offered[0]!.item;
        const selected = offered.reduce(
          (sum, { item }) => sum + cellCount(item.snapshot.versionId, question.id, row, column),
          0,
        );
        const base = offered.reduce(
          (sum, { item }) => sum + answeredRows(item.snapshot.versionId, question.id, row),
          0,
        );
        const rowLabels = labelling(
          offered.map(({ number, item }) => ({ number, label: item.rowLabel })),
        );
        const columnLabels = labelling(
          offered.map(({ number, item }) => ({ number, label: item.columnLabel })),
        );
        return {
          row,
          rowLabel: rowLabels.label,
          otherRowLabels: rowLabels.otherLabels,
          column,
          columnLabel: columnLabels.label,
          otherColumnLabels: columnLabels.otherLabels,
          count: selected,
          base,
          share: shareOf(selected, base),
        };
      }),
    };
  };

  const questions = byRecency([...appearances]).map(([, snapshots]): QuestionAnalytics => {
    const latest = snapshots.at(-1)!;
    const question = latest.item.question;
    const present = new Map(snapshots.map((snapshot) => [snapshot.number, snapshot.item]));
    const responses = snapshots.reduce((sum, { item }) => sum + item.responses, 0);
    const shownCount = snapshots.reduce((sum, { item }) => sum + item.shown, 0);
    const answeredCount = snapshots.reduce((sum, { item }) => sum + item.answered, 0);
    return {
      questionId: question.id,
      type: question.type,
      ...labelling(snapshots.map(({ number, item }) => ({ number, label: item.question.label }))),
      inCurrentVersion: latest.number === current,
      combined: {
        responses,
        shown: shownCount,
        answered: answeredCount,
        skipped: shownCount - answeredCount,
        notShown: responses - shownCount,
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
          shown: snapshot.shown,
          answered: snapshot.answered,
          skipped: snapshot.shown - snapshot.answered,
          notShown: snapshot.responses - snapshot.shown,
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
