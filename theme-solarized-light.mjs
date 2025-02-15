import * as Theme from './theme-solarized.js'

let theme, clrs, meanings, filterMeanings

clrs = { ...Theme.clrs }

meanings = { text: Theme.clrs.base01,
             textLight: Theme.clrs.base00,
             fill: Theme.clrs.base2,
             bg: Theme.clrs.base3,
             //
             emph: Theme.clrs.base03,
             emphLight: Theme.clrs.base02 }

filterMeanings = { text: Theme.filters.base01,
                   emph: Theme.filters.base03 }

theme = Theme.init('solarized-light', clrs, meanings, filterMeanings)

export { theme }
