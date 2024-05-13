import { handleURL_ms_parallel } from "./url-handlers/ms.js"
import { handleURL_tp_parallel } from "./url-handlers/tp.js"
import { handleURL_esb } from "./url-handlers/esb.js"
/*
 * available bookies
 */
const bookies = [
  {
    name:"mystake",
    baseURL:"https://mystake.com",
    URLHandler: null,
    parallel_URLHandler: handleURL_ms_parallel,
  },
  {
    name:"thunderpick",
    baseURL:"https://thunderpick.io",
    URLHandler: null,
    parallel_URLHandler: handleURL_tp_parallel,
  },
  {
    name:"esportsbet",
    baseURL:"https://esportsbet.io",
    URLHandler: handleURL_esb,
    parallel_URLHandler: null,
  },
]

const urls_ms = [
  "https://mystake.com/en/sportsbook/prematch#/prematch?match=32953172",
  "https://mystake.com/en/sportsbook/prematch#/prematch?match=33121295",
]

const urls_tp = [
  "https://thunderpick.io/esports/cs2-betting/cct-season-1-global-finals/5148/mibr-vs-betboom-team/781810",
  "https://thunderpick.io/esports/cs2-betting/esl-challenger-league-season-47-europe/4805/space-vs-eyeballers/775226",
]

const url_esb = "https://esbseamlessx02.kzonlinegame.com/esportsite/index.html#/OddsPage/28442416/47";
// const urls_esb = [
//   "https://esbseamlessx02.kzonlinegame.com/esportsite/index.html#/OddsPage/28309461/47",
//   "https://esbseamlessx02.kzonlinegame.com/esportsite/index.html#/OddsPage/28442416/47",
//   "https://esbseamlessx02.kzonlinegame.com/esportsite/index.html#/OddsPage/28437663/47",
//   "https://esbseamlessx02.kzonlinegame.com/esportsite/index.html#/OddsPage/28455109/47",
// ]

await handleURL_ms_parallel(urls_ms);
await handleURL_tp_parallel(urls_tp);
await handleURL_esb(url_esb);
/*
TODO: merge the market arrays - maybe implement a merger to be called after
every handle-call OR assign URLs to matches before handling the URLs
aka scrape the URLs earlier
*/ 
