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
             emphLight: Theme.clrs.base2,
             //
             nb3: Theme.clrs.red,
             nb2: Theme.clrs.magenta,
             nb2Light: Theme.clrs.magentaLight,
             nb1: Theme.clrs.yellow,
             nb0: Theme.clrs.blue,
             nb0Light: Theme.clrs.blueLight,
             nb0VeryLight: Theme.clrs.blueVeryLight,
             nb0VeryLightTranslucent: Theme.clrs.blueVeryLightTranslucent,
             //
             syntax5: Theme.clrs.orange,
             syntax4: Theme.clrs.yellow,
             syntax3: Theme.clrs.violet,
             syntax2: Theme.clrs.blue,
             syntax1: Theme.clrs.cyan,
             syntax0: Theme.clrs.green }

meanings.point = meanings.nb0
meanings.pointBorder = meanings.nb0
meanings.pointCurrent = meanings.nb3

meanings.scroll = meanings.textLight
meanings.scrollFill = meanings.fill

filterMeanings = { text: Theme.filters.base1,
                   nb3: Theme.filters.red,
                   nb0: Theme.filters.blue,
                   emph: Theme.filters.base3 }

theme = Theme.init('solarized-dark', meanings, filterMeanings)

export { theme }
