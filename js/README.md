# Core Model

Bred's architecture follows a strict containment hierarchy where each type has a specific role. Understanding these relationships is essential for navigating and modifying the codebase.

## Buf (Buffer)

A **Buf** is the pure data model. It holds file content and metadata but knows nothing about the DOM or user interface. Created via `Buf.make()`, it stores:

- `b.content` (or `b.co`) - the actual content (DOM elements)
- `b.views` - array of views onto this buffer
- `b.mode` - the major mode controlling behavior
- `b.minors` - array of minor modes
- `b.path`, `b.dir`, `b.file` - location info
- `b.id`, `b.name` - identifiers

A Buf has **no DOM element** and **no cursor**. It's pure data with methods for manipulation.

## View

A **View** (created in `Buf.view()` via `View.make()`) connects a Buf to a specific DOM element. It:

- Holds a reference to its Buf (`view.buf`)
- Has a DOM element (`view.ele`)
- May have a backend editor (`view.ed`) or be a **div view** (pure DOM)
- Has a `point` for cursor position when no editor is present

Multiple Views can reference the same Buf, enabling split views.

### Editor vs Div Views

A View is either:

1. **Editor view** (has `view.ed`): Wraps a codemirror instance. Uses `Ed.Backend` methods for editing operations.

2. **Div view** (no `view.ed`): Pure DOM content. Uses the `view.point` for basic cursor/selection. Supports simple navigation (arrow keys, home/end, page up/down).

The distinction is determined by the mode:
- `Ed` mode (key: `'Ed'`) - creates editor views with `view.ed`
- `Div` mode (key: `'Div'`) - creates div views without `view.ed`

Many modes inherit from `Ed` and get editor functionality. Custom UI buffers (like the Buffers list) use `Div` mode.

## Ed (Editor)

**Ed** is a module that provides editor functionality. It:

- Wraps the backend (codemirror) with a consistent API
- Provides editing commands (selfInsert, forward, backward, etc.)
- Handles mode initialization (`Ed.initModeFns`)
- Exports position utilities: `posRow()`, `posCol()`, `bepRow()`, `bepCol()`

Key exported values:
- `Ed.Backend` - the editor backend (codemirror wrapper)
- `Ed.vfind` - search function
- `Ed.vgotoLine()` - go to line number

The term "Ed" is used both for the module and as the backend's editor state.

## Pane

A **Pane** is a container for exactly one View. Created via `Pane.add()`:

- `p.view` - the view it contains
- `p.buf` - getter returning `view?.buf`
- Manages focus and input handling
- `p.setBuf()` changes the buffer
- Handles file opening and navigation
- Buffers input during view initialization

Each Pane owns its View, but the View's Buf may be shared.

## Frame

A **Frame** is a container for Panes. Created via `Frame.add()`:

- `frame.panes` - array of Panes
- `frame.el` - the DOM container
- Supports resizing via draggable separators
- Can be expanded or retracted

Frames provide layout organization within a Tab.

## Tab

A **Tab** is the top-level container. Created via `Tab.add()`:

- `tab.frames` - array of Frames
- `tab.frame1`, `tab.frameLeft`, `tab.frameRight` - default frames
- Has a tab bar element (`tab.elBar`)
- `tab.show()` makes it current

Tabs group related workspaces.

## Key Relationships

```
Tab
 └─ Frames[]
     └─ Panes[]
         └─ View
             └─ Buf (shared, can have multiple Views)
```

**Critical insight:** `Buf.views` is an array. One Buf can have multiple Views (split view), but one View belongs to exactly one Pane. This is the foundational relationship for understanding Bred's architecture.

## Common Patterns

- `Pane.current()` - get the focused pane in current frame
- `Frame.current()` - get the focused frame in current tab
- `Tab.current()` - get the active tab
- `Buf.top()` - get the most recently used buffer
- `Pane.split()` - create a new pane with same buffer

## View Without Editor (Div View)

When a mode doesn't provide editor functions, the View operates in "div mode":

- `view.ed` is undefined
- `view.point` provides cursor/selection via DOM
- Navigation uses `point.forward()`, `point.backward()`, etc.
- Content is pure DOM, no underlying text buffer

### Div Buf Pattern

Custom UI panels (ASCII table, Buffers list, Dir browser) follow this pattern:

```javascript
// 1. divW() creates initial DOM wrapper
function divW() {
  return divCl('ascii-outer', divCl('ascii-w bred-surface'))
}

// 2. make() creates the buffer with mode key matching Mode.add()
b = Buf.add('ASCII', 'ASCII', divW(), p.dir)
b.addMode('view')  // enables basic view operations
p.setBuf(b)

// 3. Mode provides viewInit to build UI
mo = Mode.add('ASCII', { viewInit })

function viewInit(view, spec, cb) {
  let w = view.ele.firstElementChild.firstElementChild
  w.innerHTML = ''
  // Build DOM content programmatically...
  append(w, content)
  if (cb) cb(view)
}
```

Key differences from editor buffers:

| Aspect | Editor Buffer | Div Buffer |
|--------|--------------|------------|
| Content | Text file | DOM elements |
| `view.ed` | Defined (codemirror) | undefined |
| Core hook | `viewInit` | `viewInit` |
| Editing ops | `insert`, `append`, etc. | None |

Div buffers are used for custom interfaces like:
- ASCII table (`ext/ascii`)
- Buffers list (`Buffers` mode)
- Directory browser (`Dir` mode)
- Help screens
- Extension UI panels

## Mode System

Modes control buffer behavior and are registered via `Mode.add(key, spec)`. They are stored in a Map by lowercase key.

### Major vs Minor Modes

- **Major mode**: Sets fundamental buffer behavior (Ed, Div, Dir, etc.). Replaces `buf.mode`.
- **Minor mode**: Adds togglable features (view, lsp, etc.). Added to `buf.minors` array.

### Mode Hooks

Modes provide functionality through these properties:

| Category | Properties |
|----------|------------|
| View lifecycle | `viewInit`, `viewCopy`, `viewReopen` |
| Editing ops | `seize`, `append`, `insert`, `text`, `save`, `clear`, `line` |
| Navigation | `pos`, `bep`, `setBep`, `gotoLine`, `forward`, `backward` |
| Lifecycle | `start()`, `stop()`, `onRemove` |
| Keybindings | `em` (event map), `parentsForEm` |

### Keybinding Inheritance

`parentsForEm` allows modes to inherit keybindings from parent modes:

```javascript
Mode.add('QR', { parentsForEm: 'ed' }) // QR inherits Ed's keybindings
```

### Accessing Modes

```javascript
Mode.get('Ed')      // by key (case-insensitive)
Mode.getOrAdd(key)  // get existing or create new
Mode.forEach(cb)    // iterate all modes
```

### Mode on Buffer

- `buf.mode` - the major mode
- `buf.minors[]` - array of active minor modes
- `buf.setMode(key)` - change major modes
- `buf.addMode(m)`, `buf.rmMode(m)`, `buf.toggleMode(m)` - minor mode management
