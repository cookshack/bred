# Agent Git Worktree Protocol

How a code session's **build** agent writes code without touching the canonical
checkout. Read-only planning happens in the **planner** agent; the moment a
written plan (or any code) needs to land in a repo, the build agent applies this
protocol.

## Goal

When a session edits code in **any** git repo it can reach — the session
`location` dir **or** a bound/mounted dir (e.g. `~/src/bred` or `~/src/review`
while working in `~/src/infra`) — the agent should **not** edit the canonical
checkout directly. It uses a **persistent worktree per repo per session**, does
each task on a task branch, and merges back (rebase + fast-forward, history
preserved) into
**the branch the dir was on when the task started**. The canonical checkout (and
its branch) is never checked out or overwritten by the agent.

## Why this shape

- **Agent-managed, not editor-managed.** A task can touch the session dir or a
  bound dir; only the running agent knows which repo it will edit at runtime.
  Hardcoding into the extension guesses wrong, so the protocol is instructions
  to the agent.
- **Per-session worktree, not per-task.** `git worktree add` is a full checkout;
  one per small task is wasteful. One persistent worktree per repo is created on
  first edit, then reused. Between tasks it syncs to the target branch cheaply.
- **Merge into the dir's current branch, not `main`.** The target branch may be
  any branch the dir is on. Target = `git -C <dir> branch --show-current`
  captured at task start.
- **Linear, preserve history.** Task commits land in the target branch unsquashed
  via `rebase <target> agent/<task>` then `merge --ff-only` — flat log, no merge
  commits.
- **Auto-merge on task completion, review afterward** (matches the workflow of
  skimming `git diff` after the agent finishes). No human merge gate.
- **Host-visible worktree root.** The worktree lives under
  `$BRED_WORKTREE_ROOT` (a per-container dir at `~/worktrees/<slug>`), which is
  bind-mounted into the container at the same absolute path. The user can watch
  edits live from the host, and agent file links (`open link`) resolve because
  the path exists on both sides.
- **Report, never force**, when the canonical dir is dirty — the user may
  intentionally keep dirs on branches.

## Performance facts

- `git worktree add` is fully local: no fetch, no remote. It writes tracked
  files from the local object DB — sub-second to ~1–2 s for a source repo,
  disk-bound only.
- Worktrees share the object DB, refs, and config. Git ops (commit/diff/status/
  merge) run at the same speed as the main checkout.
- The real cost is **dependencies**: `node_modules` is not shared per worktree.
  This is the one decision that determines whether worktrees feel slow. Because
  worktrees now live on the host under `~/worktrees`, an install in one survives
  container restarts and is reused across tasks in the same run.

## The protocol

Apply to **any git repo the session will modify** (session `location` dir or a
bound dir), **before the first tracked-file edit** to that repo. Read-only work
(inspection, searching, reading) does **not** require a worktree.

### Per repo, on first edit (create the persistent worktree)

1. `cd <repo_dir>`; confirm it is a git work tree.
2. Record the repo's current branch: `git -C <repo_dir> branch --show-current`.
3. Create one persistent worktree for this session/repo:
   `git -C <repo_dir> worktree add -b agent/<repo>-<session> "${BRED_WORKTREE_ROOT:-/tmp/opencode}/<repo>" <target_branch>`.
   `$BRED_WORKTREE_ROOT` is a host directory mounted into the container at the
   same absolute path (`~/worktrees/<slug>`), so the user can browse the worktree
   live on the host while the agent works. When the variable is unset (a
   non-docker run), fall back to `/tmp/opencode`, which is only container-local.

   Worktrees and branches persist on the host, so a resumed session may already
   have `agent/<repo>-<session>`. If `worktree add -b` reports that the branch
   exists, attach it without `-b`:
   `git -C <repo_dir> worktree add "${BRED_WORKTREE_ROOT:-/tmp/opencode}/<repo>" agent/<repo>-<session>`
   (or start a fresh task branch from the target if it is checked out elsewhere).

### Per task

1. Record the **target branch**: `git -C <repo_dir> branch --show-current`
   (captured at task start; may differ from the last task).
2. Sync the worktree to it: `git -C <worktree_dir> reset --hard <target_branch>`
   (cheap — the tree is already near-identical).
3. Create a task branch: `git -C <worktree_dir> checkout -b agent/<repo>-<task>`.
4. Do the work **in the worktree dir**. Commit incrementally (history preserved).
5. **On completion**, merge back keeping **linear** history (no merge commits):
   rebase the task branch **in the worktree** (the canonical dir cannot rebase it —
   the task branch is checked out in the worktree), then fast-forward the target
   from the canonical dir:
   `git -C <worktree_dir> rebase <target>` then
   `cd <repo_dir> && git merge --ff-only agent/<repo>-<task>`.
6. Reset the worktree onto the session branch, then delete the task branch (the
   task branch is checked out in the worktree, so the canonical dir cannot delete
   it until the worktree moves off it):
   `git -C <worktree_dir> checkout agent/<repo>-<session>` then
   `git -C <repo_dir> branch -D agent/<repo>-<task>`.

### Multi-repo tasks

A task touching `~/src/bred` **and** `~/src/review` gets **one worktree per
repo**, each merged into its own captured target branch. Worktrees are per-repo,
so there is no cross-tree interaction.

### Dirty canonical dir

If `git -C <repo_dir> status` shows changes that overlap the merge target, do
**not** force or discard them. Report: "main was dirty, merge skipped", and stop
that merge.

### Session end

Worktrees are **not** removed here. They persist for the Code Session's lifetime —
and on the host under `~/worktrees/` — and are reused (reset to the target branch
each task), so a session resumed from Code Sessions keeps working with no
re-checkout. The user may also still want to browse the files after the run.
Worktree cleanup belongs to the Code Session lifecycle (a future `ext/code`
feature): prune when a Code Session is deleted, not when a conversation ends.

Stale/prunable worktrees under `~/worktrees/` from earlier runs are expected,
disposable scratch — the agent ignores them and does not prune.

## Open decisions (resolved)

- **Dependencies.** Let the agent handle them — it installs as it needs (fresh
  install in the worktree). No node_modules symlinking.
- **Trigger.** Any tracked-file edit in a git repo the session can reach. No
  exceptions for "scratch"/`tmp/` repos, and existing file-level
  `git add && commit` instructions do not waive it. If tempted to skip, surface
  it and wait — do not guess.
- **Worktree location/naming.** Use `$BRED_WORKTREE_ROOT/<repo>`, where the
  launcher sets `$BRED_WORKTREE_ROOT=~/worktrees/<container-slug>` — one host
  directory per container, mounted at the same path. Worktree branch
  `agent/<repo>-<session>`, task branch `agent/<repo>-<task>`. Fall back to
  `/tmp/opencode` when the variable is unset.
- **Cleanup.** Worktrees are **not** removed at task or session end — they persist
  for the Code Session's lifetime, and on the host, and are reused (reset to the
  target branch each task). This keeps a session resumed from Code Sessions working
  with no re-checkout and lets the user browse the result afterwards. Pruning
  happens only when a Code Session is actually deleted (a future `ext/code`
  feature); until then leftover worktrees are cheap and harmless. The in-container
  agent does not prune.