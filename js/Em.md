# Event Map System (Em)

The Em module handles keyboard and mouse event routing to commands. It provides a hierarchical keybinding system similar to Emacs, where key sequences can map to commands or other keymaps.

## Core Concepts

### Event Map Structure

An Event Map (Em) is a tree structure where:
- Each node contains `ons` - a map of keys to either commands or nested maps
- Maps form prefix chains for key sequences like `C-x C-f`
- The `otherwise` property defines fallback behavior

```
Global Em (root)
  │
  ├─> 'C-x' ──> map
  │           ├─> 'C-f' ──> 'find file'
  │           └─> 'C-s' ──> 'save buffer'
  │
  ├─> 'C-c' ──> map
  │           └─> ...
  │
  └─> 'a' ──> 'self insert'
```

### Key Format

Keys use a prefix notation:
- `C-` = Control (must come first in sequences)
- `A-` = Alt/Meta
- Key names: `a`, `A`, `Enter`, `Backspace`, `ArrowUp`, etc.

Sequences are space-separated: `C-x C-f` (Ctrl+x then Ctrl+f)

### Mouse Events

Mouse buttons are identified by name:
- `Left` - primary button
- `Aux` - middle/wheel button
- `Right` - context menu

## API Reference

### `Em.init()`

Initializes the event system, creates the root Global map.

### `Em.make(name, spec)`

Creates a new event map. Returns an object with:
- `ons` - the key bindings object
- `on(key, to)` - register a binding
- `look(wes, cb)` - lookup key sequence
- `otherwise` getter/setter - fallback command

### `Em.add(name, spec)`

Creates or retrieves a named event map. Maps are cached by `name + spec`.

### `Em.on(seq, to, modeOrNameOrEm)`

Registers a key binding:
- `seq` - key sequence (e.g., `'C-x C-f'`)
- `to` - command name or another event map
- `modeOrNameOrEm` - optional mode to bind in

### `Em.get(name)`

Retrieves a cached event map by name.

### `Em.handle(we, view)`

Main entry point for handling wrapped events. Routes events through:
1. Input buffering (if pane is initializing)
2. `mainGetActive()` to determine active maps
3. `look()` to find matching binding
4. `Cmd.run()` to execute command

### `Em.look(wes, active, buf, cb)`

Looks up a key sequence across active maps. Calls `cb(map, to)` on match.

### `Em.seq(cmdName, buf)`

Reverse lookup: finds the key sequence for a command. Returns string like `'C-x C-f'`.

### `Em.reset()`

Clears the current key sequence buffer (after command execution).

### `Em.cancel()`

Resets and clears mini display.

## Lookup Algorithm (lines 44-129)

The `look()` function implements the core lookup:

```
1. Start with the current map's `ons`
2. For each wrapped event in sequence:
   a. If mouse event: lookup by event name
   b. If keyboard:
      i. If Ctrl pressed: lookup 'Control', descend into map
      ii. If Alt pressed: lookup 'Alt', descend into map
      iii. Lookup the key directly
3. Return the final binding (command or map)
4. If no match, try `otherwise`
5. If still no match, return failure
```

## Active Map Stack

Maps are searched in order of specificity:

```
[ targetEm?, minor1.em, minor2.em, ..., mode.em, parentEms..., root ]
```

The first match wins. This allows modes to override parent bindings.

## Key Sequence Parsing (split function, lines 173-245)

Parses key sequences and creates nested maps:

```
'C-x C-f'
  ├─> 'Control' ──> map 'C-x:'
  │                ├─> 'Control' ──> map 'C-x C-:'
  │                │                └─> 'f' ──> 'find file'
  │                └─> 'f' ──> map 'C-x f:'
  │                             └─> ...
```

The parser handles:
- `C-A-` prefix (Ctrl+Alt together)
- `C-` prefix
- `A-` prefix
- Plain keys

## Input Buffering

When a pane is initializing a view, keyboard events are buffered:

```javascript
// pane.mjs
if (pane.initializing) {
  pane.enqueueInput(we)
  return
}
// ... later when ready
pane.flushInput()
```

This prevents keystrokes from being lost during view setup.

## Event Wrapping

Events are wrapped by the DOM handler with properties:
- `e` - original DOM event
- `mouse` - boolean, true for mouse events
- `name` - event name for mouse events

## Mode Integration

Each mode has an associated event map (`mode.em`):
- Set via `Mode.add(key, { em: Em.make(...) })`
- Inherited via `parentsForEm` in mode definition
- Used in `mainGetActive()` stack construction

## Example: Binding Registration

```javascript
// In ed.mjs init()
Em.on('C-x C-f', 'find file', mo)  // bind in Ed mode
Em.on('C-g', 'cancel', mo)

// Creating a nested map manually
let em = Em.make('Test')
em.on('a', 'command-a')
em.on('b', em2)  // em2 is another map
```

## Related Files

- `js/cmd.mjs` - command execution
- `js/mode.mjs` - mode system
- `lib/ev-parser.mjs` - key sequence parser (Peggy)
- `js/pane.mjs` - input buffering integration
