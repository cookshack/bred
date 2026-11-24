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

    Establish the baseline before changing anything:

        git log --oneline -1        # the tip after the last round, or later
        git status --porcelain      # clean
        npx mocha --exit            # compare with "Current state" in doc/Loop.md
        npm run check
        ./bin/man-audit --parse     # compare with "Current state"

    If any of those differ, find out why before starting work.

    The run's state directory is per-session and may not exist: create
    $LOOP=$BRED_WORKTREE_ROOT/bred-loop with state, rules.md, claims/ and
    round.sh, as "Where state lives" and "How a round works" in doc/Loop.md
    describe. Lane worktrees are $BRED_WORKTREE_ROOT/bred-a1..a3 on branches
    agent/bred-<ws8>-a1..a3, reset --hard main before each round.

    Then work in rounds of up to three lanes whose file sets are disjoint:
    write $LOOP/lane-<id>.md for each, claim with mkdir, dispatch in background
    telling each lane to read rules.md and its brief and to commit once, then
    merge with $LOOP/round.sh. After the merge take the round's one
    measurement, and record the numbers and the item statuses in doc/Man.md,
    doc/Loop.md and doc/Loop-queue.md. Only the loop edits doc/Loop.md and
    doc/Loop-queue.md.

    Stop starting a new round 45 minutes before the deadline, commit the docs
    and summarise. A half-finished round is worse than a clean checkpoint.
