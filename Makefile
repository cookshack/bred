run:
	npm start

check:
	npm run --silent check

format:
	npm run format

fix-node-pty:
	npx electron-rebuild -f -w node-pty

fix-sqlite3:
	npx electron-rebuild -f -w better-sqlite3

prep: version-sqlite fix-others fix-ace fix-monaco fix-codemirror prep-mime
	rm -f lib/callsites.js
	cp -r node_modules/callsites/index.js lib/callsites.mjs
	npx peggy --format es -o lib/ev-parser.mjs lib/ev.pegjs
	npm run prepare

prep-mime:
	rm -f lib/mime.json
	echo \{\} > lib/mime-by-ext.json
	cp -r node_modules/mime-db/db.json lib/mime.json
	npm run mime

fix-main:
	cd lib/monaco/ && sed -i "s/\(import\|export\) \(.*\)';/\\1 \\2.js';/g" vs/editor/editor.main.js

# must run before fix-monaco so sync-monaco first to test it alone
fix-css:
#	cd lib/monaco/ && find . -type f -name \*.js | xargs grep "import .*\\.css" | sed "s;\\./\(.\+\)/.*:import '\\.\(.*\).css'.*;<link rel=\"stylesheet\" type=\"text/css\" href=\"lib/monaco/\1\2.css\"\/>;g" #> ../css.html
	echo export let sheets = \[ > lib/sheets.mjs
	cd lib/monaco/ && find . -type f -name \*.js | xargs grep "import .*\\.css" | sed "s;\\./\(.\+\)/.*:import '\\.\(.*\).css'.*;'lib/monaco/\1\2.css',;g" >> ../sheets.mjs
	echo \] >> lib/sheets.mjs

version-sqlite:
	echo -n '{ "version": "' > lib/sqlite.json
	grep -m 1 -oE 'version ([0-9]+\.[0-9]+\.[0-9]+)' node_modules/better-sqlite3/deps/sqlite3/sqlite3.c | cut -d' ' -f2- | tr -d '\n' >> lib/sqlite.json
	echo '" }' >> lib/sqlite.json

version-ace:
	echo -n '{ "version": "' > lib/ace/version.json
	(cd node_modules/ace-builds && node -p "require('./package.json').version") | tr -d '\n' >> lib/ace/version.json
	echo '" }' >> lib/ace/version.json

fix-ace: sync-ace version-ace

version-codemirror:
	echo -n '{ "version": "' > lib/@codemirror/version.json
	(cd node_modules/@codemirror/state && node -p "require('./package.json').version") | tr -d '\n' >> lib/@codemirror/version.json
	echo '" }' >> lib/@codemirror/version.json

patch-codemirror:
	cd lib/ && for P in codemirror-patches/*.patch; do echo "  $$P"; cat $$P | patch --ignore-whitespace -p 0; done

fix-codemirror: sync-codemirror patch-codemirror version-codemirror
	npx webpack --config ./pack/webpack-orga.config.cjs
	bin/fix-scope cookshack
	bin/fix-scope codemirror
	bin/fix-scope codemirror/legacy-modes/mode
	cd lib/@codemirror/ && find . -type f -name language-data.js | xargs sed -i "s/import('\([^']*\)')/import\('..\/\\1.js'\)/g"
	cd lib/@codemirror/ && echo 'let bredHackImport = (x) => x.replace(/^(.*)$$/, "../$$1.js")' >> language-data.js
	cd lib/@codemirror/ && sed -i "s/import(\([^)]\+[^\"']\))/import(bredHackImport(\\1))/g" language-data.js
	bin/fix-scope kittycad
	bin/fix-scope lezer
	bin/fix-scope marijn
	bin/fix-scope replit
	bin/fix-scope valtown
	cd lib/@orgajs/ && find . -type f -name \*.js | xargs sed -i "s/^\(import .* from\) '\([^.'][^']*\)'.*/\\1 '..\/\\2.js';/g"
	cd lib/@orgajs/ && find . -type f -name \*.js | xargs sed -i "s/ from '\@\([^']\+\)'.*/ from '..\/\@\\1.js';/g"
	cp lib/@orgajs/index.js lib/@orgajs/lezer.js
	for DIR in lib/@uiw/*; do find $$DIR -type f -name \*.js | xargs sed -i "s/^\(export .* from\) [\"']\(\.[^']*\)[\"'].*/\\1 '\\2.js';/g"; done
	for DIR in lib/@uiw/*; do find $$DIR -type f -name \*.js | xargs sed -i "s/^\(import .* from\) [\"']\(\.[^']*\)[\"'].*/\\1 '\\2.js';/g"; done
	for DIR in lib/@uiw/*; do find $$DIR -type f -name \*.js | xargs sed -i "s/^\(import .* from\) [\"']\([^.'][^']*\)[\"'].*/\\1 '..\/..\/\\2.js';/g"; done
	echo "export * from './codemirror-themes/index.js'" > lib/@uiw/codemirror-themes.js
	sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '.\/\\2.js';/g" lib/lezer-elixir.js
	sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '.\/\\2.js';/g" lib/lezer-utils.js
	sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '.\/\\2.js';/g" lib/codemirror-lang-diff.js
	sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '.\/\\2.js';/g" lib/codemirror-lang-elixir.js
	if [ -e node_modules/codemirror-lang-git-log ]; then sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '.\/\\2.js';/g" lib/codemirror-lang-git-log.js; fi
	sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '.\/\\2.js';/g" lib/codemirror-lang-makefile.js
	sed -i "s/^\import '\([^']\+\)';/import '.\/\\1.js';/g" lib/codemirror-lang-makefile.js
	sed -i "s/^\(import .* from\) ['\"]\([^']\+\)['\"].*/\\1 '.\/\\2.js';/g" lib/codemirror-lang-richdown.js
	sed -i "s/var StyleModule = exports.StyleModule/export var StyleModule/g" lib/style-mod.js
	sed -i "s/var \([^ ]\+\) = require('\([^']*\)');/import * as \\1 from '..\/\\2.js'/g" lib/@lezer/php.js
	sed -i "s;Object.defineProperty(exports;//Object.defineProperty(exports;g" lib/@lezer/php.js
	sed -i "s\exports.parser = parser;\export { parser };\g" lib/@lezer/php.js

