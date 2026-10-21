# Window Bounds

Bred saves the main window geometry in `state.json` in the profile directory:

- `bounds` from `win.getNormalBounds()`
- `maximized` from `win.isMaximized()`

`js/main-window-state.mjs` restores these after `show()`, because some window
managers ignore a position set while the window is still hidden. Placement
events during that short restore window are ignored so the window manager can't
overwrite the saved bounds with its own default.

## Wayland

Native Wayland gives the compositor control of window placement. Applications
cannot set the position of a normal toplevel, so `setBounds()` x/y is ignored
and `getNormalBounds()` reports `0,0`. Width, height and `maximized` still
round-trip, so only the position half of `state.json` is lost.

GNOME generally places the window itself; position persistence is not possible
without compositor support or a desktop-specific window rule. On GNOME that
means a Shell extension (below), or accepting whatever placement mutter picks.

XWayland still allows clients to set position. `BRED_XWAYLAND=1` makes Bred pass
`--ozone-platform=x11`, so bounds restore works on XWayland. The About buffer
(`C-h a`) shows the effective backend and session as `Display`, e.g.
`XWayland (session: wayland, ozone: x11)`, which helps when retesting the issue
below.

Ubuntu 25.10 and 26.04 no longer ship a GNOME-on-Xorg session (GNOME 49 disabled
it, GNOME 50 removed the remaining code), so an Xorg login is not available as a
positioning fallback on this distro.

## Why GNOME always opens the window in the same place

Mutter places every new toplevel, and since GNOME 48 it centers new normal
windows by default:

```sh
gsettings get org.gnome.mutter center-new-windows   # default: true
gsettings set org.gnome.mutter center-new-windows false
```

With `true`, each launch lands in the center of the active monitor regardless of
where it was last moved. With `false`, mutter falls back to "smart" placement:
first free space, top-left, cascading when the screen is full. Neither is
persistence; there is no mutter key, dconf path or app-side call that makes it
remember a position.

Because centering uses the *active* monitor, launching Bred from a terminal on
another screen is the only native way to influence the initial position.

Some applications keep working position memory by running under XWayland, but
`wmctrl`, `xdotool windowmove`, `devilspie(2)`, `.desktop` geometry hints,
Chromium `--window-position` and Bred's `--bounds` are all no-ops on native
Wayland. GNOME has no built-in window rules.

## Session management (the long-term fix)

The protocol is `xdg_session_manager_v1`. It is opt-in per application: the app
creates a session, persists the returned session ID across runs, and registers
each toplevel with a stable name. The compositor stores the window state and
restores it when the app asks on a later launch. State lives in
`$XDG_DATA_HOME/<context-nick>/session.gvdb`.

Status:

- Mutter 50 (Ubuntu 26.04): implementation present, but the global is only
  advertised when `MUTTER_DEBUG_SESSION_MANAGEMENT_PROTOCOL=1`, and it exposes
  the staging interfaces `xx_session_manager_v1` / `xx_toplevel_session_v1`.
- Mutter 51 (GNOME 51, Ubuntu 26.10): final `xdg_session_manager_v1`, advertised
  unconditionally.
- Electron: no API. Chromium has an ozone/Wayland implementation used for
  Chrome's own session restore, but it is not plumbed through Electron, so Bred
  cannot request a restore either way.

To check what the running compositor advertises (`wayland-utils` package):

```sh
wayland-info | grep -i session
```

To experiment on 26.04, enable it for the user session and re-login:

```sh
mkdir -p ~/.config/environment.d
echo 'MUTTER_DEBUG_SESSION_MANAGEMENT_PROTOCOL=1' \
  > ~/.config/environment.d/90-mutter-debug.conf
```

GTK's experimental support uses the same `xx_` names and can be tried with
`GDK_DEBUG=session-mgmt gtk4-demo`.

## Workaround: GNOME Shell extension

Extensions run inside the compositor, so they can call
`Meta.Window.move_frame()` on Wayland, which applications cannot. Working
option as of 2026-10 on GNOME 50 / Wayland:

- **Smart Auto Move NG** (extensions.gnome.org #8149, Shell 48-51): remembers
  per-app size, position and workspace and re-applies them on launch. Works, but
  feels clunky; set the default behavior to `IGNORE` and `RESTORE` only selected
  apps.
- **Window State Manager** (#5353) and **Another Window Session Manager**
  (#4709) are alternatives aimed at monitor changes and full session restore.

The extension matches on app_id/title. To find them, open Looking Glass
(`Alt+F2`, `lg`) and run:

```js
global.get_window_actors().map(a => [a.meta_window.get_wm_class(), a.meta_window.get_title()])
```

Bred also restores size and maximized state on launch, so an extension that
restores geometry too can fight with it (visible as the window jumping or the
size snapping back). Prefer having one side own geometry; if the extension is in
charge, Bred should limit itself to `maximized` on Wayland.

## Known issue (2026-10-20, Ubuntu GNOME Wayland, Electron 44.9.1)

On this machine, forcing XWayland does not produce a visible window:

- default XWayland: the GPU process crashes (`exit_code=139`)
- `--disable-gpu`: no GPU crash, but the window never appears
- `--no-zygote --no-sandbox`: no change

Native Wayland works. This looks like an Electron/Chromium/XWayland issue
rather than a Bred one, so it may be fixed by a future Electron, Mesa, or
XWayland update. Retest with:

```sh
BRED_XWAYLAND=1 bin/bred --profile Testing
BRED_XWAYLAND=1 bin/bred --profile Testing --disable-gpu
```

If it starts working, XWayland can remain the opt-in path for position
persistence. Until then, the realistic options are native Wayland with a
placement extension, or accepting mutter's placement (possibly with
`center-new-windows` turned off).
