export { JUMPS_CAP, PAGES_CAP, QUESTIONS_CAP } from "./lib/definition/form-definition.ts";
export { OPTIONS_CAP } from "./lib/definition/types/choice-options.ts";
export { COLUMNS_CAP, ROWS_CAP } from "./lib/definition/types/matrix.ts";
export {
  addOption,
  addPage,
  addQuestion,
  addRow,
  changeQuestionType,
  movePage,
  moveQuestion,
  moveQuestionTo,
  moveRow,
  reidentifyQuestion,
  removeOption,
  clearShowCondition,
  removePage,
  removeQuestion,
  removeRow,
  replaceQuestion,
  setShowCondition,
  setPageDescription,
  setPageTitle,
  upgradeToFormat2,
  type IdSource,
} from "./lib/editing/editing.ts";
