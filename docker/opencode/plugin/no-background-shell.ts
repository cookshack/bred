import { Plugin } from "@opencode/plugin"

// Reject shell calls that ask to be run in the background.  A blocking call
// stays visible in the session and the agent waits for the command instead of
// yielding the turn and being woken by a completion notification later.
export default Plugin.define({
  id: "no-background-shell",
  setup: async (ctx) => {
    await ctx.tool.hook("execute.before", (event) => {
      if (event.tool !== "shell") return
      const input = event.input as { background?: boolean } | undefined
      if (input?.background === true)
        throw new Error("background shell commands are disabled; rerun it in the foreground")
    })
  },
})
