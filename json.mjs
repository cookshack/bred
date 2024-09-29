// Collect all "import ... with" in this file, which is skipped by
// eslint.

import globals from "./lib/globals.json" with { type: "json" }
import mbe from "./lib/mime-by-ext.json" with { type: "json" }
import Vace from "./lib/ace/version.json" with { type: "json" }
import Vode from "./lib/@codemirror/version.json" with { type: "json" }
import Vonaco from "./lib/monaco/version.json" with { type: "json" }

export
function importCss
(file) {
  return import(file, { with: { type: 'css' } })
}

export
function importJson
(file) {
  return import(file, { with: { type: 'json' } })
}

export { globals, mbe, Vace, Vode, Vonaco }
