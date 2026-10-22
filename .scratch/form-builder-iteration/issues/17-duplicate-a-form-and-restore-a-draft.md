# 17: Duplicate a form and restore a draft

**What to build:** From a draft or any published version, the builder creates a new, never-published form whose title ends in " (copy)". The duplicate keeps the definition, including question identities, so its conditions and jumps still mean the same thing, and it starts without the original's external references, availability, or response limit. Its responses never mix with the original's. Restore replaces the draft with a chosen published version, asks first when a draft exists, and reports a save that landed in the meantime. Restoring the current version discards draft edits and leaves a draft open. Both actions are the existing read, create, and draft-save calls, so a host can post a template definition as a new form in any tenant its token names. Follow ADR-019. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Duplicate is offered on the draft and on each published version. It creates a new, never-published form, which can still be deleted. There is no new endpoint: it is a read of that version or draft, then `POST /forms` with the definition.
- [x] The new form's title is the source title plus " (copy)", shortened so the title stays within 200 characters. The API stores the title it is sent.
- [x] The duplicate keeps the source definition's question identities, option values, row values, and page ids, so conditions and jumps still mean the same thing when the source has them. Two forms may hold the same question identity, and their analytics never mix.
- [x] The duplicate starts with a new form's external references, availability, and response limit. It does not claim the source form's place in the host.
- [x] Restore is offered on each published version. It does not create a version. It is a read of that version, then `PUT /forms/{formId}/draft`. When the form has no draft, the expected revision is null and the draft is created. When a draft exists, the builder asks before replacing it and saves with that draft's revision.
- [x] A save that landed in the meantime is reported the same way other draft saves report `RevisionConflict`. Restoring the current published version discards the draft's edits and leaves a draft open.
- [x] A copied definition is stored as it was sent, format 1 or format 2. A missing format or an unknown key is still 422. The module stores no templates. A host posts a template definition as a new form in any tenant its token names.
- [x] Tests cover duplicate and restore as compositions through the HTTP API, including restore over an existing draft with a stale revision and deleting a never-published duplicate, and the builder flows for duplicate, the confirm step, and the conflict.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

Duplicate and restore are the existing read, create, and draft-save calls. The publication history reads the stored definition and posts it (`POST /forms`) or saves it (`PUT /forms/{formId}/draft`), changing only the duplicate's title. Question identities, option values, and any later format's page ids and row values travel in that JSON. There is no new endpoint, and the module still stores no templates: a host posts a definition into the tenant its token names.

The draft editor was not restyled. It gained an `onDuplicated` callback, which the form page uses to open the new form, and restore reports `RevisionConflict` through the editor's existing conflict alert. Replacing a draft asks first and sends that draft's revision; with no draft, the expected revision is null.

Format 2 is not parsed on this branch. Ticket 01 owns the reader. These calls do not upgrade or strip a definition, so a format the reader accepts is stored as it was sent. A missing format or an unknown key is still 422.

`vp check`, `vp run boundaries`, `vp run check:svelte`, `vp run check:generated`, and `vp test` were run in this worktree. `vp run ready` also runs `test:pg` and `e2e`, which this worktree does not, and CI on the PR is the central gate.
