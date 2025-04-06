import { append, div, divCl, img } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Em from '../../em.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import * as Panel from '../../panel.mjs'
//import { d } from '../../mess.mjs'

let icon

export
function init
() {
  let mode

  function refresh
  (view, full) {
    let w, now, months, year, month, today

    function addMonth
    (yr, mo) {
      let last

      //d("addMonth " + mo + " of yr " + yr)

      last = new Date(yr, mo + 1, 0)
      //d("last: " + last)
      last = last.getDate()
      if (last >= 1) {
        let days, first

        days = []
        first = new Date(yr, mo, 1)
        //d("first: " + first)

        // add days of previous month to fill back to monday
        for (let day = first.getDay(); day > 1; day--)
          days.push(divCl('calendar-day'))
        // add all days of month
        for (let day = 1; day <= last; day++)
          days.push(divCl('calendar-day'
                          + (((day == today) && (month == mo) && (year == yr)) ? ' calendar-today' : ''),
                          day))
        // done
        return divCl('calendar-month',
                     [ divCl('calendar-month-h', first.toLocaleString('default', { month: 'long' })),
                       divCl('calendar-dows', [ 'M', 'T', 'W', 'T', 'F', 'S', 'S' ].map(day => divCl('calendar-dow', day))),
                       divCl('calendar-days', days) ])
      }
      return null
    }

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''

    now = new Date()
    year = now.getFullYear()
    today = now.getDate()
    month = now.getMonth()

    months = []

    if (full)
      for (let i = 0; i < 12; i++)
        months.push(addMonth(year, i))
    else {
      if (month == 0)
        months.push(addMonth(year - 1, 11))
      else
        months.push(addMonth(year, month - 1))

      months.push(addMonth(year, month))

      if (month == 11)
        months.push(addMonth(year + 1, 0))
      else
        months.push(addMonth(year, month + 1))
    }

    append(w, months)
  }

  function year
  () {
    refresh(Pane.current().view, 1)
  }

  function three
  () {
    refresh(Pane.current().view, 0)
  }

  function make
  (p) {
    let b

    b = Buf.add('Calendar', 'Calendar',
                divCl('calendar-ww', divCl('calendar-w bred-surface')),
                p.dir)
    b.addMode('view')
    p.setBuf(b)
  }

  mode = Mode.add('Calendar', { viewInitSpec: view => refresh(view) })

  Cmd.add('year', () => year(), mode)
  Em.on('y', 'year', mode)

  Cmd.add('three', () => three(), mode)
  Em.on('3', 'three', mode)

  Cmd.add('calendar', () => {
    let found, p

    p = Pane.current()
    found = Buf.find(b => b.mode.key == 'calendar')
    if (found)
      p.setBuf(found)
    else
      make(p)
  })

  icon = div(divCl('mini-icon',
                   img('img/calendar.svg', 'Calendar', 'filter-clr-text')),
             'mini-calendar mini-icon onfill mini-em',
             { 'data-run': 'calendar' })
  Panel.start('mini-panel', icon)
}

export
function free
() {
  Mode.remove('Calendar')
  Cmd.remove('calendar')
  icon.remove()
}
