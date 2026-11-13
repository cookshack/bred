import { Plugin } from "@opencode/plugin"

// Port of the built-in opencode.plan plugin under the id "planner", so it does
// not trip the built-in's id-keyed hooks or the ~/.opencode/plan carve-out
// (that facility is gone). A read-only primary agent with plan's permissions.
//
// Plan keeps TWO reminders and reconciles them against the transcript on every
// request: the enter text while plan is active, and a leave text the moment the
// user switches away. Both are persisted into the session, so the reminder is
// part of the conversation and can be cancelled later. Without the leave text a
// switch to build leaves the last enter reminder as the transcript's only
// statement about the agent's mode, and the model carries on believing it is
// still in Planner mode.
const ID = "planner"

// Plan's enter reminder, adapted: "Planner mode" and no plan-directory line.
// Unlike plan there is no write carve-out at all, so no directory is named.
const ENTER = `<system-reminder>
You are in Planner mode. Discuss the plan with the user directly in the conversation. You may not create or update any files.

Do not modify any other files or ask a subagent to do so.

You remain in Planner mode until the user switches agents. If the user asks you to implement changes, do not do so. Tell them they need to switch to the build agent.
</system-reminder>`

const LEAVE = `<system-reminder>
You are NO LONGER in Planner mode. The previous Planner restrictions no longer apply. Any Planner mode instructions from earlier in this conversation are no longer active.
</system-reminder>`

const WRITE_TOOLS = new Set([ "edit", "write", "patch" ])

// Reminders are inserted as single-part user messages, so only those count when
// looking for the newest one.
function lastReminder
(messages: ReadonlyArray<{ role?: string, content: ReadonlyArray<{ type?: string, text?: string }> }>) {
  return messages.reduce<string | undefined>((found, message) => {
    const part = message.role === "user" && message.content.length === 1
      ? message.content[0]
      : undefined

    if (part?.type !== "text") return found

    return part.text === ENTER || part.text === LEAVE ? part.text : found
  }, undefined)
}

// What the transcript should say for this request's agent, or nothing when it
// already says the right thing.
function reminderFor
(agent: string, reminder: string | undefined) {
  if (agent === ID) return reminder === ENTER ? undefined : ENTER

  return reminder === ENTER ? LEAVE : undefined
}

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

    // A rule-based deny short-circuits before the permission.evaluate hook runs,
    // so the model would only be told "Permission denied: edit". Name the way
    // out instead. Plan does this from execute.after; execute.before needs no
    // Tool.Error construction and pre-empts the permission denial entirely.
    await ctx.tool.hook("execute.before", (event) => {
      if (event.agent !== ID) return
      if (!WRITE_TOOLS.has(event.tool)) return

      throw new Error("Planner is read-only: no file changes. Ask the user to "
                      + "switch to the build agent if they want this written.")
    })

    const persist = async (sessionID: string, text: string) => {
      try {
        await ctx.session.synthetic({ sessionID, text, resume: false })
      } catch (err) {
        console.error("[planner] failed to persist reminder: " + err)
      }
    }

    // Reconcile per request against the transcript, which is the only durable
    // record: compaction and committed reverts can drop reminders while the
    // session's agent stays put. Plan inserts before the user's prompt, which is
    // where agent-switch reminders land; mirror that.
    await ctx.session.hook("context", async (input) => {
      const text = reminderFor(input.agent, lastReminder(input.messages))

      if (!text) return

      const at = input.messages.at(-1)?.role === "user"
        ? input.messages.length - 1
        : input.messages.length

      // A plain object is enough: the request is already shaped at this point,
      // and the persisted copy is built server-side by session.synthetic.
      const reminder = { role: "user", content: [ { type: "text", text } ] }

      input.messages.splice(at, 0, reminder as unknown as (typeof input.messages)[number])

      await persist(input.sessionID, text)
    })
  },
})
