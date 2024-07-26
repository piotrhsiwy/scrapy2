import { scrapeMatchURL_tp } from './books/tp/urlScraper.js'
import { huntMatchURLs_tp } from './books/tp/urlHunter.js'
import { handleURL_ms } from './books/ms/ms.js'
import { handleURL_esb } from './books/esb/esb.js'
import { handleURL_ls } from './books/ls/ls.js'
import { handleURL_22 } from './books/22/22.js'
import { handleURL_gg } from './books/gg/gg.js'

import { readFileSync, writeFileSync } from 'fs'

// adapted from https://stackoverflow.com/questions/46293216/crawling-multiple-urls-in-a-loop-using-puppeteer/65000065#65000065 
// https://levelup.gitconnected.com/changing-async-await-to-promises-all-to-speed-up-api-calls-in-node-js-348ea70592fd

// ### Hunting URLs
const tournamentURLsFilePath = './books/tp/tournamentURLs.json';  const tournamentURLs = JSON.parse(readFileSync(tournamentURLsFilePath)).urls;
for(const tournamentURL of tournamentURLs){
  await huntMatchURLs_tp(tournamentURL);
}

// ### Scraping the data
const data = {sports: []};

let urlsFilePath;
urlsFilePath = './books/tp/matchURLs.json';  const urls_tp =   JSON.parse(readFileSync(urlsFilePath)).urls;
// urlsFilePath = './books/ms/urls.json';  const urls_ms =   JSON.parse(readFileSync(urlsFilePath)).urls;
// urlsFilePath = './books/esb/urls.json'; const urls_esb =  JSON.parse(readFileSync(urlsFilePath)).urls;
// urlsFilePath = './books/ls/urls.json';  const urls_ls =   JSON.parse(readFileSync(urlsFilePath)).urls;
// urlsFilePath = './books/22/urls.json';  const urls_22 =   JSON.parse(readFileSync(urlsFilePath)).urls;
// urlsFilePath = './books/gg/urls.json';  const urls_gg =   JSON.parse(readFileSync(urlsFilePath)).urls;

let promise;
const batchSize = 4;
for(let i = 0; i < 4 ; i++){
  const allPromises = [];
  do{
    promise = scrapeMatchURL_tp (data, urls_tp[i]); allPromises.push(promise);
    i++;
  } while(allPromises.length < batchSize);
  // promise = handleURL_ms(data, urls_ms[i]); allPromises.push(promise);
  // promise = handleURL_esb(data, urls_esb[i]); allPromises.push(promise);
  // promise = handleURL_ls(data, urls_ls[i]); allPromises.push(promise);
  // promise = handleURL_22(data, urls_22[i]); allPromises.push(promise);
  // promise = handleURL_gg(data, urls_gg[i]); allPromises.push(promise);
  await Promise.allSettled(allPromises);
  console.log(allPromises);
}

const dataPathOut = 'data/data_out.json';
writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8')

// ### Processing the data
// import { createWriteStream } from "fs"
// import { calcMarket } from './calculator/calc.js'
// import { huntMatchURLs_tp } from './books/tp/urlHunter.js'

// function calcData(dataFilePath, logFilePath, books){
//   const data = JSON.parse(readFileSync(dataFilePath));
//   const writeLogStream = createWriteStream(logFilePath);

//   for(const sport of data.sports){
//     writeLogStream.write(`Processing sport: ${sport.name}\n`);
//     for(const tournament of sport.tournaments){
//       writeLogStream.write(`Processing tournament: ${tournament.name}\n`);
//       for(const match of tournament.matches){
//         writeLogStream.write(`Processing match: ${match.teamHome} vs ${match.teamAway}, ${match.datetime}\n`);
//         for(const market of match.markets){
//           calcMarket(writeLogStream, market, books);
//         }
//       }
//     }
//   }
// }

// const dataFilePath = 'data/data_out.json';
// const logFilePath = 'calculator/log.txt';
// const availableBooks = ['Thunderpick', 'Mystake', 'Esportsbet', 'Lsbet', '22bet'];
// calcData(dataFilePath, logFilePath, availableBooks);