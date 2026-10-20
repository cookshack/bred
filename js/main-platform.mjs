// Wayland does not let applications position their own windows, so saved
// bounds cannot be restored there. Force XWayland unless explicitly disabled.
export
function ozonePlatform
(env) {
  if ((env.XDG_SESSION_TYPE == 'wayland')
      && ((env.BRED_NATIVE_WAYLAND || '0') == '0')
      && env.DISPLAY)
    return 'x11'
  return 0
}
