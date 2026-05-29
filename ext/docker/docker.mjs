import * as Buf from '../../js/Buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Em from '../../js/Em.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Pane from '../../js/Pane.mjs'
import * as Shell from '../../js/shell.mjs'
import { d } from '../../js/mess.mjs'

function fmt
() {
  return '{{.ID}}\t{{.Names}}\t{{.Image}}'
}

function onPsResult
(view, str, code) {
  let ids, lines, i, maxId, maxName

  if (code) {
    d('docker ps failed: ' + code)
    return
  }
  ids = []
  lines = str.split('\n').filter(l => l.length)
  for (i = 0; i < lines.length; i++)
    ids.push(lines[i].split('\t')[0])
  view.buf.vars('docker').ids = ids
  maxId = 2
  maxName = 4
  for (i = 0; i < lines.length; i++) {
    let fields

    fields = lines[i].split('\t')
    if (fields[0].slice(0, 12).length > maxId)
      maxId = fields[0].slice(0, 12).length
    if (fields[1].length > maxName)
      maxName = fields[1].length
  }
  view.buf.clear()
  view.buf.append('ID' + ' '.repeat(maxId - 2) + '  NAME' + ' '.repeat(maxName - 4) + '  IMAGE\n')
  for (i = 0; i < lines.length; i++) {
    let fields, image

    fields = lines[i].split('\t')
    image = fields[2]
    if (image.startsWith('sha256:'))
      image = image.slice(7, 19)
    view.buf.append(fields[0].slice(0, 12).padEnd(maxId) + '  ' + fields[1].padEnd(maxName) + '  ' + image + '\n')
  }
  view.bufStart()
}

function dockerBuf
() {
  return Buf.find(b => b.mode.name == 'Docker')
}

function refresh
() {
  let found

  found = dockerBuf()
  if (found) {
    let view

    view = found.views.find(v => v.ele)
    if (view)
      psToView(view)
  }
}

function psToView
(view) {
  Shell.runToString(view.buf.dir,
                    'docker',
                    [ 'ps', '--no-trunc', '--format', fmt() ],
                    0,
                    (str, code) => onPsResult(view, str, code))
}

function onStopResult
(id, str, code) {
  if (code)
    Mess.say('Failed to stop ' + id.slice(0, 12))
  else
    Mess.say('Stopped ' + id.slice(0, 12))
  refresh()
}

function showDetails
(split) {
  let p

  p = Pane.current()
  if (p.buf.mode.name == 'Docker') {
    let row, ids, id

    row = Ed.bepRow(p.view, p.view.bep)
    if (row == 0)
      return Mess.say('That is the header')

    ids = p.buf.vars('docker').ids
    id = ids?.[row - 1]
    if (id)
      showDetailsInner(id, p.dir, split)
    else
      Mess.say('Container missing')
  }
  else
    Mess.say('Must be in a docker buffer')
}

function showDetailsInner
(id, dir, split) {
  let name, b

  name = 'Docker: ' + id.slice(0, 12)
  b = Buf.add(name, 'Docker Details', Ed.divW(0, name), dir)
  b.vars('docker details').id = id
  b.addMode('view')
  b.opts.set('core.lint.enabled', 0)
  b.opts.set('minimap.enabled', 0)
  if (split)
    Pane.nextOrSplit()
  Pane.current().setBuf(b)
}

function onDetailsPs
(v, cb, str, code) {
  let parts, labels, maxW, i

  if (code) {
    v.buf.append('Failed to get container details\n')
    if (cb)
      cb(v)
    return
  }
  parts = str.trim().split('\t')
  if (parts.length < 2) {
    v.buf.append('Empty\n')
    if (cb)
      cb(v)
    return
  }
  labels = [ 'ID', 'Name', 'Image', 'Status', 'Ports', 'Created', 'Command' ]
  maxW = 0
  for (i = 0; i < labels.length; i++)
    if (labels[i].length > maxW)
      maxW = labels[i].length
  v.buf.append(labels[0].padEnd(maxW) + '  ' + parts[0] + '\n')
  v.buf.append(labels[1].padEnd(maxW) + '  ' + parts[1] + '\n')
  v.buf.append(labels[2].padEnd(maxW) + '  ' + parts[2] + '\n')
  v.buf.append(labels[3].padEnd(maxW) + '  ' + parts[3] + '\n')
  v.buf.append(labels[4].padEnd(maxW) + '  ' + (parts[4] || '-') + '\n')
  v.buf.append(labels[5].padEnd(maxW) + '  ' + parts[5] + '\n')
  v.buf.append(labels[6].padEnd(maxW) + '  ' + (parts[6] || '-') + '\n')
  v.bufStart()
  if (cb)
    cb(v)
}

function detailsViewInit
(view, spec, cb) {
  Ed.viewInit(view, spec, v => onDetailsViewInit(v, cb))
}

function onDetailsViewInit
(v, cb) {
  let id

  id = v.buf.vars('docker details').id
  if (id)
    Shell.runToString(v.buf.dir, 'docker', [ 'ps', '--no-trunc', '--filter', 'id=' + id, '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}\t{{.Command}}' ], 0, (str, code) => onDetailsPs(v, cb, str, code))
  else
    v.buf.append('Container id missing\n')
  if (cb)
    cb(v)
}

function stop
() {
  let p

  p = Pane.current()
  if (p.buf.mode.name == 'Docker') {
    let row, ids, id

    row = Ed.bepRow(p.view, p.view.bep)
    ids = p.buf.vars('docker').ids
    id = ids?.[row]
    if (id)
      Shell.runToString(p.buf.dir, 'docker', [ 'stop', id ], 0, (str, code) => onStopResult(id, str, code))
    else
      Mess.say('Missing container')
  }
  else
    Mess.say('Must be in a Docker buffer')
}

function onViewInit
(v, cb) {
  psToView(v)
  if (cb)
    cb(v)
}

function viewInit
(view, spec, cb) {
  Ed.viewInit(view, spec, v => onViewInit(v, cb))
}

function make
(p) {
  let b

  b = Buf.add('Docker', 'Docker', Ed.divW(0, 'Docker'), p.dir)
  b.addMode('view')
  b.opts.set('core.lint.enabled', 0)
  b.opts.set('minimap.enabled', 0)
  p.setBuf(b)
}

function openDocker
() {
  let found, p

  p = Pane.current()
  found = dockerBuf()
  if (found)
    p.setBuf(found)
  else
    make(p)
}

export
function init
() {
  let mo

  mo = Mode.add('Docker',
                { viewInit,
                  viewCopy: Ed.viewCopy,
                  initFns: Ed.initModeFns,
                  parentsForEm: 'ed' })

  Mode.add('Docker Details',
           { viewInit: detailsViewInit,
             viewCopy: Ed.viewCopy,
             initFns: Ed.initModeFns,
             parentsForEm: 'ed' })

  Cmd.add('stop container', () => stop(), mo)
  Em.on('s', 'stop container', mo)

  Cmd.add('show details', () => showDetails(0), mo)
  Em.on('Enter', 'show details', mo)

  Cmd.add('show details other pane', () => showDetails(1), mo)
  Em.on('o', 'show details other pane', mo)

  Cmd.add('refresh docker', () => refresh(), mo)
  Em.on('g', 'refresh docker', mo)

  Cmd.add('docker', () => openDocker())
}

export
function free
() {
  Cmd.remove('docker')
  Cmd.remove('stop container')
  Cmd.remove('show details')
  Cmd.remove('show details other pane')
  Cmd.remove('refresh docker')
  Mode.remove('Docker')
  Mode.remove('Docker Details')
}
