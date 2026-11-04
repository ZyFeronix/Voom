# AGENTS.md

Operating rules for agents working in this repository. They complement `CONTRIBUTING.md` (code style, architecture, conventions); where they disagree **about branching or delivery, this file wins**.

## 1. Branch model

| Branch | Purpose |
| --- | --- |
| `main` | Production only. Deployed code. |
| `beta` | Testing. Code being validated before production. |
| `dev` | Everything else. Integration of all work. |

- **Never commit directly to `main` or `beta`.**
- **Every change lands through a PR into `dev`.**
- Promotion happens in one direction only: `dev` → `beta` → `main`.
  A PR into `beta` must come from `dev`; a PR into `main` must come from `beta`.
  The `Branch flow` workflow fails any other combination.
- **Never force-push, rewrite or delete `main`, `beta` or `dev`.**
- Work branches start from `dev` and are named `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `ci/<topic>`, `chore/<topic>`.
- `delete_branch_on_merge` is intentionally **off** — deleting merged branches automatically would destroy `dev` and `beta` on promotion. Delete your own work branch after it lands, and only that one.

## 2. Before opening a PR

Run these and put the real result in the PR body:

```bash
cd frontend
npm run lint     # prettier --check + eslint
npm run build    # vite build + adapter-node
```

`npm test` when the change touches server logic. The Vitest suite is currently disabled in CI (see `.github/workflows/ci.yml`); do not claim tests pass if you did not run them.

Never report a check as green without executing it.

## 3. Commits

Conventional Commits, English, imperative mood:

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `ci`, `chore`.

One logical change per commit. Do not bundle unrelated reformatting.

## 4. Dependencies

- **Do not add `.github/dependabot.yml`.** Version updates are deliberately disabled — they produce a PR per outdated package regardless of risk.
- Alerts and **security updates** are enabled at repository level. Dependabot opens PRs only for vulnerabilities with a fix available.
- Do not open manual "bump package X" PRs unless the update fixes something specific.

## 5. GitLab mirror

The repository is mirrored to `git.alexdevuwu.com/organizations/zyferonix/voom` by `.github/workflows/sync.yml`.

- **Do not push to GitLab from a workstation.** The workflow owns that.
- Only `main` and `beta` are published. `dev` is never mirrored (it may contain throwaway code).
- **Never put credentials in a remote URL** (`https://token@host/...`). It writes an entry into the OS credential manager. If out-of-band auth is needed, use:
  ```bash
  git -c credential.helper= \
      -c "http.https://host/.extraheader=AUTHORIZATION: basic <base64>" push <url> <ref>
  ```
- The workflow reads `GITLAB_ACCESS_TOKEN` from GitHub Secrets. Never hardcode it.

## 6. Secrets

- Never commit `.env`, `.env.*` (except `.env.example`), keys, tokens or webhook URLs.
- Never paste a token into an issue, PR, commit message or code comment.
- If a secret is exposed, say so explicitly — do not quietly rotate or ignore it.

## 7. Scope and review

- One concern per PR. Keep the diff reviewable.
- Do not modify `.github/workflows/` unless the PR is about CI; label it `ci`.
- Do not rewrite files unrelated to the task (formatting, renaming, dependency churn).

## 8. Definition of done

A task is complete when:

1. The change is on a work branch, with a PR open against `dev`.
2. `Branch flow` and `Lint & Build` are green.
3. The PR body states what was verified and how.
4. Limitations and unverified parts are stated plainly, not hidden behind "should work".
