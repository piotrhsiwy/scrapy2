import { readFileSync, writeFileSync } from 'fs'

import { scrapeMatchURL_tp } from './books/tp/urlScraper.js'
import { huntMatchURLs_tp } from './books/tp/urlHunter.js'
import { scrapeMatchURL_ms } from './books/ms/urlScraper.js'
import { huntMatchURLs_ms } from './books/ms/urlHunter.js'
import { scrapeMatchURL_esb } from './books/esb/urlScraper.js'
import { huntMatchURLs_esb } from './books/esb/urlHunter.js'
import { scrapeMatchURL_ls } from './books/ls/urlScraper.js'
import { huntMatchURLs_ls } from './books/ls/urlHunter.js'
import { scrapeMatchURL_22 } from './books/22/urlScraper.js'
import { huntMatchURLs_22 } from './books/22/urlHunter.js'
import { scrapeMatchURL_gg } from './books/gg/urlScraper.js'
import { huntMatchURLs_gg } from './books/gg/urlHunter.js'


// adapted from https://stackoverflow.com/questions/46293216/crawling-multiple-urls-in-a-loop-using-puppeteer/65000065#65000065 
// https://levelup.gitconnected.com/changing-async-await-to-promises-all-to-speed-up-api-calls-in-node-js-348ea70592fd

const availableBooks = ['Thunderpick', 'Mystake', 'Esportsbet', 'Lsbet', '22bet', 'Ggbet'];
const availableBooksShort = ['tp', 'ms', 'esb', 'ls', '22', 'gg'];
console.log(`availableBooks: ${availableBooks.toString()}`);
console.log(`availableBooksShort: ${availableBooksShort.toString()}`);
// ### Hunting URLs
console.log('### Hunting URLs');

console.log('Opening files...');
let tournamentURLsFilePath;
tournamentURLsFilePath = './books/tp/tournamentURLs.json';    const tournamentURLs_tp = JSON.parse(readFileSync(tournamentURLsFilePath)).urls;  console.log(`Loaded tournamentURLs_tp from ${tournamentURLsFilePath}`);
tournamentURLsFilePath = './books/ms/tournamentURLs.json';    const tournamentURLs_ms = JSON.parse(readFileSync(tournamentURLsFilePath)).urls;  console.log(`Loaded tournamentURLs_ms from ${tournamentURLsFilePath}`);
tournamentURLsFilePath = './books/esb/tournamentURLs.json';   const tournamentURLs_esb = JSON.parse(readFileSync(tournamentURLsFilePath)).urls; console.log(`Loaded tournamentURLs_esb from ${tournamentURLsFilePath}`);
tournamentURLsFilePath = './books/ls/tournamentURLs.json';    const tournamentURLs_ls = JSON.parse(readFileSync(tournamentURLsFilePath)).urls;  console.log(`Loaded tournamentURLs_ls from ${tournamentURLsFilePath}`);
tournamentURLsFilePath = './books/22/tournamentURLs.json';    const tournamentURLs_22 = JSON.parse(readFileSync(tournamentURLsFilePath)).urls;  console.log(`Loaded tournamentURLs_22 from ${tournamentURLsFilePath}`);
tournamentURLsFilePath = './books/gg/tournamentURLs.json';    const tournamentURLs_gg = JSON.parse(readFileSync(tournamentURLsFilePath)).urls;  console.log(`Loaded tournamentURLs_gg from ${tournamentURLsFilePath}`);

