# Mission Control Fork Strategy

OG Capital maintains `OG-Capital/mission-control` as a managed fork of upstream
`builderz-labs/mission-control`. Upstream is MIT, public. Our fork is public but
can host private customizations via protected branches.

## Branch model

```
upstream/main  ──► origin/main  ──► origin/og/main  ──► production (docker image we run)
    (read-only)     (mirror)        (our customizations)
```

- **`main`** — clean mirror of `upstream/main`. **Never commit directly.**
  Only the `sync-upstream` workflow advances this branch.
- **`og/main`** — default branch. Our customizations live here. All PRs (from
  agents or humans) target `og/main`.
- **feature branches** — short-lived, target `og/main`.

## Upstream sync workflow

`.github/workflows/sync-upstream.yml` runs weekly (Monday 06:00 UTC) and on
manual dispatch. It:

1. Fetches `upstream/main`.
2. Fast-forwards our `main` to upstream's head. If diverged → fails, marks
   workflow "needs manual resolution".
3. Opens PR `main → og/main`. We review the diff, resolve conflicts with
   our customizations, merge.

## Updating the production deployment

Our production image is `ghcr.io/builderz-labs/mission-control:latest` (upstream
image, since we haven't customized yet). Once we start carrying real code deltas
on `og/main`:

Option A — GHCR of our own:
```
docker build -t ghcr.io/og-capital/mission-control:latest -f Dockerfile .
docker push ghcr.io/og-capital/mission-control:latest
```
Then change `/root/mc-run-cmd.sh` image reference.

Option B — keep running upstream image while our customizations are small:
- Mount diff files via docker bind-mount instead of forking the image.
- Cheaper, but painful if many files change.

Currently we use **Option B** (no code changes yet, just tracking upstream).

## What to customize on `og/main`

Things we already do via bind-mounts (no fork needed):
- `/root/mission-control/openclaw-wrapper.sh` — custom openclaw entrypoint shim
- `/root/mc-agents/` — our own mc-agents (bind into `/nonexistent/.agents`)
- Environment variables (all in `mc-run-cmd.sh`)
- `MC_ALLOWED_HOSTS` — our hostname

Things that **would** need a real fork commit (when/if):
- UI branding (OG Capital logo, theme)
- MC TOTP 2FA (if upstream lacks it)
- UTM-salt header injection awareness
- Russian i18n polish
- Our own LightRAG integration UI
- Custom dashboard widgets (budget forecaster, trade alerts)

## Conflict handling on sync

If upstream refactors a file we also changed → sync workflow's PR will show
merge conflicts. Manual resolution:

```bash
cd /root/gh/mission-control
git fetch origin
git checkout og/main
git pull origin og/main
git merge origin/main          # brings upstream changes (via main mirror) in
# resolve conflicts
git commit -m "merge upstream into og/main, resolved conflicts in X,Y"
git push origin og/main
```

Close the PR as merged (it auto-closes once og/main contains main's tip).

## Rollback

If an upstream sync breaks production:

1. Identify last-known-good image digest (see `/root/mission-control/WORK_LOG.md`
   and `docker image ls --digests`).
2. `docker pull ghcr.io/builderz-labs/mission-control@sha256:<digest>`
3. Edit `/root/mc-run-cmd.sh`, replace `:latest` with `@sha256:<digest>`.
4. `docker stop mission-control && docker rm mission-control && bash /root/mc-run-cmd.sh`.

On the fork side:
```
git checkout og/main
git revert <merge-commit-sha>
git push origin og/main
```

## Publishing our own images (future)

When we start shipping code changes:

1. Add `.github/workflows/build-and-push.yml` in `og/main` that builds on every
   push, tags `ghcr.io/og-capital/mission-control:latest` + `:<git-sha>`.
2. Switch `/root/mc-run-cmd.sh` to our image.
3. Keep `:latest` as rolling, pin by sha in production.

## Secrets needed

- `OG_SYNC_TOKEN` (optional) — org-scoped PAT with `repo` + `workflow` scope, for
  the sync workflow. Without it the workflow uses default `GITHUB_TOKEN` which
  works for same-repo PRs.
- Docker registry creds only if we publish own image.

## Checklist for first sync test

- [ ] `og/main` exists, production deploys from it
- [ ] Workflow committed on `og/main`
- [ ] Manual workflow dispatch → confirms no-op (we just forked, `main` ==
      `upstream/main`)
- [ ] When upstream next pushes, sync runs Monday, opens PR

## Reference

- Upstream: https://github.com/builderz-labs/mission-control
- Fork: https://github.com/OG-Capital/mission-control
- Docker image (upstream, currently used): `ghcr.io/builderz-labs/mission-control:latest`
- Production run cmd: `/root/mc-run-cmd.sh`
