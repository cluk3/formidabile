# Repository hosting and visibility

Type: grilling
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

Where is the repo hosted, is it public or private, and what does it publish?

[CI pipeline](./17-ci-pipeline.md) and the spec's phase 0 have an implementing agent run `gh repo create` for a **public** repo under `cluk3`, then push the whole history, including `.scratch/`, `.agents/` and `.claude/`. That's an irreversible disclosure, and nobody has approved it as a requirement. The CI design also leans on public-repo terms: unlimited Actions minutes, and rulesets with required checks on `main`.

Decide:

- Visibility and account.
- Which paths are committed and published (the planning notes in `.scratch/`, the vendored skills in `.agents/` and `.claude/`, `skills-lock.json`).
- Who creates the remote: you, by hand before phase 0, or the implementing agent.
- If private: check whether the account's plan gives rulesets and required status checks on a private repo, and whether the free Actions minutes cover four jobs per push, including the three-browser e2e job. Then decide what CI changes.

## Answer

No ADR. [CI pipeline](./17-ci-pipeline.md) is amended, and Revise the phased plan and spec folds the checklist below into `spec.md`.

Facts checked during the session:

- **GitHub plans**: rulesets and protected branches are available on public repos under GitHub Free, but on private repos only with Pro, Team or Enterprise Cloud (GitHub docs, `data/reusables/gated-features/repo-rules.md` and `protected-branches.md`). Private repos on Free get 2,000 Actions minutes a month, and usage is blocked, not billed, once they run out without a payment method ([GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). Public repos get unlimited minutes on standard runners.
- **Vendored skills**: they come from `mattpocock/skills` (34), `wshobson/agents` (1) and `github/awesome-copilot` (1), all MIT, and the repo carried none of their licence notices. `npx skills experimental_install` restores `.agents/skills/` from `skills-lock.json`, but it's experimental and doesn't recreate `.claude/` links.
- **Tracked files**: no secrets or tokens. The one existing commit was authored with a work address, which would have been published with the history.
- **The remote**: [`cluk3/formidabile`](https://github.com/cluk3/formidabile) already exists. It's public, empty, has no ruleset and no licence, and its default branch is `main`. Nothing has been pushed yet.

Decisions:

- **Visibility and account**: public, under the personal account `cluk3`, at `https://github.com/cluk3/formidabile`. CI pipeline's public-repo terms hold: unlimited minutes and a ruleset with required checks.
- **What's published**: everything tracked, namely `.scratch/` (map, tickets, research, prototypes, `spec.md`), `.agents/`, the `.claude/skills` symlinks, `skills-lock.json`, `AGENTS.md`, `GLOSSARY.md` and `docs/`. The vendored skills are committed rather than restored from the lock file, so a fresh clone works for agents straight away.
- **Licences**:
  - The project is MIT: a root `LICENSE`, `Copyright (c) 2026 Luca Campli`.
  - `.agents/skills/THIRD_PARTY_NOTICES.md` carries each upstream's MIT text with its copyright line, copied from that repo's `LICENSE`, and lists which skills came from it.
- **Commit identity**: all history is authored as `6255324+cluk3@users.noreply.github.com`, set as this repo's local `user.email`. The work address never reaches the remote.
- **Who creates the remote**: you, by hand. Because the repo is already public, the first push is the disclosure, so the review happens locally before it.
- **Before phase 0 (by hand)**, a checklist the spec carries ahead of phase 0:
  1. Run `git config user.email 6255324+cluk3@users.noreply.github.com` in this repo. Commit or unstage anything currently staged first, because the amend takes whatever is in the index. Then run `git commit --amend --reset-author --no-edit`.
  2. Add `LICENSE` and `.agents/skills/THIRD_PARTY_NOTICES.md`, and commit them.
  3. Review locally: `git log --format='%an <%ae>'` shows only the noreply address, and `git ls-files` lists only the published set above.
  4. Run `git remote add origin git@github.com:cluk3/formidabile.git`, then `git push -u origin main`.
- **Phase 0 (implementing agent)** starts from the existing `origin` and no longer runs `gh repo create`. It adds the `.gitignore` (nothing generated exists before phase 0, so the first push is safe without it), the workflow and `.github/dependabot.yml`. Once the four jobs (`static`, `test`, `test-pg`, `e2e`) have reported on a PR, it creates the `main` ruleset with `gh api`.
- **CI**: unchanged from CI pipeline. The map's fog patch about CI on a non-public repo is cleared, because the repo is public.
