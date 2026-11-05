import { Plugin } from "@opencode/plugin"

// Defines the read-only "planner" agent (a plan-like planning agent) for Bred's
// opencode container. Baked into the image via docker/opencode/plugin (the
// Dockerfile COPYs this dir to ~/.config/opencode/plugin).
export default Plugin.define({
  id: "planner",
  setup: async (ctx) => {
    await ctx.agent.transform((editor) => {
      editor.update("planner", (agent) => {
        agent.name = "Planner"
        agent.description = "Read-only agent for exploring the codebase and planning work before implementation."
        agent.mode = "primary"
        agent.system =
          "You are the Planner, a read-only planning agent. Discuss the plan with the user directly in the conversation. You may not create or update any files. Do not modify any other files or ask a subagent to do so. You remain a planning agent until the user switches agents. If the user asks you to implement changes, do not do so. Tell them they need to switch to the build agent."
        agent.permissions.push(
          { action: "question", resource: "*", effect: "allow" },
          { action: "edit", resource: "*", effect: "deny" }
        )
      })
    })
  },
})