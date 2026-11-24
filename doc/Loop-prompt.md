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

    Read doc/Loop.md first: it is the protocol, the round history, and the
    rules that earned their place. Then read doc/Loop-queue.md: it says whether
    a run is live and which items are ready, next or triage.

    Establish the baseline by recording it, not by gating on it. Other agents
    and the user may commit to main while the loop runs, so drift is normal;
    what matters is knowing which kind it is:

        git log --oneline -1        # the tip at dispatch: record it as base
        git status --porcelain      # dirty paths: these are outside claims
        git log --since='2 hours ago' --name-only   # hot files: avoid them
        npx mocha --exit            # compare with "Current state" in doc/Loop.md
        npm run check
        ./bin/man-audit --parse     # compare with "Current state" and the page count

    Classify every difference as a loop commit (recorded in $LOOP/state), an
    outside commit (someone else moved main), a corpus or package change (the
    page count moved, not the parser), or a real regression. Only the last one
    blocks work; do not spend the round explaining the first three.

    The run's state directory is per-session and may not exist: create
    $LOOP=$BRED_WORKTREE_ROOT/bred-loop with state, rules.md, claims/ and
    round.sh, as "Where state lives" and "How a round works" in doc/Loop.md
    describe. Lane worktrees are $BRED_WORKTREE_ROOT/bred-a1..a3 on branches
    agent/bred-<ws8>-a1..a3; run $LOOP/lanes-up.sh to bring them to main.

    Then work in rounds of up to three lanes whose file sets are disjoint: pick
    from the `files` column in doc/Loop-queue.md, and leave out any item whose
    files are dirty or were touched in the last two hours (another agent is on
    them). Write $LOOP/lane-<id>.md and $LOOP/lane-a<lane>.test for each, claim
    with mkdir, dispatch in background telling each lane to read rules.md and
    its brief and to commit once, then merge with $LOOP/round.sh. After the
    merge take the round's one measurement at the tip round.sh reports, and
    record the numbers and the item statuses in doc/loop/round-<n>.md,
    doc/Man.md and doc/Loop-queue.md. Only the loop edits doc/Loop.md and
    doc/Loop-queue.md.

    Stop starting a new round 45 minutes before the deadline, commit the docs
    and summarise. A half-finished round is worse than a clean checkpoint.
