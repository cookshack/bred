import * as Theme from './theme-solarized.js'
import * as Blend from '../lib/color-blend.js'

let theme, clrs, meanings, filterMeanings, rgb, bgRgb

clrs = { ...Theme.clrs }

bgRgb = clrs.base3Rgb
rgb = clrs.redRgb

rgb.a = 0.3
clrs.redLight = Theme.toHex(Blend.normal(bgRgb, rgb))

meanings = { text: clrs.base01,
             textLight: clrs.base00,
             fill: clrs.base2,
             bg: clrs.base3,
             //
             emph: clrs.base03,
             emphLight: clrs.base02 }

filterMeanings = { text: Theme.filters.base01,
                   emph: Theme.filters.base03 }

theme = Theme.init('solarized-light', clrs, meanings, filterMeanings)

export { theme }
