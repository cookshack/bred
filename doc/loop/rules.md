# Lane rules

You are one lane in the Bred unattended loop. Read this file, then your lane
brief, then the files you own. Work only in the worktree named in the brief.

- Claim the item first: `bin/loop.mjs claim <id> --lane <your lane>`. If it
  fails, the item is already taken by a live lease: stop and report. The claim
  is a lease with a pid, so a dead lane's item is reaped rather than stuck.
- Stay inside your item's file set. If the fix needs a file you do not own,
  stop and report that instead of touching it. Another lane may be editing it.
  The loop diffs your commit against the queue row after it merges, so a file
  outside the set parks the branch.
- Red first. Add a test that fails against the current code, run it, then fix.
  If the change is a measurement/tooling change that cannot fail, prove the
  claim with the tool's before/after output and say so.
- Prove the diagnosis before fixing it. For parser claims, quote the page source
  and what `groff -Tutf8` (or `groff -Tutf8 -mdoc`) really prints. The obvious
  diagnosis has been wrong three rounds running.
- Never widen a timeout silently. Wait on real state, or make the expiry
  observable and say which. A proof that hangs is neither red nor green: it is
  `did-not-finish` and the loop parks it.
- Read `node_modules/@cookshack/eslint-config/index.js` before writing code.
  Style: no semicolons, single quotes, Stroustrup braces, no braces for single
  statements, spaces inside `[ ]` and `{ }`, `let` grouped with a blank line
  after, no logical negation, `==` over `===`, 1/0 for booleans, files end in a
  newline, two-space indent.
- Run the narrow tests while you work (`npx mocha test/<file>.mjs`) and
  `npm run check` before committing. Do NOT run the whole suite, `man-audit`,
  or a section sweep: the measurement belongs to the loop, at the merged tip,
  and a sweep running beside the suite makes the viewer tests flaky.
- Commit once, on your lane branch, in your worktree. Never merge, rebase,
  push, or edit `doc/Loop.md`, `doc/Loop-queue.md` or `doc/loop/queue.json`.
  The loop owns those.
- main may move while you work: other agents and the user commit to it. The
  loop rebases your branch onto the round's integration branch and re-runs your
  proof there. If the rebase, the re-test or the file-set check fails, the loop
  parks your branch and does not merge; your commit is never discarded, but it
  is not on main either.
- Do not reset or clean your worktree, and do not amend a commit the loop has
  already seen: the branch is the record of what you did.
- Report back: the commit hash, what changed, the test that failed before, the
  before/after numbers, and anything you found but did not fix (with evidence),
  so it can go back in the queue. End the report with the block your brief
  names: `ITEM`, `BRANCH`, `TIP`, `FILES`, `PROOF`, `RED`.
