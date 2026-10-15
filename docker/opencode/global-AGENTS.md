# Global agent rules

## Pushing

The agent runs in a network-restricted container with no SSH credentials;
`git push` always fails. Never run `git push`, never include it as a plan step,
and never offer to do it. If a branch is ready, state the exact command for the
user to run on the host — pushing is the user's action, not the agent's.
