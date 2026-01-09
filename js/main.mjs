import { app, clipboard as Clipboard, BrowserWindow, ipcMain, Menu /*, net, protocol*/, WebContentsView } from 'electron'
import * as Browse from './main-browse.mjs'
import CheckDeps from '../lib/check-dependencies.cjs'
import * as Chmod from './main-chmod.mjs'
import * as Dir from './main-dir.mjs'
import * as Ext from './main-ext.mjs'
import * as File from './main-file.mjs'
import * as Files from './main-files.mjs'
import * as Hover from './main-hover.mjs'
import { d, log } from './main-log.mjs'
import * as Log from './main-log.mjs'
import * as Lsp from './main-lsp.mjs'
import { makeErr } from './main-err.mjs'
import Os from 'node:os'
import Path from 'node:path'
import * as Peer from './main-peer.mjs'
import process from 'node:process'
import * as Profile from './main-profile.mjs'
import * as Project from './main-project.mjs'
import * as Code from './main-code.mjs'
import fs from 'node:fs'
import * as Shell from './main-shell.mjs'
import * as Step from './main-step.mjs'
import Util from 'node:util'
import { spawnSync } from 'node:child_process'
import * as Commander from 'commander'

let version, options, dirUserData, shell, lastClipWrite, _win, mainStart

function cmdDevtoolsClose
(e) {
  let win

  win = BrowserWindow.fromWebContents(e.sender)
  if (win.isDevToolsOpened()) {
    win.webContents.closeDevTools()
    return { open: 0 }
  }
  return { open: 0 }
}

function cmdDevtoolsToggle
(e) {
  let win

  win = BrowserWindow.fromWebContents(e.sender)
  if (win.isDevToolsOpened()) {
    win.webContents.closeDevTools()
    return { open: 0 }
  }
  win.webContents.openDevTools({ activate: 0, // keeps main focus when detached
                                 title: 'Developer Tools - Bred' })
  return { open: 1 }
}

function cmdClipSelect
(e, ch, onArgs) {
  let [ text ] = onArgs

  Clipboard.writeText(text, 'selection')
  return {}
}

function cmdClipWrite
(e, ch, onArgs) {
  let [ text ] = onArgs

  lastClipWrite = text
  Clipboard.writeText(text, 'clipboard')
  return {}
}

function cmdTestThrow
() {
  setTimeout(() => {
    throw new Error ('test err')
  })
  return {}
}

function onLoadInit
(e, ch) {
  let win

  win = BrowserWindow.fromWebContents(e.sender)

  if (options.skipInit) {
    log('Skipping load of your init.js.')
    e.sender.send(ch, { skip: 1 })
  }
  else if (dirUserData) {
    let file

    file = Path.join(dirUserData, 'init.js')
    log('Loading ' + file + '...')
    d('Loading ' + file + '...')
    fs.readFile(file, 'utf8', (err, js) => {
      if (err) {
        if (err.code === 'ENOENT') {
          log('Loading ' + file + ": missing, that's OK")
          e.sender.send(ch, { exist: 0 })
          return
        }
        log('Loading ' + file + ': ' + err.message)
        e.sender.send(ch, { err })
        return
      }
      js = '(function (C,Cmd,Dom,Ed,Em,Hist,Loc,Opt,Pane,Mess,Mode,Dir,Place,Win) { "use strict"; Mess.log("Loading your init.js...");\n' + js + ';\nMess.log("Loading your init.js... done"); })(window.bred.C,window.bred.Cmd,window.bred.Dom,window.bred.Ed,window.bred.Em,window.bred.Hist,window.bred.Loc,window.bred.Opt,window.bred.Pane,window.bred.Mess,window.bred.Mode,window.bred.Dir,window.bred.Place,window.bred.Win)'
      win.webContents.executeJavaScript(js).then(() => {
        log('Loading ' + file + ': done.')
        d('Loading ' + file + ': done.')
        setTimeout(() => e.sender.send(ch, { exist: 1 })) // timeout because wtf slow
      })
    })
  }
  else {
    log('Path userData missing, skipping load of your init.js')
    e.sender.send(ch, { err: new Error('Path userData missing') })
  }
}

