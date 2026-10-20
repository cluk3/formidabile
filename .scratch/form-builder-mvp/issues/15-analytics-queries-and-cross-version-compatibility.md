# Analytics queries and cross-version compatibility

Type: grilling
Status: resolved
Blocked by: 08, 10
Map: [Form builder MVP](../map.md)

## Question

How are the MVP analytics (ADR 0001 §8.2, as narrowed by [MVP product calls on the ADR open questions](./05-mvp-product-calls-on-the-adr-open-questions.md)) computed over the answer rows from [Persistence model](./10-persistence-model.md), and when are two versions' snapshots of one question identity compatible enough to combine by default?

Decide:

- The SQL behind each analytics view: total counts, counts by version, choice distributions (single choice, and multiple choice through `jsonb_array_elements_text`), boolean splits and numeric summaries. Decide which views run in SQL and which in application code, and whether text, email and date questions get any summary at all.
- The compatibility rules. A question identity keeps one type for life ([Canonical form definition model](./08-canonical-form-definition-model.md)), so the rules only cover option and constraint changes: added, removed or relabelled options, changed `min`/`max`/`maxSelected`, and the `integer` flag. Decide which changes still combine, which split, and how a split or a normalisation is described to the reader (ADR §8.2).
- Which label a combined option or question shows when labels differ across versions.
- How a question's view tells apart, for each version, responses submitted, the question being present, answers given, optional questions skipped, and the question being absent from that version (ADR §8.2). A missing answer row means skipped only where `form_version_questions` has the question.
- The response shape the API returns for analytics. The per-version breakdown is always visible, alongside the combined view.
- Any indexes needed beyond `responses (form_id, version_id)` and `answers (question_id)`.

## Answer

Recorded as [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md). No glossary changes: "combined" and "per-version" are the ADR's own words, and every other name here is an implementation detail.

- **Compatibility**: every snapshot of one question identity combines. The identity is the editor's claim that the meaning is unchanged, and the type (fixed for life) guarantees the representation. Nothing splits automatically. Differences between versions are described as structured data: options offered only in some versions (`offeredIn`), other labels (`otherLabels`), per-version `constraints`, and `present: false`. "Incompatible questions are shown separately" (ADR 0002) therefore means questions with different identities.
- **"Treat as a new question"**: `@fb/core/editing` gains `reidentifyQuestion`. It keeps the snapshot's content and position, mints a fresh question identity and keeps the option values, which are scoped to the question. The builder offers it on a question's menu with one line saying past answers won't be combined with new ones. This is the ADR 0001 §4.4 lever the compatibility rule depends on.
- **Summaries per type**:
  - Single choice and multiple choice: a count per option value.
  - Boolean: true and false counts.
  - Number: `count`, `min`, `max`, `mean` and `median` (`percentile_cont(0.5)`). All but `count` are null when nothing was answered.
  - Text, email and date: answered and skipped counts only, with no value summary.
- **Present, answered, skipped and absent**: for each question and version, the view reports one of two states.
  - Absent: `present: false` with no counts, when the version's `form_version_questions` lacks the question. An absent version is never zero-filled.
  - Present: `responses` (the version's response count), `answered` (its answer rows) and `skipped = responses − answered`. A required question still reports `skipped: 0`. Versions with zero responses appear with zeros.
  - Combined: these figures summed over the versions where the question is present, plus `absentResponses`, the responses from versions without the question.
  - Edited responses count with their latest answers ([MVP product calls on the ADR open questions](./05-mvp-product-calls-on-the-adr-open-questions.md)).
- **Option shares**: each option carries `count`, `base` (the answered responses in versions that offered it) and `offeredIn` (version numbers). The builder computes percentages as `count / base`. An option not offered in a version isn't counted as "not chosen" there, so with differing option sets single-choice shares don't sum to 100%, and the view says why. A version's own choice summary lists only the options that version offered.
- **Labels**: a combined question or option shows its label from the highest-numbered version that contains it. Every other distinct label goes in `otherLabels`, with its version numbers. Options are matched by option value, never by label.
- **Filtering**: none in the MVP. The per-version breakdown is the only segmentation. Filters by external reference or by submission date are out of scope, and can be added later as an `EXISTS` clause without changing the response shape.
- **Computation**: on read, with no caching or materialised views, in `@fb/server`'s `lib/analytics`.
  - A fixed set of per-form queries runs in one `REPEATABLE READ READ ONLY` transaction, so concurrent submissions and edits can't make `answered` exceed `responses`:
    1. Responses per version.
    2. Answered count per version and question.
    3. Value counts per version and question, for single choice and boolean (`GROUP BY value`).
    4. Option counts per version and question, for multiple choice (`jsonb_array_elements_text(value)`).
    5. Numeric aggregates per version and question.
    6. Numeric aggregates per question across all versions, because medians can't be combined from per-version medians.
  - Every query joins through `forms … WHERE tenant = $t`, and selects question types through `form_version_questions.type`.
  - Pure functions then merge the counts with the version definitions (presence, offered options, labels, constraints, ordering) and are unit-tested without a database.
- **Indexes**: `answers (version_id, question_id)` replaces `answers (question_id)` in [Persistence model](./10-persistence-model.md). No other new indexes.
- **Ordering and empty forms**:
  - Questions come in the current version's order, then the questions the current version no longer has, most recently dropped first, each in its last version's order.
  - A form with no published version returns `200` with `totalResponses: 0`, `versions: []` and `questions: []`.
  - The 403 and 404 rules from [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md) apply unchanged.
- **Response shape**: declared in Effect Schema at the edge, using `NullOr` rather than optional fields. Inside the body, versions are referenced by `number`, and the top-level `versions` list maps each number to its id. The server returns no prose; the builder writes the sentences ("Option C was offered only in v2–v3"). The endpoint path belongs to [HTTP API surface](./16-http-api-surface.md).

  ```ts
  type FormAnalytics = {
    formId: string;
    totalResponses: number;
    versions: {
      versionId: string;
      number: number;
      publishedAt: string;
      responses: number;
    }[]; // ascending, all versions
    questions: QuestionAnalytics[];
  };

  type QuestionAnalytics = {
    questionId: string;
    type: QuestionTypeName;
    label: string;
    otherLabels: { label: string; versions: number[] }[];
    inCurrentVersion: boolean;
    combined: {
      responses: number;
      answered: number;
      skipped: number;
      absentResponses: number;
      summary: Summary;
    };
    byVersion: (
      | { version: number; present: false }
      | {
          version: number;
          present: true;
          responses: number;
          answered: number;
          skipped: number;
          summary: Summary;
          constraints: Constraints | null;
        } // min/max/integer, or minSelected/maxSelected
    )[];
  };

  type Summary =
    // tagged by the question's type
    | {
        type: "single_choice" | "multiple_choice";
        options: {
          value: string;
          label: string;
          otherLabels: { label: string; versions: number[] }[];
          count: number;
          base: number;
          offeredIn: number[];
        }[];
      }
    | { type: "boolean"; trueCount: number; falseCount: number }
    | {
        type: "number";
        count: number;
        min: number | null;
        max: number | null;
        mean: number | null;
        median: number | null;
      }
    | { type: "text" | "email" | "date" };
  ```
