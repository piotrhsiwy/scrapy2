// import { handleURL_ms_parallel } from "./url-handlers/ms.js"
// import { handleURL_esb } from "./url-handlers/esb.js"

/*
 * available bookies
 */
// const bookies = [
//   {
//     name:"mystake",
//     baseURL:"https://mystake.com",
//     URLHandler: null,
//     parallel_URLHandler: handleURL_ms_parallel,
//   },
//   {
//     name:"thunderpick",
//     baseURL:"https://thunderpick.io",
//     URLHandler: null,
//     parallel_URLHandler: handleURL_tp_parallel,
//   },
//   {
//     name:"esportsbet",
//     baseURL:"https://esportsbet.io",
//     URLHandler: handleURL_esb,
//     parallel_URLHandler: null,
//   },
// ]


import { handleURL } from './url-handlers/tp.js'
import { readFileSync, writeFileSync } from 'fs'

const dataPath = 'data/data.json'
const data = JSON.parse(readFileSync(dataPath));
const urls = 
[
  'https://thunderpick.io/esports/cs2-betting/blast-premier-fall-groups-2024/5497/virtus-pro-vs-liquid/833214',
  'https://thunderpick.io/esports/cs2-betting/blast-premier-fall-groups-2024/5497/natus-vincere-vs-big/833218',
  'https://thunderpick.io/esports/cs2-betting/blast-premier-fall-groups-2024/5497/g2-vs-ninjas-in-pyjamas/833213',
  'https://thunderpick.io/esports/cs2-betting/blast-premier-fall-groups-2024/5497/faze-vs-cloud9/833212',
];

const allPromises = [];
for(const url of urls){
  const promise = handleURL(data, url);
  allPromises.push(promise);
}
await Promise.allSettled(allPromises);
console.log(allPromises);

const dataPathOut = 'data/data_out.json';
writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8')


// await handleURL_ms_parallel(urls_ms);
// await handleURL_tp_parallel(urls_tp);
// await handleURL_esb(url_esb);
/*
TODO: merge the market arrays - maybe implement a merger to be called after
every handle-call OR assign URLs to matches before handling the URLs
aka scrape the URLs earlier
*/ 
