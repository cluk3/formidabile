export { JUMPS_CAP, PAGES_CAP, QUESTIONS_CAP } from "./lib/definition/form-definition.ts";
export { OPTIONS_CAP } from "./lib/definition/types/choice-options.ts";
export {
  addOption,
  addPage,
  addQuestion,
  changeQuestionType,
  movePage,
  moveQuestion,
  moveQuestionTo,
  reidentifyQuestion,
  removeOption,
  removePage,
  removeQuestion,
  replaceQuestion,
  setPageDescription,
  setPageTitle,
  upgradeToFormat2,
  type IdSource,
} from "./lib/editing/editing.ts";
