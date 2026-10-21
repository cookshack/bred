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

// What the session and ozone backend are, for the about table. A Wayland
// session driven through the x11 ozone backend is XWayland.
export
function display
(env, ozone) {
  let session, backend

  session = env.XDG_SESSION_TYPE || (env.WAYLAND_DISPLAY ? 'wayland' : 'unknown')
  ozone = ozone || 'auto'
  if (ozone == 'x11')
    backend = (session == 'wayland') ? 'XWayland' : 'X11'
  else if (ozone == 'wayland')
    backend = 'Wayland'
  else
    backend = (session == 'wayland') ? 'Wayland' : 'X11'
  return backend + ' (session: ' + session + ', ozone: ' + ozone + ')'
}
