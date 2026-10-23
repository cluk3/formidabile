import { describe, expect, test } from "vite-plus/test";
import {
  AnyAnswers,
  interpretAnswers,
  pathOf,
  validateAnswers,
  type Answers,
} from "@fb/core/answers";
import {
  conditionOperators,
  parseDefinition,
  questionTypes,
  validateForPublish,
  type Condition,
  type FormDefinition,
  type QuestionSnapshotOf,
  type Result,
} from "@fb/core/definition";
import {
  addOption,
  addQuestion,
  addRow,
  changeQuestionType,
  COLUMNS_CAP,
  moveRow,
  removeOption,
  removeRow,
  replaceQuestion,
  ROWS_CAP,
  setShowCondition,
} from "@fb/core/editing";

const id = "00000000-0000-4000-8000-000000000001";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const columns = (...labels: string[]) => labels.map((label, i) => ({ value: `c${i}`, label }));
const rows = (...labels: string[]) => labels.map((label, i) => ({ value: `r${i}`, label }));

const single = (config: object = {}, extra: object = {}) => ({
  type: "single_choice_matrix",
  config: { rows: rows("Speed", "Comfort"), columns: columns("Good", "Poor"), ...config },
  ...extra,
});

const multiple = (config: object = {}, extra: object = {}) => ({
  type: "multiple_choice_matrix",
  config: { rows: rows("Speed", "Comfort"), columns: columns("Good", "Poor"), ...config },
  ...extra,
});

const withQuestion = (question: object) => ({
  format: 1,
  title: "Feedback",
  questions: [{ id, label: "How was the trip?", required: true, ...question }],
});

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

const structureIssues = (question: object) =>
  issuePaths(parseDefinition(withQuestion(question))).map((path) => path.slice(2));

const publishIssues = (question: object) =>
  issuePaths(validateForPublish(withQuestion(question), [])).map((path) => path.slice(2));

