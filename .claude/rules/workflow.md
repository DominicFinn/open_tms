# Workflow — GitHub Issues, Projects & Worktrees

## Issue tracking — GitHub Issues + Projects

**Work is tracked in GitHub Issues, organised on a GitHub Project board.** The issue number is the
thread tying issue → branch → commit → PR together.

### Area prefixes

Title issues with the area they belong to:

- **TMS** — transport management work (shipments, orders, tendering, EDI, financials, tracking)
- **WMS** — warehouse work (receiving, picking, packing, inventory, warehouse PWA)

e.g. `TMS: cutoff risk issues don't auto-resolve on recovery`, `WMS: pack audit misses short picks`.

### Rules

- Every non-trivial change traces back to an issue. If there isn't one, **create it before
  starting** — a one-line issue beats untracked work.
- **The issue number goes in the branch name and in the commit message** — `... (#412)`. That's how
  we reconstruct why a change exists a year later.
- **Read the issue before implementing.** Acceptance criteria and comments routinely carry
  constraints that never made the title.
- **Move the issue as you go**: put it *In Progress* when you start, and move it to *Done* when the
  work is merged. Leave a closing comment describing what actually changed, especially where the
  implementation diverged from the description.
- **Always tidy up when you're done** — the issue must not be left sitting in *In Progress* after
  the PR merges.
- Never paste customer PII into an issue or comment. Reference `shipmentId` / `orderId`, same rule
  as logs.

## Use the `gh` CLI and the GitHub MCP

**Anything that talks to GitHub goes through `gh` (or the GitHub MCP tools).** Local plumbing
(`git status`, `git add`, `git commit`, `git worktree`, `git log`) stays plain git; the network side
— fetch, push, PRs, issues, checks, releases, API — is `gh`'s job.

```bash
gh auth status                                  # verify auth first
gh issue list --label TMS
gh issue create --title "TMS: ..." --body "..."
gh issue edit 412 --add-project "Open TMS"
gh pr create --title "Fix cutoff auto-resolve (#412)" --body "..."
gh pr checks --watch
gh pr merge --squash --delete-branch
gh api repos/:owner/:repo/branches/main         # escape hatch when no subcommand fits
```

Prefer `gh api` over curl with a hand-rolled token.

## Always pull before you start

**Branch from an up-to-date `origin/main`, never from a stale local `main`.**

```bash
git fetch origin
git log --oneline -1 origin/main    # confirm it actually moved
```

Do this before creating a worktree or a branch. Work branched off a weeks-old base is where
avoidable merge pain comes from.

## Git worktrees (STRONGLY PREFERRED)

**Use a git worktree per issue rather than switching branches in the main checkout.**

This repo carries heavy untracked local state — hoisted `node_modules/`, build output, a local
database, `.env` files, running dev servers on 3001/5173. Switching branches under all that
invalidates builds, strands migrations, and leaves stale compiled assets. A worktree gives each
piece of work its own directory and leaves `main` clean and runnable.

### Convention

```bash
git fetch origin
git worktree add ../open_tms-412 -b tms/412-cutoff-auto-resolve origin/main
```

- Branch name carries the issue number: `tms/412-<slug>` or `wms/412-<slug>`
- **Always branch from `origin/main`**
- Worktrees live as **siblings of the repo** (`../open_tms-412`). If you put them inside the repo
  instead, the path **must** be gitignored — `.claude/worktrees/` already is.

### Provisioning

A fresh worktree has no untracked files, so nothing runs until you set it up:

```bash
cd ../open_tms-412
cp ../open_tms/backend/.env backend/.env    # .env is gitignored, it doesn't come with the worktree
npm install                                  # from the root — node_modules is hoisted
```

Watch out for **port collisions** (two stacks can't both bind 3001/5173 — change them in the second
worktree's `.env`) and **separate databases** (that's the point; don't "fix" it by sharing).

### Always tidy up worktrees when done

```bash
git worktree remove ../open_tms-412    # after the branch is merged
git worktree prune                     # clear stale metadata
git worktree list                      # check what's still around
```

**Remove the worktree as part of finishing the work, not later.** A directory of abandoned worktrees
is how a stale branch gets deployed by accident. `.claude/worktrees/` currently holds leftovers —
that's the failure mode this rule exists to prevent.

## Commits & PRs

- Commit messages describe the change and carry the issue number:
  `Fix cutoff risk issues not auto-resolving on recovery (#412)`
- PR titles follow the same convention.
- Before opening a PR: tests pass, TypeScript compiles clean, and the pre-commit checklist has
  actually been walked through.
- After merging: `--delete-branch` handles the remote, then remove the worktree and move the issue
  to *Done*.
