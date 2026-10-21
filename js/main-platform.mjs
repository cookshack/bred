// Native Wayland does not let applications position their own windows. XWayland
// does, so allow opting into it for saved window bounds. See
// doc/WindowBounds.md for the current XWayland issue and how to retest it.
export
function ozonePlatform
(env) {
  if ((env.BRED_XWAYLAND == '1')
      && (env.XDG_SESSION_TYPE == 'wayland')
      && env.DISPLAY)
    return 'x11'
  return 0
}

// What the app is really talking to, for the about table. A Wayland session
// driven through the x11 ozone backend is XWayland.
export
function display
(env, ozone) {
  let wayland

  wayland = (env.XDG_SESSION_TYPE == 'wayland') || env.WAYLAND_DISPLAY
  if (wayland)
    return ozone == 'x11' ? 'XWayland' : 'Wayland'
  return 'X11'
}
