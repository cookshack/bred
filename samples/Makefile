# Bred

safety:
	echo "This is just a sample file"

run:
	npm start

prep: sync-ace fix-monaco fix-codemirror
	rm -f lib/callsites.js
	cp -r node_modules/callsites/index.js lib/callsites.mjs
	rm -f lib/mime.json
	cp -r node_modules/mime-db/db.json lib/mime.json
	npx peggy --format es -o lib/ev-parser.mjs lib/ev.pegjs

fix-main:
	cd lib/monaco/ && sed -i "s/\(import\|export\) \(.*\)';/\\1 \\2.js';/g" vs/editor/editor.main.js

fix-css:
	cd lib/monaco/ && find . -type f -name \*.js | xargs grep "import .*\\.css" | sed "s;\\./\(.\+\)/.*:import '\\.\(.*\).css'.*;<link rel=\"stylesheet\" href=\"lib/monaco/\1\2.css\"\/>;g" > ../css.html
	touch bred.html
	chmod ug+w bred.html
	echo "<!DOCTYPE html>" > bred.html
	echo "<html>" >> bred.html
	echo "<head>" >> bred.html
	cat meta.html >> bred.html
	cat lib/css.html >> bred.html
	echo "</head>" >> bred.html
	cat body.html >> bred.html
	echo "</html>" >> bred.html
	chmod ug-w bred.html

version-codemirror:
	echo -n '{ "version": "' > lib/@codemirror/version.json
	(cd node_modules/@codemirror/state && node -p "require('./package.json').version") | tr -d '\n' >> lib/@codemirror/version.json
	echo '" }' >> lib/@codemirror/version.json

fix-codemirror: sync-codemirror version-codemirror
	npx webpack --config webpack-orga.config.js
	cd lib/@codemirror/ && find . -type f -name \*.js | xargs sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '..\/\\2.js';/g"
	cd lib/@codemirror/legacy-modes/mode/ && find . -type f -name \*.js | xargs sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '..\/\\2.js';/g"
	cd lib/@codemirror/ && find . -type f -name language-data.js | xargs sed -i "s/import('\([^']*\)')/import\('..\/\\1.js'\)/g"
	cd lib/@lezer/ && find . -type f -name \*.js | xargs sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '..\/\\2.js';/g"
	cd lib/@replit/ && find . -type f -name \*.js | xargs sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '..\/\\2.js';/g"
	sed -i "s/zIndex: '-1',/zIndex: 'var(--z-indent-marker)',/g" lib/@replit/codemirror-indentation-markers.js
	cd lib/@orgajs/ && find . -type f -name \*.js | xargs sed -i "s/^\(import .* from\) '\([^.'][^']*\)'.*/\\1 '..\/\\2.js';/g"
	cd lib/@orgajs/ && find . -type f -name \*.js | xargs sed -i "s/ from '\@\([^']\+\)'.*/ from '..\/\@\\1.js';/g"
	cp lib/@orgajs/index.js lib/@orgajs/lezer.js
	for DIR in lib/@uiw/*; do find $$DIR -type f -name \*.js | xargs sed -i "s/^\(export .* from\) [\"']\(\.[^']*\)[\"'].*/\\1 '\\2.js';/g"; done
	for DIR in lib/@uiw/*; do find $$DIR -type f -name \*.js | xargs sed -i "s/^\(import .* from\) [\"']\(\.[^']*\)[\"'].*/\\1 '\\2.js';/g"; done
	for DIR in lib/@uiw/*; do find $$DIR -type f -name \*.js | xargs sed -i "s/^\(import .* from\) [\"']\([^.'][^']*\)[\"'].*/\\1 '..\/..\/\\2.js';/g"; done
	sed -i "s/ from '\@\([^']\+\)'.*/ from '..\/..\/\@\\1\/index.js';/g" lib/@uiw/codemirror-themes-all/index.js
	echo "export * from './codemirror-themes/index.js'" > lib/@uiw/codemirror-themes.js
	sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '.\/\\2.js';/g" lib/lezer-elixir.js
	sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '.\/\\2.js';/g" lib/codemirror-lang-elixir.js
	sed -i "s/^\(import .* from\) '\([^']\+\)'.*/\\1 '.\/\\2.js';/g" lib/codemirror-lang-makefile.js
	sed -i "s/^\import '\([^']\+\)';/import '.\/\\1.js';/g" lib/codemirror-lang-makefile.js
	sed -i "s/var StyleModule = exports.StyleModule/export var StyleModule/g" lib/style-mod.js
	sed -i "s/var \([^ ]\+\) = require('\([^']*\)');/import * as \\1 from '..\/\\2.js'/g" lib/@lezer/php.js
	sed -i "s;Object.defineProperty(exports;//Object.defineProperty(exports;g" lib/@lezer/php.js
	sed -i "s\exports.parser = parser;\export { parser };\g" lib/@lezer/php.js

sync-codemirror:
	rm -rf lib/@codemirror
	rm -rf lib/@lezer
	rm -rf lib/@replit
	rm -rf lib/@orgajs
	rm -rf lib/@uiw
	rm -rf lib/@babel
	mkdir -p lib/@codemirror/legacy-modes/mode
	mkdir -p lib/@lezer
	mkdir -p lib/@replit
	mkdir -p lib/@orgajs
	mkdir -p lib/@uiw
	mkdir -p lib/@babel/runtime/helpers/
	cp node_modules/@babel/runtime/helpers/esm/extends.js lib/@babel/runtime/helpers/extends.js
	cp node_modules/lezer-elixir/dist/index.js lib/lezer-elixir.js
	cp node_modules/codemirror-lang-elixir/dist/index.js lib/codemirror-lang-elixir.js
	cp node_modules/codemirror-lang-makefile/dist/index.js lib/codemirror-lang-makefile.js
	cp node_modules/@replit/codemirror-indentation-markers/dist/index.js lib/@replit/codemirror-indentation-markers.js
	cp node_modules/@replit/codemirror-lang-csharp/dist/index.js lib/@replit/codemirror-lang-csharp.js
	cp node_modules/@replit/codemirror-lang-nix/dist/index.js lib/@replit/codemirror-lang-nix.js
	cp node_modules/@replit/codemirror-css-color-picker/dist/index.js lib/@replit/codemirror-css-color-picker.js
	cp node_modules/@orgajs/cm-lang/index.js lib/@orgajs/codemirror-lang-org.js
	cp node_modules/@orgajs/lezer/lib/*.js lib/@orgajs/
#	cp -r node_modules/@codemirror/commands/dist/index.js lib/@codemirror/commands.js
	for DIR in node_modules/@codemirror/*; do cp $$DIR/dist/index.js lib/@codemirror/$$(basename $$DIR).js; done
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
#	npx webpack --config ./webpack.config.js
	echo ERR in main.html now
#	npx webpack --config ./webpack-ace.config.js

release:
	npm run make # FIX fails due to symlinks
