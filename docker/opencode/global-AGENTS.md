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
- Cycle: write the status line, then ONE tool call that sleeps exactly N
  minutes and checks the state with a single quick command, then write the next
  status line immediately. Keep the post-sleep command short so the report
  follows within seconds. Repeat until the run ends, then summarise.
- Write a report before the first sleep and never run two sleeps without a
  report between them. Do not encode progress as command output alone.
- Background commands are disabled (no completion notification); never claim to
  have started one.
- If a call is interrupted right at the boundary, read the state again and
  report immediately; do not restart the interval or go silent.
- If the state stops changing, report that too; a stalled run is a status, not
  silence.
