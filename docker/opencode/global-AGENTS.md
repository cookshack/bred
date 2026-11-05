# Global agent rules

## Pushing

The agent runs in a network-restricted container with no SSH credentials;
`git push` always fails. Never run `git push`, never include it as a plan step,
and never offer to do it. If a branch is ready, state the exact command for the
user to run on the host — pushing is the user's action, not the agent's.

## Following a long-running run

When the user says "follow <run>, report every N minutes" — where <run> is
whatever identifies it ("the e2e run for 79", "./fix-gvmd-unit 171", "the gvmd
unit suite") — keep reporting until the run ends:

- Work out how to observe <run> from the conversation and the repo (its log
  file, the output file it writes, the process/container it runs in, a socket)
  and say what you are watching in the first report. If it is ambiguous, ask
  once.
- Only assistant text reaches the user. Text is delivered between tool calls,
  but an in-flight call blocks the turn, so progress cannot be spoken while a
  call runs.
- Cycle: write a status line, then make ONE tool call that sleeps exactly N
  minutes and inspects the run however you need (logs, files, processes,
  containers - as many commands as that takes), then write the next status
  line. Repeat until the run ends, then summarise. Taking a little time to
  inspect is fine; the cadence is what matters.
- Write a report before the first sleep and never run two sleeps without a
  report between them. Do not encode progress as command output alone.
- Background commands are disabled (no completion notification); never claim to
  have started one.
- If a call is interrupted right at the boundary, read the state again and
  report immediately; do not restart the interval or go silent.
- If the state stops changing, report that too; a stalled run is a status, not
  silence.

## Working in a git worktree (mandatory)

You **must not** modify tracked files in a canonical git checkout — do not `edit`,
`git add`, or `git commit` on a repo's checked-out branch. Before any change to a
repo you can reach, create a worktree, do the work there, then merge it back. This
keeps the user's main checkout (and whatever branch it sits on) untouched. The rule
has **no exceptions**:

- It applies to **every** reachable repo — the session directory and any
  bound/mounted directory (e.g. `~/src/bred`, `~/src/review`, `~/src/infra`).
- A "scratch", "test", or `tmp/` repo is still a repo: use a worktree there too.
- An existing file-level instruction telling you to `git add && git commit` a file
  is about *how to commit*, not permission to skip the worktree. Do that commit
  inside a worktree on your own branch, then merge it back.
- The only commits you ever make are in a worktree, on a branch you created.

If you are tempted to skip this because a repo seems small, scratch-like, or to
have "its own rules" — do **not** guess and do **not** proceed. Stop, tell the user
you are about to skip the worktree rule and why, and wait for a decision.

(A read-only agent such as `planner` never modifies files, so this does not apply
to it.)

Per repo you edit, once per session:

1. `cd <repo>`; record its current branch — `git -C <repo> branch --show-current`
   — as the target branch.
2. Create one persistent worktree for this session:
   `git -C <repo> worktree add -b agent/<repo>-<session> <repo>.wx/<session> <target>`
   (a sibling worktree dir outside the checkout, e.g. `<repo>.wx/<session>`).

The worktree path must be **writable** in the container. A sibling like `<repo>.wx/`
only works when its parent is mounted writable (e.g. inside the session dir's source
tree); for a repo whose sibling isn't writable (such as a `tmp/` repo with only `$PWD`
mounted), fall back to a known-writable scratch dir (e.g. `/tmp/opencode/...` or
`~/sessions/...`) instead of failing on the sibling.

Per task:

1. Re-read the repo's current branch as the target branch.
2. Sync the worktree: `git -C <worktree> reset --hard <target>` (cheap — the tree
   is already near-identical to main).
3. Start a task branch: `git -C <worktree> checkout -b agent/<repo>-<task>`.
4. Do the work **in the worktree dir**; commit incrementally (history preserved).
5. Merge back, keeping **linear** history (no merge commits): rebase the task branch
   **in the worktree** (the canonical dir cannot rebase it — the task branch is checked
   out in the worktree), then fast-forward the target from the canonical dir:
   `git -C <worktree> rebase <target>` then
   `cd <repo> && git merge --ff-only agent/<repo>-<task>`.
6. Delete the task branch: `git -C <repo> branch -D agent/<repo>-<task>`.

A task touching multiple repos gets **one worktree per repo**, each merged into its
own target branch (worktrees are per-repo, no cross-tree interaction).

If a canonical dir has uncommitted changes that overlap the merge, **do not force
or discard them** — stop that merge and report "main was dirty, merge skipped."

**Keep your worktrees for the life of the session.** They are reused and reset each
task, so do **not** delete them when a task or a conversation finishes — that keeps
a session resumed from Code Sessions working with no re-checkout. Worktree pruning
is housekeeping done outside the session (by you or on the host); do not remove
worktrees yourself.
