import * as Ed from '../../js/ed.mjs'
import * as Mode from '../../js/mode.mjs'

import * as CMLang from '../../lib/@codemirror/language.js'
import * as CMState from '../../lib/@codemirror/state.js'

import { outlineFoldService } from './outline-fold.mjs'

export
function init
() {
  Mode.add('Outline', { viewInit: Ed.viewInit,
                        viewCopy: Ed.viewCopy,
                        initFns: Ed.initModeFns,
                        parentsForEm: 'ed',
                        wexts: [ { backend: 'cm',
                                   name: 'extOutlineFold',
                                   make: () => ([ CMLang.foldService.of(outlineFoldService) ]),
                                   part: new CMState.Compartment } ],
                        decorators: [ { regex: /^(\*{6,})/d,
                                        decor: [ { line: 1,
                                                   attr: { style: 'color: var(--clr-syntax5)' } } ] },
                                      { regex: /^(\*{4}\s)/d,
                                        decor: [ { line: 1,
                                                   attr: { style: 'color: var(--clr-syntax4)' } } ] },
                                      { regex: /^(\*{3}\s)/d,
                                        decor: [ { line: 1,
                                                   attr: { style: 'color: var(--clr-syntax0)' } } ] },
                                      { regex: /^(\*{2}\s)/d,
                                        decor: [ { line: 1,
                                                   attr: { style: 'color: var(--clr-syntax1)' } } ] },
                                      { regex: /^(\*{1}\s)/d,
                                        decor: [ { line: 1,
                                                   attr: { style: 'color: var(--clr-syntax3)' } } ] } ] })
}

export
function free
() {
  Mode.remove('Outline')
}
