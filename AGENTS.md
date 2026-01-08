# Code Extension

You and I are improving the Bred editor.

See Specification.md for a general overview.
See Files.md for an overview of the source files.

## Context

Bred is my personal project that I use for daily work. It's highly likely that I
will be the only one who ever uses and/or develops it. So the focus must be on
improvements for me, as apposed to making is accessible to others.

## Conventions

- **Code style** - Follow `@cookshack/eslint-config` (please read `node_modules/@cookshack/eslint-config/index.js`)
- **`d()` takes single arg** - Use `d('msg')` or `d({ obj })`, never multiple args
- **String formatting** - Use `'xxx' + var`, not template literals `` `xxx${var}` ``
- **Variable naming** - No capitals: `textBuffer`, not `TextBuffer`
- **Event structure** - `event.properties.part`, not `event.data.properties.part`
- **Permission prompts** - Use `Prompt.yn()` for yes/no, not `Prompt.ask()` with options
- **Files must end in newlines** - Always end files with a trailing newline
- **Booleans use 1/0** - Use `1` and `0` instead of `true` and `false`
- **No explicit 0 for falsy** - Don't set variables to `0` when they are implicitly false/undefined
- **No curly braces for single statements** - Omit `{}` for single-statement if/for/else bodies
- No semicolons, single quotes
- No linebreaks in arrays/function calls: `fn([ { a: 1 }, { b: 2 } ])`
- Space after `[` and before `]`, space around `{` in objects
- `let` with blank line before code
- Stroustrup brace style
- Use the positive sense - commit hooks prevent:
  - Logical negation: `!condition`, `!=`, `!==`
  - Comparisons to 0/null/undefined
- prefer == to === for comparison

## Debugging

Use `d()` to log debug output:

```javascript
import { d } from '../../js/mess.mjs'

d('some message')
d({ object }) // NB this takes a single arg only
```

Check the dev console (Ctrl+Shift+I) to see logs.

## ext/code: Opencode UI

### Conventions

- **Session matching** - Match events by `sessionID` from `buf.vars('code`
- **SDK method** - `c.postSessionIdPermissionsPermissionId()` on the client
- **Read TUI code** - When uncertain about API usage, check `opencode-src/packages/opencode/src/cli/cmd/tui/` for reference patterns
- **OpenCode src path** - Use `opencode-src/` instead of full path (it's a symlink to the actual source)

### Files

- `ext/code/code.mjs` - Main extension code
- `ext/code/code.css` - Styles
- `ext/code/lib/opencode.js` - SDK wrapper
- `ext/code/lib/gen/` - Generated SDK (v1.1.1)

### SDK Usage

The OpenCode SDK provides a client that connects to the local server at `http://127.0.0.1:4096`.

```javascript
import * as OpenCode from './lib/opencode.js'

client = OpenCode.createOpencodeClient({ baseUrl: 'http://127.0.0.1:4096' })
```

#### Key SDK Methods

- `client.session.create({ body: { title } })` - Create a new session
- `client.session.prompt({ path: { id }, body: { parts, model } })` - Send a prompt
- `client.event.subscribe({})` - Subscribe to events (returns `{ stream }`)
- `client.config.providers({})` - List available providers and models
- `client.postSessionIdPermissionsPermissionId({ path: { id, permissionID }, body: { response } })` - Respond to permission requests

#### Event Stream

```javascript
const { stream } = await client.event.subscribe({})
for await (const event of stream) {
  // event.type
  // event.properties
}
```

### Event Types

#### message.part.updated

Tool, text, and reasoning parts arrive through this event.

```javascript
if (event.type == 'message.part.updated') {
  const part = event.properties.part
  // part.type: 'text' | 'reasoning' | 'tool'
  // part.sessionID
  // part.messageID
}
```

#### permission.updated

Permission requests for tools like `bash`:

```javascript
if (event.type == 'permission.updated') {
  const req = event.properties
  // req.id - permission ID
  // req.type - 'bash', 'read', 'grep', etc.
  // req.metadata - tool input (command, pattern, description, etc.)
  // req.sessionID
}
```

### Tool Events

#### read

Shows `➔ Read file {path}` when running.

```javascript
if (part.tool == 'read' && part.state?.status == 'running') {
  const path = part.state.input.filePath
}
```

#### grep

Shows `➔ Grep "{pattern}" in {path}` when running.
Shows `➔ Grep "{pattern}" in {path} ({N} matches)` when done.

```javascript
if (part.tool == 'grep' && part.state?.status == 'running') {
  const pattern = part.state.input.pattern
  const path = part.state.input.path
}
if (part.tool == 'grep' && part.state?.status == 'completed') {
  const matches = part.state.metadata?.matches
}
```

#### bash

Shows `➔ bash: {command}` when running.
Shows `➔ bash: $ {command} (exit {code})` with output underneath when done.

```javascript
if (part.tool == 'bash' && part.state?.status == 'running') {
  const command = part.state.input.command
  const description = part.state.input.description
}
if (part.tool == 'bash' && part.state?.status == 'completed') {
  const command = part.state.input.command
  const exitCode = part.state.metadata?.exit
  const output = part.state.output
}
```

### Permission Handling

For bash commands, show a Y/N prompt and respond:

```javascript
Prompt.yn('Run "' + (description || command) + '"?', {}, async yes => {
  await client.postSessionIdPermissionsPermissionId({
    path: { id: sessionID, permissionID: req.id },
    body: { response: yes ? 'once' : 'reject' }
  })
})
```

Response options: `'once'` | `'always'` | `'reject'`

### Thinking Content

Thinking arrives as `reasoning` parts. Text parts arrive first, buffered by `part.messageID`. When the reasoning event arrives, display the buffered text as thinking.

```javascript
const textBuffer = new Map()

// Text parts buffer
if (part.type == 'text') {
  const existing = textBuffer.get(part.messageID) || ''
  textBuffer.set(part.messageID, existing + part.text)
}

// Reasoning event - show thinking
if (part.type == 'reasoning') {
  const buffered = textBuffer.get(part.messageID) || ''
  appendThinking(buf, buffered)
  textBuffer.delete(part.messageID)
}
```

### Model Selection

Set the model in the prompt body:

```javascript
res = await client.session.prompt({
  path: { id: sessionID },
  body: {
    model: { providerID: 'opencode', modelID: 'minimax-m2.1-free' }, // FIX uses Opt now
    parts: [ { type: 'text', text } ]
  }
})
```

### Commands

- `code` - Start a new coding chat
- `code chat` (in code mode) - Continue the chat

### Known Issues

- Event stream must be started before sending prompts
- Each buffer needs its own event subscription handling
- Thinking content arrives incrementally via delta updates
