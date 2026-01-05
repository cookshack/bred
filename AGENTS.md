# OpenCode Extension

Build an OpenCode UI inside the bred editor.

## Conventions

- **`d()` takes single arg** - Use `d('msg')` or `d({ obj })`, never multiple args
- **String formatting** - Use `'xxx' + var`, not template literals `` `xxx${var}` ``
- **Variable naming** - No capitals: `textBuffer`, not `TextBuffer`
- **Event structure** - `event.properties.part`, not `event.data.properties.part`
- **Session matching** - Match events by `sessionID` from `buf.vars('opencode').sessionID`
- **Permission prompts** - Use `Prompt.yn()` for yes/no, not `Prompt.ask()` with options
- **SDK method** - `c.postSessionIdPermissionsPermissionId()` on the client
- **Read TUI code** - When uncertain about API usage, check `opencode-src/packages/opencode/src/cli/cmd/tui/` for reference patterns
- **OpenCode src path** - Use `opencode-src/` instead of full path (it's a symlink to the actual source)
- **Files must end in newlines** - Always end files with a trailing newline

## Files

- `ext/opencode/opencode.mjs` - Main extension code
- `ext/opencode/opencode.css` - Styles
- `ext/opencode/lib/opencode.js` - SDK wrapper
- `ext/opencode/lib/gen/` - Generated SDK (v1.1.1)

## SDK Usage

The OpenCode SDK provides a client that connects to the local server at `http://127.0.0.1:4096`.

```javascript
import * as OpenCode from './lib/opencode.js'

client = OpenCode.createOpencodeClient({ baseUrl: 'http://127.0.0.1:4096' })
```

### Key SDK Methods

- `client.session.create({ body: { title } })` - Create a new session
- `client.session.prompt({ path: { id }, body: { parts, model } })` - Send a prompt
- `client.event.subscribe({})` - Subscribe to events (returns `{ stream }`)
- `client.config.providers({})` - List available providers and models
- `client.postSessionIdPermissionsPermissionId({ path: { id, permissionID }, body: { response } })` - Respond to permission requests

### Event Stream

```javascript
const { stream } = await client.event.subscribe({})
for await (const event of stream) {
  // event.type
  // event.properties
}
```

## Event Types

### message.part.updated

Tool, text, and reasoning parts arrive through this event.

```javascript
if (event.type == 'message.part.updated') {
  const part = event.properties.part
  // part.type: 'text' | 'reasoning' | 'tool'
  // part.sessionID
  // part.messageID
}
```

### permission.updated

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

## Tool Events

### read

Shows `➔ Read file {path}` when running.

```javascript
if (part.tool == 'read' && part.state?.status == 'running') {
  const path = part.state.input.filePath
}
```

### grep

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

### bash

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

## Permission Handling

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

## Thinking Content

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

## Model Selection

Set the model in the prompt body:

```javascript
res = await client.session.prompt({
  path: { id: sessionID },
  body: {
    model: { providerID: 'opencode', modelID: 'minimax-m2.1-free' },
    parts: [ { type: 'text', text } ]
  }
})
```

## Commands

- `opencode` - Start a new OpenCode chat
- `code` - Alias for `opencode`
- `opencode chat` (in opencode mode) - Continue the chat
- `opencode models` - List available providers and models

## Debugging

Use `d()` to log debug output:

```javascript
import { d } from '../../js/mess.mjs'

d('some message')
d({ object }) // Single arg only
```

Check the dev console (Ctrl+Shift+I) to see logs.

## Known Issues

- Event stream must be started before sending prompts
- Each buffer needs its own event subscription handling
- Thinking content arrives incrementally via delta updates
