# Code Extension

You and I are improving the Bred editor.

See Specification.md for a general overview.
See Files.md for an overview of the source files.

## Context

Bred is my personal project. I use for daily work, and it's highly likely that I
will be the only one to ever uses and/or develop Bred. So the focus must be on
improvements for me, as opposed to making is accessible to others.

Bred is designed to run out of a git checkout. It's always a development build.

## Code Style

Before making ANY code changes, you MUST read the ESLint config to understand the project's code style:

**Required reading:** `node_modules/@cookshack/eslint-config/index.js`

Key rules from the config (must be followed):
- **No semicolons**, single quotes only
- **Stroustrup brace style** (opening brace on same line)
- **No curly braces for single statements** - omit `{}` for if/for/else
- **Space after `[` and before `]`**, space around `{` in objects
- **No linebreaks in arrays/function calls**: `fn([ { a: 1 }, { b: 2 } ])`
- **`let` with blank line before code**
- **No logical negation**: `!condition`, `!=`, `!==` are blocked by commit hooks
- **prefer == to === for comparison**
- **Booleans use 1/0**, not `true`/`false`
- **Files must end in a newline**
- **Padding**: always blank line after `let` declarations

## Conventions

- **`d()` takes single arg** - Use `d('msg')` or `d({ obj })`, never multiple args
- **String formatting** - Use `'xxx' + var`, not template literals `` `xxx${var}` ``
- **Variable naming** - No capitals: `textBuffer`, not `TextBuffer`
- **Event structure** - `event.properties.part`, not `event.data.properties.part`
- **Permission prompts** - Use `Prompt.yn()` for yes/no, not `Prompt.ask()` with options
- **Files must end in newlines** - Always end files with a trailing newline
- **Booleans use 1/0** - Use `1` and `0` instead of `true` and `false`
- **No explicit 0 for falsy** - Don't set variables to `0` when they are implicitly false/undefined
- **No curly braces for single statements** - Omit `{}` for single-statement if/for/else bodies
- **Colors** - Use CSS variables: `--clr-emph` for emphasis, `--clr-fill` for backgrounds, `--clr-nb3` for important text
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

let a

a = 1
d('some message')
d({ a }) // NB this takes a single arg only

```

## Architecture

Read `doc/Dependencies.md` for the module dependency graph and data flow:
- Module hierarchy (bred → buf → view → pane → frame → tab → win)
- Editor vs div views comparison
- Init order and key relationships
- IPC communication patterns

This helps understand the overall architecture before diving into specific modules.

## Event System

Read `js/Em.md` for the event map system:
- Key binding hierarchy and lookup algorithm
- `Em.on()`, `Em.make()`, `Em.handle()` usage
- Key sequence parsing and nesting
- Input buffering during view initialization
- Mode integration and parent inheritance

Key concepts:
- Event maps form trees for `C-x C-f` style sequences
- `Em.look()` at lines 44-129 implements the lookup algorithm
- `split()` at lines 173-245 parses sequences into nested maps
- Active maps stack determines binding precedence

## Async Boundaries

Bred has several async boundaries that are potential bottlenecks. Look for `// ASYNC:` markers in the code:

- **IPC to main process** (`tron.mjs`): All file system and subprocess operations cross IPC
- **File system** (`main-file.mjs`, `main-dir.mjs`): Blocking I/O operations
- **Shell commands** (`main-shell.mjs`): Spawns pty, streams output
- **LSP** (`main-lsp.mjs`): Network requests to language servers
- **Browser views** (`main-browse.mjs`): WebContents operations

Key files:
- `js/tron.mjs` - IPC bridge (ASYNC markers on all exports)
- `js/main-file.mjs` - file operations (ASYNC on all on* functions)
- `js/main-dir.mjs` - directory operations (ASYNC on all on* functions)
- `js/main-shell.mjs` - shell execution (ASYNC on run(), on*, onOpen, onShow)
- `js/main-lsp.mjs` - LSP client (ASYNC on onEdit, onReq, make)
- `js/main-browse.mjs` - browser views (ASYNC on all on* functions)

## Global State

Read `js/Globals.md` for singleton modules and global state:

- `Win.current()` - current window (Electron BrowserWindow wrapper)
- `Pane.current()` - focused pane in current frame
- `Buf.shared()` - shared buffer state (buffers array, MRU ring, IDs)
- `Em.root` - global event map for key bindings
- `Area.current()` - current area in window

Key patterns:
- `globalThis.bred._shared()` provides access to shared state
- `Win.shared().win.wins[]` tracks all open windows
- Event listeners set up in `bred.html` (keydown, click, resize, etc.)

## Read Core Documentation First

Before making changes to the core codebase, read `js/README.md` to understand Bred's model:

- **Hierarchy**: Tab → Frame → Pane → View → Buf
- **Buf, View, Pane roles** and their relationships
- **Editor vs div views**: When a mode uses `view.ed` vs pure DOM
- **Mode system**: Major/minor modes, hooks (`viewInitSpec`, `append`, `insert`, etc.), keybinding inheritance via `parentsForEm`

This is especially important when working with `buf.mjs`, `view.mjs`, `pane.mjs`, `frame.mjs`, `tab.mjs`, or `mode.mjs`.

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

#### Key SDK Methods

- `client.session.create({ body: { title } })` - Create a new session
- `client.session.prompt({ path: { id }, body: { parts, model } })` - Send a prompt
- `client.event.subscribe({})` - Subscribe to events (returns `{ stream }`)
- `client.config.providers({})` - List available providers and models
- `client.postSessionIdPermissionsPermissionId({ path: { id, permissionID }, body: { response } })` - Respond to permission requests

### Commands

- `code` - Start a new coding chat
- `code chat` (in code mode) - Continue the chat

### Known Issues

- Event stream must be started before sending prompts
- Each buffer needs its own event subscription handling
- Thinking content arrives incrementally via delta updates
