import { app, clipboard as Clipboard, WebContentsView, BrowserWindow, ipcMain, shell as Shell /*, protocol, net*/ } from 'electron'
import CheckDeps from './lib/check-dependencies.cjs'
import * as Chmod from './main-chmod.mjs'
import { d, log } from './main-log.mjs'
import { makeErr, errMsg } from './main-err.mjs'
import Path from 'node:path'
import * as Peer from './main-peer.mjs'
import process from 'node:process'
import fs from 'node:fs'
import Store from 'electron-store'
import Util from 'node:util'
import { fork, spawn, spawnSync } from 'node:child_process'
import * as Commander from 'commander'
import * as Pty from 'node-pty'

let version, options, stores, dirUserData, lsp, shell, lastClipWrite

function lspMake
() {
  let lsp, initialized, buffer // u8
  let clen // in bytes
  let capabilities, valueSet
  let files, tsproc, encoder, decoder, bcl, crnlLen, codeCr, codeNl

  function dbg
  (msg) {
    if (0)
      log(msg)
  }

  function bconcat
  (b1, b2) {
    let b3

    b3 = new (b1.constructor)(b1.length + b2.length)
    b3.set(b1, 0)
    b3.set(b2, b1.length)
    return b3
  }

  function bstartsWith
  (b1, b2) {
    if (b1.length >= b2.length) {
      for (let i = 0; i < b2.length; i++) {
        if (b1.at(i) == b2.at(i))
          continue
        return 0
      }
      return 1
    }
    return 0
  }

  function _req
  (json) {
    let str, full

    str = JSON.stringify({ jsonrpc: '2.0',
                           ...json })

    full = 'Content-Length: ' + str.length + '\r\n\r\n' + str

    if (1) {
      d('REQUEST: [' + full + ']')
      tsproc.stdin.write(full)
    }
  }

  function initialize
  () {
    _req({ method: 'initialize',
           id: 1,
           params: { processId: -1,
                     capabilities: capabilities,
                     rootPath: '.',
                     rootUri: null,
                     //rootUri: 'file://' + dir,
                     //workspaceFolders: workspaceFolders,
                     initializationOptions: { tsserver: { logDirectory: '/tmp/',
                                                          logVerbosity: 'verbose',
                                                          trace: 'off' } }, // off/messages/verbose delivered through LSP messages
                     trace: 'verbose' } })
  }

  function req
  (json) {
    if (initialized)
      _req(json)
  }

  function open
  (file, language, text) { // absolute
    if (initialized) {
      if (files.includes(file))
        return
      req({ method: 'textDocument/didOpen',
            params: { textDocument: { uri: 'file://' + file,
                                      // ids listed under interface here
                                      // https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocumentItem
                                      languageId: language,
                                      version: 0,
                                      text: text } } })
      files.push(file)
    }
  }

  function parse
  () {
    dbg('PARSE')
    while (1) {
      if (bstartsWith(buffer, bcl)) {
        let crI

        // Content-Length: ...\r\n
        dbg('STARTSWITH: cl')
        crI = buffer.indexOf(codeCr)
        if (crI > 0) {
          let nlI

          dbg('FOUND: cr')
          nlI = buffer.indexOf(codeNl)
          if (nlI == crI + 1) {
            let bnum

            dbg('FOUND: nl')
            bnum = buffer.slice(bcl.length, crI)
            //d(sl)
            if (bnum.length) {
              clen = parseInt(decoder.decode(bnum))
              dbg('CLEN: ' + clen + ' bytes')
              buffer = buffer.slice(nlI + 1)
            }
          }
        }
      }

      if ((buffer.length >= 2)
          && (buffer.at(0) == codeCr)
          && (buffer.at(1) == codeNl)) {
        // empty line between Content-Length: and content.
        buffer = buffer.slice(crnlLen)
        if (0)
          dbg('BETWEEN: ' + buffer)
      }

      if (clen && buffer.length && (buffer.length >= clen)) {
        let str, json

        //d(clen)
        //d('[' + decoder.decode(buffer) + ']')
        str = decoder.decode(buffer.slice(0, clen))
        //d('JSON.parse: ' + str)
        try {
          json = JSON.parse(str)
        }
        catch (err) {
          console.error('JSON.parse: ' + err.message)
        }
        dbg('RESPONSE:')
        //d('  id: ' + json.id)
        // if id call any handler
        dbg(JSON.stringify(json, null, 2))
        if (json.id == 1) {
          if (json.error) {
            console.error('LSP: initialize FAILED: ' + json.error.message)
            return
          }
          dbg('INITIALIZED')
          initialized = 1
        }
        else if (lsp.win)
          lsp.win.webContents.send('lsp', { response: json })
        else
          console.error('MISSING: lsp.win')
        buffer = buffer.slice(clen)
        clen = undefined
      }
      else
        break
    }
  }

  files = []

  valueSet = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25 ]

  capabilities = { textDocument: { synchronization: { dynamicRegistration: true },
                                   completion: { completionItem: { commitCharactersSupport: false,
                                                                   documentationFormat: [ 'markdown', 'plaintext' ],
                                                                   snippetSupport: false },
                                                 completionItemKind: { valueSet: valueSet },
                                                 contextSupport: true,
                                                 dynamicRegistration: false } } }

  lsp = { open,
          req }

  tsproc = fork(Path.join(import.meta.dirname,
                          'lib/typescript-language-server/lib/cli.mjs'),
                [ '--stdio', '--log-level', '4' ],
                { cwd: import.meta.dirname,
                  stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ] })

  tsproc.on('exit', code => log('EXIT ' + code))
  tsproc.on('error', code => log('ERROR ' + code))
  tsproc.stdout && tsproc.stdout.setEncoding('utf-8')

  tsproc.stdout.on('data',
                   data => {
                     dbg('DATA: [' + data + ']')
                     buffer = bconcat(buffer, encoder.encode(data))
                     dbg('BUFFER: [' + decoder.decode(buffer) + ']')

                     parse()
                   })

  tsproc.stderr.on('data',
                   data => {
                     log('STDERR: ')
                     process.stderr.write(data)
                   })

  encoder = new TextEncoder()
  decoder = new TextDecoder()

  buffer = encoder.encode('')
  bcl = encoder.encode('Content-Length: ')
  crnlLen = encoder.encode('\r\n').length
  codeCr = '\r'.charCodeAt(0)
  codeNl = '\n'.charCodeAt(0)

  initialize()

  return lsp
}

