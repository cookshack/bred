import { append, button, div, divCl } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Css from '../../js/css.mjs'
import * as Em from '../../js/em.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Pane from '../../js/pane.mjs'
//import { d } from '../../js/mess.mjs'

let controls

function divW
() {
  return divCl('ascii-outer', divCl('ascii-w bred-surface'))
}

export
function make
(p) {
  let b

  b = Buf.add('ASCII', 'ASCII', divW(), p.dir)
  b.addMode('view')
  p.setBuf(b)
}

export
function init
() {
  let mo, verbose

  function viewInitSpec
  (view, spec, cb) {
    let co, cols, last, rows, code, w

    function seq
    (n) {
      return Array.from({ length: n }, (item, index) => index)
    }

    function charAcro
    (code) {
      if (code < 32)
        return controls[code]?.acro || 'ERR'
      if (code == 127)
        return 'DEL'
      return String.fromCharCode(code)
    }

    function charLong
    (code) {
      if (code < 32)
        return controls[code]?.long || 'ERR'
      return ''
    }

    function ctrl
    (code) {
      if (code < 32)
        return 'C-' + String.fromCharCode(code + '@'.charCodeAt(0)).toLowerCase()
      return ''
    }

    function specifier
    (code) {
      if (code < 32)
        return controls[code]?.spec || ''
      return ''
    }

    function formatRow
    (code) {
      return [ divCl('ascii-col-d', code.toString()),
               div(code.toString(16)),
               divCl('ascii-col-b', (code >>> 0).toString(2)), // >>> for negatives
               div(code.toString(8)),
               divCl('ascii-col-c', charAcro(code)),
               divCl('ascii-col-ctrl', ctrl(code)),
               divCl('ascii-col-specifier', specifier(code)),
               divCl('ascii-col-long', charLong(code)) ]
    }

    function head
    (co, css) {
      return divCl('ascii-h' + (css ? (' ' + css) : ''),
                   co)
    }

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''

    if (verbose)
      Css.add(w, 'verbose')
    else
      Css.remove(w, 'verbose')

    cols = 4
    last = 128

    rows = Math.floor(((last % cols) == 0) ? (last / cols) : (last / (cols + 1)))

    co = []

    co.push(seq(cols).map(() => [ head('D'),
                                  head('H'),
                                  head('B', 'ascii-h-b'),
                                  head('O'),
                                  head('C', 'ascii-h-c'),
                                  head([], 'ascii-h-ctrl'),
                                  head([], 'ascii-h-specifier'),
                                  head([], 'ascii-h-long') ]))

    code = 0
    while (code < rows) {
      co.push(seq(cols).map(col => formatRow(code + (rows * col))))
      code++
    }

    co.push(divCl('ascii-foot'))

    co.push(divCl('ascii-bar',
                  button('v', '', { 'data-run': 'toggle verbose' })))

    append(w, co)

    if (cb)
      cb(view)
  }

  function toggle
  () {
    verbose = verbose ? 0 : 1
    viewInitSpec(Pane.current().view)
  }

  function ascii
  () {
    let found, p

    p = Pane.current()
    found = Buf.find(b => b.mode.name == 'ascii')
    if (found)
      p.setBuf(found)
    else
      make(p)
  }

  controls = [ { acro: 'NUL',
                 long: 'Null',
                 spec: '\\0' },
               { acro: 'SOH',
                 long: 'Start of Heading' },
               { acro: 'STX',
                 long: 'Start of Text' },
               { acro: 'ETX',
                 long: 'End of Text' },
               { acro: 'EOT',
                 long: 'End of Transmission' },
               { acro: 'ENQ',
                 long: 'Enquiry' },
               { acro: 'ACK',
                 long: 'Acknowledgement' },
               { acro: 'BEL',
                 long: 'Bell',
                 spec: '\\a' },
               { acro: 'BS',
                 long: 'Backspace',
                 spec: '\\b' },
               { acro: 'HT',
                 long: 'Horizontal Tab',
                 spec: '\\t' },
               { acro: 'LF',
                 long: 'Line Feed',
                 spec: '\\n' },
               { acro: 'VT',
                 long: 'Vertical Tab',
                 spec: '\\v' },
               { acro: 'FF',
                 long: 'Form Feed',
                 spec: '\\f' },
               { acro: 'CR',
                 long: 'Carriage Return',
                 spec: '\\r' },
               { acro: 'SO',
                 long: 'Shift Out' },
               { acro: 'SI',
                 long: 'Shift In' },
               { acro: 'DLE',
                 long: 'Data Link Escape' },
               { acro: 'DC1',
                 long: 'Device Control 1 (XON)' },
               { acro: 'DC2',
                 long: 'Device Control 2' },
               { acro: 'DC3',
                 long: 'Device Control 3 (XOFF)' },
               { acro: 'DC4',
                 long: 'Device Control 4' },
               { acro: 'NAK',
                 long: 'Negative Acknowledgement' },
               { acro: 'SYN',
                 long: 'Synchronous Idle' },
               { acro: 'ETB',
                 long: 'End of Transmission Block' },
               { acro: 'CAN',
                 long: 'Cancel' },
               { acro: 'EM',
                 long: 'End of Medium' },
               { acro: 'SUB',
                 long: 'Substitute' },
               { acro: 'ESC',
                 long: 'Escape',
                 spec: '\\e' },
               { acro: 'FS',
                 long: 'File Separator' },
               { acro: 'GS',
                 long: 'Group Separator' },
               { acro: 'RS',
                 long: 'Record Separator' },
               { acro: 'US',
                 long: 'Unit Separator' } ]

  verbose = 0

  mo = Mode.add('ASCII', { viewInitSpec,
                           context: [ { cmd: 'Toggle Verbose' } ] })

  Cmd.add('refresh', () => viewInitSpec(Pane.current().view), mo)
  Cmd.add('toggle verbose', () => toggle(), mo)

  Em.on('g', 'refresh', mo)
  Em.on('v', 'toggle verbose', mo)

  Cmd.add('ascii', () => ascii())
}

export
function free
() {
  Mode.remove('ASCII')
  Cmd.remove('ascii')
}
