# Global State

Bred uses several singleton modules and global event listeners to manage application state.

## Singleton Modules

These modules export functions that access shared state:

### `Win.current()`

Returns the current window object (Electron BrowserWindow wrapper).

```javascript
let win = Win.current()
win.id              // window identifier
win.document        // DOM document
win.areas           // array of areas
win.body            // document.body
win.mini            // mini bar element
win.selection       // window.getSelection()
```

**Shared state**: `Win.shared().win.wins[]` - array of all windows

**Location**: `js/win.mjs:347`

### `Pane.current(frame)`

Returns the focused pane in a frame. Falls back to first pane.

```javascript
let p = Pane.current()
p.view              // current view
p.buf               // current buffer (getter)
p.focus()           // focus this pane
p.setBuf(b)         // change buffer
```

**Location**: `js/pane.mjs:27`

### `Buf.shared()`

Returns the shared buffer object containing:

```javascript
let sh = Buf.shared()
sh.buffers          // all open buffers
sh.ring             // buffer MRU ring
sh.id               // next buffer ID
sh.bBuffers         // special Buffers mode buffer
```

**Shared state structure**:
```
Win.shared().buf = {
  buffers: [...],
  ring: [...],
  id: 1,
  bBuffers: <buffer>
}
```

**Location**: `js/buf.mjs:21`

### `Em.root`

The global root event map. All key bindings ultimately inherit from here.

```javascript
Em.root             // global event map
Em.root.ons         // global key bindings
Em.root.otherwise   // fallback for unbound keys
```

**Location**: `js/em.mjs:23`

### `Area.current(win)`

Returns the current area in a window.

```javascript
let a = Area.current()
a.tabs              // array of tabs
a.el                // DOM element
a.show()            // make current
```

**Location**: `js/area.mjs:114`

## Global Event Listeners

Set up in `bred.html` or during app initialization:

### Keyboard Events

```javascript
document.keydown → onKeydown()
document.keyup → onKeyup()
```

Routes through `Em.handle()` to find and execute commands.

### Mouse Events

```javascript
document.click → onClick()           // primary button
document.auxclick → onAuxClick()     // middle/wheel button
document.contextmenu → onContextMenu() // right button
```

### Window Events

```javascript
window.resize → onResize()           // layout recalc
window.blur → onBlur()               // lost focus
window.focus → onFocus()             // gained focus
```

### Clipboard Watcher (main.mjs)

Monitors system clipboard for external changes:

```javascript
// In main.mjs:watchClip()
setInterval(checkClipboard, 1000)
```

Sends `clip.new` event to renderer when clipboard changes.

## Initialization Order

From `bred.mjs:initPackages`:

```
Opt → Scroll → Hist → Area → Cmd → Em → Win → Buf → Frame → Pane
→ Lsp → Ed → ViewMode → Dir → Cut → Exec → Shell → Apt → Vc
→ About → Prompt → Open → Switch → Tab → Ext → Place → OptUi
```

Each module calls `init()` which sets up its portion of global state.

## Shared Data Structure

```javascript
globalThis.bred = {
  _shared() {
    return {
      win: { wins: [], id: 1 },
      buf: { buffers: [], ring: [], id: 1 }
    }
  }
}
```

- `Win.shared()` returns `globalThis.bred._shared().win`
- `Buf.shared()` returns `globalThis.bred._shared().buf`

## Per-Window State

Each window stores state on its Electron BrowserWindow:

```javascript
win.bred = {
  hover: { ... },      // hover popup
  wins: [],            // all windows (shared)
}
```

## Global Properties on Window

```javascript
window.bredWin           // current Win
window.bred._shared()    // shared state accessor
window.tron              // IPC bridge
```

## Related Files

| File | Purpose |
|------|---------|
| `js/win.mjs` | Window management, shared state |
| `js/pane.mjs` | Pane management |
| `js/buf.mjs` | Buffer management |
| `js/em.mjs` | Event map system |
| `js/area.mjs` | Area container |
| `bred.html` | DOM event listener setup |
| `main.mjs` | Main process IPC handlers |
