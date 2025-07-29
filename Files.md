# Bred Source Files and Exported Functions

## Core Application Files

### js/main.mjs

Main Electron process entry point that initializes the application window and handles inter-process communication.

**Functions:**
- `version()` - Returns application version
- `os()` - Returns operating system information
- `initPackages(backend, cb)` - Initializes application packages
- `initDoc(devtools)` - Initializes document rendering
- `initMouse()` - Sets up mouse handling
- `makeScratch(p, cb)` - Creates a scratch buffer
- `initCmds()` - Initializes command handlers
- `initSearch(vfind, spec)` - Initializes search functionality
- `initDivSearch()` - Initializes div-based search
- `initBindings()` - Initializes keyboard and mouse bindings
- `initHandlers()` - Sets up event handlers
- `initTest()` - Initializes test buffer functionality
- `initEvalLine()` - Initializes line evaluation
- `initRecent()` - Initializes recent files functionality
- `initFontSize()` - Sets initial font size
- `initDivMode()` - Initializes div mode
- `start1(data, start2)` - Initial startup function
- `start2(devtools, frames)` - Secondary startup function
- `start3(tab)` - Tertiary startup function
- `initShared()` - Initializes shared resources
- `init()` - Main initialization function
- `initNewWindow()` - Initializes a new window

### js/bred.mjs

Main frontend initialization module that sets up the editor environment.

**Functions:**
- `version()` - Returns application version
- `os()` - Returns operating system information
- `initSearch(vfind, spec)` - Initializes search functionality with backend
- `patchModeKey()` - Returns patch mode key
- `makeMlDir(dir)` - Creates directory markup
- `setMlDir(buf, dir)` - Sets buffer directory markup
- `setIcon(buf, css, name, run)` - Sets buffer icon
- `initTheme(theme)` - Initializes editor theme
- `getCTag(name)` - Gets a ctag by name
- `addCTags(file)` - Adds ctags from a file
- `initCTags()` - Initializes ctags
- `initModeFns(mo)` - Initializes mode functions
- `tokenAt(x, y)` - Gets token at coordinates
- `makeDecor(spec)` - Creates a decoration
- `vforLines(view, cb)` - Iterates through lines in a view
- `vwordForward(view, u)` - Moves word forward in a view
- `save(fn, cb)` - Saves a file
- `enable(u, name)` - Enables/disables an option
- `enableBuf(u, name)` - Enables/disables a buffer option
- `init(backend, cb)` - Main initialization function
- `findLang(id)` - Finds a language by ID
- `register(spec)` - Registers a component
- `code(el, langId, text)` - Renders code in an element
- `fill(view, col)` - Fills paragraph to column width

### js/dom.mjs

DOM utility functions for creating and manipulating HTML elements.

**Functions:**
- `create(nodeName, content, classesOrAttrs, attrs)` - Creates an HTML element
- `append(parent, ...args)` - Appends content to a parent element
- `prepend(parent, ...children)` - Prepends content to a parent element
- `div(content, classes, attrs)` - Creates a div element
- `divId(id, content, classes, attrs)` - Creates a div with an ID
- `divCl(classes, content, attrs)` - Creates a div with classes
- `divIdCl(id, classes, content, attrs)` - Creates a div with ID and classes
- `span(content, classes, attrs)` - Creates a span element
- `img(src, alt, classes, attrs)` - Creates an image element
- `button(content, classes, attrs)` - Creates a button element

### js/cmd.mjs

Command system for handling editor commands and key bindings.

**Functions:**
- `init()` - Initializes command system
- `last()` - Returns last executed command
- `lastFlag(name)` - Returns last flag value
- `flagLast(name, val)` - Sets a flag value
- `universal(cmd)` - Gets universal argument multiplier
- `setUniversal()` - Sets universal argument
- `getMo(name, modeKey)` - Gets a command for a mode
- `get(name, buf)` - Gets a command
- `getAll(buf)` - Gets all commands
- `exec(name, buf, universalArg, we, ...args)` - Executes a command
- `run(name, buf, universalArg, we, ...args)` - Runs a command without recording
- `runMo(name, mo, universalArg, we, ...args)` - Runs a command in a mode
- `canon(name)` - Canonicalizes command name
- `add(name, cb, mo)` - Adds a command
- `remove(name)` - Removes a command