function onPaths
(e) {
  let home, user, win, frame

  frame = Profile.stores.frame

  win = BrowserWindow.fromWebContents(e.sender)

  try {
    home = app.getPath('home')
  }
  catch (e) {
    console.warn('failed to get home: ' + e.message)
  }
  try {
    user = app.getPath('userData')
  }
  catch (e) {
    console.warn('failed to get userData: ' + e.message)
  }
  return { home,
           app: app.getAppPath(),
           user,
           cwd: process.cwd(),
           shell,
           profile: Profile.name(),
           //
           backend: options.backend,
           devtools: { open: win.webContents.isDevToolsOpened() ? 1 : 0 },
           frames: { left: frame.get('frameLeft'),
                     right: frame.get('frameRight') },
           //
           os: Os.type(),
           version: { bred: version,
                      node: process.versions.node,
                      electron: process.versions.electron,
                      chrome: process.versions.chrome,
                      v8: process.versions.v8 } }
}

async function wrapOn
(e, ch, onArgs, cb) {
  setTimeout(async () => {
    try {
      await cb(e, ch, onArgs, { shell })
    }
    catch (err) {
      try {
        e.sender.send(ch, makeErr(err))
      }
      catch (err2) {
        log('wrapOn: ' + err2.message)
      }
    }
  })
  return ch
}

function quit
() {
  try {
    Code.closeAll()
    app.quit()
  }
  catch (err) {
    console.log(err.message)
    _win.webContents.send('thrown', makeErr(err))
  }
}

function relaunch
() {
  // Would be neater, but relaunched process always has "no new privileges" set, preventing it from running sudo.
  //app.relaunch()
  //quit()

  try {
    d('process.env.PPID ' + process.env.PPID)
    d('process.env.BRED_SCRIPT_PID ' + process.env.BRED_SCRIPT_PID)
    d('writing 1 to /tmp/bred-' + process.env.BRED_SCRIPT_PID + '-relaunch')
    fs.writeFileSync('/tmp/bred-' + process.env.BRED_SCRIPT_PID + '-relaunch', '1', {})
  }
  catch (err) {
    console.log(err.message)
  }
  try {
    Code.closeAll()
    app.exit(7)
  }
  catch (err) {
    console.log(err.message)
    _win.webContents.send('thrown', makeErr(err))
  }
}

async function onAcmd
(e, name, args) {
  if (name == 'code.spawn')
    return Code.onSpawn(e, args)

  if (name == 'code.close')
    return Code.onClose(e, args)

  if (name == 'browse.back')
    return Browse.onBack(e, args)

  if (name == 'browse.close')
    return Browse.onClose(e, args)

  if (name == 'browse.pass')
    return Browse.onPass(e, args)

  if (name == 'browse.reload')
    return Browse.onReload(e, args)

  if (name == 'browse.reopen')
    return Browse.onReopen(e, args)

  if (name == 'browse.zoom')
    return Browse.onZoom(e, args)

  if (name == 'code.close')
    return Code.onClose(e, args)

  if (name == 'code.spawn')
    return Code.onSpawn(e, args)

  if (name == 'file.save.tmp')
    return File.onSaveTmp(e, args)

  if (name == 'hover.css')
    return Hover.onCss(e, args)

  if (name == 'hover.on')
    return Hover.onOn(e, args)

  if (name == 'hover.off')
    return Hover.onOff(e, args)

  if (name == 'peer.get')
    return Peer.onGet(e, args)

  if (name == 'peer.psn.line')
    return Peer.onPsnLine(e, args)

  if (name == 'peer.psn.lineNext')
    return Peer.onPsnLineNext(e, args)

  if (name == 'peer.push')
    return Peer.onPush(e, args)

  if (name == 'profile.hist.add')
    return Profile.onHistAdd(e, args)

  if (name == 'profile.hist.get')
    return Profile.onHistGet(e, args)

  if (name == 'profile.hist.suggest')
    return Profile.onHistSuggest(e, args)

  if (name == 'profile.prompt.add')
    return Profile.onPromptAdd(e, args)

  if (name == 'profile.prompt.load')
    return Profile.onPromptLoad(e, args)

  if (name == 'project.root')
    return Project.onRoot(e, args)

  d('onAcmd: missing: ' + name)

  return { err: { message: 'onAcmd: Missing: ' + name } }
}

