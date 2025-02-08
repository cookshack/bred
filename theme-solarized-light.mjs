import * as Theme from './theme-solarized.js'

let theme, meanings, filterMeanings

meanings = { text: Theme.clrs.base01,
             textLight: Theme.clrs.base00,
             fill: Theme.clrs.base2,
             light: Theme.clrs.base3,
             fillAux: Theme.clrs.cyanLight,
             fillAuxLight: Theme.clrs.cyanVeryLight,
             fillAuxVeryLight: Theme.clrs.cyanVeryVeryLight,
             //
             emph: Theme.clrs.base03,
             emphLight: Theme.clrs.base02 }

filterMeanings = { text: Theme.filters.base01,
                   emph: Theme.filters.base03 }

theme = Theme.init('solarized-light', meanings, filterMeanings)

export { theme }