### js/mode.mjs

Mode system for different editing modes and contexts.

**Functions:**
- `add(key, spec)` - Adds a new mode
- `remove(key)` - Removes a mode
- `get(key)` - Gets a mode by key
- `getOrAdd(key)` - Gets or adds a mode
- `forEach(cb)` - Iterates through all modes
- `find(cb)` - Finds a mode
- `map(cb)` - Maps over all modes

### js/buf.mjs

Buffer management for handling text documents and their views.

**Functions:**
- `shared()` - Returns shared buffer storage
- `getRing()` - Gets buffer ring
- `capitalize(string)` - Capitalizes a string
- `prepDir(dir)` - Prepares a directory path
- `savePoss()` - Saves buffer positions
- `make(spec)` - Creates a new buffer
- `add(name, modeKey, content, dir, spec)` - Adds a buffer
- `queue(buf)` - Moves buffer to top of ring
- `top(buf)` - Gets top buffer
- `after(buf)` - Gets buffer after specified buffer
- `clear(buf)` - Clears buffer content
- `find(fn)` - Finds a buffer
- `map(fn)` - Maps over buffers
- `filter(fn)` - Filters buffers
- `forEach(fn)` - Iterates through buffers
- `view(buf, spec, cb)` - Creates a buffer view
- `print()` - Prints buffer debug information
- `register(spec)` - Registers buffer-related functionality

## Editor Backend Files

### js/wodemirror.mjs

CodeMirror backend implementation.

