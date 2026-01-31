import * as U from './util.mjs'
import * as Wode from './wodemirror.mjs'
import * as WodeHi from './wode-hi.mjs'
import * as WodeRange from './wode-range.mjs'
import { d } from './mess.mjs'

import * as CMSearch from '../lib/@codemirror/search.js'
import * as CMView from '../lib/@codemirror/view.js'

export
function vfind
(view, needle, decorParent,
 // { backwards,
 //   caseSensitive,
 //   regExp,
 //   skipCurrent,
 //   wrap,
 //   stayInPlace,
 //   reveal } // 1 nearest, 2 center
 opts) {
  let ret, find, initialBep, initialSel, search, query

  function range
  (fromTo) {
    return WodeRange.make(fromTo.from, fromTo.to)
  }

  function init
  () {
    d('vfind init ' + (opts.backwards ? 'backward' : 'forward') + ', needle: ' + needle)
    search = new CMSearch.SearchQuery({ search: needle,
                                        caseSensitive: opts.caseSensitive,
                                        literal: 1,
                                        regexp: U.bool(opts.regExp),
                                        wholeWord: 0 })
    //CMSearch.setSearchQuery(query)
    query = search.create()

    find = query.nextMatch
    if (opts.backwards)
      find = query.prevMatch
  }

  d('vfind ' + (opts.backwards ? 'backward ' : 'forward ') + needle + ' decor ' + (decorParent ? 'on' : 'off'))

  init()

  initialBep = Wode.vgetBep(view)
  if (view.markActive)
    initialSel = view.ed.state.selection.main

  ret = find.bind(query)(view.ed.state, initialBep, initialBep)
  //d(ret)
  if (ret) {
    let bep

    if (opts.skipCurrent
        && (ret.from == initialBep)) {
      let opts2

      Wode.vsetBep(view, ret.to)
      opts2 = Object.assign({}, opts)
      opts2.skipCurrent = 0
      return vfind(view, needle, decorParent, opts2)
    }

    if (opts.wrap == 0)
      if (opts.backwards
        ? (initialBep < ret.from)
        : (ret.from < initialBep))
        // wrapped
        return 0

    //view.ed.setSelection(ret.range)
    if (decorParent) {
      if (decorParent.decorAll)
        decorParent.decorAll.remove()
      decorParent.decorAll = WodeHi.highlighters.add((state, from, to, add) => { // highlight
        query.highlight(state, from, to, (from, to) => {
          let selected

          // is range selected?
          selected = state.selection.ranges.some(r => r.from == from && r.to == to)
          //d('ADD all ' + from + ' ' + to)
          add(from, to,
              CMView.Decoration.mark({ class: 'bred-search-all' + (selected ? ' bred-search-selected' : '') }),
              10)
        })
      },
                                                     data => { // update
                                                       needle = data.needle
                                                       init()
                                                     })

      if (decorParent.decorMatch)
        decorParent.decorMatch.remove()
      decorParent.decorMatch = WodeHi.highlighters.add((state, from, to, add) => { // highlight
        let selected

        // is range selected?
        selected = state.selection.ranges.some(r => r.from == ret.from && r.to == ret.to) // <=?
        //d('ADD match ' + ret.from + ' ' + ret.to)
        add(ret.from, ret.to,
            CMView.Decoration.mark({ class: 'bred-search-match' + (selected ? ' bred-search-selected' : '') }),
            11)
      },
                                                       data => { // update
                                                         d('decor match update')
                                                         if (0) {
                                                           needle = data.needle
                                                           init()
                                                         }
                                                       })
    }

    if (opts.stayInPlace)
      return range(ret)

    bep = opts.backwards ? ret.from : ret.to
    if (initialSel)
      Wode.vsetSel(view, initialSel.from, bep, opts.reveal ?? 1)
    else
      Wode.vsetBep(view, bep, opts.reveal ?? 1)
    return range(ret)
  }
  if (decorParent?.decorAll)
    if (opts.skipCurrent) {
      // searching again, keep highlights
    }
    else {
      decorParent.decorAll.remove(view)
      // change view to force highlight refresh
      Wode.vsetBep(view, initialBep)
    }

  if (decorParent?.decorMatch) {
    decorParent.decorMatch.remove(view)
    // change view to force highlight refresh
    Wode.vsetBep(view, initialBep)
  }
  return 0
}
