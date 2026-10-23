import { describe, expect, test } from "vite-plus/test";
import { parseDefinition, type FormDefinition } from "@fb/core/definition";
import {
  addPage,
  addQuestion,
  movePage,
  moveQuestionTo,
  PAGES_CAP,
  removePage,
  setPageDescription,
  setPageTitle,
} from "@fb/core/editing";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

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

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

/** Parsed and frozen, so an editing function that mutates its input throws. */
const freeze = (input: unknown) => {
  const result = parseDefinition(input);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return deepFreeze(result.value);
};

const name = {
  id: uuid(1),
  type: "text",
  label: "Name",
  required: true,
  config: { display: "single_line" },
} as const;
const colour = {
  id: uuid(2),
  type: "single_choice",
  label: "Favourite colour",
  required: false,
  config: {
    options: [
      { value: "r", label: "Red" },
      { value: "g", label: "Green" },
    ],
    display: "radio",
  },
} as const;
const age = {
  id: uuid(3),
  type: "number",
  label: "Age",
  required: true,
  config: { integer: true },
} as const;

const survey = () => {
  const definition = freeze({
    format: 2,
    title: "Survey",
    pages: [
      { id: uuid(7), title: "Start", questions: [name, colour], jumps: [] },
      {
        id: uuid(8),
        questions: [age],
        jumps: [{ condition: { questionId: name.id, operator: "answered" }, target: "end" }],
      },
    ],
  });
  if (definition.format !== 2) throw new Error("format");
  return definition;
};

const format1 = freeze({ format: 1, title: "Survey", questions: [name] });

describe("addPage", () => {
  test("inserts an empty page with a minted id, at the end or at an index", () => {
    const ids = idSource();
    const end = addPage(survey(), ids);
    expect(end.pages).toHaveLength(3);
    expect(end.pages[2]).toEqual({ id: uuid(1001), questions: [], jumps: [] });
    expect(end.pages[0]).toEqual(survey().pages[0]);
    expect(end.pages[1]).toEqual(survey().pages[1]);
    expect(freeze(end)).toEqual(end);

    const inserted = addPage(survey(), ids, 1);
    expect(inserted.pages.map((page) => page.id)).toEqual([uuid(7), uuid(1002), uuid(8)]);
    expect(inserted.pages[1]).toEqual({ id: uuid(1002), questions: [], jumps: [] });
  });

  test("refuses a 51st page, a format 1 definition, and an index past the end", () => {
    const ids = idSource();
    let full = survey();
    while (full.pages.length < PAGES_CAP) full = addPage(full, ids);
    expect(full.pages).toHaveLength(PAGES_CAP);
    expect(() => addPage(full, ids)).toThrow(`A form has at most ${PAGES_CAP} pages`);
    expect(() => addPage(format1, ids)).toThrow("Pages are edited on a format 2 definition");
    expect(() => addPage(survey(), ids, 3)).toThrow("No position 3 among 2 pages");
  });
});

describe("removePage", () => {
  test("removes the page and its questions, and leaves a jump that named it", () => {
    const start = survey();
    const edited = removePage(start, uuid(7));
    expect(edited.pages).toEqual([start.pages[1]]);
    expect(edited.pages[0]!.questions.map((question) => question.id)).toEqual([age.id]);
    expect(edited.pages[0]!.jumps).toEqual(start.pages[1]!.jumps);
    expect(freeze(edited)).toEqual(edited);
  });

  test("refuses the last page and an unknown page", () => {
    const only = removePage(survey(), uuid(7));
    expect(() => removePage(only, uuid(8))).toThrow("A form needs a page");
    expect(() => removePage(survey(), uuid(9))).toThrow(`No page ${uuid(9)}`);
    expect(() => removePage(format1, uuid(7))).toThrow("Pages are edited on a format 2 definition");
  });
});

describe("movePage", () => {
  test("reorders pages without changing their ids, questions, or jumps", () => {
    const start = survey();
    const edited = movePage(start, uuid(8), 0);
    expect(edited.pages.map((page) => page.id)).toEqual([uuid(8), uuid(7)]);
    expect(edited.pages[0]).toBe(start.pages[1]);
    expect(edited.pages[1]).toBe(start.pages[0]);
    expect(freeze(edited)).toEqual(edited);
    expect(movePage(start, uuid(7), 0).pages.map((page) => page.id)).toEqual([uuid(7), uuid(8)]);
  });

  test("refuses an unknown page and a position outside the form", () => {
    expect(() => movePage(survey(), uuid(9), 0)).toThrow(`No page ${uuid(9)}`);
    expect(() => movePage(survey(), uuid(7), 2)).toThrow("No position 2 among 2 pages");
  });
});

