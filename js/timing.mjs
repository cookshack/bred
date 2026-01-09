let phases

export
function start
(label) {
  phases.push([ label, performance.now() ])
}

export
function stop
(label) {
  let i, phase, time

  for (i = phases.length - 1; i >= 0; i--) {
    phase = phases[i]
    if (phase[0] == label && phase.length == 2) {
      time = performance.now() - phase[1]
      phases[i] = [ label, phase[1], time ]
      console.log('timing: ' + label + ': ' + Math.round(time) + 'ms')
      return
    }
  }
}

export
function get
() {
  return phases.filter(phase => phase.length == 3)
}

export
function init
() {
  phases = []
}
