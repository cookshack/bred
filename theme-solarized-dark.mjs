import * as Theme from './theme-solarized.js'
import * as Blend from './lib/color-blend.js'
import { d } from './mess.mjs'

let theme, clrs, meanings, filterMeanings, rgb

function toX
(r) {
  return r.toString(16).padStart(2, '0')
}

function toHex
(c) {
  return '#' + toX(c.r) + toX(c.g) + toX(c.b)
}

clrs = { ...Theme.clrs }

rgb = clrs.blueRGB
rgb.a = 0.2
clrs.blueLight = toHex(Blend.normal(clrs.base03RGB, rgb))
if (0) {
  d({ rgb })
  d('===================')
  d(clrs.blueLight)
}

rgb = clrs.cyanRGB

rgb.a = 0.38
clrs.cyanLight = toHex(Blend.normal(clrs.base03RGB, rgb))

rgb.a = 0.18
clrs.cyanVeryLight = toHex(Blend.normal(clrs.base03RGB, rgb))

rgb.a = 0.9
clrs.cyanVeryVeryLight = toHex(Blend.normal(clrs.base03RGB, rgb))

meanings = { text: clrs.base1,
             textLight: clrs.base0,
             fill: clrs.base02,
             light: clrs.base03,
             //
             emph: clrs.base3,
             emphLight: clrs.base2 }

filterMeanings = { text: Theme.filters.base1,
                   emph: Theme.filters.base3 }

theme = Theme.init('solarized-dark', clrs, meanings, filterMeanings)

export { theme }