**Functions:**
- `version()` - Returns CodeMirror version
- `modeFor(path)` - Determines mode for a file path
- `setValue(ed, text, addToHistory)` - Sets editor value
- `viewFromState(state)` - Gets view from editor state
- `makeDecor(spec)` - Creates a decoration
- `findLang(id)` - Finds a language by ID
- `register(spec)` - Registers a component
- `viewInitSpec(view, spec, cb)` - Initializes view specification
- `viewReopen(view, lineNum, whenReady, cb)` - Reopens a view
- `viewCopy(to, from, lineNum, whenReady, cb)` - Copies a view
- `makeBep(view, row, col)` - Creates a backend position
- `lineAtBep(view, bep)` - Gets line at backend position
- `vsetPos(view, pos, reveal)` - Sets position in view
- `vgetPos(view)` - Gets position from view
- `vsetBepSpec(view, bep, spec)` - Sets backend position with options
- `ensurePointVisible(view)` - Ensures point is visible
- `posRow(pos)` - Gets row from position
- `posCol(pos)` - Gets column from position
- `vgetBep(view)` - Gets backend position
- `bepGt(bep1, bep2)` - Checks if bep1 > bep2
- `bepGtEq(bep1, bep2)` - Checks if bep1 >= bep2
- `bepLt(bep1, bep2)` - Checks if bep1 < bep2
- `bepLtEq(bep1, bep2)` - Checks if bep1 <= bep2
- `bepRow(view, bep)` - Gets row from backend position
- `rowLen(view, row)` - Gets row length
- `bepCol(view, bep)` - Gets column from backend position
- `vgetBepEnd(view)` - Gets end backend position
- `vsetBep(view, bep, reveal, keepSelection)` - Sets backend position
- `vbepIncr(view, bep)` - Increments backend position
- `vbepEq(bep1, bep2)` - Checks if backend positions are equal
- `bepRightOverSpace(view, bep)` - Moves position right over space
- `makeRange(from, to)` - Creates a range
- `rangeEmpty(range)` - Checks if range is empty
- `rangeOrder(range)` - Orders a range
- `rangeStartBep(range)` - Gets start backend position of range
- `rangeEndBep(range)` - Gets end backend position of range
- `textFromRange(view, range)` - Gets text from range
- `vgotoLine(view, num)` - Goes to a line
- `makePsn(view, bep)` - Makes a position object
- `vregion(view)` - Gets current region
- `initModeFns(mo)` - Initializes mode functions
- `vforward(v, u)` - Moves forward in view
- `forward(u)` - Moves forward
- `backward(u)` - Moves backward
- `wordForward(u)` - Moves word forward
- `wordBackward(u)` - Moves word backward
- `groupForward(u)` - Moves group forward
- `groupBackward(u)` - Moves group backward
- `syntaxForward(u)` - Moves syntax forward
- `syntaxBackward(u)` - Moves syntax backward
- `prevLine(v, u)` - Moves to previous line
- `nextLine(v, u)` - Moves to next line
- `prevBoundary(v, u)` - Moves to previous boundary
- `nextBoundary(v, u)` - Moves to next boundary
- `clearSelection(view)` - Clears selection
- `setMark(u)` - Sets a mark
- `activateMark()` - Activates mark
- `exchange()` - Exchanges point and mark
- `lineStart(view)` - Goes to line start
- `lineEnd(view)` - Goes to line end
- `vbufEnd(v)` - Goes to buffer end
- `vbufStart(v)` - Goes to buffer start
- `bufferStart()` - Goes to buffer start
- `bufferEnd()` - Goes to buffer end
- `scrollUp()` - Scrolls up
- `scrollDown()` - Scrolls down
- `toggleOverwrite()` - Toggles overwrite mode
- `selectAll()` - Selects all
- `topLevelStart()` - Goes to top level start
- `topLevelEnd()` - Goes to top level end
- `topOfPane()` - Goes to top of pane
- `bottomOfPane()` - Goes to bottom of pane
- `recenter(view)` - Recenters view
- `cancel()` - Cancels current operation
- `vsaveAs(view, cb)` - Saves as
- `vsave(view, cb)` - Saves view
- `revertV(view, spec)` - Reverts view
- `revert()` - Reverts buffer
- `undo()` - Undoes last action
- `redo()` - Redoes last action
- `vrangeText(view, range)` - Gets text from range
- `setDecorMatch(decorParent, view, range)` - Sets match decoration
- `setDecorAll(decorParent, view, needle)` - Sets all decorations
- `vfind(view, needle, decorParent, opts)` - Finds text
- `vinsertAt(v, bep, u, text, setBep, to)` - Inserts text at position
- `vreplaceAt(view, range, text, more)` - Replaces text at range
- `vreplaceAtAll(view, range, text, more)` - Replaces text at all ranges
- `selfInsert(u, we)` - Self-inserts character
- `quotedInsert(u)` - Inserts quoted character
- `caseWord(cb)` - Cases word
- `capitalizeWord()` - Capitalizes word
- `newline()` - Inserts newline
- `newlineAndIndent()` - Inserts newline and indents
- `insertSlash(u)` - Inserts slash
- `openLine()` - Opens line
- `delPrevChar()` - Deletes previous character
- `delNextChar()` - Deletes next character
- `cutLine()` - Cuts line
- `remove(ed, range)` - Removes text in range
- `vremove(view, range)` - Removes text in view range
- `delNextWordBound(n)` - Deletes next word boundary
- `suggest()` - Shows suggestions
- `nextSuggest()` - Shows next suggestion
- `prevSuggest()` - Shows previous suggestion
- `commentRegion(u)` - Comments/uncomments region
- `indentLine()` - Indents line
- `indentRegion()` - Indents region
- `indentBuffer()` - Indents buffer
- `insertTwoSpaces()` - Inserts two spaces
- `transposeChars()` - Transposes characters
- `trim()` - Trims whitespace
- `yank()` - Yanks text
- `yankRoll()` - Rolls yank
- `cut()` - Cuts selection
- `copy()` - Copies selection
- `openLint()` - Opens lint panel
- `firstDiagnostic(u, we)` - Shows first diagnostic
- `find(st)` - Finds text
- `replace(st, all, search)` - Replaces text
- `vgoXY(view, x, y)` - Goes to X,Y coordinates
- `vtokenAt(view, x, y)` - Gets token at coordinates
- `vforLines(view, cb)` - Iterates through lines
- `clearDecorMatch(view, decorParent)` - Clears match decoration
- `clearDecorAll(view, decorParent)` - Clears all decorations
- `makeSearcher(view)` - Creates searcher
- `initComplete()` - Initializes completion
- `patchModeKey()` - Returns patch mode key
- `addMode(lang, spec)` - Adds a language mode
- `addModes()` - Adds language modes
- `code(el, langId, text)` - Renders code
- `fill(view, col)` - Fills to column
- `flushTrailing()` - Flushes trailing whitespace
- `init()` - Initializes module

