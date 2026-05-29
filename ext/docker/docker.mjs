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
  Shell.runToString(view.buf.dir, 'docker', [ 'ps', '--no-trunc', '--format', fmt() ], 0, (str, code) => onPsResult(view, str, code))
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
      Mess.say('No container on this line')
  }
  else
    Mess.say('Not a docker buffer')
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
  let parts

  if (code) {
    v.buf.append('Failed to get container details\n')
    if (cb)
      cb(v)
    return
  }
  parts = str.trim().split('\t')
  if (parts.length < 2) {
    v.buf.append('No data\n')
    if (cb)
      cb(v)
    return
  }
  v.buf.append('ID:\t\t' + parts[0] + '\n')
  v.buf.append('Name:\t\t' + parts[1] + '\n')
  v.buf.append('Image:\t\t' + parts[2] + '\n')
  v.buf.append('Status:\t\t' + parts[3] + '\n')
  v.buf.append('Ports:\t\t' + (parts[4] || '-') + '\n')
  v.buf.append('Created:\t' + parts[5] + '\n')
  v.buf.append('Command:\t' + (parts[6] || '-') + '\n')
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
    v.buf.append('No container id\n')
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
      Mess.say('No container on this line')
  }
  else
    Mess.say('Not a docker buffer')
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
  Mode.add('Docker',
           { viewInit,
             viewCopy: Ed.viewCopy,
             initFns: Ed.initModeFns,
             parentsForEm: 'ed' })

  Mode.add('Docker Details',
           { viewInit: detailsViewInit,
             viewCopy: Ed.viewCopy,
             initFns: Ed.initModeFns,
             parentsForEm: 'ed' })

  Cmd.add('stop container', () => stop(), Mode.get('Docker'))
  Em.on('s', 'stop container', Mode.get('Docker'))

  Cmd.add('show container details', () => showDetails(0), Mode.get('Docker'))
  Em.on('Enter', 'show container details', Mode.get('Docker'))

  Cmd.add('show container details other pane', () => showDetails(1), Mode.get('Docker'))
  Em.on('o', 'show container details other pane', Mode.get('Docker'))

  Cmd.add('refresh docker', () => refresh(), Mode.get('Docker'))
  Em.on('g', 'refresh docker', Mode.get('Docker'))

  Cmd.add('docker', () => openDocker())
}

export
function free
() {
  Cmd.remove('docker')
  Cmd.remove('stop container')
  Cmd.remove('show container details')
  Cmd.remove('show container details other pane')
  Cmd.remove('refresh docker')
  Mode.remove('Docker')
  Mode.remove('Docker Details')
}
