import { desc, and, eq, exists, sql } from "drizzle-orm";
import { type Brand, Effect, type Schema } from "effect";
import type { ExternalRef, TenantId } from "../authorization/actor.ts";
import type {
  Draft,
  DraftSummary,
  Form,
  FormDetail,
  FormSettings,
  FormSummary,
  VersionSummary,
} from "../envelopes.ts";
import type { Database } from "./database.ts";
import { currentInstant, newId } from "./ids.ts";
import { drafts, formExternalRefs, forms, formVersions } from "./schema.ts";

type Db = Database["Service"];

export const toForm = (row: typeof forms.$inferSelect): Form => ({
  id: row.id,
  availability: row.availability,
  responseLimit: row.responseLimit,
  currentVersionId: row.currentVersionId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const toDraft = (row: typeof drafts.$inferSelect): Draft => ({
  formId: row.formId,
  revision: String(row.revision),
  basedOnVersionId: row.basedOnVersionId,
  definition: row.definition,
  updatedAt: row.updatedAt,
});

const draftSummaryColumns = {
  revision: drafts.revision,
  basedOnVersionId: drafts.basedOnVersionId,
  updatedAt: drafts.updatedAt,
};

const toDraftSummary = (
  row: Pick<typeof drafts.$inferSelect, keyof typeof draftSummaryColumns>,
): DraftSummary => ({
  revision: String(row.revision),
  basedOnVersionId: row.basedOnVersionId,
  updatedAt: row.updatedAt,
});

export const versionSummaryColumns = {
  id: formVersions.id,
  number: formVersions.number,
  publishedAt: formVersions.publishedAt,
  publishedBy: formVersions.publishedBy,
  derivedFromVersionId: formVersions.derivedFromVersionId,
};

const toCurrentVersionSummary = (
  row: Pick<typeof formVersions.$inferSelect, keyof typeof versionSummaryColumns>,
): VersionSummary => ({
  id: row.id,
  number: row.number,
  publishedAt: row.publishedAt,
  publishedBy: row.publishedBy,
  derivedFromVersionId: row.derivedFromVersionId,
  isCurrent: true,
});

/** A new form is closed, unlimited and unpublished, with its first draft. */
export const insertFormWithDraft = (db: Db, tenant: TenantId, definition: Schema.Json) =>
  Effect.gen(function* () {
    const id = yield* newId;
    const now = yield* currentInstant;
    return yield* db.transaction((tx) =>
      Effect.gen(function* () {
        const [form] = yield* tx
          .insert(forms)
          .values({
            id,
            tenant,
            availability: "closed",
            responseLimit: "unlimited",
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        const [draft] = yield* tx
          .insert(drafts)
          .values({ formId: id, definition, updatedAt: now })
          .returning();
        return { form: toForm(form!), draft: toDraft(draft!) };
      }),
    );
  });

/** A form row locked `FOR UPDATE` in the actor's tenant, which every draft write takes first. */
export type LockedForm = Form & Brand.Brand<"LockedForm">;

/** Must run inside the write's transaction, which holds the lock until it ends. */
export const lockForm = (db: Db, tenant: TenantId, formId: string) =>
  db
    .select()
    .from(forms)
    .where(and(eq(forms.tenant, tenant), eq(forms.id, formId)))
    .for("update")
    .pipe(Effect.map(([row]) => row && (toForm(row) as LockedForm)));

/** Its draft goes by cascade; a trigger refuses the delete once the form has any version. */
export const deleteForm = (db: Db, form: LockedForm) =>
  db.delete(forms).where(eq(forms.id, form.id));

export const updateFormSettings = (db: Db, form: LockedForm, settings: FormSettings) =>
  Effect.gen(function* () {
    const [row] = yield* db
      .update(forms)
      .set({
        availability: settings.availability ?? undefined,
        responseLimit: settings.responseLimit ?? undefined,
        updatedAt: yield* currentInstant,
      })
      .where(eq(forms.id, form.id))
      .returning();
    return toForm(row!);
  });

const currentVersion = and(
  eq(formVersions.id, forms.currentVersionId),
  eq(formVersions.formId, forms.id),
);

const isRef = (ref: ExternalRef) =>
  and(eq(formExternalRefs.namespace, ref.namespace), eq(formExternalRefs.refId, ref.refId));

/** With `ref`, only the forms carrying it. */
export const listForms = (db: Db, tenant: TenantId, ref?: ExternalRef) =>
  db
    .select({
      form: forms,
      title: sql<string>`coalesce(${drafts.definition}->>'title', ${formVersions.definition}->>'title')`,
      hasDraft: sql<boolean>`${drafts.formId} IS NOT NULL`,
      currentVersion: versionSummaryColumns,
    })
    .from(forms)
    .leftJoin(drafts, eq(drafts.formId, forms.id))
    .leftJoin(formVersions, currentVersion)
    .where(
      and(
        eq(forms.tenant, tenant),
        ref &&
          exists(
            db
              .select({ formId: formExternalRefs.formId })
              .from(formExternalRefs)
              .where(and(eq(formExternalRefs.formId, forms.id), isRef(ref))),
          ),
      ),
    )
    .orderBy(desc(forms.updatedAt), desc(forms.id))
    .pipe(
      Effect.map((rows) =>
        rows.map((row): FormSummary => ({
          id: row.form.id,
          title: row.title,
          availability: row.form.availability,
          responseLimit: row.form.responseLimit,
          currentVersion: row.currentVersion && toCurrentVersionSummary(row.currentVersion),
          hasDraft: row.hasDraft,
          updatedAt: row.form.updatedAt,
        })),
      ),
    );

export const findFormDetail = (db: Db, tenant: TenantId, formId: string) =>
  Effect.gen(function* () {
    const [row] = yield* db
      .select({ form: forms, draft: draftSummaryColumns, currentVersion: versionSummaryColumns })
      .from(forms)
      .leftJoin(drafts, eq(drafts.formId, forms.id))
      .leftJoin(formVersions, currentVersion)
      .where(and(eq(forms.tenant, tenant), eq(forms.id, formId)));
    if (row === undefined) return undefined;
    return {
      id: row.form.id,
      availability: row.form.availability,
      responseLimit: row.form.responseLimit,
      currentVersion: row.currentVersion && toCurrentVersionSummary(row.currentVersion),
      draft: row.draft && toDraftSummary(row.draft),
      externalRefs: yield* findFormExternalRefs(db, row.form.id),
      createdAt: row.form.createdAt,
      updatedAt: row.form.updatedAt,
    } satisfies FormDetail;
  });

/** Sorted by namespace, then `refId`, byte-wise, so both drivers agree whatever their collation. */
export const findFormExternalRefs = (db: Db, formId: string) =>
  db
    .select({ namespace: formExternalRefs.namespace, refId: formExternalRefs.refId })
    .from(formExternalRefs)
    .where(eq(formExternalRefs.formId, formId))
    .orderBy(
      sql`${formExternalRefs.namespace} COLLATE "C"`,
      sql`${formExternalRefs.refId} COLLATE "C"`,
    );

/** The caller checks the per-form limit under the form's lock. */
export const insertFormExternalRef = (db: Db, form: LockedForm, ref: ExternalRef) =>
  db.insert(formExternalRefs).values({ formId: form.id, ...ref });

export const deleteFormExternalRef = (db: Db, form: LockedForm, ref: ExternalRef) =>
  db.delete(formExternalRefs).where(and(eq(formExternalRefs.formId, form.id), isRef(ref)));
