import { app, clipboard as Clipboard, BrowserWindow, ipcMain /*, protocol, net*/ } from 'electron'
import * as Browse from './main-browse.mjs'
import CheckDeps from './lib/check-dependencies.cjs'
import * as Chmod from './main-chmod.mjs'
import * as Dir from './main-dir.mjs'
import * as Ext from './main-ext.mjs'
import * as File from './main-file.mjs'
import { d, log } from './main-log.mjs'
import * as Log from './main-log.mjs'
import * as Lsp from './main-lsp.mjs'
import { makeErr } from './main-err.mjs'
import Path from 'node:path'
import * as Peer from './main-peer.mjs'
import process from 'node:process'
import * as Profile from './main-profile.mjs'
import fs from 'node:fs'
import * as Shell from './main-shell.mjs'
import * as Step from './main-step.mjs'
import Util from 'node:util'
import { spawnSync } from 'node:child_process'
import * as Commander from 'commander'

let version, options, dirUserData, shell, lastClipWrite, _win

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
        e.sender.send(ch, { err: err })
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
  return { home: home,
           app: app.getAppPath(),
           user: user,
           cwd: process.cwd(),
           shell: shell,
           profile: Profile.name(),
           //
           backend: options.backend,
           devtools: { open: win.webContents.isDevToolsOpened() ? 1 : 0 },
           frames: { left: frame.get('frameLeft'),
                     right: frame.get('frameRight') },
           //
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
      await cb(e, ch, onArgs, { shell: shell })
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
    app.exit(7)
  }
  catch (err) {
    console.log(err.message)
    _win.webContents.send('thrown', makeErr(err))
  }
}

let onCmdCount

onCmdCount = 0

async function onCmd
(e, name, args) {
  let win, ch

  ch = 'onCmd' + onCmdCount
  onCmdCount++
  onCmdCount = Math.min(onCmdCount, 1000000)

  win = BrowserWindow.fromWebContents(e.sender)

  if ((name == 'dir.get') && options.logfile) {
    // Skip because the dir watch handler calls dir.get, so this would cause recursive behaviour.
  }
  else
    d(ch + ': ' + name) // + " on " + args)

  if (name == 'brood.get')
    return Profile.onGet(e, args[0], args[1])

  if (name == 'brood.load')
    return wrapOn(e, ch, args, Profile.onLoad)

  if (name == 'brood.save')
    return Profile.onSave(e, ch, args)

  if (name == 'brood.set')
    return Profile.onSet(e, args[0], args[1], args[2])

  if (name == 'browse')
    return wrapOn(e, ch, args, Browse.onBrowse)

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
      win.inspectElement(args[0], args[1]) // x, y
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

  if (name == 'file.mv')
    return wrapOn(e, ch, args, File.onMv)

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

  if (name == 'peer.get')
    return wrapOn(e, ch, args, Peer.onPeerGet)

  if (name == 'peer.pull')
    return wrapOn(e, ch, args, Peer.onPeerPull)

  if (name == 'peer.push')
    return wrapOn(e, ch, args, Peer.onPeerPush)

  if (name == 'test.throw')
    return cmdTestThrow(e, ch, args)

  setTimeout(() => e.sender.send(ch, { err: { message: 'bogus cmd' } }))
  return ch
}

function createWindow
(html, opts) {
  let win

  opts = opts || { backgroundColor: '#fdf6e3', // --color-primary-light
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

  win.once('ready-to-show', () => win.show())

  win.removeMenu()

  win.setBounds(options.bounds || Profile.stores.state.get('bounds'))

  try {
    win.webContents.debugger.attach('1.3')
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
        && (details.frameName.match(/bred:win\/[-0-9a-f]+/)))
      return { action: 'allow',
               outlivesOpener: true,
               overrideBrowserWindowOptions: { backgroundColor: '#fdf6e3', // --color-primary-light
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
  })

  win.on('close', () => {
    Profile.stores.state.set('isDevToolsOpened', win.webContents.isDevToolsOpened())
    Profile.stores.state.set('bounds', win.getBounds())
  })

  win.on('resize', () => {
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
        let res

        //d('git describe in ' + appPath)
        res = spawnSync('git', [ 'describe' ], { cwd: appPath, encoding: 'utf-8' })
        if (res.error)
          throw res.error
        version = res.stdout.trim()
        if (version.length == 0)
          throw new Error ('git describe output empty')
        if (version[0] == 'v')
          version = version.slice(1)
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
      _win.webContents.send('clip.new', { text: text })
    }
  }

  setInterval(check, 1 * 1000)
}

function checkDepsWin
() {
  let html, win, opts

  html = 'check-deps.html'

  process.on('uncaughtException', err => {
    console.log(err.message)
    _win.webContents.send('thrown', makeErr(err))
  })

  opts = { backgroundColor: '#fdf6e3', // --color-primary-light
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
    win.webContents.send('devtools', { open: 1 })
  })
  win.webContents.on('devtools-closed', () => {
    win.webContents.send('devtools', { open: 0 })
  })

  return win
}

function checkDeps
(whenHaveDeps) {
  let win

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

  Lsp.make('c')
  Lsp.make('javascript')

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
  let program

  setVersion()

  program = new Commander.Command()

  program
    .option('--skip-init', 'Skip loading of your init.js file')
    .addOption(new Commander.Option('--devtools <state>', 'Initial state of devtools').choices([ 'auto', 'on', 'off' ]).default('auto'))
    .option('--wait-for-devtools', 'Wait for devtools to load before starting. Slower, but useful for debugging startup.')
    .option('--wait', 'Same as --wait-for-devtools.')
    .addOption(new Commander.Option('--backend <name>', 'Editing backend').choices([ 'ace', 'codemirror', 'monaco' ]).default('codemirror'))
    .option('--bounds <spec>', 'Set geometry of window (format: "x,y,width-in-px,height-in-px", default: previous geometry)')
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

  if (Profile.init(options.profile, dirUserData)) {
    app.quit()
    return
  }

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

  app.on('window-all-closed', () => {
    app.quit()
  })

  checkDeps(() => whenHaveDeps(program))
}

app.whenReady().then(whenReady)
