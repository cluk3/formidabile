# 16: Collect consent with must-be-yes

**What to build:** A boolean question can require yes. It is shown as one checkbox, and wherever that question is asked the respondent cannot submit without checking it. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A boolean question can require the answer `true`. The setting is `mustBeYes` on the question's config.
- [x] With the setting, the question is required wherever it is asked, and the control is one checkbox. Without it, a boolean stays two radios, because an unticked checkbox cannot tell no from unanswered.
- [x] A submission that leaves the checkbox unticked is refused when the question is asked. Once a question can leave the path, a hidden must-be-yes question does not block submission.
- [x] Publish accepts the question: `true` is an answer it allows. This ticket does not bump `info.version`.
- [x] Tests cover the constraint and publish at the core entry point, the refusal through the HTTP API, the checkbox in the renderer, and the setting in the builder.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-22, implementing agent:** `mustBeYes` is an optional boolean on a boolean question's config. Absent and `false` keep the yes/no radios. `true` accepts only the answer `true`, and the question does not parse unless `required` is true, so it is required wherever it is asked. The builder's "Must be yes" control sets both in one edit and puts `required` back if it is cleared while the setting stays on. The renderer shows one checkbox for that setting and leaves the radio fieldset unchanged for ticket 15's Clear answer. An unticked box sends no key. Publish accepts the question. `info.version` stays `0.1.0`.

- Zod's `literal(true)` already becomes JSON Schema `const: true`, and `required` puts the question in the advisory schema's `required` array, so `generatorFixes` has no boolean arm and no `x-fb-*` key.
- Paths are not in this branch (ticket 03). A hidden must-be-yes question stops blocking submission once `required` applies only on the path, because this ticket stores the constraint as `required: true` rather than a separate always-on check. Until then every question is asked, so the constraint blocks every submission that leaves the box unticked.
- `vp run ready` is still open: this worktree ran `vp check`, `vp run boundaries`, `vp run check:svelte`, and `vp test`. `check:generated` matches the regenerated OpenAPI document and client once those files are committed. `ready`'s Postgres and end-to-end jobs, and CI on the PR, belong to the central gate.
