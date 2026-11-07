# Workflows

File prefixes say **when** a workflow runs, so you can tell them apart at a glance:

- `pr-*` run on **pull requests**, before anything is merged. They only check; they never publish.
- `release-*` run **after a merge** into `beta` / `main`. They ship something (image, mirror).
- `checks-*` / `claude-*` are repository-specific automations (see the table).

Why CI and image publishing are separate: `pr-checks` answers "is this change safe to merge?" and has
read-only access. `release-docker-image` answers "ship it" and is the only place with permission to write
to the registry. Publishing re-runs the image smoke test on purpose, so an image is always tested right
before it is pushed.

Shared logic lives in [ZyFeronix/utils](https://github.com/ZyFeronix/utils); the files here are thin callers.

| File | Runs when | What it does | Writes |
|---|---|---|---|
| `pr-branch-flow.yml` | A pull request targets dev, beta or main. | Blocks PRs that skip the promotion path (work branch -> dev -> beta -> main). | Nothing (read-only). |
| `release-sync-gitlab.yml` | A push to main or beta (after a merge), or manually. | Mirrors main, beta and tags to GitLab. | The GitLab mirror only. |
| `pr-checks.yml` | A pull request targets dev, beta or main (docs-only changes are skipped), or manually. | Lint & Build (required check on main) + Docker image smoke test and compose validation when packaging files change. | Nothing (read-only). Publishing happens AFTER the merge, in release-docker-image.yml. |
| `release-docker-image.yml` | A push to beta or main (after a merge), or manually. | Smoke-tests the image on amd64 + arm64, then publishes it to GHCR. main -> :latest + :X.Y.Z + git tag; beta -> :beta; manual -> :manual. Fails early if the tag already exists, so bump the version first. | GHCR image tags and the git tag vX.Y.Z on main. |