### js/ed.mjs

High-level editor functionality and utilities.

**Functions:**
- `divMl(dir, name, opts)` - Creates markup language element
- `divW(dir, name, opts)` - Creates editor wrapper
- `makePos(row, col)` - Creates a position object
- `posRowDecr(pos)` - Decrements position row
- `posRowIncr(pos)` - Increments position row
- `themeExtension()` - Gets theme extension
- `langs()` - Gets available languages
- `make(p, spec, cb)` - Makes an editor instance
- `charForInsert(we)` - Gets character for insertion
- `mtypeFromExt(ext)` - Gets MIME type from extension
- `supports(mtype)` - Checks if MIME type is supported
- `supportsExt(ext)` - Checks if extension is supported
- `escapeForRe(s)` - Escapes string for regex
- `initComplete()` - Initializes completion
- `initFlushLines(mo)` - Initializes flush lines
- `initGotoLine(mo)` - Initializes goto line
- `initQR(mo)` - Initializes query replace
- `initSearch(mo)` - Initializes search
- `patchModeKey()` - Gets patch mode key
- `makeMlDir(dir)` - Makes markup language directory
- `setMlDir(buf, dir)` - Sets markup language directory
- `setIcon(buf, css, name, run)` - Sets buffer icon
- `initTheme(theme)` - Initializes theme
- `setBackend(be, cb)` - Sets editor backend
- `getCTag(name)` - Gets ctag by name
- `addCTags(file)` - Adds ctags from file
- `initCTags()` - Initializes ctags
- `initModeFns(mo)` - Initializes mode functions
- `tokenAt(x, y)` - Gets token at coordinates
- `makeDecor(spec)` - Makes decoration
- `vforLines(view, cb)` - Iterates through lines
- `vwordForward(view, u)` - Moves word forward
- `save(fn, cb)` - Saves file
- `enable(u, name)` - Enables option
- `enableBuf(u, name)` - Enables buffer option
- `init(backend, cb)` - Initializes editor
- `findLang(id)` - Finds language by ID
- `register(spec)` - Registers component
- `code(el, langId, text)` - Displays code
- `fill(view, col)` - Fills paragraph
- `onCursor(cb)` - Adds cursor callback

## Utility Files

### js/dom.mjs

DOM manipulation utilities (described above)

### js/mess.mjs

Messaging system for displaying messages to the user.

**Functions:**
- `log(...args)` - Logs a message
- `say(...args)` - Displays a message
- `warn(...args)` - Displays a warning
- `yell(...args)` - Displays an error
- `echo(...args)` - Echoes a message
- `echoMore(...args)` - Echoes additional message
- `trace(...args)` - Logs a trace

### js/css.mjs

CSS manipulation utilities.

**Functions:**
- `add(ele, classes)` - Adds classes to element
- `remove(ele, classes)` - Removes classes from element
- `toggle(ele, classes)` - Toggles classes on element
- `has(ele, classes)` - Checks if element has classes
- `enable(ele)` - Enables element
- `disable(ele)` - Disables element
- `show(ele)` - Shows element
- `hide(ele)` - Hides element
- `expand(ele)` - Expands element
- `retract(ele)` - Retracts element
- `initCss(cb)` - Initializes CSS

### Other Notable Files

1. **js/preload.js** - Electron preload script for secure context isolation
2. **js/main-file.mjs** - File operation handlers in main process
3. **js/main-dir.mjs** - Directory operation handlers in main process
4. **js/main-browse.mjs** - File browser functionality
5. **js/main-lsp.mjs** - Language Server Protocol integration
6. **js/main-shell.mjs** - Shell command execution
7. **js/opt.mjs** - Option and configuration management
8. **js/pane.mjs** - Pane management and layout
9. **js/tab.mjs** - Tab management and navigation
10. **js/win.mjs** - Window management

These files contain various utility functions and specialized functionality but were not fully documented here due to length constraints. Each typically exports functions related to their specific domain such as file operations, directory management, LSP integration, shell commands, option handling, pane management, tab navigation, and window operations.