describe("setPageTitle and setPageDescription", () => {
  test("sets and clears a page's title and description", () => {
    const titled = setPageTitle(survey(), uuid(8), "Details");
    const described = setPageDescription(titled, uuid(8), "A bit more");
    expect(described.pages[1]).toMatchObject({ title: "Details", description: "A bit more" });
    expect(described.pages[0]).toEqual(survey().pages[0]);
    expect(described.pages[1]!.jumps).toEqual(survey().pages[1]!.jumps);
    expect(freeze(described)).toEqual(described);

    const cleared = setPageDescription(setPageTitle(described, uuid(8), ""), uuid(8), undefined);
    expect(cleared.pages[1]).not.toHaveProperty("title");
    expect(cleared.pages[1]).not.toHaveProperty("description");
    expect(freeze(cleared)).toEqual(cleared);
  });

  test("refuses an unknown page", () => {
    expect(() => setPageTitle(survey(), uuid(9), "Details")).toThrow(`No page ${uuid(9)}`);
    expect(() => setPageDescription(format1, uuid(7), "More")).toThrow(
      "Pages are edited on a format 2 definition",
    );
  });
});

describe("moveQuestionTo", () => {
  test("moves a question onto another page at an index, keeping its identity", () => {
    const start = survey();
    const moved = moveQuestionTo(start, name.id, uuid(8), 0);
    expect(moved.pages[0]!.questions.map((question) => question.id)).toEqual([colour.id]);
    expect(moved.pages[1]!.questions.map((question) => question.id)).toEqual([name.id, age.id]);
    expect(moved.pages[1]!.questions[0]).toEqual(start.pages[0]!.questions[0]);
    expect(moved.pages[1]!.questions[0]!.id).toBe(name.id);
    expect(moved.pages[0]!.id).toBe(uuid(7));
    expect(moved.pages[1]!.jumps).toEqual(start.pages[1]!.jumps);
    expect(moved.pages[0]!.title).toBe("Start");
    expect(freeze(moved)).toEqual(moved);

    const appended = moveQuestionTo(start, colour.id, uuid(8), 1);
    expect(appended.pages[1]!.questions.map((question) => question.id)).toEqual([
      age.id,
      colour.id,
    ]);
  });

  test("reorders within a page when the destination is that page", () => {
    const moved = moveQuestionTo(survey(), colour.id, uuid(7), 0);
    expect(moved.pages[0]!.questions.map((question) => question.id)).toEqual([colour.id, name.id]);
    expect(moved.pages[1]!.questions.map((question) => question.id)).toEqual([age.id]);
  });

  test("refuses a format 1 definition, an unknown question or page, and an index past the end", () => {
    expect(() => moveQuestionTo(format1, name.id, uuid(7), 0)).toThrow(
      "Pages are edited on a format 2 definition",
    );
    expect(() => moveQuestionTo(survey(), uuid(9), uuid(8), 0)).toThrow(`No question ${uuid(9)}`);
    expect(() => moveQuestionTo(survey(), name.id, uuid(9), 0)).toThrow(`No page ${uuid(9)}`);
    expect(() => moveQuestionTo(survey(), name.id, uuid(8), 2)).toThrow(
      "No position 2 among 1 questions on the page",
    );
  });
});

test("addQuestion can append to a chosen page", () => {
  const edited = addQuestion(survey(), "email", idSource(), uuid(7));
  if (edited.format !== 2) throw new Error("format");
  expect(edited.pages[0]!.questions.map((question) => question.type)).toEqual([
    "text",
    "single_choice",
    "email",
  ]);
  expect(edited.pages[1]!.questions.map((question) => question.id)).toEqual([age.id]);
  expect(edited.pages[0]!.questions[2]!.id).toBe(uuid(101));
});

test("addQuestion still refuses a page id on format 1", () => {
  expect(() => addQuestion(format1 as FormDefinition, "text", idSource(), uuid(7))).toThrow(
    "Pages are edited on a format 2 definition",
  );
});
