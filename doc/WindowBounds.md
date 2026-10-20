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
cannot set the position of a normal toplevel, so `setBounds()` x/y is ignored.
GNOME generally places the window itself; position persistence is not possible
without compositor support or a desktop-specific window rule.

XWayland still allows clients to set position. `BRED_XWAYLAND=1` makes Bred pass
`--ozone-platform=x11`, so bounds restore works on X11/XWayland setups.

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
persistence. Until then, the alternatives are native Wayland (let GNOME place
the window) or logging into an Xorg session, where X11 positioning works without
XWayland.
