import { Plugin } from "@opencode/plugin"

// A session's directory is the anchor everything hangs off: Code Sessions lists
// sessions by it, the opencode store is keyed by it, and reopening a session
// spawns its container there. An agent that calls session_move relocates the
// session into its worktree, which silently hides it from Code Sessions and
// leaves a reopen looking in a different database (the store for the worktree
// path), so the session appears lost.
//
// Worktrees are filesystem scratch: create them with git inside
// $BRED_WORKTREE_ROOT and work in them by absolute path / `git -C`. So the tool
// is removed from the registry and, in case a registry transform runs before the
// built-in tools register, denied in every agent's permission ruleset — that
// ruleset is what tool discovery and the tool snapshot are filtered with.
const TOOL = "opencode_session_move"

let warned = false

export default Plugin.define({
  id: "no-session-move",
  setup: async (ctx) => {
    await ctx.tool.transform((tools) => {
      if (!warned && tools.get(TOOL) === undefined) {
        warned = true
        console.error("[no-session-move] " + TOOL + " is not registered; relying on the permission deny rule")
      }

      tools.remove(TOOL)
    })

    await ctx.agent.transform((agents) => {
      for (const agent of agents.list())
        agent.permissions.push({ action: TOOL, resource: "*", effect: "deny" })
    })
  },
})