function getStore
(name) {
  if (name == 'frame')
    return stores.frame
  if (name == 'poss')
    return stores.poss
  if (name == 'state')
    return stores.state
  return new Store({ name: name, cwd: 'brood' })
}

function onBroodGet
(e, file, name) {
  let s

  s = getStore(file)
  return { data: s.get(name) }
}

function onBroodLoad
(e, ch, name) {
  let s

  s = getStore(name)
  e.sender.send(ch, { data: s.store })
}

function onBroodSave
(e, ch, args) {
  let s

  s = getStore(args[0])
  args[1].forEach(a => {
    s.set(a[0], a[1])
  })
  return {}
}

function onBroodSet
(e, file, name, value) {
  let s

  s = getStore(file)
  s.set(name, value)
  return {}
}

function onBrowse
(e, ch, onArgs) {
  const [ x, y, width, height, page ] = onArgs
  let view, win

  view = new WebContentsView()
  win = BrowserWindow.fromWebContents(e.sender)
  view.webContents.on('context-menu', () => {
    d('context-menu')
    //win.webContents.sendInputEvent({ type: 'contextMenu', x: 0, y: 0 })
    win.webContents.sendInputEvent({ type: 'mouseDown', x: 0, y: 0, button: 'left', clickCount: 1 })
  })
  view.webContents.on('input-event', (event, input) => {
    //d('input-event')
    //d(input.type)
    if ((input.type == 'keyDown') || (input.type == 'rawKeyDown')) {
      d(input.type)
      d(e.key)
    }
    if (input.type == 'mouseDown') {
      d('mouseDown')
      d(event.button)
      d(JSON.stringify(event))
    }
    if ((input.type == 'contextMenu')
        || ((input.type == 'mouseDown') && (event.button == 2)))
      d('context')
  })
  view.webContents.loadURL(page)
  win.contentView.addChildView(view)
  view.setBounds({ x: x, y: y, width: width, height: height }) // safeDialogs, autoplayPolicy, navigateOnDragDrop, spellcheck
  view.setBackgroundColor('white')
  //view.setAutoResize({ width: true, height: true })

  ipcMain.on(ch, (e, x, y, width, height) => {
    // using d messed up values
    //view.setBounds({ x: d.x, y: d.y, width: d.width, height: d.height })
    view.setBounds({ x: x, y: y, width: width, height: height })
  })

  e.sender.send(ch, {})
}

