import { readFileSync, writeFileSync } from 'fs'

// adapted from https://stackoverflow.com/questions/46293216/crawling-multiple-urls-in-a-loop-using-puppeteer/65000065#65000065 
// https://levelup.gitconnected.com/changing-async-await-to-promises-all-to-speed-up-api-calls-in-node-js-348ea70592fd

const availableAbbrev =  // rest of the book-data is in ./books/${abbrev}/meta.json files
[
  // 'tp',
  // 'ms',
  // 'esb',
  // 'ls',
  // '22', //leaving for now, IP is blocked. Do not modify website with js too fast
  'gg'
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
for(const book of books){
  await import(`./books/${book.abbrev}/urlHunter.js`).then( async (module) => {
    console.log(`Imported module ./books/${book.abbrev}/urlHunter.js`);
    await module.huntSportURLs(book);
  }, () => {
    console.log(`Importing module failed ${book.hunterModuleName}`);
  });
}

  // console.log(`i=${i} Queued ${availableBaseURLs[i]}  to hunt`);

  // const huntBatchSize = 1;
  // console.log(`Hunting..., batchSize: ${huntBatchSize}`);
  // await (async () => {
  //     const allPromises = [];
  //     let i = 0;
  //     do{
  //         let promise;
  //         // promise = huntMatchURLs_ms (tournamentURLs_ms[i]);    allPromises.push(promise);  console.log(`i=${i} Queued ${tournamentURLs_ms[i]}  to hunt`);
  //         // promise = huntMatchURLs_esb (tournamentURLs_esb[i]);  allPromises.push(promise);  console.log(`i=${i} Queued ${tournamentURLs_esb[i]} to hunt`);
  //         // promise = huntMatchURLs_ls (tournamentURLs_ls[i]);    allPromises.push(promise);  console.log(`i=${i} Queued ${tournamentURLs_ls[i]}  to hunt`);
  //         // promise = huntMatchURLs_22 (tournamentURLs_22[i]);    allPromises.push(promise);  console.log(`i=${i} Queued ${tournamentURLs_22[i]}  to hunt`);
  //         // promise = huntMatchURLs_gg (tournamentURLs_gg[i]);    allPromises.push(promise);  console.log(`i=${i} Queued ${tournamentURLs_gg[i]}  to hunt`);
  //         i++;
  //     } while(allPromises.length < huntBatchSize && i < availableSize);
  //     console.log(`Deploying hunt batch of ${allPromises.length}...`)
  //     await Promise.allSettled(allPromises);
  //     console.log('Hunt batch results:')
  //     console.log(allPromises);
  // })();

  // ### Scraping the data
console.log('### Scraping match URLs');
console.log('Importing modules');
for(const book of books){
  import(book.scraperModuleName);
  console.log(`Imported module ${book.scraperModuleName}`);
}
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

const arbs = arbSports(availableBooks);

console.log(`Finished. ${arbs.length} positive arbs.`);