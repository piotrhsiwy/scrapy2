import { readFileSync, writeFileSync } from 'fs'

// adapted from https://stackoverflow.com/questions/46293216/crawling-multiple-urls-in-a-loop-using-puppeteer/65000065#65000065 
// https://levelup.gitconnected.com/changing-async-await-to-promises-all-to-speed-up-api-calls-in-node-js-348ea70592fd

const availableAbbrev =  // rest of the book-data is in ./books/${abbrev}/meta.json files
[
  'tp',
  'ms',
  'esb',
  // 'ls',
  '22', // 15min ratelimiter if too many requests -> IP blockers in place
  // 'gg'
]
console.log(`availableAbbrev: ${availableAbbrev.toString()}`);

// ### Initializing books metadata
console.log('### Initializing books metadata');
const books = [];
for(const abbrev of availableAbbrev){
  const bookFilePath = `./books/${abbrev}/meta.json`;
  const book = JSON.parse(readFileSync(bookFilePath));
  if(book){
    console.log(`Loaded file successfully ${bookFilePath}`);
    books.push(book);
  } else{
    console.log(`Loading file failed ${bookFilePath}`);
  }
};

// ### Hunting URLs
console.log('### Hunting URLs');
const modules = [];
for(const book of books){
  const moduleName = `./books/${book.abbrev}/urlHunter.js`;
  await import(moduleName).then( async (module) => {
    book.module = module; 
    console.log(`Imported module ${moduleName}`);
  }, () => {
    console.log(`Importing module failed ${moduleName}`);
  });
}

const allPromises = [];
for(const book of books){
  let promise;
  promise = book.module.huntSportURLs(book);
  allPromises.push(promise);
  console.log(`Queued hunt from ${book.abbrev} module`);
}
console.log(`Deploying hunt batch of size ${allPromises.length}...`)
await Promise.allSettled(allPromises);
console.log(`Scrape batch results: ${allPromises.toString}`);

// ### Scraping the data
console.log('### Scraping match URLs');
console.log('Importing modules');
for(const book of books){
  const moduleName = `./books/${book.abbrev}/urlScraper.js`;
  await import(moduleName).then( async (module) => {
    console.log(`Imported module ${moduleName}`);
    await module.scrapeMatchURL(book);
  }, () => {
    console.log(`Importing module failed ${book.hunterModuleName}`);
  });
}

const data = {sports: []};

console.log('Opening files...');
let urlsFilePath;
urlsFilePath = './books/tp/matchURLs.json';  const matchURLs_tp =   JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_tp from  ${urlsFilePath}`);
urlsFilePath = './books/ms/matchURLs.json';  const matchURLs_ms =   JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_ms from  ${urlsFilePath}`);
urlsFilePath = './books/esb/matchURLs.json'; const matchURLs_esb =  JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_esb from ${urlsFilePath}`);
urlsFilePath = './books/ls/matchURLs.json';  const matchURLs_ls =   JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_ls from  ${urlsFilePath}`);
// urlsFilePath = './books/22/matchURLs.json';  const matchURLs_22 =   JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_22 from  ${urlsFilePath}`);
// urlsFilePath = './books/gg/matchURLs.json';  const matchURLs_gg =   JSON.parse(readFileSync(urlsFilePath)).urls; console.log(`Loaded matchURLs_gg from  ${urlsFilePath}`);

const scrapeBatchSize = 6;
const matchesFromTop = 8;
for(let i = 0; i < matchesFromTop ;){
  const allPromises = [];
  do{
    let promise;
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
import { huntSportURLs } from './books/tp/urlHunter.js';

const arbs = arbSports(availableBooks);

console.log(`Finished. ${arbs.length} positive arbs.`);