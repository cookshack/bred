import * as Theme from './theme-solarized.js'

let theme, meanings, filterMeanings

meanings = { text: Theme.clrs.base01,
             textLight: Theme.clrs.base00,
             fill: Theme.clrs.base2,
             fillLight: Theme.clrs.base2Light,
             light: Theme.clrs.base3,
             fillAux: Theme.clrs.cyanLight,
             fillAuxLight: Theme.clrs.cyanVeryLight,
             fillAuxVeryLight: Theme.clrs.cyanVeryVeryLight,
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
             emph: Theme.clrs.base03,
             emphLight: Theme.clrs.base02,
             //
             syntax5: Theme.clrs.orange,
             syntax4: Theme.clrs.yellow,
             syntax3: Theme.clrs.violet,
             syntax2: Theme.clrs.blue,
             syntax1: Theme.clrs.cyan,
             syntax0: Theme.clrs.green }

//--clr-point: rgba(38 139 210 / 40%); /* nb0 at 50% */
meanings.point = meanings.nb0
//--clr-point-border: rgba(38 139 210 / 40%); /* nb0 with some transparency */
meanings.pointBorder = meanings.nb0
//--clr-point-current: rgba(220 50 47 / 50%); /* nb3 at 50% */
meanings.pointCurrent = meanings.nb3

meanings.scroll = meanings.textLight
meanings.scrollFill = meanings.fill

filterMeanings = { text: Theme.filters.base01,
                   nb3: Theme.filters.red,
                   nb0: Theme.filters.blue,
                   emph: Theme.filters.base03 }

theme = Theme.init('solarized-light', meanings, filterMeanings)

export { theme }
