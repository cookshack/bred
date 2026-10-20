// Native Wayland does not let applications position their own windows. XWayland
// does, so allow opting into it for saved window bounds.
export
function ozonePlatform
(env) {
  if ((env.BRED_XWAYLAND == '1')
      && (env.XDG_SESSION_TYPE == 'wayland')
      && env.DISPLAY)
    return 'x11'
  return 0
}
