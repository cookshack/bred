# Code Extension

You and I are improving the Bred editor.

See Specification.md for a general overview.
See Files.md for an overview of the source files.

## Context

Bred is my personal project, used daily. Focus on improvements for me, not accessibility.

Bred runs out of a git checkout — always a development build. No packaging.

Portability is extremely low priority. Assume Debian-derived distro.

## Commits

Always commit changes once they're done and verified. Don't wait to be asked.

## opencode container (`docker/opencode/`)

Built with `make oc` (image `opencode-bred`), run via `bin/code` / `bin/codesh`. It bakes a
headless render helper (system Chromium + puppeteer-core) at `/home/node/tools/render.mjs` and a
global `render-web-page` skill, so agents can screenshot or measure local pages. See the skill for
usage. Rebuild the image after changing the Dockerfile, `tools/`, or `skills/`.

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

Uses opencode v2 via `@opencode/client` (copied into `ext/code/lib/opencode/` by
`bin/postinstall`, which also writes `version.json`). Generated types live at
`ext/code/lib/opencode/promise/generated/types.d.ts`.

### Files
- `ext/code/code.mjs` — main extension
- `ext/code/code.css` — styles
- `ext/code/comm.mjs` — client creation (`OpenCode.make`)
- `ext/code/event.mjs` — v2 event subscription + translation to legacy events
- `ext/code/stop.mjs` — `session.interrupt`

### Conventions
- Match events by `sessionID` from `buf.vars('code')`
- `event.mjs` translates v2 events (`{ type, data, location }`) into the legacy
  `{ type, properties }` shapes the handlers in `code.mjs` consume. Prefer adding
  a translation there over changing every handler.
- v2 client methods return parsed output and **reject** on error (no `{ data, error }`).
- Session methods take `location: { directory }`; prompts take `{ sessionID, text }`
  and model/agent are set with `session.switchModel` / `session.switchAgent`.
- Test the extension offline with `test/fake-oc.mjs` + `test/code-events.mjs`.

### Key SDK Methods
- `OpenCode.make({ baseUrl, headers })` — create client
- `client.session.create({ location: { directory }, title, agent, model })`
- `client.session.switchModel({ sessionID, model: { id, providerID, variant } })`
- `client.session.switchAgent({ sessionID, agent })`
- `client.session.prompt({ sessionID, text })`
- `client.message.list({ sessionID })`
- `client.event.subscribe()` — async iterable of v2 events
- `client.permission.reply({ sessionID, requestID, decision })`
- `client.session.form.reply({ sessionID, formID, answer })` / `.cancel(...)`
- `client.provider.list({ location })` / `client.model.list({ location })`

### Known Issues
- Event stream must be started before sending prompts
- Each buffer needs its own event subscription
- v2 event subscriptions are live-only (no replay); bred reconnects on drop
