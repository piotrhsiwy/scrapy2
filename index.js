import { handleURL_tp } from './books/tp/tp.js'
import { handleURL_ms } from './books/ms/ms.js'
import { handleURL_esb } from './books/esb/esb.js'

import { readFileSync, writeFileSync } from 'fs'

const dataPath = 'data/data.json'
const data = JSON.parse(readFileSync(dataPath));

const urls_tp = 
[
  'https://thunderpick.io/esports/cs2-betting/blast-premier-fall-groups-2024/5497/virtus-pro-vs-liquid/833214',
  'https://thunderpick.io/esports/cs2-betting/blast-premier-fall-groups-2024/5497/natus-vincere-vs-big/833218',
  // 'https://thunderpick.io/esports/cs2-betting/blast-premier-fall-groups-2024/5497/g2-vs-ninjas-in-pyjamas/833213',
  // 'https://thunderpick.io/esports/cs2-betting/blast-premier-fall-groups-2024/5497/faze-vs-cloud9/833212',
];

const urls_ms =
[
  'https://mystake.com/en/sportsbook/prematch#/prematch?match=35077808',
  'https://mystake.com/en/sportsbook/prematch#/prematch?match=35077807',
  // 'https://mystake.com/en/sportsbook/prematch#/prematch?match=35077811',
  // 'https://mystake.com/en/sportsbook/prematch#/prematch?match=35077812',
];

const urls_esb =
[
  'https://esportsbet.io/de/esportsbull/OddsPage/29762888/47?version=2&liveStream=1&streamer=1&streamerLiveStream=1&isSingleProduct=1&gameCategory=1',
  'https://esportsbet.io/de/esportsbull/OddsPage/29762308/47?version=2&liveStream=1&streamer=1&streamerLiveStream=1&isSingleProduct=1&gameCategory=1',
  // 'https://esportsbet.io/de/esportsbull/OddsPage/29762500/47?version=2&liveStream=1&streamer=1&streamerLiveStream=1&isSingleProduct=1&gameCategory=1',
  // 'https://esportsbet.io/de/esportsbull/OddsPage/29763510/47?version=2&liveStream=1&streamer=1&streamerLiveStream=1&isSingleProduct=1&gameCategory=1',
];

// adapted from https://stackoverflow.com/questions/46293216/crawling-multiple-urls-in-a-loop-using-puppeteer/65000065#65000065 
// https://levelup.gitconnected.com/changing-async-await-to-promises-all-to-speed-up-api-calls-in-node-js-348ea70592fd
const allPromises = [];

for(const url of urls_tp){
  const promise = handleURL_tp(data, url);
  allPromises.push(promise);
}

for(const url of urls_ms){
  const promise = handleURL_ms(data, url);
  allPromises.push(promise);
}

for(const url of urls_esb){
  const promise = handleURL_esb(data, url);
  allPromises.push(promise);
}

await Promise.allSettled(allPromises);
console.log(allPromises);

const dataPathOut = 'data/data_out.json';
writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8')