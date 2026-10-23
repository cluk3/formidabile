# 13: Ask a matrix

**What to build:** A single-choice matrix and a multiple-choice matrix have stable row values and ordinary columns. A required matrix needs every row; an optional one accepts any subset of rows. Conditions address one row. The respondent gets a grid when the form is wide and stacked groups when it is narrow, and each optional radio row has Clear answer. Analytics show a count and a share for each row and column. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [x] The question types are `single_choice_matrix` and `multiple_choice_matrix`. They store different answers: one option value per row, or a list of option values per row. The answer is an object keyed by row value. Date range, matrix, and address share that object arm; add it if an earlier ticket has not.
- [x] A matrix has 1 to 50 rows. Each row has a builder-minted row value and a label, and row values are unique. Relabelling a row keeps its row value. The builder can add, remove, and reorder rows. Columns use the existing option model, at most 12, with the same minimum number of columns as single choice or multiple choice has options.
- [x] A required matrix needs every row. An optional matrix accepts any subset of rows. An answered multiple-choice row has at least one column. A matrix with no answered row has no answer key. There is no per-row required flag and no per-row selection count.
- [x] A condition names the question and a row value. A single-choice row offers is any of and is none of. A multiple-choice row offers includes any of, includes all of, and includes none of. Every row, and the question as a whole, also offers is answered and is not answered.
- [x] Removing a row that a condition names leaves that condition in place and marked broken, and publish refuses it.
- [x] When the element is wide, a matrix is a grid. When it is narrow, it is one group per row, each labelled by the row. The switch follows the element's own width. An optional single-choice row has Clear answer.
- [x] Analytics report a count and a share for each row and column. The base is the answered rows of the versions that had both that row and that column. No raw matrix answers are returned.
- [x] The advisory answer schema describes a matrix as an object with one property per row value. This ticket does not bump `info.version`.
- [x] Tests cover structure, publish, the row rules, display, and the operators at the core entry point; the advisory schema and the matrix aggregates through the HTTP API; the matrix aggregates on both PGlite and Postgres; the grid, the narrow groups, and Clear answer in the renderer; and the row editor in the builder.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.
