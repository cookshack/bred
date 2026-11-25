# Restart prompt

Hand the block below to a fresh agent, in build mode, from the repository root.
It is deliberately short: the protocol, the rules and the round history are in
`doc/Loop.md`, and the work is in `doc/Loop-queue.md`, so the prompt only has to
say where to look and what to do.

The one thing a file cannot carry is the deadline, because `$LOOP/state` is
per-session and will not exist in a fresh one. State it in the message that
hands this over ("deadline: eight hours from now", or a time), or the agent
will choose its own.

    Continue the Bred unattended loop.

    Read doc/Loop.md first: the protocol, the round history, the rules that
    earned their place, and the section on areas and measures. Then
    doc/loop/queue.json, which is the queue itself, and doc/loop/plan-agreed.md,
    which is the agreed plan and the reason the backlog looks the way it does
    (its two predecessors are superseded; do not re-derive them).

    Establish the baseline by recording it, not by gating on it. Other agents
    and the user may commit to main while the loop runs, so drift is normal;
    what matters is knowing which kind it is:

        git log --oneline -1        # the tip at dispatch: record it as base
        git status --porcelain      # dirty paths: these are outside claims
        git log --since='2 hours ago' --name-only   # hot files (not our own)
        npx mocha --exit            # compare with "Current state" in doc/Loop.md
        npm run check
        ./bin/man-audit --parse     # compare with "Current state" and the page count

    Classify every difference as a loop commit (recorded in $LOOP/state), an
    outside commit (someone else moved main), a corpus or package change (the
    page count moved, not the parser), or a real regression. Only the last one
    blocks work; do not spend the round explaining the first three.

    The tool is tracked: bin/loop.mjs status is the re-entry point (tip,
    last verified tip, lane tips, queue counts, claims, parked branches).
    Read status, then arrange the session state in
    $LOOP=$BRED_WORKTREE_ROOT/bred-loop (claims, briefs, suite logs); the
    queue is doc/loop/queue.json, not a markdown table, so never hand-edit
    doc/Loop-queue.md (it is generated, and check will say so).

    status lists lane worktrees from earlier sessions too, because they are
    registered in the same repository; your lanes are the three under your own
    $BRED_WORKTREE_ROOT (named bred-a1..a3 and created by lanes-up), and the
    others are left alone. The same goes for the stale registrations line.

    Work in rounds of up to three lanes whose file sets are disjoint: pick
    with bin/loop.mjs pick (it skips dirty, hot and overlapping items). pick
    only returns rows whose status is `ready`, so if it returns nothing, groom
    instead: promote a `next` row to `ready` once it has a red-capable `proof`
    written on the row (a command that fails at base) and its files are free.
    Write the proof before the brief — the merge gate reads the row, not the
    brief. Then mark the chosen rows in-round, write a brief per item in
    $LOOP, run bin/loop.mjs lanes-up, and dispatch each lane with background. Tell every
    lane to read doc/loop/rules.md and its brief, work only in its worktree
    and files, commit once with a Loop-item: <id> trailer, and never merge,
    rebase or push.

    Then bin/loop.mjs round <n> --items ... gates and integrates onto
    loop/r<n> and runs the suite once at that tip (the suite log is in $LOOP).
    Measure the tip with bin/loop.mjs measure --area all --tip <tip>: every
    area, each within its budget, into doc/loop/history.jsonl. Write
    doc/loop/round-<n>.md on loop/r<n>, mark the merged items done there with
    `bin/loop.mjs mark <id>=<hash> ...`, and commit both on the branch with
    Loop-round: <n> and Loop-verify: <tip> — the marks belong in the same
    commit, not after the land. bin/loop.mjs land <n> then makes the one
    fast-forward, and refuses while doc/ is dirty. Run bin/loop.mjs report
    --write after any queue edit.

    Only the loop edits doc/Loop.md, doc/loop/queue.json, doc/Loop-queue.md and
    the plan; a lane that needs a file outside its row stops and reports
    instead of widening it.
    A red suite is not landed: fix the harness or park the lane, record the
    fact, and keep main green.

    Stop starting a new round 45 minutes before the deadline, commit the docs
    and summarise. A half-finished round is worse than a clean checkpoint.
