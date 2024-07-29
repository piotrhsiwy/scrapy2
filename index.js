import { readFile, readFileSync, writeFileSync } from 'fs'

// adapted from https://stackoverflow.com/questions/46293216/crawling-multiple-urls-in-a-loop-using-puppeteer/65000065#65000065 
// https://levelup.gitconnected.com/changing-async-await-to-promises-all-to-speed-up-api-calls-in-node-js-348ea70592fd

const availableAbbrev =  // rest of the book-data is in ./books/${abbrev}/meta.json files
[
  'tp',
  'ms',
  'esb',
  'ls',
  '22', // 15min ratelimiter if too many requests -> IP blockers in place
  'gg'
]
console.log(`seeds of available books: ${availableAbbrev.toString()}`);

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

// ### Loading modules
console.log('### Loading modules');
for(const book of books){
  const moduleName = `./books/${book.abbrev}/urlHunter.js`;
  await import(moduleName).then( async (module) => {
    book.module = module; 
    console.log(`Imported module ${moduleName}`);
  }, () => {
    console.log(`Importing module failed ${moduleName}`);
  });
}

// ### Hunting URLs
// console.log('### Hunting URLs');

// for(const book of books){
//   console.log(`Queued hunt from ${book.abbrev} module`);
//   await book.module.huntSportURLs(book);
// }

// let allHuntPromises = [];
// for(const book of books){
//   let promise;
//   promise = book.module.huntSportURLs(book);
//   allHuntPromises.push(promise);
//   console.log(`Queued hunt from ${book.abbrev} module`);
// }
// console.log(`Deploying hunt batch of size ${allHuntPromises.length}...`)
// await Promise.allSettled(allHuntPromises);
// console.log(`Hunt batch results:`);
// console.log(allHuntPromises);

// ### Scraping the data
console.log('### Scraping match URLs');

console.log('Loading urls from files...');
for(const book of books){
  const urlsFilePath = `./books/${book.abbrev}/matchURLs.json`;
  book.urls = JSON.parse(readFileSync(urlsFilePath));
  console.log(`Loaded file ${book.urls.length} entries from file ${urlsFilePath}`);
}

const data = {sports: []};
let allScrapePromises = [];
let i = 0;
for(const book of books){
  let promise;
  if( i < book.urls.length){
    promise = book.module.scrapeMatchURL(data, book.urls[i]);
    allScrapePromises.push(promise);
    console.log(`Queued scrape from ${book.abbrev} module on ${books.urls[i]}`);
  }
}
console.log(`Deploying scrape batch of size ${allScrapePromises.length}...`)
await Promise.allSettled(allScrapePromises);
console.log(`Scrape batch results:`);
console.log(allScrapePromises);

const dataPathOut = 'data/data_out.json';
console.log(`Saving the results in ${dataPathOut}`);
writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8')

// ### Processing the data
console.log('### Processing the match data');
import { arbSports } from './calc/calc.js'
const arbs = arbSports(availableBooks);
console.log(`Finished. ${arbs.length} positive arbs.`);