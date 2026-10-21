import { and, eq, sql } from "drizzle-orm";
import { Effect, type Schema } from "effect";
import type { TenantId } from "../authorization/actor.ts";
import type { Database } from "./database.ts";
import { type LockedForm, toDraft } from "./forms.ts";
import { currentInstant } from "./ids.ts";
import { drafts, forms } from "./schema.ts";

type Db = Database["Service"];

/** Undefined when the tenant has no such form; a `null` draft when the form has none. */
export const findFormDraft = (db: Db, tenant: TenantId, formId: string) =>
  db
    .select({ draft: drafts })
    .from(forms)
    .leftJoin(drafts, eq(drafts.formId, forms.id))
    .where(and(eq(forms.tenant, tenant), eq(forms.id, formId)))
    .pipe(Effect.map(([row]) => row && { draft: row.draft && toDraft(row.draft) }));

export const findLockedDraft = (db: Db, form: LockedForm) =>
  db
    .select()
    .from(drafts)
    .where(eq(drafts.formId, form.id))
    .pipe(Effect.map(([row]) => row && toDraft(row)));

/** A new draft is based on the form's current version, or on nothing before the first publish. */
export const insertDraft = Effect.fnUntraced(function* (
  db: Db,
  form: LockedForm,
  definition: Schema.Json,
) {
  const [draft] = yield* db
    .insert(drafts)
    .values({
      formId: form.id,
      basedOnVersionId: form.currentVersionId,
      definition,
      updatedAt: yield* currentInstant,
    })
    .returning();
  return toDraft(draft!);
});

/** Every save draws a new revision from the sequence. */
export const updateDraft = Effect.fnUntraced(function* (
  db: Db,
  form: LockedForm,
  definition: Schema.Json,
) {
  const [draft] = yield* db
    .update(drafts)
    .set({
      definition,
      revision: sql`nextval('form_management.draft_revisions')`,
      updatedAt: yield* currentInstant,
    })
    .where(eq(drafts.formId, form.id))
    .returning();
  return toDraft(draft!);
});

export const deleteDraft = (db: Db, form: LockedForm) =>
  db.delete(drafts).where(eq(drafts.formId, form.id));