let onCmdCount

onCmdCount = 0

function onCmdCh
(ch, e, name, args) {
  let win

  win = BrowserWindow.fromWebContents(e.sender)

  if (name == 'browse.open')
    return wrapOn(e, ch, args, Browse.onOpen)

  if (name == 'profile.get')
    return Profile.onGet(e, args[0], args[1])

  if (name == 'profile.load')
    return wrapOn(e, ch, args, Profile.onLoad)

  if (name == 'profile.save') // profile.set but many
    return Profile.onSave(e, ch, args)

  if (name == 'profile.set')
    return Profile.onSet(e, args[0], args[1], args[2])

  if (name == 'dir.get')
    return wrapOn(e, ch, args, Dir.onGet)

  if (name == 'dir.make')
    return wrapOn(e, ch, args, Dir.onMake)

  if (name == 'dir.rm')
    return wrapOn(e, ch, args, Dir.onRm)

  if (name == 'dir.watch')
    return wrapOn(e, ch, args, Dir.onWatch)

  if (name == 'devtools.inspect')
    return wrapOn(e, ch, args, () => {
      win.inspectElement(Math.round(args[0]), Math.round(args[1])) // x, y
      e.sender.send(ch, {})
    })

  if (name == 'devtools.close')
    return cmdDevtoolsClose(e, ch, args)

  if (name == 'devtools.toggle')
    return cmdDevtoolsToggle(e, ch, args)

  if (name == 'ext.add')
    return wrapOn(e, ch, args, Ext.onAdd)

  if (name == 'ext.all')
    return wrapOn(e, ch, args, Ext.onAll)

  if (name == 'ext.remove')
    return wrapOn(e, ch, args, Ext.onRemove)

  if (name == 'init.load')
    return wrapOn(e, ch, [], onLoadInit)

  if (name == 'lsp.edit')
    return wrapOn(e, ch, args, Lsp.onEdit)

  if (name == 'lsp.req')
    return Lsp.onReq(e, ch, args)

  if (name == 'paths')
    return onPaths(e)

  if (name == 'clip.select')
    return cmdClipSelect(e, ch, args)

  if (name == 'clip.write')
    return cmdClipWrite(e, ch, args)

  if (name == 'shell')
    return wrapOn(e, args[0] /* clientCh */, args, Shell.on)

  if (name == 'shell.run')
    return wrapOn(e, args[0] /* clientCh */, args, Shell.onRun)

  if (name == 'shell.open')
    return wrapOn(e, ch, args, Shell.onOpen)

  if (name == 'shell.show')
    return wrapOn(e, ch, args, Shell.onShow)

  if (name == 'step.send')
    return wrapOn(e, ch, args, Step.onSend)

  if (name == 'quit') {
    quit()
    return ch
  }

  if (name == 'restart') {
    relaunch()
    return ch
  }

  if (name == 'file.chmod')
    return wrapOn(e, ch, args, Chmod.onChmod)

  if (name == 'file.cp')
    return wrapOn(e, ch, args, File.onCp)

  if (name == 'file.exists')
    return wrapOn(e, ch, args, File.onExists)

  if (name == 'file.get')
    return wrapOn(e, ch, args, File.onGet)

  if (name == 'file.ln')
    return wrapOn(e, ch, args, File.onLn)

  if (name == 'file.modify')
    return wrapOn(e, ch, args, File.onModify)

  if (name == 'file.mv')
    return wrapOn(e, ch, args, File.onMv)

  if (name == 'file.patch')
    return wrapOn(e, ch, args, File.onPatch)

  if (name == 'file.rm')
    return wrapOn(e, ch, args, File.onRm)

  if (name == 'file.save')
    return wrapOn(e, ch, args, File.onSave)

  if (name == 'file.stat')
    return wrapOn(e, ch, args, File.onStat)

  if (name == 'file.touch')
    return wrapOn(e, ch, args, File.onTouch)

  if (name == 'file.watch')
    return wrapOn(e, ch, args, File.onWatch)

  if (name == 'files.lines')
    return wrapOn(e, ch, args, Files.onLines)

  if (name == 'peer.pull')
    return wrapOn(e, ch, args, Peer.onPull)

  if (name == 'test.throw')
    return cmdTestThrow(e, ch, args)

  setTimeout(() => e.sender.send(ch, { err: { message: 'bogus cmd' } }))
  return ch
}