const parsedQuestion = <Type extends "single_choice_matrix" | "multiple_choice_matrix">(
  type: Type,
  question: object,
): QuestionSnapshotOf<Type> => {
  const result = parseDefinition(withQuestion(question));
  if (!result.ok || result.value.format !== 1) throw new Error(JSON.stringify(result));
  const snapshot = result.value.questions[0];
  if (snapshot?.type !== type) throw new Error(snapshot?.type ?? "missing");
  return snapshot as QuestionSnapshotOf<Type>;
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const form = (questions: object[]): FormDefinition => {
  const result = parseDefinition({ format: 1, title: "Feedback", questions });
  if (!result.ok || result.value.format !== 1) throw new Error(JSON.stringify(result));
  return deepFreeze(result.value);
};

const idSource = () => {
  let questions = 100;
  let options = 0;
  let pages = 1000;
  return {
    questionId: () => uuid(++questions),
    optionValue: () => `minted-${++options}`,
    pageId: () => uuid(++pages),
  };
};

const leaf = (
  questionId: string,
  operator: string,
  constant?: string[],
  row?: string,
): Condition => ({
  questionId,
  operator,
  ...(constant !== undefined ? { constant } : {}),
  ...(row !== undefined ? { row } : {}),
});

const shown = (definition: FormDefinition, answers: Answers = {}) =>
  pathOf(definition, answers).questions.map((question) => question.id);

describe("matrix structure", () => {
  test("a single-choice matrix has rows and columns, and nothing else", () => {
    expect(structureIssues(single())).toEqual([]);
    expect(structureIssues(single({ display: "radio" }))).toEqual([["config"]]);
    expect(
      structureIssues(single({ rows: rows("Speed").map((row) => ({ ...row, required: true })) })),
    ).toEqual([["config", "rows", 0]]);
  });

  test("a matrix has at most 50 rows and 12 columns, with unique values", () => {
    const manyRows = (n: number) => rows(...Array.from({ length: n }, (_, i) => `Row ${i}`));
    const manyColumns = (n: number) => columns(...Array.from({ length: n }, (_, i) => `Col ${i}`));
    expect(structureIssues(single({ rows: manyRows(50), columns: manyColumns(12) }))).toEqual([]);
    expect(structureIssues(single({ rows: manyRows(51) }))).toEqual([["config", "rows"]]);
    expect(structureIssues(single({ columns: manyColumns(13) }))).toEqual([["config", "columns"]]);
    expect(
      structureIssues(
        single({
          rows: [
            { value: "r", label: "A" },
            { value: "r", label: "B" },
          ],
        }),
      ),
    ).toEqual([["config", "rows", 1, "value"]]);
    expect(
      structureIssues(
        single({
          columns: [
            { value: "c", label: "A" },
            { value: "c", label: "B" },
          ],
        }),
      ),
    ).toEqual([["config", "columns", 1, "value"]]);
    expect(structureIssues(single({ rows: [{ value: "", label: "A" }] }))).toEqual([
      ["config", "rows", 0, "value"],
    ]);
  });

  test("a multiple-choice matrix stores no per-row selection count", () => {
    expect(structureIssues(multiple())).toEqual([]);
    expect(structureIssues(multiple({ minSelected: 1 }))).toEqual([["config"]]);
  });
});

describe("matrix publish", () => {
  test("needs a label, one labelled row, and as many columns as the choice types", () => {
    expect(publishIssues(single())).toEqual([]);
    expect(publishIssues(multiple({ columns: columns("Only") }))).toEqual([]);
    expect(publishIssues({ ...single(), label: "" })).toEqual([["label"]]);
    expect(publishIssues(single({ rows: [] }))).toEqual([["config", "rows"]]);
    expect(publishIssues(single({ columns: columns("Only") }))).toEqual([["config", "columns"]]);
    expect(publishIssues(multiple({ columns: [] }))).toEqual([["config", "columns"]]);
    expect(publishIssues(single({ rows: rows("Speed", "", "Speed") }))).toEqual([
      ["config", "rows", 1, "label"],
      ["config", "rows", 2, "label"],
    ]);
  });

  test("relabelling a row keeps its row value, and a condition on that value still publishes", () => {
    const matrix = {
      id: uuid(1),
      label: "Trip",
      required: false,
      ...single({ rows: rows("Speed") }),
    };
    const follower = {
      id: uuid(2),
      type: "text",
      label: "Why?",
      required: false,
      config: { display: "single_line" },
      showCondition: leaf(uuid(1), "is_any_of", ["c0"], "r0"),
    };
    const definition = form([matrix, follower]);
    const relabelled = replaceQuestion(definition, uuid(1), (question) => {
      if (question.type !== "single_choice_matrix") throw new Error("type");
      return {
        ...question,
        config: {
          ...question.config,
          rows: [{ value: question.config.rows[0]!.value, label: "Pace" }],
        },
      };
    });
    const question = relabelled.format === 1 ? relabelled.questions[0] : undefined;
    if (question?.type !== "single_choice_matrix") throw new Error("type");
    expect(question.config.rows).toEqual([{ value: "r0", label: "Pace" }]);
    expect(validateForPublish(relabelled, [])).toMatchObject({ ok: true });
  });
});

describe("matrix answers", () => {
  const required = parsedQuestion("single_choice_matrix", single());
  const optional = parsedQuestion("single_choice_matrix", { ...single(), required: false });
  const requiredAnswer = questionTypes.single_choice_matrix.answer(required);
  const optionalAnswer = questionTypes.single_choice_matrix.answer(optional);
  const multi = parsedQuestion("multiple_choice_matrix", { ...multiple(), required: false });
  const multiAnswer = questionTypes.multiple_choice_matrix.answer(multi);

  test("a required single-choice matrix needs every row, and one column value each", () => {
    expect(requiredAnswer.safeParse({ r0: "c0", r1: "c1" }).success).toBe(true);
    expect(requiredAnswer.safeParse({ r0: "c0" }).success).toBe(false);
    expect(requiredAnswer.safeParse({}).success).toBe(false);
    expect(requiredAnswer.safeParse({ r0: "c0", r1: "c1", r2: "c0" }).success).toBe(false);
    expect(requiredAnswer.safeParse({ r0: "nope", r1: "c1" }).success).toBe(false);
    expect(requiredAnswer.safeParse({ r0: ["c0"], r1: "c1" }).success).toBe(false);
  });

  test("an optional single-choice matrix accepts any non-empty subset of rows", () => {
    expect(optionalAnswer.safeParse({ r0: "c0" }).success).toBe(true);
    expect(optionalAnswer.safeParse({ r1: "c1" }).success).toBe(true);
    expect(optionalAnswer.safeParse({}).success).toBe(false);
    const definition = form([{ id, label: "Trip", required: false, ...single() }]);
    expect(validateAnswers(definition, {}).ok).toBe(true);
    expect(validateAnswers(definition, { [id]: {} }).ok).toBe(false);
    expect(validateAnswers(definition, { [id]: { r0: "c0" } }).ok).toBe(true);
  });

  test("an answered multiple-choice row has at least one column, with no selection count", () => {
    expect(multiAnswer.safeParse({ r0: ["c0", "c1"] }).success).toBe(true);
    expect(multiAnswer.safeParse({ r0: ["c1", "c0"], r1: ["c0"] }).success).toBe(true);
    expect(multiAnswer.safeParse({ r0: [] }).success).toBe(false);
    expect(multiAnswer.safeParse({ r0: ["c0", "c0"] }).success).toBe(false);
    expect(multiAnswer.safeParse({ r0: ["nope"] }).success).toBe(false);
    expect(multiAnswer.safeParse({}).success).toBe(false);
  });

  test("display names the rows that were answered, in row order", () => {
    expect(questionTypes.single_choice_matrix.display(required, { r1: "c0", r0: "c1" })).toBe(
      "Speed: Poor; Comfort: Good",
    );
    expect(questionTypes.multiple_choice_matrix.display(multi, { r0: ["c1", "c0"] })).toBe(
      "Speed: Good, Poor",
    );
  });

  test("the shared object arm accepts string and string-list values", () => {
    expect(AnyAnswers.safeParse({ [id]: { r0: "c0" } }).success).toBe(true);
    expect(AnyAnswers.safeParse({ [id]: { r0: ["c0", "c1"] } }).success).toBe(true);
    expect(AnyAnswers.safeParse({ [id]: { start: "2026-01-01", end: "2026-01-02" } }).success).toBe(
      true,
    );
    expect(AnyAnswers.safeParse({ [id]: { r0: { nested: "no" } } }).success).toBe(false);
    expect(AnyAnswers.safeParse({ [id]: { r0: 1 } }).success).toBe(false);
  });
});

describe("matrix conditions", () => {
  test("a single-choice row is any of or none of, and a multiple-choice row includes", () => {
    const ids = (type: "single_choice_matrix" | "multiple_choice_matrix") =>
      conditionOperators[type].map((operator) => operator.id);
    expect(ids("single_choice_matrix")).toEqual([
      "is_any_of",
      "is_none_of",
      "is_answered",
      "is_not_answered",
    ]);
    expect(ids("multiple_choice_matrix")).toEqual([
      "includes_any_of",
      "includes_all_of",
      "includes_none_of",
      "is_answered",
      "is_not_answered",
    ]);
    for (const operator of conditionOperators.single_choice_matrix) {
      expect(operator.row === true).toBe(
        operator.id === "is_any_of" || operator.id === "is_none_of",
      );
    }
    expect(
      conditionOperators.single_choice_matrix.find((operator) => operator.id === "is_any_of")
        ?.options,
    ).toBe(true);
  });

  const matrix = (extra: object = {}) => ({
    id: uuid(1),
    label: "Trip",
    required: false,
    ...single(),
    ...extra,
  });
  const multi = {
    id: uuid(1),
    label: "Trip",
    required: false,
    ...multiple(),
  };
  const ask = (source: object, condition: Condition, value: unknown) => {
    const definition = form([
      source,
      {
        id: uuid(2),
        type: "text",
        label: "Why?",
        required: false,
        config: { display: "single_line" },
        showCondition: condition,
      },
    ]);
    const answers = value === undefined ? {} : { [uuid(1)]: value as Answers[string] };
    return shown(definition, answers).includes(uuid(2));
  };

  test("a single-choice row matches one column, and an unanswered row matches nothing else", () => {
    const speedGood = { r0: "c0", r1: "c1" };
    expect(ask(matrix(), leaf(uuid(1), "is_any_of", ["c0"], "r0"), speedGood)).toBe(true);
    expect(ask(matrix(), leaf(uuid(1), "is_any_of", ["c1"], "r0"), speedGood)).toBe(false);
    expect(ask(matrix(), leaf(uuid(1), "is_none_of", ["c0"], "r0"), speedGood)).toBe(false);
    expect(ask(matrix(), leaf(uuid(1), "is_none_of", ["c0"], "r0"), { r0: "c1" })).toBe(true);
    expect(ask(matrix(), leaf(uuid(1), "is_any_of", ["c0"], "r0"), { r1: "c0" })).toBe(false);
    expect(ask(matrix(), leaf(uuid(1), "is_none_of", ["c0"], "r0"), { r1: "c0" })).toBe(false);
    expect(ask(matrix(), leaf(uuid(1), "is_not_answered", undefined, "r0"), { r1: "c0" })).toBe(
      true,
    );
    expect(ask(matrix(), leaf(uuid(1), "is_answered", undefined, "r0"), { r1: "c0" })).toBe(false);
  });

  test("is answered and is not answered also apply to the question as a whole", () => {
    expect(ask(matrix(), leaf(uuid(1), "is_answered"), { r1: "c0" })).toBe(true);
    expect(ask(matrix(), leaf(uuid(1), "is_not_answered"), { r1: "c0" })).toBe(false);
    expect(ask(matrix(), leaf(uuid(1), "is_answered"), undefined)).toBe(false);
    expect(ask(matrix(), leaf(uuid(1), "is_not_answered"), undefined)).toBe(true);
    expect(ask(matrix(), leaf(uuid(1), "is_answered"), {})).toBe(false);
  });

  test("a multiple-choice row includes any, all, or none of the columns", () => {
    expect(
      ask(multi, leaf(uuid(1), "includes_all_of", ["c1", "c0"], "r0"), { r0: ["c0", "c1"] }),
    ).toBe(true);
    expect(ask(multi, leaf(uuid(1), "includes_any_of", ["c1"], "r0"), { r0: ["c0"] })).toBe(false);
    expect(ask(multi, leaf(uuid(1), "includes_none_of", ["c1"], "r0"), { r0: ["c0"] })).toBe(true);
    expect(ask(multi, leaf(uuid(1), "includes_none_of", ["c1"], "r0"), undefined)).toBe(false);
    expect(ask(multi, leaf(uuid(1), "is_answered", undefined, "r1"), { r0: ["c0"] })).toBe(false);
  });

  test("a row value that no longer exists reads as unanswered", () => {
    expect(ask(matrix(), leaf(uuid(1), "is_not_answered", undefined, "gone"), { r0: "c0" })).toBe(
      true,
    );
    expect(ask(matrix(), leaf(uuid(1), "is_answered", undefined, "gone"), { r0: "c0" })).toBe(
      false,
    );
    expect(ask(matrix(), leaf(uuid(1), "is_any_of", ["c0"], "gone"), { r0: "c0" })).toBe(false);
  });

  test("a row operator with no row does not hold", () => {
    expect(ask(matrix(), leaf(uuid(1), "is_any_of", ["c0"]), { r0: "c0" })).toBe(false);
    expect(ask(matrix(), leaf(uuid(1), "is_any_of", ["c0"]), undefined)).toBe(false);
  });

  test("an answer held off the path does not count", () => {
    const definition = form([
      {
        id: uuid(3),
        type: "text",
        label: "Gate",
        required: false,
        config: { display: "single_line" },
      },
      { ...matrix(), showCondition: leaf(uuid(3), "equals", undefined) },
    ]);
    const gated = form([
      {
        id: uuid(3),
        type: "text",
        label: "Gate",
        required: false,
        config: { display: "single_line" },
      },
      {
        ...matrix(),
        showCondition: { questionId: uuid(3), operator: "equals", constant: "go" },
      },
      {
        id: uuid(2),
        type: "text",
        label: "Why?",
        required: false,
        config: { display: "single_line" },
        showCondition: leaf(uuid(1), "is_answered"),
      },
    ]);
    expect(shown(gated, { [uuid(3)]: "stay", [uuid(1)]: { r0: "c0" } })).toEqual([uuid(3)]);
    expect(shown(definition, { [uuid(3)]: "stay", [uuid(1)]: { r0: "c0" } })).toEqual([uuid(3)]);
  });

  test("publish refuses a missing row, a rowless comparison, and an unknown column", () => {
    const problems = (condition: Condition) => {
      const result = validateForPublish(
        form([
          matrix(),
          {
            id: uuid(2),
            type: "text",
            label: "Why?",
            required: false,
            config: { display: "single_line" },
            showCondition: condition,
          },
        ]),
        [],
      );
      return result.ok ? [] : result.issues.map((issue) => issue.message);
    };
    expect(problems(leaf(uuid(1), "is_any_of", ["c0"], "r0"))).toEqual([]);
    expect(problems(leaf(uuid(1), "is_answered"))).toEqual([]);
    expect(problems(leaf(uuid(1), "is_answered", undefined, "r0"))).toEqual([]);
    expect(problems(leaf(uuid(1), "is_any_of", ["c0"]))).toEqual(["This operator needs a row"]);
    expect(problems(leaf(uuid(1), "is_any_of", ["c0"], "gone"))).toEqual([
      "This condition names a row value the question does not have",
    ]);
    expect(problems(leaf(uuid(1), "is_any_of", ["nope"], "r0"))).toEqual([
      "This condition names an option value the question does not have",
    ]);
  });

  test("removing a row leaves the condition, and publish refuses it", () => {
    const definition = setShowCondition(
      form([
        matrix(),
        {
          id: uuid(2),
          type: "text",
          label: "Why?",
          required: false,
          config: { display: "single_line" },
        },
      ]),
      uuid(2),
      leaf(uuid(1), "is_any_of", ["c0"], "r0"),
    );
    const removed = removeRow(definition, uuid(1), "r0");
    const follower = removed.format === 1 ? removed.questions[1] : undefined;
    expect(follower?.showCondition).toEqual(leaf(uuid(1), "is_any_of", ["c0"], "r0"));
    const published = validateForPublish(removed, []);
    expect(published.ok).toBe(false);
    if (!published.ok)
      expect(published.issues.map((issue) => issue.message)).toContain(
        "This condition names a row value the question does not have",
      );
  });
});

describe("matrix editing", () => {
  const blank = () => {
    const ids = idSource();
    return {
      ids,
      definition: addQuestion(form([]), "single_choice_matrix", ids),
    };
  };

  test("adds, removes and reorders rows, minting values from the option source", () => {
    const { ids, definition } = blank();
    const questionId = definition.format === 1 ? definition.questions[0]!.id : "";
    const added = addRow(definition, questionId, ids);
    const rowsOf = (value: FormDefinition) => {
      const question = value.format === 1 ? value.questions[0] : undefined;
      if (question?.type !== "single_choice_matrix") throw new Error("type");
      return question.config.rows;
    };
    expect(rowsOf(definition).map((row) => row.value)).toEqual(["minted-1"]);
    expect(rowsOf(added).map((row) => row.value)).toEqual(["minted-1", "minted-4"]);
    const moved = moveRow(added, questionId, "minted-4", 0);
    expect(rowsOf(moved).map((row) => row.value)).toEqual(["minted-4", "minted-1"]);
    const removed = removeRow(moved, questionId, "minted-1");
    expect(rowsOf(removed)).toEqual([{ value: "minted-4", label: "" }]);
    expect(() => removeRow(removed, questionId, "minted-1")).toThrow(
      `Question ${questionId} has no row minted-1`,
    );
    expect(() => moveRow(removed, questionId, "minted-4", 1)).toThrow("No position 1 among 1 rows");
  });

  test("refuses a 51st row and a 13th column, and carries columns across a type change", () => {
    const ids = idSource();
    let definition = addQuestion(form([]), "multiple_choice_matrix", ids);
    const questionId = definition.format === 1 ? definition.questions[0]!.id : "";
    for (let i = 1; i < ROWS_CAP; i += 1) definition = addRow(definition, questionId, ids);
    expect(() => addRow(definition, questionId, ids)).toThrow(
      `A matrix has at most ${ROWS_CAP} rows`,
    );

    let wide = addQuestion(form([]), "single_choice_matrix", idSource());
    const wideId = wide.format === 1 ? wide.questions[0]!.id : "";
    for (let i = 2; i < COLUMNS_CAP; i += 1) wide = addOption(wide, wideId, idSource());
    expect(() => addOption(wide, wideId, idSource())).toThrow(
      `A matrix has at most ${COLUMNS_CAP} columns`,
    );

    const carried = idSource();
    const choice = addQuestion(form([]), "single_choice", carried);
    const choiceId = choice.format === 1 ? choice.questions[0]!.id : "";
    const matrix = changeQuestionType(choice, choiceId, "single_choice_matrix", carried);
    const question = matrix.format === 1 ? matrix.questions[0] : undefined;
    if (question?.type !== "single_choice_matrix") throw new Error("type");
    const previous = choice.format === 1 ? choice.questions[0] : undefined;
    if (previous?.type !== "single_choice") throw new Error("type");
    expect(question.config.columns).toEqual(previous.config.options);
    expect(question.config.rows).toHaveLength(1);
    expect(question.id).not.toBe(choiceId);

    expect(() => addRow(choice, choiceId, idSource())).toThrow(`Question ${choiceId} has no rows`);
    expect(() =>
      removeOption(
        form([
          { id, type: "text", label: "T", required: false, config: { display: "single_line" } },
        ]),
        id,
        "x",
      ),
    ).toThrow(`Question ${id} has no options`);
  });
});

describe("matrix read-back", () => {
  test("interpretAnswers shows the rows that were answered", () => {
    const definition = form([{ id, label: "Trip", required: false, ...single() }]);
    const [row] = interpretAnswers(definition, { [id]: { r1: "c0", r0: "c1" } }, [id]);
    expect(row).toMatchObject({
      status: "answered",
      answer: { display: "Speed: Poor; Comfort: Good" },
    });
    expect(interpretAnswers(definition, {}, [id])[0]).toMatchObject({ status: "skipped" });
  });
});
