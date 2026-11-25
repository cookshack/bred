# Restart prompt

Hand the block below to a fresh agent, in build mode, from the repository root.
It is deliberately short: the protocol, the rules and the round history are in
`doc/Loop.md`, and the work is in `doc/Loop-queue.md`, so the prompt only has to
say where to look and what to do.

The deadline is tracked: `doc/loop/queue.json` `run` carries start, deadline
and stopNew, so a fresh session inherits it. If `bin/loop.mjs clock` says the
clock is missing, set it before doing anything else. A remembered duration is
not a clock.

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

    Before every round, run bin/loop.mjs clock. Start a round only while it
    says can-start 1; round refuses when it does not, and a missing clock is a
    refusal too. Finishing before stopNew with dispatchable work is a failed
    run: groom or hunt, do not summarise.

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
    with bin/loop.mjs pick (it skips dirty, hot and overlapping items). One
    lane is one file, so items on the same file (the man tail on
    js/man-parse.mjs) are batched, not parallel: when two or three rows name
    one lane with identical files and proof, add one batch row that owns the
    union and that proof, dispatch the batch, and mark each absorbed row done
    with the batch's hash and a note naming it. pick
    only returns rows whose status is `ready`, so if it returns nothing, groom
    instead: promote a `next` row to `ready` once it has a red-capable `proof`
    written on the row (a command that fails at base) and its files are free.
    Write the proof before the brief — the merge gate reads the row, not the
    brief. Then mark the chosen rows in-round, write a brief per item in
    $LOOP, run bin/loop.mjs lanes-up, and dispatch each lane as a background
    subagent: call the native `subagent` tool directly (agent general,
    background), not through execute. It is a native harness tool, so the
    execute catalog's "complete" note does not cover it; if a session cannot
    call it, stop and report the tool and error instead of doing the lanes'
    work yourself. Tell every lane to read doc/loop/rules.md and its brief,
    work only in its worktree and files, commit once with a Loop-item: <id>
    trailer, and never merge, rebase or push. While the lanes run, groom the
    next round: promote `next` rows to `ready` with red-capable proofs.
    Waiting on a lane is free time; use it.

    Then bin/loop.mjs round <n> --items ... gates and integrates onto
    loop/r<n> and runs the suite once at that tip (the suite log is in $LOOP).
    Measure what the round touched with
    bin/loop.mjs measure --area <area> --tip <tip> (each area within its
    budget, into doc/loop/history.jsonl); run --area all at the final tip and
    after a round that spans areas. Write
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

    Keep starting rounds until bin/loop.mjs clock says can-start 0 (stopNew
    is 45 minutes before the deadline). Then land or park what is in flight,
    commit the docs and write the summary with the clock line you stopped on.
    Stopping earlier needs one of the named exceptions in doc/Loop.md
    "Stopping". A half-finished round is worse than a clean checkpoint; a
    summary written early is not a finished run.

    A long transcript is not the clock: opencode compacts automatically at
    about 90% of the model window and carries on. A high context reading is
    not a stop, and neither is a session that cannot finish the run — land
    what is in flight, leave the tracked clock for the next session, and say
    the clock line you handed over on. The clock and the named exceptions are
    the only stops.
