import * as Theme from './theme-solarized.js'
import * as Blend from './lib/color-blend.js'
//import { d } from './mess.mjs'

let theme, clrs, meanings, filterMeanings, rgb, bg, bgRgb, fill, text, textRgb

clrs = { ...Theme.clrs }

rgb = clrs.blueRgb
rgb.a = 0.2
clrs.blueLight = Theme.toHex(Blend.normal(clrs.base03Rgb, rgb))

text = clrs.base1
textRgb = clrs.base1Rgb

bg = clrs.base03
bgRgb = clrs.base03Rgb

// base02 too dark, eg hard to see tag.meta like #include in c
clrs.base02LightRgb = clrs.base02Rgb
clrs.base02LightRgb.a = 0.9
clrs.base02Light = Theme.toHex(Blend.normal(textRgb, clrs.base02LightRgb))
fill = clrs.base02Light

rgb = clrs.cyanRgb

rgb.a = 0.38
clrs.cyanLight = Theme.toHex(Blend.normal(bgRgb, rgb))

rgb.a = 0.18
clrs.cyanVeryLight = Theme.toHex(Blend.normal(bgRgb, rgb))

rgb.a = 0.09
clrs.cyanVeryVeryLight = Theme.toHex(Blend.normal(bgRgb, rgb))

rgb = clrs.redRgb

rgb.a = 0.6
clrs.redLight = Theme.toHex(Blend.normal(bgRgb, rgb))

meanings = { text: text,
             textLight: clrs.base0,
             fill: fill,
             bg: bg,
             //
             emph: clrs.base3,
             emphLight: clrs.base2 }

filterMeanings = { text: Theme.filters.base1,
                   emph: Theme.filters.base3 }

theme = Theme.init('solarized-dark', clrs, meanings, filterMeanings)

export { theme }