function mandatoryExt
(name) {
  return [ 'core', 'ed' ].includes(name)
}

function onExtAdd
(e, ch, onArgs) {
  let [ name ] = onArgs
  let res, flag, dir

  function add
  () {
    flag = Path.join(dir, '.ADDED')
    fs.open(flag, 'a', (err, fd) => {
      if (err) {
        e.sender.send(ch, makeErr(err))
        return
      }
      fs.close(fd, err => {
        if (err)
          e.sender.send(ch, makeErr(err))
        else
          e.sender.send(ch, {})
      })
    })
  }

  if (mandatoryExt(name)) {
    e.sender.send(ch, errMsg("That's a mandatory extension"))
    return
  }

  dir = Path.join(app.getAppPath(), 'ext', name)

  flag = Path.join(dir, '.READY')
  fs.access(flag, fs.constants.F_OK, err => {
    if (err) {
      res = spawn('npm', [ 'install' ], { cwd: dir, encoding: 'utf-8' })
      if (res.error)
        throw res.error
      res.on('close', code => {
        if (code)
          e.sender.send(ch, errMsg('npm install failed: ' + code))
        else
          add()
      })
      return
    }
    // already installed
    add()
  })

  return ch
}

function onExtRemove
(e, ch, onArgs) {
  let [ name ] = onArgs
  let flag

  if (mandatoryExt(name)) {
    e.sender.send(ch, errMsg("That's a mandatory extension"))
    return
  }
  flag = Path.join(app.getAppPath(), 'ext', name, '.ADDED')
  fs.unlinkSync(flag)
  e.sender.send(ch, {})
}

function onExtAll
(e, ch) {
  let dir

  function isDir
  (stat) {
    if (stat.mode & (1 << 15))
      return 0
    return 1
  }

  function added
  (dir, name) {
    if (mandatoryExt(name))
      return 1
    if (fs.statSync(Path.join(dir, name, '.ADDED'),
                    { throwIfNoEntry: false }))
      return 1
    return 0
  }

  dir = Path.join(app.getAppPath(), 'ext')
  fs.readdir(dir, {}, (err, data) => {
    let exts

    if (err) {
      e.sender.send(ch, { err: err })
      return
    }

    exts = []
    data.forEach(name => {
      let stat

      stat = fs.statSync(Path.join(dir, name),
                         { throwIfNoEntry: false })
      if (stat && isDir(stat))
        exts.push({ name: name,
                    mandatory: mandatoryExt(name),
                    added: added(dir, name) })
    })
    e.sender.send(ch, { exts: exts })
  })
}

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

function onLspReq
(e, ch, onArgs) {
  let [ method, id, params ] = onArgs

  setTimeout(() => lsp.req({ method: method,
                             ...(id ? { id: id } : {}),
                             params: params }))

  return {}
}

