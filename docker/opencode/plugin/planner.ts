import { Plugin } from "@opencode/plugin"

// Faithful port of the built-in opencode.plan plugin under the id "planner",
// so it does not trip the built-in's id-keyed hooks or the ~/.opencode/plan
// carve-out (that facility is gone). Same shape as plan: a read-only primary
// agent with plan's permissions and an enter/leave "Planner mode" reminder
// injected/reconciled per request through the session context hook.
const ID = "planner"

// Plan's enter reminder, adapted: "Planner mode" and no ~/.opencode/plan line.
const ENTER = `You are in Planner mode. Discuss the plan with the user directly in the conversation. You may not create or update any files.

Do not modify any other files or ask a subagent to do so.

You remain in Planner mode until the user switches agents. If the user asks you to implement changes, do not do so. Tell them they need to switch to the build agent.`

const isEnter = (p: { type?: string; text?: string }) => p.type === "text" && p.text === ENTER

export default Plugin.define({
  id: ID,
  setup: async (ctx) => {
    await ctx.agent.transform((editor) => {
      editor.update(ID, (agent) => {
        agent.name = "Planner"
        agent.description = "Read-only agent for exploring the codebase and planning work before implementation."
        agent.mode = "primary"
        agent.permissions.push(
          { action: "question", resource: "*", effect: "allow" },
          { action: "edit", resource: "*", effect: "deny" }
        )
      })
    })

    // Enter/leave: the Planner-mode reminder is present in system while the
    // planner is active, and stripped the moment a different agent is selected
    // (the read-only restriction lifts with the agent). Mirrors plan's enter
    // and leave behaviour through the same `system` channel internal plugins use.
    await ctx.session.hook("context", (input) => {
      const system = input.system as Array<{ type?: string; text?: string }>
      const active = input.agent === ID
      const at = system.findIndex(isEnter)
      if (active && at < 0) system.push({ type: "text", text: ENTER })
      else if (!active && at >= 0) system.splice(at, 1)
    })
  },
})