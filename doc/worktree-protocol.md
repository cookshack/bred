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
- **Report, never force**, when the canonical dir is dirty — the user may
  intentionally keep dirs on branches.

## Performance facts

- `git worktree add` is fully local: no fetch, no remote. It writes tracked
  files from the local object DB — sub-second to ~1–2 s for a source repo,
  disk-bound only.
- Worktrees share the object DB, refs, and config. Git ops (commit/diff/status/
  merge) run at the same speed as the main checkout.
- The real cost is **dependencies**: `node_modules` is not shared per worktree.
  This is the one decision that determines whether worktrees feel slow.

## The protocol

Apply to **any git repo the session will modify** (session `location` dir or a
bound dir), **before the first tracked-file edit** to that repo. Read-only work
(inspection, searching, reading) does **not** require a worktree.

### Per repo, on first edit (create the persistent worktree)

1. `cd <repo_dir>`; confirm it is a git work tree.
2. Record the repo's current branch: `git -C <repo_dir> branch --show-current`.
3. Create one persistent worktree for this session/repo:
   `git -C <repo_dir> worktree add -b agent/<repo>-<session> /tmp/opencode/<repo>-<session> <target_branch>`.
   `/tmp/opencode/...` is always writable in the container, so no sibling/fallback
   needed. The worktree is disposable scratch (merged work lives in the canonical
   checkout on the host), so its non-persistence across container restarts is fine.

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

Worktrees are **not** removed here. They persist for the Code Session's lifetime
and are reused (reset to the target branch each task), so a session resumed from
Code Sessions keeps working with no re-checkout. Worktree cleanup belongs to the
Code Session lifecycle (a future `ext/code` feature): prune when a Code Session
is deleted, not when a conversation ends.

## Open decisions (resolved)

- **Dependencies.** Let the agent handle them — it installs as it needs (fresh
  install in the worktree). No node_modules symlinking.
- **Trigger.** Any tracked-file edit in a git repo the session can reach. No
  exceptions for "scratch"/`tmp/` repos, and existing file-level
  `git add && commit` instructions do not waive it. If tempted to skip, surface
  it and wait — do not guess.
- **Worktree location/naming.** Use `/tmp/opencode/<repo>-<session>` (always writable
  in the container); worktree branch `agent/<repo>-<session>`, task branch
  `agent/<repo>-<task>`.
- **Cleanup.** Worktrees are **not** removed at task or session end — they persist
  for the Code Session's lifetime and are reused (reset to the target branch each
  task). This keeps a session resumed from Code Sessions working with no
  re-checkout. Pruning happens only when a Code Session is actually deleted (a
  future `ext/code` feature); until then leftover worktrees are cheap and harmless.
  The in-container agent does not prune.