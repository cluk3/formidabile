import { and, desc, eq, max } from "drizzle-orm";
import { Effect, type Schema } from "effect";
import type { TenantId } from "../authorization/actor.ts";
import type { FormVersion, VersionSummary } from "../envelopes.ts";
import type { Database } from "./database.ts";
import { type LockedForm, toForm, versionSummaryColumns } from "./forms.ts";
import { currentInstant, newId } from "./ids.ts";
import { formVersionQuestions, formVersions, forms, questionIdentities } from "./schema.ts";

type Db = Database["Service"];

const toVersionSummary = (
  row: Pick<typeof formVersions.$inferSelect, keyof typeof versionSummaryColumns>,
  currentVersionId: string | null,
): VersionSummary => ({
  id: row.id,
  number: row.number,
  publishedAt: row.publishedAt,
  publishedBy: row.publishedBy,
  derivedFromVersionId: row.derivedFromVersionId,
  isCurrent: row.id === currentVersionId,
});

/** Undefined when the tenant has no such form. Newest first. */
export const listVersions = (db: Db, tenant: TenantId, formId: string) =>
  db
    .select({ currentVersionId: forms.currentVersionId, version: versionSummaryColumns })
    .from(forms)
    .leftJoin(formVersions, eq(formVersions.formId, forms.id))
    .where(and(eq(forms.tenant, tenant), eq(forms.id, formId)))
    .orderBy(desc(formVersions.number))
    .pipe(
      Effect.map((rows) =>
        rows.length === 0
          ? undefined
          : rows.flatMap(({ currentVersionId, version }) =>
              version ? [toVersionSummary(version, currentVersionId)] : [],
            ),
      ),
    );

export const findVersion = (db: Db, tenant: TenantId, formId: string, versionId: string) =>
  db
    .select({ currentVersionId: forms.currentVersionId, version: formVersions })
    .from(formVersions)
    .innerJoin(forms, eq(forms.id, formVersions.formId))
    .where(and(eq(forms.tenant, tenant), eq(forms.id, formId), eq(formVersions.id, versionId)))
    .pipe(
      Effect.map(
        ([row]): FormVersion | undefined =>
          row && {
            ...toVersionSummary(row.version, row.currentVersionId),
            definition: row.version.definition,
          },
      ),
    );

export const versionDefinitions = (db: Db, form: LockedForm) =>
  db
    .select({ definition: formVersions.definition })
    .from(formVersions)
    .where(eq(formVersions.formId, form.id))
    .pipe(Effect.map((rows) => rows.map((row) => row.definition)));

export interface NewVersion {
  readonly definition: Schema.Json;
  readonly questions: ReadonlyArray<{ readonly id: string; readonly type: string }>;
  readonly publishedBy: string;
  readonly derivedFromVersionId: string | null;
}

/**
 * Inserts the next version with its question keys and any new question identities, then makes it the
 * form's current version.
 */
export const insertCurrentVersion = (db: Db, form: LockedForm, version: NewVersion) =>
  Effect.gen(function* () {
    const id = yield* newId;
    const now = yield* currentInstant;
    const [latest] = yield* db
      .select({ number: max(formVersions.number) })
      .from(formVersions)
      .where(eq(formVersions.formId, form.id));
    const [inserted] = yield* db
      .insert(formVersions)
      .values({
        id,
        formId: form.id,
        number: (latest?.number ?? 0) + 1,
        definition: version.definition,
        publishedAt: now,
        publishedBy: version.publishedBy,
        derivedFromVersionId: version.derivedFromVersionId,
      })
      .returning(versionSummaryColumns);
    yield* db
      .insert(questionIdentities)
      .values(version.questions.map((q) => ({ formId: form.id, questionId: q.id, type: q.type })))
      .onConflictDoNothing({ target: [questionIdentities.formId, questionIdentities.questionId] });
    yield* db.insert(formVersionQuestions).values(
      version.questions.map((q, position) => ({
        versionId: id,
        questionId: q.id,
        formId: form.id,
        type: q.type,
        position,
      })),
    );
    const [moved] = yield* db
      .update(forms)
      .set({ currentVersionId: id, updatedAt: now })
      .where(eq(forms.id, form.id))
      .returning();
    return { form: toForm(moved!), version: toVersionSummary(inserted!, id) };
  });
