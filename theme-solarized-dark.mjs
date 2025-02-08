import * as Theme from './theme-solarized.js'

let theme, meanings, filterMeanings

meanings = { text: Theme.clrs.base1,
             textLight: Theme.clrs.base0,
             fill: Theme.clrs.base02,
             light: Theme.clrs.base03,
             fillAux: Theme.clrs.cyanLight,
             fillAuxLight: Theme.clrs.cyanVeryLight,
             fillAuxVeryLight: Theme.clrs.cyanVeryVeryLight,
             //
             emph: Theme.clrs.base3,
             emphLight: Theme.clrs.base2 }

filterMeanings = { text: Theme.filters.base1,
                   nb3: Theme.filters.red,
                   nb0: Theme.filters.blue,
                   emph: Theme.filters.base3 }

theme = Theme.init('solarized-dark', meanings, filterMeanings)

export { theme }