fix-others: sync-others
	sed -i "s/output.status = success ? 0 : 1;/output.status = success ? 0 : 1; output.installWasNeeded = installNeeded;/g" lib/check-dependencies.cjs
	sed -i "s/function/export function/g" lib/fast-word-wrap.js
	sed -i "s/module.exports/\/\/module.exports/g" lib/fast-word-wrap.js

sync-others:
	cp node_modules/diff/lib/index.mjs lib/diff.js
	cp node_modules/check-dependencies/lib/check-dependencies.js lib/check-dependencies.cjs
	cp node_modules/color-blend/dist/index.modern.js lib/color-blend.js
	cp node_modules/escape-string-regexp/index.js lib/escape-string-regexp.js
	cp node_modules/fast-word-wrap/index.js lib/fast-word-wrap.js
	cp node_modules/get-current-line/edition-es2022-esm/index.js lib/get-current-line.js
	mkdir -p lib/typescript-language-server/lib/
	cp node_modules/typescript-language-server/lib/cli.mjs lib/typescript-language-server/lib/cli.mjs
	cp node_modules/typescript-language-server/package.json lib/typescript-language-server/package.json # cli.mjs reads version from here
	mkdir -p lib/uuid/
	cp node_modules/uuid/dist/esm-browser/* lib/uuid/

sync-codemirror:
	rm -rf lib/@codemirror
	rm -rf lib/@kittycad
	rm -rf lib/@lezer
	rm -rf lib/@markdoc
	rm -rf lib/@marijn
	rm -rf lib/@replit
	rm -rf lib/@orgajs
	rm -rf lib/@uiw
	rm -rf lib/@babel
	rm -rf lib/@valtown
	mkdir -p lib/@kittycad
	mkdir -p lib/@lezer
	mkdir -p lib/@markdoc
	mkdir -p lib/@marijn
	mkdir -p lib/@replit
	mkdir -p lib/@valtown
	mkdir -p lib/@orgajs
	mkdir -p lib/@uiw
	mkdir -p lib/@babel/runtime/helpers/
	bin/sync-scope cookshack
	bin/sync-scope kittycad
	# bad marijn
	#bin/sync-scope marijn
	cp node_modules/@marijn/find-cluster-break/src/index.js lib/@marijn/find-cluster-break.js
	bin/sync-scope valtown
	cp node_modules/globals/globals.json lib/globals.json
	cp node_modules/@babel/runtime/helpers/esm/extends.js lib/@babel/runtime/helpers/extends.js
	cp node_modules/lezer-elixir/dist/index.js lib/lezer-elixir.js
	cp node_modules/lezer-utils/dist/pretty.js lib/lezer-utils.js
	cp node_modules/codemirror-lang-diff/dist/index.js lib/codemirror-lang-diff.js
	cp node_modules/codemirror-lang-elixir/dist/index.js lib/codemirror-lang-elixir.js
	if [ -e node_modules/codemirror-lang-git-log ]; then cp node_modules/codemirror-lang-git-log/dist/index.js lib/codemirror-lang-git-log.js; fi
	cp node_modules/codemirror-lang-makefile/dist/index.js lib/codemirror-lang-makefile.js
	cp node_modules/codemirror-rich-markdoc/dist/index.js lib/codemirror-lang-richdown.js
	cp node_modules/@markdoc/markdoc/dist/index.mjs lib/@markdoc/markdoc.js
	cp node_modules/@replit/codemirror-lang-csharp/dist/index.js lib/@replit/codemirror-lang-csharp.js
	cp node_modules/@replit/codemirror-lang-nix/dist/index.js lib/@replit/codemirror-lang-nix.js
	cp node_modules/@replit/codemirror-css-color-picker/dist/index.js lib/@replit/codemirror-css-color-picker.js
	cp node_modules/@orgajs/cm-lang/index.js lib/@orgajs/codemirror-lang-org.js
	cp node_modules/@orgajs/lezer/lib/*.js lib/@orgajs/
	cp node_modules/eslint-linter-browserify/linter.mjs lib/eslint-linter-browserify.mjs
#	cp -r node_modules/@codemirror/commands/dist/index.js lib/@codemirror/commands.js
	# so next cmd passes
	mkdir -p node_modules/@codemirror/legacy-modes/dist && echo > node_modules/@codemirror/legacy-modes/dist/index.js
	bin/sync-scope codemirror
	mkdir -p lib/@codemirror/legacy-modes/mode
	cp node_modules/@codemirror/legacy-modes/mode/*.js lib/@codemirror/legacy-modes/mode/
	for DIR in node_modules/@lezer/*; do cp $$DIR/dist/index.js lib/@lezer/$$(basename $$DIR).js; done
	cp node_modules/style-mod/dist/style-mod.cjs lib/style-mod.js
	cp node_modules/crelt/index.js lib/crelt.js
	cp node_modules/w3c-keyname/index.js lib/w3c-keyname.js
	cp node_modules/@lezer/php/dist/index.cjs lib/@lezer/php.js # .js is missing
	for DIR in node_modules/@uiw/*; do mkdir -p lib/@uiw/$$(basename $$DIR)/; cp $$DIR/esm/*.js lib/@uiw/$$(basename $$DIR)/; done

version-monaco:
	echo -n '{ "version": "' > lib/monaco/version.json
	(cd node_modules/monaco-editor && node -p "require('./package.json').version") | tr -d '\n' >> lib/monaco/version.json
	echo '" }' >> lib/monaco/version.json

patch-monaco:
	cd lib/monaco/ && for P in ../monaco-patches/*.patch; do echo "  $$P"; cat $$P | patch --ignore-whitespace -p 0; done

# must run after any sync-monaco-*
# must sync-monaco before repeating this
fix-monaco: sync-monaco fix-main fix-css patch-monaco version-monaco
	cd lib/monaco/ && find . -type f -name \*.js | xargs sed -i "s/import \(.*\)\\.css'/console.log(\\1\\.css'); import \\1.css' with { type: 'css' }/g"

fix-monaco-local: sync-monaco-local fix-main fix-css patch-monaco version-monaco
	cd lib/monaco/ && find . -type f -name \*.js | xargs sed -i "s/import \(.*\)\\.css'/console.log(\\1\\.css'); import \\1.css' with { type: 'css' }/g"

sync-monaco-local:
	rm -rf lib/monaco/
	mkdir -p lib/monaco/
	cp -r ~/src/monaco-editor/out/monaco-editor/esm/* lib/monaco/

sync-monaco:
	rm -rf lib/monaco/
	mkdir -p lib/monaco/
	cp -r node_modules/monaco-editor/esm/* lib/monaco/

sync-monaco-themes:
	rm -rf lib/monaco-themes/
	mkdir -p lib/monaco-themes/
	cp -r node_modules/monaco-themes/themes/* lib/monaco-themes/

sync-ace:
	touch lib/unicode.js
	rm lib/unicode.js
	cat node_modules/ace-code/src/unicode.js | sed -e 's/var wordChars/export var wordChars/g' | sed -e 's/exports.wordChars/wordChars/g' > lib/unicode.mjs
	rm -rf lib/ace/
	mkdir -p lib/ace/
	cp -r node_modules/ace-builds/src-noconflict/* lib/ace/
	rm -rf lib/ace-linters/
	mkdir -p lib/ace-linters/
	cp -r node_modules/ace-linters/build/* lib/ace-linters
#	cp -r ../ace-builds/src-noconflict/* lib/ace/
#	cp -r ../ace/build/src-noconflict/* lib/ace/

gen-pngs:
	inkscape --export-filename=img/logo.png --batch-process -w 256 -h 256 img/logo.svg
	inkscape --export-filename=img/logom.png --batch-process -w 256 -h 256 img/logom.svg

sync-icons:
	echo ERR maybe later
	rm -rf lib/icon/
	mkdir -p lib/icon/
	find node_modules/@fluentui/svg-icons/icons/*_24_regular.svg | while read f; do cp $$f lib/icon/$$(basename $$f | sed -e 's/_24_regular.svg$$/.svg/g'); done

pack:
#	npx webpack --config ./pack/pack.config.js
	echo ERR in main.html now
#	npx webpack --config ./pack/wack-ace.config.js

release:
	npm run make # FIX fails due to symlinks

jshint:
	npx jshint --config=.jshint --reporter=unix *.mjs
