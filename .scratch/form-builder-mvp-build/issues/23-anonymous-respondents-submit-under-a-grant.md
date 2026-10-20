# 23: Anonymous respondents submit under a form-bound grant

**What to build:** A host admits an anonymous respondent to one form with a short-lived, host-signed, form-bound grant. "Anonymous" always means a grant, never "no token". The grant reaches only the load and submit for its bound form (and, from ticket 37, the answer schema). An anonymous respondent can't edit a response or answer a form limited to one response per respondent.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md); [Anonymous respondent access and tenancy](../../form-builder-mvp/issues/19-anonymous-respondent-access-and-tenancy.md).

**Blocked by:** 22 (Respondents edit their own response).

**Status:** ready-for-agent

- [ ] No token on load or submit gives 401 `missing`.
- [ ] A grant for form A gets 404 on form B's load and submit.
- [ ] An `acme` grant naming a `globex` form gets 404.
- [ ] A grant on a limited form loads with `respondent: "anonymous"`, and submitting gives 401 `identityRequired`.
- [ ] A grant on the read or edit of a response gives 401 `identityRequired`.
- [ ] A grant submitting to its open, unlimited form gets 201, and no respondent id is stored.
- [ ] An anonymous replay returns the original response.
- [ ] The parity table gains a 401 `identityRequired` row.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
