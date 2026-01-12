# Bred Dependencies

```
bred.mjs (entry point, bootstraps app)
    │
    ├─> buf.mjs (file model)
    │     │
    │     ├─> view.mjs (DOM sync, point cursor)
    │     │     └─> point.mjs (cursor position for div views)
    │     │
    │     ├─> ed.mjs (editor view wrapper)
    │     │     │
    │     │     ├─> pane.mjs (container)
    │     │     │     │
    │     │     │     ├─> frame.mjs (layout)
    │     │     │     │     │
    │     │     │     │     ├─> tab.mjs
    │     │     │     │     │     │
    │     │     │     │     │     └─> area.mjs
    │     │     │     │     │           │
    │     │     │     │     │           └─> win.mjs (window)
    │     │     │     │     │
    │     │     │     │     └─> pane.mjs (recursive: panes in frame)
    │     │     │     │
    │     │     │     └─> view.mjs (recursive: view in pane)
    │     │     │
    │     │     └─> mode.mjs (mode plugins)
    │     │           │
    │     │           └─> em.mjs (key bindings)
    │     │                 │
    │     │                 └─> cmd.mjs (commands)
    │     │
    │     └─> tron.mjs (IPC to main process)
    │
    └─> tron.mjs (IPC to main process)
```

## Hierarchy

```
Win ──> Area ──> Tab ──> Frame ──> Pane ──> View ──> Buf
                                         │
                                         └── multiple Views can share one Buf
```

## Module Descriptions

| Module | Role |
|--------|------|
| `bred.mjs` | Entry point, bootstraps app, defines global commands/bindings |
| `buf.mjs` | Buffer (file) model - pure data, no DOM |
| `view.mjs` | View layer - connects Buf to DOM, handles sync |
| `point.mjs` | Cursor position for div views (pure DOM editing) |
| `ed.mjs` | Editor mode wrapper around CodeMirror backend |
| `pane.mjs` | Pane container - holds exactly one View |
| `frame.mjs` | Frame layout - resizable container for panes |
| `tab.mjs` | Tab container - holds frames |
| `area.mjs` | Area container - holds tabs |
| `win.mjs` | Window/session container |
| `mode.mjs` | Mode registry and plugin system (major/minor modes) |
| `em.mjs` | Event map - key binding lookup and routing |
| `cmd.mjs` | Command registry and execution |
| `tron.mjs` | IPC communication with Electron main process |

## Init Order (from bred.mjs:initPackages)

```
Opt → Scroll → Hist → Area → Cmd → Em → Win → Buf → Frame → Pane
→ Lsp → Ed → ViewMode → Dir → Cut → Exec → Shell → Apt → Vc
→ About → Prompt → Open → Switch → Tab → Ext → Place → OptUi
```

## Key Relationships

- **One Buf, Many Views**: `buf.views[]` enables split panes showing same file
- **One View, One Pane**: Each pane holds exactly one view
- **Mode determines behavior**: `buf.mode` controls editing style (Ed vs Div)
- **Key bindings cascade**: Modes use `parentsForEm` to inherit bindings
- **IPC for file ops**: All file system access goes through `tron.mjs` to main process

## Editor vs Div Views

| Aspect | Editor View (`view.ed`) | Div View |
|--------|------------------------|----------|
| Backend | CodeMirror | Pure DOM |
| Editing | Full text operations | None (read-only UI) |
| Cursor | CodeMirror state | `view.point` |
| Used for | Code/text files | Buffers list, Dir browser, Help |

## Example: Opening a File

```
User runs: open file.txt
    │
    ├─> Pane.open() → Tron.cmd('file.stat', path)
    │                      │
    │                      └─> main.mjs (main process)
    │                           └─> reads file, returns stats
    │
    ├─> Ed.make(pane, { name, dir, file })
    │     │
    │     └─> Buf.add(name, 'ed', divW(), dir, { file })
    │           │
    │           └─> Buf.view(buf, { ele: pane.ele })
    │                 │
    │                 └─> View.make(buf, { ele, mode: Mode.get('ed') })
    │                       │
    │                       └─> Mode provides viewInitSpec, editing ops
    │
    └─> pane.focus()
```

## Extension System

```
ext.mjs
  └─> loads extensions from ext/ directory
       │
       ├─> ext/code/ (OpenCode integration)
       ├─> ext/dir/ (directory browser)
       ├─> ext/search-buffers/ (buffer search)
       └─> ... (many others)
```

## IPC Communication (tron.mjs)

```
Renderer Process                    Main Process
     │                                   │
     ├─> tron.cmd(name, args) ──────────>│─> main.mjs
     │      │                            │      │
     │      └─> callback(err, data) ◀────┘      ├─> main-file.mjs (file ops)
     │                                           ├─> main-dir.mjs (dir ops)
     │                                           ├─> main-shell.mjs (shell exec)
     │                                           ├─> main-lsp.mjs (LSP)
     │                                           └─> main-browse.mjs (browser)
     │
     ├─> tron.on(ch, cb) ◀─────────────────────┤
     │     (event listeners)                    │
     │
     └─> tron.acmd(name, args) ───────────────>│─> async commands
```

## Core Data Flow

```
┌─────────┐
│   Win   │◄── Electron BrowserWindow
└────┬────┘
     │
     ▼
┌─────────┐
│  Area   │◄── split container (sidebar/main/etc)
└────┬────┘
     │
     ▼
┌─────────┐
│   Tab   │◄── tab bar item
└────┬────┘
     │
     ▼
┌─────────┐
│  Frame  │◄── resizable pane container
└────┬────┘
     │
     ▼
┌─────────┐
│  Pane   │◄── one view per pane
└────┬────┘
     │
     ▼
┌─────────┐     ┌─────────┐
│  View   │────▶│   Buf   │◄── file content, shared across views
└────┬────┘     └─────────┘
     │               ▲
     │               │ mode plugins
     ▼               │
┌─────────┐     ┌────┴─────┐
│ Point/  │     │  Mode    │
│ Editor  │     │ System   │
└─────────┘     └──────────┘
```
