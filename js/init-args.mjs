// The names Bred injects into the wrapper around your init.js.  Keep in sync
// with the wrapper built in js/main.mjs; the linter uses them as globals so
// init.js is not reported as full of undefined variables.

export let args

args = [ 'C', 'Cmd', 'Dom', 'Ed', 'Em', 'Hist', 'Loc', 'Opt', 'Pane', 'Mess', 'Mode', 'Dir', 'Place', 'Win' ]

export
function params
() {
  return args.join(',')
}

export
function call
() {
  return args.map(a => 'window.bred.' + a).join(',')
}

export
function globals
() {
  return Object.fromEntries(args.map(a => [ a, 'readonly' ]))
}