function onPaths
(e) {
  let home, user, win, frame

  frame = stores.frame

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

function onShell
(e, ch, onArgs) {
  let proc, closedProc, closedErr, closedOut, sender
  let [ clientCh, dir, sc, args, runInShell, multi ] = onArgs

  function close
  () {
    if (closedProc && closedErr && closedOut) {
      //ipcMain.removeAllListeners(ch)
    }
  }

  ch = clientCh
  sender = e.sender

  try {
    let env

    if (runInShell) {
      if (multi)
        args = [ '-i' ]
      else
        args = [ '--init-file', app.getAppPath() + '/etc/single.bashrc', '-i' ]
      runInShell = sc
      //d('runInShell: ' + runInShell)
      sc = shell
    }

    env = {}
    // prevent: nvm is not compatible with the "npm_config_prefix" environment variable...
    Object.entries(process.env).forEach(kv => {
      if (kv[0].startsWith('npm_'))
        return
      env[kv[0]] = kv[1].slice(0)
    })
    env.EMACS = 't' // turns off line editing in bash
    env.TERM = 'dumb'
    //env.TERM = 'xterm'
    //env.TERM = 'xterm-256color'
    //env.COLORTERM = 'truecolor'

    //d(JSON.stringify(env, null, 2))
    d('spawn ' + sc + ' [' + args + '] in ' + dir)
    //process.stdin.setRawMode(true)
    // could be useful: const cwd = await fs.promises.readlink(`/proc/${this.#realPty.pid}/cwd`, {encoding: "utf8"})
    proc = Pty.spawn(sc, args, { cwd: dir,
                                 cols: 10000,
                                 rows: 10000,
                                 env: env,
                                 encoding: null })

    /// raw mode to prevent echo of input (bred already put the input in the buf)
    // https://github.com/Microsoft/node-pty/issues/78#issuecomment-1867116455
    //proc.write(`stty -F ${proc.ptsName} raw -echo\n`)
    // https://github.com/Microsoft/node-pty/issues/78#issuecomment-297550361
    {
      let tty, TtyWrap

      //d(proc.ptsName)
      //d(proc.fd)
      TtyWrap = process.binding('tty_wrap')
      tty = new TtyWrap.TTY(proc.fd, true)
      //d('tty.isTTY: ' + tty.isTTY)
      if (1) { // (TtyWrap.IsTTY(tty)) { // (tty.isTTY)
        0 && d('setRawMode')
        tty.setRawMode(true)
      }
    }

    if (multi) {
      // want the prompt string
    }
    else
      // happens too late, need to somehow set it in .bashrc (now done in single.bashrc above)
      proc.write('export PS1=""\n')

    if (runInShell)
      if (multi) {
        if (runInShell.length)
          proc.write(runInShell + '\n')
      }
      else
        proc.write(runInShell + ' && exit 2>/dev/null || exit 2>/dev/null\n')

    proc.onData(data => {
      d(`${ch}: data: ${data}`)
      sender.send(ch, { stdout: data })
      closedOut = 1
      close()
    })

    proc.onExit(ret => {
      d(`${ch}: child process exited with code ${ret.exitCode}`)
      sender.send(ch, { close: 1, code: ret.exitCode })
      closedProc = 1
      close()
    })

    ipcMain.on(ch, (e, data) => {
      d(ch + ': on: ' + JSON.stringify(data))
      if (data.input && data.input.length)
        proc.write(data.input)
      process.kill(proc.pid, 'SIGHUP')
    })
  }
  catch (err) {
    d(`${ch}: child process caught err ${err}`)
    sender.send(ch, { err: err })
  }
}

function onShellOpen
(e, ch, onArgs) {
  let [ url ] = onArgs

  Shell.openExternal(url)
}

function onDirGet
(e, ch, dir) {
  function stat
  (path) {
    let st

    st = fs.lstatSync(path,
                      { throwIfNoEntry: false })
    if (st)
      st.link = st.isSymbolicLink()
    return st
  }

  function ok
  (data) {
    e.sender.send(ch, { data: data.map(f => ({ name: f,
                                               bak: f && f.endsWith('~'),
                                               hidden: f && f.startsWith('.'),
                                               stat: stat(Path.join(dir, f)) })) })
  }

  fs.readdir(dir, {}, (err, data) => {
    if (err)
      if (err.code === 'ENOTDIR') {
        dir = Path.dirname(dir)
        fs.readdir(dir, {}, (err, data) => {
          if (err)
            e.sender.send(ch, { err: err })
          else
            ok(data)
        })
      }
      else
        e.sender.send(ch, { err: err })

    else
      ok(data)
  })
}

function onDirMake
(e, ch, dir) {
  // mode will be 0777 (drwxrwxrwx)
  fs.mkdir(dir, { recursive: true }, err => {
    if (err)
      e.sender.send(ch, { err: err })
    else
      e.sender.send(ch, {})
  })
}

function onDirRm
(e, ch, onArgs) {
  let [ path ] = onArgs

  if (path.startsWith('/'))
    fs.rmdir(path, err => {
      if (err) {
        e.sender.send(ch, makeErr(err))
        return
      }
      e.sender.send(ch, {})
    })
  else
    e.sender.send(ch, errMsg('Path must be absolute'))
}

function onDirWatch
(e, ch, onArgs) {
  let [ path ] = onArgs
  let watcher

  function handle
  (type, name) {
    try {
      //d('--- handle ---')
      //d('type: ' + type)
      //d('name: ' + name)
      e.sender.send(ch,
                    { type: type,
                      bak: name.endsWith('~'),
                      hidden: Path.basename(name).startsWith('.'),
                      name: name })
    }
    catch (err) {
      err.message.includes('Object has been destroyed')
        || log(err.message)
      watcher.close()
    }
  }

  if (path.startsWith('/'))
    watcher = fs.watch(path, { recursive: false }, handle)
  else
    e.sender.send(ch, errMsg('Path must be absolute'))
}

function onFileCp
(e, ch, onArgs) {
  let [ from, to ] = onArgs

  if (from.startsWith('/') && to.startsWith('/')) {
    fs.copyFile(from, to, 0, err => {
      if (err)
        e.sender.send(ch, makeErr(err))
      else
        e.sender.send(ch, {})
    })
    return
  }
  e.sender.send(ch, errMsg('Paths must be absolute'))
}

function onFileExists
(e, ch, onArgs) {
  let path

  path = onArgs
  e.sender.send(ch, { exists: fs.existsSync(path) })
}

async function wrapOn
(e, ch, onArgs, cb) {
  setTimeout(async () => {
    try {
      await cb(e, ch, onArgs)
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

function onFileGet
(e, ch, onArgs) {
  let path

  path = onArgs
  fs.readFile(path, 'utf8', (err, data) => {
    if (err)
      e.sender.send(ch, { err: err })
    else {
      lsp.open(path, 'javascript', data)
      e.sender.send(ch, { data: data,
                          stat: fs.statSync(path, { throwIfNoEntry: false }),
                          realpath: fs.realpathSync(path) })
    }
  })
}

function onFileLn
(e, ch, onArgs) {
  let cwd, dir, absFrom, dbg, targetFile, fromFile
  let from, target

  function link
  (chdir) {
    if (fs.statSync(from, { throwIfNoEntry: false })) {
      e.sender.send(ch, errMsg('File exists: ' + from))
      return
    }
    dbg('fs.symlink: ' + target + ' <- ' + from)
    fs.symlink(target,
               from,
               err => {
                 try {
                   let ret

                   ret = { ...(err ? makeErr(err) : {}),
                           cwd: process.cwd(),
                           from: from,
                           target: target,
                           absFrom: Path.join(cwd, from),
                           absTarget: Path.join(cwd, target) }
                   e.sender.send(ch, ret)
                 }
                 finally {
                   if (chdir)
                     process.chdir(chdir)
                 }
               })
  }

  // args
  //
  // ln -s target from
  //
  // the file pointed to by the symlink.
  // absolute.
  target = onArgs[0]
  // the symlink (a file that contains the target pathname).
  // absolute, or relative to target dirname
  // if ends in / takes filename of target.
  // same if basename is '..'.
  from = onArgs[1]

  dbg = () => {}
  //dbg = d
  dbg('from: ' + from)
  dbg('target: ' + target)

  // check target
  //

  if (target.startsWith('/')) {
    // ok
  }
  else {
    e.sender.send(ch, errMsg('Target path must be absolute'))
    return
  }

  // check from
  //

  fromFile = Path.basename(from)
  dbg('fromFile: ' + fromFile)

  if (fromFile == '.') {
    e.sender.send(ch, errMsg('Link to self'))
    return
  }

  targetFile = Path.basename(target)
  dbg('targetFile: ' + targetFile)

  // .. ⎘ t becomes ../t ⎘ t
  if (fromFile == '..')
    from += '/'
  // x/ ⎘ t becomes x/t ⎘ t
  if (from.endsWith('/'))
    from = Path.join(from, targetFile)

  // store the current dir (for logging and may chdir)
  //

  cwd = process.cwd()

  // absolute from
  //

  if (from.startsWith('/')) {
    link()
    return
  }

  // relative from, need to change dir
  //

  if (from.startsWith('./')
      || from.startsWith('../')) {
    // safe
  }
  else
    from = './' + from

  // change into the link dir
  dbg('from: ' + from)
  absFrom = Path.join(Path.dirname(target), from)
  dbg('absFrom: ' + absFrom)
  dir = Path.dirname(absFrom)
  dbg('dir: ' + dir)
  process.chdir(dir)
  dbg('temp cwd: ' + process.cwd())

  // make from just the file name (this is simplest)
  from = Path.basename(absFrom)
  dbg('new from: ' + from)

  // get the target path relative to the link dir (kind of the inverse of arg 'from')
  target = Path.relative(dir, target)
  dbg('new target: ' + target)
  //target = './' + Path.basename(target)

  // create link, passing flag to revert dir
  link(cwd)
}

function onFileMv
(e, ch, onArgs) {
  let [ from, to ] = onArgs

  if (from.startsWith('/') && to.startsWith('/')) {
    if (fs.statSync(to, { throwIfNoEntry: false })) {
      e.sender.send(ch, errMsg('File exists'))
      return
    }
    fs.renameSync(from, to)
    e.sender.send(ch, {})
    return
  }
  e.sender.send(ch, errMsg('Paths must be absolute'))
}

function onFileRm
(e, ch, onArgs) {
  let [ path ] = onArgs

  if (path.startsWith('/'))
    fs.unlink(path, err => {
      if (err) {
        e.sender.send(ch, makeErr(err))
        return
      }
      e.sender.send(ch, {})
    })
  else
    e.sender.send(ch, errMsg('Path must be absolute'))
}

function onFileSave
(e, ch, onArgs) {
  let [ path, text ] = onArgs

  fs.writeFile(path, text, { encoding: 'utf8' }, err => {
    if (err)
      e.sender.send(ch, { err: err })
    else
      e.sender.send(ch, { stat: fs.statSync(path, { throwIfNoEntry: false }) })
  })
}

function onFileStat
(e, ch, onArgs) {
  fs.lstat(onArgs, (err, data) => {
    if (err)
      e.sender.send(ch, { err: { message: err.message,
                                 code: err.code } })
    else if (data.isSymbolicLink())
      fs.readlink(onArgs, (err, string) => {
        if (err)
          e.sender.send(ch, { err: err })
        else {
          let dest

          dest = Path.join(Path.dirname(onArgs), string)
          fs.stat(dest, (err, data) => {
            if (err)
              e.sender.send(ch, { err: err })
            else
              e.sender.send(ch, { data: data,
                                  link: 1,
                                  dest: dest })
          })
        }
      })
    else
      e.sender.send(ch, { data: data })
  })
}

function onFileTouch
(e, ch, onArgs) {
  let now, paths

  now = new Date()
  paths = onArgs
  for (let i = 0; i < paths.length; i++)
    if (paths[i].startsWith('/'))
      fs.utimesSync(paths[i], now, now)
    else {
      e.sender.send(ch, errMsg('Path must be absolute: ' + paths[i]))
      return
    }
  e.sender.send(ch, {})
}

function onFileWatch
(e, ch, onArgs) {
  let [ path ] = onArgs
  let watcher

  function handle
  (type, name) {
    try {
      //d('--- handle ---')
      //d('type: ' + type)
      //d('name: ' + name)
      e.sender.send(ch,
                    { type: type,
                      name: name,
                      stat: fs.statSync(path, { throwIfNoEntry: false }) })
    }
    catch (err) {
      err.message.includes('Object has been destroyed')
        || log(err.message)
      watcher.close()
    }
  }

  if (path.startsWith('/'))
    watcher = fs.watch(path, { recursive: false }, handle)
  else
    e.sender.send(ch, errMsg('Path must be absolute'))
}

function quit
() {
  try {
    app.quit()
  }
  catch (err) {
    console.log(err.message)
    lsp.win.webContents.send('thrown', makeErr(err))
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
    return onBroodGet(e, args[0], args[1])

  if (name == 'brood.load')
    return wrapOn(e, ch, args, onBroodLoad)

  if (name == 'brood.save')
    return onBroodSave(e, ch, args)

  if (name == 'brood.set')
    return onBroodSet(e, args[0], args[1], args[2])

  if (name == 'browse')
    return wrapOn(e, ch, args, onBrowse)

  if (name == 'dir.get')
    return wrapOn(e, ch, args, onDirGet)

  if (name == 'dir.make')
    return wrapOn(e, ch, args, onDirMake)

  if (name == 'dir.rm')
    return wrapOn(e, ch, args, onDirRm)

  if (name == 'dir.watch')
    return wrapOn(e, ch, args, onDirWatch)

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
    return wrapOn(e, ch, args, onExtAdd)

  if (name == 'ext.all')
    return wrapOn(e, ch, args, onExtAll)

  if (name == 'ext.remove')
    return wrapOn(e, ch, args, onExtRemove)

  if (name == 'init.load')
    return wrapOn(e, ch, [], onLoadInit)

  if (name == 'lsp.req')
    return onLspReq(e, ch, args)

  if (name == 'paths')
    return onPaths(e)

  if (name == 'clip.select')
    return cmdClipSelect(e, ch, args)

  if (name == 'clip.write')
    return cmdClipWrite(e, ch, args)

  if (name == 'shell')
    return wrapOn(e, args[0] /* clientCh */, args, onShell)

  if (name == 'shell.open')
    return wrapOn(e, ch, args, onShellOpen)

  if (name == 'quit') {
    quit()
    return ch
  }

  if (name == 'restart') {
    app.relaunch()
    quit()
    return ch
  }

  if (name == 'file.chmod')
    return wrapOn(e, ch, args, Chmod.onFileChmod)

  if (name == 'file.cp')
    return wrapOn(e, ch, args, onFileCp)

  if (name == 'file.exists')
    return wrapOn(e, ch, args, onFileExists)

  if (name == 'file.get')
    return wrapOn(e, ch, args, onFileGet)

  if (name == 'file.ln')
    return wrapOn(e, ch, args, onFileLn)

  if (name == 'file.mv')
    return wrapOn(e, ch, args, onFileMv)

  if (name == 'file.rm')
    return wrapOn(e, ch, args, onFileRm)

  if (name == 'file.save')
    return wrapOn(e, ch, args, onFileSave)

  if (name == 'file.stat')
    return wrapOn(e, ch, args, onFileStat)

  if (name == 'file.touch')
    return wrapOn(e, ch, args, onFileTouch)

  if (name == 'file.watch')
    return wrapOn(e, ch, args, onFileWatch)

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

  win.setBounds(options.bounds || stores.state.get('bounds'))

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

    bounds = stores.state.get('bounds')
    bounds.x = 0
    bounds.y = 0
    ch.removeMenu()
    ch.webContents.openDevTools({ activate: 0, // keeps main focus when detached
                                  title: 'Developer Tools - Bred' })
    ch.setBounds(bounds)
  })

  win.on('close', () => {
    stores.state.set('isDevToolsOpened', win.webContents.isDevToolsOpened())
    stores.state.set('bounds', win.getBounds())
  })

  win.on('resize', () => {
    stores.state.set('bounds', win.getBounds())
  })

  if ((options.devtools == 'on')
      || ((options.devtools == 'auto') && stores.state.get('isDevToolsOpened'))) {
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
    stores.state.set('isDevToolsOpened', 1)
    win.webContents.send('devtools', { open: 1 })
  })
  win.webContents.on('devtools-closed', () => {
    stores.state.set('isDevToolsOpened', 0)
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

  lsp.win = createWindow(html)

  process.on('uncaughtException', err => {
    console.log(err.message)
    lsp.win.webContents.send('thrown', makeErr(err))
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
      lsp.win.webContents.send('clip.new', { text: text })
    }
  }

  setInterval(check, 1 * 1000)
}

function checkDepsRelaunch
() {
  d('cdr')
  app.relaunch()
  quit()
}

function checkDeps
() {
  let output

  d('Checking dependencies...')
  output = CheckDeps.sync({ install: true,
                            verbose: true })
  if (output.status) {
    d('Checking dependencies... ERR')
    return 1
  }
  if (output.installWasNeeded) {
    d('Checking dependencies... installed, restarting')
    checkDepsRelaunch()
    return 1
  }
  d('Checking dependencies... OK')
  return 1
}

// attempt to speed up load using Cache-Control. seems the same.
//protocol.registerSchemesAsPrivileged([ { scheme: 'bf',
//                                         privileges: { bypassCSP: true } } ])

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
    .option('--disable-setuid-sandbox', 'Turn off UID sandboxing (eg if you want to run sudo)')
    .version(version)
    .parse()

  options = program.opts()
  if (options.wait)
    options.waitForDevtools = true

  shell = process.env.SHELL || 'sh'

  if (options.logfile) {
    let file

    d('logging to ' + options.logfile)
    fs.mkdirSync(Path.dirname(options.logfile),
                 { recursive: true,
                   mode: 0o777 }) // drwxrwxrwx
    file = fs.createWriteStream(options.logfile,
                                { flags: 'w',
                                  flush: true })
    log = d => {
      file.write(Util.format(d) + '\n')
    }
  }
  else
    d('logging to stdout')

  if (checkDeps())
    return

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

  lsp = lspMake()

  stores = { frame: new Store({ name: 'frame', cwd: 'brood' }),
             poss: new Store({ name: 'poss', cwd: 'brood' }),
             state: new Store({ name: 'state', cwd: 'brood' }) }

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

  try {
    dirUserData = app.getPath('userData')
  }
  catch (err) {
    console.warn('failed to get userData: ' + err.message)
  }

  d('creating window')
  createMainWindow()

  d('setting up clipboard watcher')
  watchClip()

  d('setting app handlers')

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createMainWindow()
  })
}

app.whenReady().then(whenReady)
