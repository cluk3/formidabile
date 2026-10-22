# 17: Duplicate a form and restore a draft

**What to build:** From a draft or any published version, the builder creates a new, never-published form whose title ends in " (copy)". The duplicate keeps the definition, including question identities, so its conditions and jumps still mean the same thing, and it starts without the original's external references, availability, or response limit. Its responses never mix with the original's. Restore replaces the draft with a chosen published version, asks first when a draft exists, and reports a save that landed in the meantime. Restoring the current version discards draft edits and leaves a draft open. Both actions are the existing read, create, and draft-save calls, so a host can post a template definition as a new form in any tenant its token names. Follow ADR-019. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Duplicate is offered on the draft and on each published version. It creates a new, never-published form, which can still be deleted. There is no new endpoint: it is a read of that version or draft, then `POST /forms` with the definition.
- [ ] The new form's title is the source title plus " (copy)", shortened so the title stays within 200 characters. The API stores the title it is sent.
- [ ] The duplicate keeps the source definition's question identities, option values, row values, and page ids, so conditions and jumps still mean the same thing when the source has them. Two forms may hold the same question identity, and their analytics never mix.
- [ ] The duplicate starts with a new form's external references, availability, and response limit. It does not claim the source form's place in the host.
- [ ] Restore is offered on each published version. It does not create a version. It is a read of that version, then `PUT /forms/{formId}/draft`. When the form has no draft, the expected revision is null and the draft is created. When a draft exists, the builder asks before replacing it and saves with that draft's revision.
- [ ] A save that landed in the meantime is reported the same way other draft saves report `RevisionConflict`. Restoring the current published version discards the draft's edits and leaves a draft open.
- [ ] A copied definition is stored as it was sent, format 1 or format 2. A missing format or an unknown key is still 422. The module stores no templates. A host posts a template definition as a new form in any tenant its token names.
- [ ] Tests cover duplicate and restore as compositions through the HTTP API, including restore over an existing draft with a stale revision and deleting a never-published duplicate, and the builder flows for duplicate, the confirm step, and the conflict.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
