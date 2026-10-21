-- ADR 0007 and ADR 0014: these hold even for the table owner. Tests reset with a fresh database, never by truncating.
CREATE FUNCTION "form_management"."reject_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION '% on %.% is not allowed', TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
		USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "form_versions_immutable" BEFORE UPDATE OR DELETE ON "form_management"."form_versions"
	FOR EACH ROW EXECUTE FUNCTION "form_management"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "form_versions_no_truncate" BEFORE TRUNCATE ON "form_management"."form_versions"
	FOR EACH STATEMENT EXECUTE FUNCTION "form_management"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "form_version_questions_immutable" BEFORE UPDATE OR DELETE ON "form_management"."form_version_questions"
	FOR EACH ROW EXECUTE FUNCTION "form_management"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "form_version_questions_no_truncate" BEFORE TRUNCATE ON "form_management"."form_version_questions"
	FOR EACH STATEMENT EXECUTE FUNCTION "form_management"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "question_identities_immutable" BEFORE UPDATE OR DELETE ON "form_management"."question_identities"
	FOR EACH ROW EXECUTE FUNCTION "form_management"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "question_identities_no_truncate" BEFORE TRUNCATE ON "form_management"."question_identities"
	FOR EACH STATEMENT EXECUTE FUNCTION "form_management"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "forms_no_truncate" BEFORE TRUNCATE ON "form_management"."forms"
	FOR EACH STATEMENT EXECUTE FUNCTION "form_management"."reject_change"();
--> statement-breakpoint
-- Only a form that has never been published can be deleted (ADR 0014); its draft goes by cascade.
CREATE FUNCTION "form_management"."reject_deleting_published_form"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF EXISTS (SELECT 1 FROM "form_management"."form_versions" WHERE "form_id" = OLD."id") THEN
		RAISE EXCEPTION 'form % has a published version and can''t be deleted', OLD."id"
			USING ERRCODE = 'restrict_violation';
	END IF;
	RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "forms_published_undeletable" BEFORE DELETE ON "form_management"."forms"
	FOR EACH ROW EXECUTE FUNCTION "form_management"."reject_deleting_published_form"();
--> statement-breakpoint
CREATE FUNCTION "form_management"."reject_tenant_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'a form''s tenant never changes' USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "forms_tenant_immutable" BEFORE UPDATE OF "tenant" ON "form_management"."forms"
	FOR EACH ROW WHEN (OLD."tenant" IS DISTINCT FROM NEW."tenant")
	EXECUTE FUNCTION "form_management"."reject_tenant_change"();
