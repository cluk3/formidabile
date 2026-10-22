# 16: Collect consent with must-be-yes

**What to build:** A boolean question can require yes. It is shown as one checkbox, and wherever that question is asked the respondent cannot submit without checking it. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A boolean question can require the answer `true`. The setting is `mustBeYes` on the question's config.
- [ ] With the setting, the question is required wherever it is asked, and the control is one checkbox. Without it, a boolean stays two radios, because an unticked checkbox cannot tell no from unanswered.
- [ ] A submission that leaves the checkbox unticked is refused when the question is asked. Once a question can leave the path, a hidden must-be-yes question does not block submission.
- [ ] Publish accepts the question: `true` is an answer it allows. This ticket does not bump `info.version`.
- [ ] Tests cover the constraint and publish at the core entry point, the refusal through the HTTP API, the checkbox in the renderer, and the setting in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