async function onCmd
(e, name, args) {
  let ret, ch

  ch = 'onCmd' + onCmdCount
  onCmdCount++
  onCmdCount = Math.min(onCmdCount, 1000000)

  if ((name == 'dir.get') && options.logfile) {
    // Skip because the dir watch handler calls dir.get, so this would cause recursive behaviour.
  }
  else
    d(ch + ': ' + name) // + " on " + args)

  ret = onCmdCh(ch, e, name, args)

  if ((name == 'dir.get') && options.logfile) {
  }
  else
    d(ch + ': ' + name + ': done')

  return ret
}

function createWindow
(html, opts) {
  let win, mode, hover

  mode = Profile.stores.opt.get('core.theme.mode')

  opts = opts || { backgroundColor: (mode == 'dark') ? '#002b36' : '#fdf6e3', // --color-primary-bg
                   //frame: false,
                   //titleBarStyle: 'hidden',
                   //titleBarOverlay: true,
                   show: false,
                   webPreferences: {
                     // FIX The preload script configured for the <webview> will have node integration enabled when it is executed so you should ensure remote/untrusted content is not able to create a <webview> tag...
                     webviewTag: true,
                     preload: Path.join(import.meta.dirname, 'preload.js')
                   } }
  win = new BrowserWindow(opts)
  win.bred = win.bred || {}
  win.webContents.setMaxListeners(30)

  win.on('blur', () => {
    d('BLUR WIN')
  })
  win.on('focus', () => {
    d('FOCUS WIN')
  })

  win.webContents.on('blur', () => {
    d('BLUR MAIN')
  })
  win.webContents.on('focus', () => {
    d('FOCUS MAIN')
  })

  hover = { bg: 0,
            fg: 0,
            view: 0,
            text: 0,
            create() {
              if (hover.view)
                win.contentView.removeChildView(hover.view)
              hover.text = 0
              hover.view = new WebContentsView()
              hover.view.setBackgroundColor((mode == 'dark') ? '#15414b' : '#eee8d5') // --clr-fill
              hover.view.webContents.on('blur', () => {
                d('BLUR')
              })
              hover.view.webContents.on('focus', () => {
                d('FOCUS')
                // workaround for the view stealing the focus.
                // https://github.com/electron/electron/issues/42339
                //
                // needs to be in a timeout for some reason.
                setTimeout(() => {
                  if (win.webContents)
                    win.webContents.focus()
                  else
                    d('MISS')
                })
              })
              win.contentView.addChildView(hover.view)
            },
            off() {
              hover.text = 0
              hover.view.setVisible(false)
            },
            on(text) {
              let html, bg, fg

              if (text == hover.text)
                return
              // have to recreate it every time so it stays on top of the browser views
              // https://github.com/electron/electron/issues/15899
              hover.create()
              hover.text = text
              if (hover.fg && /#[0-9a-fA-F]+/.test(hover.fg))
                fg = hover.fg
              else
                fg = (mode == 'dark' ? '#93a1a1' : '#586e75') // --clr-text
              if (hover.bg && /#[0-9a-fA-F]+/.test(hover.bg))
                bg = hover.bg
              else
                bg = ((mode == 'dark') ? '#15414b' : '#eee8d5') // --clr-fill
              // could you inject js here?
              html = 'data:text/html,' + globalThis.encodeURIComponent('<html style="font-family: \'DejaVu Sans\', sans-serif;"><body style="padding: 0; margin: 0; overflow: hidden; color: ' + fg + '; background-color: ' + bg + '; border: 1px solid ' + fg + ';"><div style="text-wrap: nowrap; padding: 0.5rem; overflow: hidden; display: inline-block;">' + text + '</div></body></html>')
              hover.view.webContents.loadURL(html)
              hover.view.setVisible(true)
              hover.view.webContents.executeJavaScript('[ globalThis.document.body.firstElementChild.offsetWidth, globalThis.document.body.offsetHeight ]').then(wh => {
                hover.resize(wh[0], wh[1])
              })
            },
            resize(width, height) {
              if (hover.view) {
                let bounds

                height = height ?? 30
                bounds = win.getBounds()
                width = width ?? bounds.width
                d('resize to ' + width + ',' + height)
                hover.view.setBounds({ x: 0, y: bounds.height - height, width, height })
              }
            } }
  win.bred.hover = hover

  hover.resize()

  win.once('ready-to-show', () => {
    win.show()
    win.bred.hover.resize()
  })

  win.removeMenu()

  win.setBounds(options.bounds || Profile.stores.state.get('bounds'))

  try {
    //win.webContents.debugger.attach('1.3')
  }
  catch (err) {
    log('ERR debugger.attach: ', err.message)
  }

  win.webContents.debugger.on('detach', (event, reason) => {
    log('debugger: detached: ' + reason)
  })

  win.webContents.debugger.on('detach', (event, method) => {
    log('debugger: message: ' + method)
  })

  win.webContents.setWindowOpenHandler(details => {
    if ((details.url == 'about:blank')
        && (details.frameName.match(/bred:win\/[-0-9a-f]+/))) {
      let mode

      mode = Profile.stores.opt.get('core.theme.mode')
      return { action: 'allow',
               outlivesOpener: true,
               overrideBrowserWindowOptions: { backgroundColor: (mode == 'dark') ? '#002b36' : '#fdf6e3', // --color-primary-bg
                                               show: false,
                                               webPreferences: { webviewTag: true,
                                                                 preload: Path.join(import.meta.dirname,
                                                                                    'preload.js') } },
               createWindow: opts => {
                 let html, win

                 html = 'bred-new-window.html'
                 if (options.backend == 'ace')
                   html = 'bred-ace-new-window.html'
                 win = createWindow(html, opts)
                 return win?.webContents
               } }
    }
    return { action: 'deny' }
  })

  win.webContents.on('did-create-window', ch => {
    let bounds

    bounds = Profile.stores.state.get('bounds')
    bounds.x = 0
    bounds.y = 0
    ch.removeMenu()
    ch.webContents.openDevTools({ activate: 0, // keeps main focus when detached
                                  title: 'Developer Tools - Bred' })
    ch.setBounds(bounds)
    win.bred.hover.resize()
  })

  win.on('close', () => {
    Profile.stores.state.set('isDevToolsOpened', win.webContents.isDevToolsOpened())
    Profile.stores.state.set('bounds', win.getBounds())
  })

  win.on('resize', () => {
    win.bred.hover.resize()
    Profile.stores.state.set('bounds', win.getBounds())
  })

  win.on('move', () => {
    Profile.stores.state.set('bounds', win.getBounds())
  })

  if ((options.devtools == 'on')
      || ((options.devtools == 'auto') && Profile.stores.state.get('isDevToolsOpened'))) {
    d('opening devtools')
    win.webContents.openDevTools({ activate: 0, // keeps main focus when detached
                                   title: 'Developer Tools - Bred' })
    // wait for devtools, so that breakpoints in init are hit
    win.webContents.once('devtools-opened', () => {
      d('loading ' + html)
      if (options.waitForDevtools)
        win.loadFile(html)
      // would be nice to focus current pane here, for when devtools docked
      //win.focus()
    })
    options.waitForDevtools || win.loadFile(html)
  }
  else {
    d('loading ' + html)
    win.webContents.closeDevTools()
    win.loadFile(html)
  }

  win.webContents.on('devtools-opened', () => {
    Profile.stores.state.set('isDevToolsOpened', 1)
    win.webContents.send('devtools', { open: 1 })
  })
  win.webContents.on('devtools-closed', () => {
    Profile.stores.state.set('isDevToolsOpened', 0)
    win.webContents.send('devtools', { open: 0 })
  })

  return win
}

function createMainWindow
() {
  let html

  html = 'bred.html'
  if (options.backend == 'ace')
    html = 'bred-ace.html'

  _win = createWindow(html)
  Lsp.setWin(_win)
  d('timing: main startup: ' + Math.round(performance.now() - mainStart) + 'ms')

  process.on('uncaughtException', err => {
    console.log(err.message)
    _win.webContents.send('thrown', makeErr(err))
  })
}

function setVersion
() {
  let appPath

  appPath = app.getAppPath()
  version = app.getVersion()
  if (appPath)
    try {
      let stat

      stat = fs.statSync(Path.join(appPath, '.git'), { throwIfNoEntry: true })
      if (stat) {
        let res, out

        res = spawnSync('git',
                        [ 'rev-list', '--count', 'v' + version + '..HEAD' ],
                        { cwd: appPath, encoding: 'utf-8' })
        if (res.error)
          throw res.error
        out = res.stdout.trim()
        if (out.length == 0)
          throw new Error ('git rev-list in ' + appPath + ': output empty')
        version += '-' + out
      }
    }
    catch (err) {
      console.warn('setVersion failed, assuming this is a release: ' + err.message)
    }

  else
    console.warn('setVersion: appPath missing, assuming this is a release')
}

function watchClip
() {
  let last

  function check
  () {
    let text

    //d('check')
    text = Clipboard.readText('clipboard')
    if (text && text.length) {
      if (text == last)
        return
      if (text == lastClipWrite)
        return
      //d('clip.new ' + text)
      last = text
      _win.webContents.send('clip.new', { text })
    }
  }

  setInterval(check, 1 * 1000)
}

function checkDepsWin
() {
  let html, uri, win, opts, mode, color

  color = (mode == 'dark') ? '#93a1a1' : '#586e75' // --color-text
  html = '<html><body style="color: ' + color + '">Checking dependencies...</body></html>'
  uri = 'data:text/html,' + globalThis.encodeURIComponent(html)
  mode = Profile.stores.opt.get('core.theme.mode')

  process.on('uncaughtException', err => {
    console.log(err.message)
    _win.webContents.send('thrown', makeErr(err))
  })

  opts = { backgroundColor: (mode == 'dark') ? '#002b36' : '#fdf6e3', // --color-primary-bg
           //frame: false,
           //titleBarStyle: 'hidden',
           //titleBarOverlay: true,
           show: false,
           webPreferences: {
             // FIX The preload script configured for the <webview> will have node integration enabled when it is executed so you should ensure remote/untrusted content is not able to create a <webview> tag...
             webviewTag: true
             //preload: Path.join(import.meta.dirname, 'preload.js')
           } }
  win = new BrowserWindow(opts)

  win.once('ready-to-show', () => win.show())

  win.removeMenu()

  win.setBounds({ width: 300,
                  height: 100 })

  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  win.webContents.on('did-create-window', ch => {
    ch.removeMenu()
    ch.webContents.openDevTools({ activate: 0, // keeps main focus when detached
                                  title: 'Developer Tools - Bred' })
    ch.setBounds({ width: 300,
                   height: 100 })
  })

  if (options.devtools == 'on') {
    d('opening devtools')
    win.webContents.openDevTools({ activate: 0, // keeps main focus when detached
                                   title: 'Developer Tools - Bred' })
    // wait for devtools, so that breakpoints in init are hit
    win.webContents.once('devtools-opened', () => {
      d('loading html')
      if (options.waitForDevtools)
        win.loadURL(uri)
      // would be nice to focus current pane here, for when devtools docked
      //win.focus()
    })
    options.waitForDevtools || win.loadURL(uri)
  }
  else {
    d('loading html')
    win.webContents.closeDevTools()
    win.loadURL(uri)
  }

  win.webContents.on('devtools-opened', () => {
    win.webContents.send('devtools', { open: 1 })
  })
  win.webContents.on('devtools-closed', () => {
    win.webContents.send('devtools', { open: 0 })
  })

  return win
}

function checkDeps
(whenHaveDeps) {
  let win, lastCheckFile, lastCheckCommit, currentCommit

  lastCheckFile = Path.join(dirUserData, '.last-deps-check')

  try {
    lastCheckCommit = fs.readFileSync(lastCheckFile, 'utf8').trim()
  }
  catch {
    lastCheckCommit = ''
  }

  try {
    let res

    res = spawnSync('git', [ 'rev-parse', 'HEAD' ],
                    { cwd: app.getAppPath(), encoding: 'utf8' })
    if (res.error)
      throw res.error
    currentCommit = res.stdout.trim()
  }
  catch (e) {
    d('Failed to get current commit: ' + e.message)
    currentCommit = ''
  }

  if (lastCheckCommit && currentCommit && lastCheckCommit === currentCommit) {
    d('Dependencies already checked for commit ' + currentCommit)
    whenHaveDeps()
    return
  }

  d('Creating check window...')
  win = checkDepsWin()
  win.webContents.on('dom-ready', () => {
    d('Checking dependencies...')
    CheckDeps({ install: true,
                verbose: true }).then(output => {
      if (output.status) {
        d('Checking dependencies... ERR')
        app.quit()
        return
      }
      if (output.installWasNeeded) {
        d('Checking dependencies... installed, restarting')
        relaunch()
        return
      }
      d('Checking dependencies... OK')

      // Record the commit we checked
      if (currentCommit)
        try {
          fs.writeFileSync(lastCheckFile, currentCommit)
        }
        catch (e) {
          d('Failed to write last deps check: ' + e.message)
        }

      setTimeout(() => win.close())
      whenHaveDeps()
    })
  })
  return 1
}

// attempt to speed up load using Cache-Control. seems the same.
//protocol.registerSchemesAsPrivileged([ { scheme: 'bf',
//                                         privileges: { bypassCSP: true } } ])

function whenHaveDeps
(program) {
  if (options.bounds) {
    let s

    s = options.bounds.split(',')
    if (s.length == 4) {
      options.bounds = { x: parseInt(s[0].trim()),
                         y: parseInt(s[1].trim()),
                         width: parseInt(s[2].trim()),
                         height: parseInt(s[3].trim()) }
      if (isNaN(options.bounds.x)) {
        console.error('Error parsing x in --bounds')
        program.help()
      }
      if (isNaN(options.bounds.y)) {
        console.error('Error parsing y in --bounds')
        program.help()
      }
      if (isNaN(options.bounds.width)) {
        console.error('Error parsing width in --bounds')
        program.help()
      }
      if (isNaN(options.bounds.height)) {
        console.error('Error parsing height in --bounds')
        program.help()
      }
    }
    else {
      console.error('Error parsing value of --bounds')
      program.help()
    }
  }

  d(JSON.stringify(process.env, null, 2))

  log('Bred ' + version)
  log('    Node: ' + process.versions.node)
  log('    Electron: ' + process.versions.electron)
  log('    Chrome: ' + process.versions.chrome)
  log('    Backend: ' + options.backend)
  d('printed version')

  /* see bf above
  protocol.handle('bf', (request) => {
    let file, response
    file = request.url
    file = file.slice('bf://'.length)
    //d('fetch ' + file)
    return net.fetch(Url.pathToFileURL(Path.join(import.meta.dirname, file)).toString()).then(response => {
      if (response.ok) {
        let headers
        //d(JSON.stringify(response))
        headers = new Headers(response.headers)
        headers.append('Cache-Control', 'max-age=31536000, immutable') // 1yr
        return new Response(response.body,
                            { status: 200,
                              statusText: 'OK',
                              headers: headers })
      }
      return response
    })
  })
  */

  ipcMain.handle('acmd', onAcmd)
  ipcMain.handle('cmd', onCmd)

  d('creating window')
  createMainWindow()

  d('setting up clipboard watcher')
  watchClip()

  d('setting app handlers')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createMainWindow()
  })
}