const huntBatchSize = 6;
const tournamentsFromTop = 1;
console.log(`Hunting..., batchSize: ${huntBatchSize}, ${tournamentsFromTop} first tournaments from top`);
let promise;
for(let i = 0; i < tournamentsFromTop ;){
  const allPromises = [];
  do{
    promise = huntMatchURLs_tp (tournamentURLs_tp[i]);    allPromises.push(promise);  console.log(`i=${i} Queued ${tournamentURLs_tp[i]}  to hunt`);
    promise = huntMatchURLs_ms (tournamentURLs_ms[i]);    allPromises.push(promise);  console.log(`i=${i} Queued ${tournamentURLs_ms[i]}  to hunt`);
    promise = huntMatchURLs_esb (tournamentURLs_esb[i]);  allPromises.push(promise);  console.log(`i=${i} Queued ${tournamentURLs_esb[i]} to hunt`);
    promise = huntMatchURLs_ls (tournamentURLs_ls[i]);    allPromises.push(promise);  console.log(`i=${i} Queued ${tournamentURLs_ls[i]}  to hunt`);
    promise = huntMatchURLs_22 (tournamentURLs_22[i]);    allPromises.push(promise);  console.log(`i=${i} Queued ${tournamentURLs_22[i]}  to hunt`);
    promise = huntMatchURLs_gg (tournamentURLs_gg[i]);    allPromises.push(promise);  console.log(`i=${i} Queued ${tournamentURLs_gg[i]}  to hunt`);
    i++;
  } while(allPromises.length < huntBatchSize && i < tournamentsFromTop);
  console.log(`Deploying hunt batch of ${allPromises.length}...`)
  await Promise.allSettled(allPromises);
  console.log('Hunt batch results:')
  console.log(allPromises);
}

// ### Scraping the data
console.log('### Scraping match URLs');
const data = {sports: []};

console.log('Opening files...');
let urlsFilePath;
urlsFilePath = './books/tp/matchURLs.json';  const matchURLs_tp =   JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_tp from  ${urlsFilePath}`);
urlsFilePath = './books/ms/matchURLs.json';  const matchURLs_ms =   JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_ms from  ${urlsFilePath}`);
urlsFilePath = './books/esb/matchURLs.json'; const matchURLs_esb =  JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_esb from ${urlsFilePath}`);
urlsFilePath = './books/ls/matchURLs.json';  const matchURLs_ls =   JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_ls from  ${urlsFilePath}`);
urlsFilePath = './books/22/matchURLs.json';  const matchURLs_22 =   JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_22 from  ${urlsFilePath}`);
urlsFilePath = './books/gg/matchURLs.json';  const matchURLs_gg =   JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_gg from  ${urlsFilePath}`);

const scrapeBatchSize = 6;
const matchesFromTop = 8;
for(let i = 0; i < matchesFromTop ;){
  const allPromises = [];
  do{
    promise = scrapeMatchURL_tp (data, matchURLs_tp[i]);    allPromises.push(promise); console.log(`i=${i} Queued ${matchURLs_tp[i]}  to scrape`);
    promise = scrapeMatchURL_ms (data, matchURLs_ms[i]);    allPromises.push(promise); console.log(`i=${i} Queued ${matchURLs_ms[i]}  to scrape`);
    promise = scrapeMatchURL_esb (data, matchURLs_esb[i]);  allPromises.push(promise); console.log(`i=${i} Queued ${matchURLs_esb[i]} to scrape`);
    promise = scrapeMatchURL_ls (data, matchURLs_ls[i]);    allPromises.push(promise); console.log(`i=${i} Queued ${matchURLs_ls[i]}  to scrape`);
    promise = scrapeMatchURL_22 (data, matchURLs_22[i]);    allPromises.push(promise); console.log(`i=${i} Queued ${matchURLs_22[i]}  to scrape`);
    promise = scrapeMatchURL_gg (data, matchURLs_gg[i]);    allPromises.push(promise); console.log(`i=${i} Queued ${matchURLs_gg[i]}  to scrape`);
    i++;
  } while(allPromises.length < scrapeBatchSize && i < matchesFromTop);
  console.log(`Deploying scrape batch of ${allPromises.length}...`)
  await Promise.allSettled(allPromises);
  console.log('Scrape batch results:')
  console.log(allPromises);
}

const dataPathOut = 'data/data_out.json';
console.log(`Saving the results in ${dataPathOut}`);
writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8')

// ### Processing the data
console.log('### Processing the match data');
import { arbSports } from './calc/calc.js'

const arbs = arbSports(availableBooks);

console.log(`Finished. ${arbs.length} positive arbs.`);