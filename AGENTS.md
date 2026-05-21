# Code Extension

You and I are improving the Bred editor.

See Specification.md for a general overview.
See Files.md for an overview of the source files.

## Context

Bred is my personal project, used daily. Focus on improvements for me, not accessibility.

Bred runs out of a git checkout — always a development build. No packaging.

Portability is extremely low priority. Assume Debian-derived distro.

## Linting

Run `npm run check` to verify code style before you're done. This calls eslint with
`@cookshack/eslint-config` across `js/*.mjs`, `js/*.js`, `ext/*/*.mjs`, `test/*.mjs`.

## Testing

Run `npm test` (mocha) to run all tests.

Run `npm run test-indent` for a single test file. Adapt this pattern for others:
`npx mocha test/<name>.mjs`

## Code Style

**Before making any changes, read `node_modules/@cookshack/eslint-config/index.js`.**

Key rules enforced by the config:

- **No semicolons**, single quotes only
- **Stroustrup brace style** — opening brace on same line, else/catch on new line
- **No curly braces for single statements** — omit `{}` for if/for/else
- **Space after `[` and before `]`**, space around `{` in objects: `[ a, b ]`, `{ a: 1 }`
- **No linebreaks in arrays/function calls**: `fn([ { a: 1 }, { b: 2 } ])`
- **`let` with blank line before code** — group all `let`s at block top, then blank line
- **No logical negation** — `!condition`, `!=`, `!==` are blocked. Use positive sense.
- **Prefer `==` to `===`**
- **Booleans use `1`/`0`**, not `true`/`false`
- **No explicit `0` for falsy** — leave undefined variables alone
- **Files must end in a newline**
- 2-space indent, no tabs

### Conventions

- **`d()` takes single arg**: `d('msg')` or `d({ obj })`, never multiple args
- **String formatting**: `'xxx' + var`, not template literals `` `xxx${var}` ``
- **Variable naming**: no capitals — `textBuffer`, not `TextBuffer`
- **Event structure**: `event.properties.part`, not `event.data.properties.part`
- **Permission prompts**: `Prompt.yn()` for yes/no, not `Prompt.ask()` with options
- **Colors**: use CSS variables — `--clr-emph` (emphasis), `--clr-fill` (backgrounds), `--clr-nb3` (important text)

## Debugging

```javascript
import { d } from '../../js/mess.mjs'

let a

a = 1
d('some message')
d({ a }) // single arg only
```

## Architecture

Read `doc/Dependencies.md` for the module dependency graph:
- Init order: `Opt → Scroll → Hist → Area → Cmd → Em → Win → Buf → Frame → Pane → ...`
- Module hierarchy: `Win → Area → Tab → Frame → Pane → View → Buf`
- One Buf can have multiple Views (split panes), one View belongs to one Pane

Read `js/README.md` for the core model:
- **Buf**: pure data, no DOM. `b.co` for content, `b.views` for views, `b.mode` for mode.
- **View**: connects Buf to DOM. Has `view.ed` (codemirror) or is a div view (pure DOM, `view.point`).
- **Editor vs Div views**: `Ed` mode creates editor views; `Div` mode creates div views.
- **Mode system**: `Mode.add(key, spec)` with hooks (`viewInit`, `append`, `insert`, etc.), `parentsForEm` for keybinding inheritance.

## Event System

Read `doc/Em.md` for the key binding system:
- Event maps form trees for `C-x C-f` style sequences
- `Em.on(seq, cmd)` registers bindings
- Active maps stack determines precedence: `[ minor, ..., mode, parentEms..., root ]`
- `Em.handle(we, view)` is the main entry point for DOM events
- Mouse events use names: `Left`, `Aux`, `Right`

## Async Boundaries

All file system and subprocess operations cross IPC to main process.

Key files (look for `// ASYNC:` markers):
- `js/tron.mjs` — IPC bridge to Electron main process
- `js/main-file.mjs` — file operations (read, write, stat, watch)
- `js/main-dir.mjs` — directory operations
- `js/main-shell.mjs` — shell execution with pty
- `js/main-lsp.mjs` — LSP client
- `js/main-browse.mjs` — browser views

## Global State

Read `doc/Globals.md` for singleton modules:
- `Win.current()` — current window
- `Pane.current()` — focused pane in current frame
- `Buf.shared()` — all buffers, MRU ring
- `Em.root` — global event map
- `Area.current()` — current area
- `globalThis.bred._shared()` returns shared state

## ext/code: Opencode UI

### Files
- `ext/code/code.mjs` — main extension
- `ext/code/code.css` — styles
- `ext/code/lib/opencode.js` — SDK wrapper
- `ext/code/lib/gen/` — generated SDK

### Conventions
- Match events by `sessionID` from `buf.vars('code')`
- For uncertain SDK API usage, check `opencode-src/packages/opencode/src/cli/cmd/tui/` for reference patterns
- `opencode-src/` is a symlink to the actual source

### Key SDK Methods
- `client.session.create({ body: { title } })` — create session
- `client.session.prompt({ path: { id }, body: { parts, model } })` — send prompt
- `client.event.subscribe({})` — subscribe to events (returns `{ stream }`)
- `client.postSessionIdPermissionsPermissionId({ path: { id, permissionID }, body: { response } })` — respond to permissions

### Known Issues
- Event stream must be started before sending prompts
- Each buffer needs its own event subscription
- Thinking content arrives incrementally via delta updates