async function whenReady
() {
  let program, profileStart

  setVersion()

  program = new Commander.Command()

  program
    .option('--skip-init', 'Skip loading of your init.js file')
    .addOption(new Commander.Option('--devtools <state>', 'Initial state of devtools').choices([ 'auto', 'on', 'off' ]).default('auto'))
    .option('--wait-for-devtools', 'Wait for devtools to load before starting. Slower, but useful for debugging startup.')
    .option('--wait', 'Same as --wait-for-devtools.')
    .addOption(new Commander.Option('--backend <name>', 'Editing backend').choices([ 'ace', 'codemirror', 'monaco' ]).default('codemirror'))
    .option('--bounds <spec>', 'Set geometry of window (format: "x,y,width-in-px,height-in-px", default: previous geometry)')
    .option('--disable-gpu', 'Disable GPU')
    .option('--inspect', 'listen for inspector messages on 9229')
    .option('--logfile <file>', 'file to write logs to (default: stdout)')
    .option('--no-sandbox', 'Turn off Chromium sandboxing')
    .option('--profile <name>', 'Profile to use (default: Main)')
    .option('--disable-setuid-sandbox', 'Turn off UID sandboxing (eg if you want to run sudo)')
    .version(version)
    .parse()

  options = program.opts()
  if (options.wait)
    options.waitForDevtools = true

  shell = process.env.SHELL || 'sh'

  try {
    dirUserData = app.getPath('userData')
  }
  catch (err) {
    console.warn('failed to get userData: ' + err.message)
  }

  profileStart = performance.now()
  if (Profile.init(options.profile, dirUserData)) {
    app.quit()
    return
  }
  d('timing: profile.init: ' + Math.round(performance.now() - profileStart) + 'ms')

  if (options.logfile) {
    let file

    d('logging to ' + options.logfile)
    fs.mkdirSync(Path.dirname(options.logfile),
                 { recursive: true,
                   mode: 0o777 }) // drwxrwxrwx
    file = fs.createWriteStream(options.logfile,
                                { flags: 'w',
                                  flush: true })
    Log.logWith(d => {
      file.write(Util.format(d) + '\n')
    })
  }
  else
    d('logging to stdout')

  Browse.init()
  Project.init()
  Code.init()

  Menu.setApplicationMenu(null) // Apparently good for performance

  app.on('window-all-closed', () => {
    app.quit()
  })

  checkDeps(() => whenHaveDeps(program))
}

mainStart = performance.now()
app.whenReady().then(whenReady)
