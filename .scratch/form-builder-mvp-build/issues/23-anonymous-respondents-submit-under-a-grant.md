# 23: Anonymous respondents submit under a form-bound grant

**What to build:** A host admits an anonymous respondent to one form with a short-lived, host-signed, form-bound grant. "Anonymous" always means a grant, never "no token". The grant reaches only the load and submit for its bound form (and, from ticket 37, the answer schema). An anonymous respondent can't edit a response or answer a form limited to one response per respondent.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md); [Anonymous respondent access and tenancy](../../form-builder-mvp/issues/19-anonymous-respondent-access-and-tenancy.md).

**Blocked by:** 22 (Respondents edit their own response).

**Status:** ready-for-agent

- [x] No token on load or submit gives 401 `missing`.
- [x] A grant for form A gets 404 on form B's load and submit.
- [x] An `acme` grant naming a `globex` form gets 404.
- [x] A grant on a limited form loads with `respondent: "anonymous"`, and submitting gives 401 `identityRequired`.
- [x] A grant on the read or edit of a response gives 401 `identityRequired`.
- [x] A grant submitting to its open, unlimited form gets 201, and no respondent id is stored.
- [x] An anonymous replay returns the original response.
- [x] The parity table gains a 401 `identityRequired` row.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t23-anonymous-grants`. The last box stays open until the PR's CI jobs report. Notes for later tickets (26, 27, 36 and 37 especially):

- `Submission.submit` no longer refuses every grant up front. Inside the transaction, right after `shareForm` gives `NotFound`, a grant on a `one_per_respondent` form gets 401 `identityRequired`, decided under the form's share lock. That check comes before the idempotency lookup and before `FormClosed`, so a grant on a closed limited form gets `identityRequired`, not `FormClosed`.
- A grant's response stores `respondent_id = NULL` and the grant's `refs`. Its replay lookup scopes on `respondent_id IS NULL`, so any two grants on one form that send the same key share a response (`NULLS NOT DISTINCT`). Keys are client-minted UUIDs, so that only happens on a real replay.
- `read` and `edit` still refuse grants before any lookup (ticket 22). Ticket 37's answer-schema endpoint must let a grant through for its bound form only: reuse `reaches(actor, formId)` in `lib/submission/submission.ts`.
- Erasure (ticket 36): anonymous responses have no respondent id, so the only handle on them is `response_external_refs`, as the spec says.
- Tests: `describe("an anonymous grant")` in `packages/server/tests/submission.test.ts` and in `packages/http-api/tests/respond.test.ts` (whose `openForm(title, owner)` now takes an owner client, for a `globex` form). The parity row `an anonymous grant reading a response is 401 identityRequired` reads a random response id, since the refusal comes before the lookup.
