
// adapted from https://stackoverflow.com/questions/46293216/crawling-multiple-urls-in-a-loop-using-puppeteer/65000065#65000065 
// https://levelup.gitconnected.com/changing-async-await-to-promises-all-to-speed-up-api-calls-in-node-js-348ea70592fd

// ### Hunting URLs

// await books[3].hunterModule.huntSportURLs(books[3]);


// let allHuntPromises = [];
// for(const book of books){
//   if(book.hunterModule){
//     let promise;
//     promise = book.hunterModule.huntSportURLs(book);
//     allHuntPromises.push(promise);
//     console.log(`Queued hunt from ${book.abbrev} module`);
//   } else{
//     console.log(`No hunter module in ${book.abbrev}`);
//   }
// }
// console.log(`Deploying hunt batch of size ${allHuntPromises.length}...`)
// await Promise.allSettled(allHuntPromises);
// console.log(`Hunt batch results:`);
// console.log(allHuntPromises);


// let bookFrom = 0;
// let bookTo = 5;
// let urlFrom = 0;
// let urlTo = 3;
// for(let ui = urlFrom; ui <= urlTo; ui++){
  //   for(let bi = bookFrom; bi <= bookTo; bi++){
  //     console.log(books[bi].urls[ui])
  //     await books[bi].scraperModule.scrapeMatchURL(data, books[bi].urls[ui]);
      // const dataPathOut = 'data/data_out.json';
  //     console.log(`Saving the results in ${dataPathOut}`);
  //     writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8')
  //   }
// }

async function clean(){
  console.log(`Cleaning...`);
  for(const book of books){
    const path = `./books/${book.abbrev}/log.txt`;
    if(existsSync(path)){ truncateSync(path, 0); }
    console.log(`Cleared file ${path}`);
  }
  const path = '/calc/log.txt';
  if(existsSync(path)){ truncateSync(path, 0); }
  console.log(`Cleared file ${path}`);
}

async function load(){
  console.log(`Loading modules...`);
  for(const book of books){
    const moduleName = `./books/${book.abbrev}/urlHunter.js`;
    await import(moduleName).then( async (module) => {
      book.hunterModule = module; 
      console.log(`Imported module ${moduleName}`);
    }, () => {
      console.log(`Importing module failed ${moduleName}`);
    });
  }
  for(const book of books){
    const moduleName = `./books/${book.abbrev}/urlScraper.js`;
    await import(moduleName).then( async (module) => {
        book.scraperModule = module; 
        console.log(`Imported module ${moduleName}`);
      }, () => {
        console.log(`Importing module failed ${moduleName}`);
      });
  }
}

async function singleHunt(){
  console.log('Hunting...')
  for(const book of books){
    console.log(`Queued hunt from ${book.abbrev} module ${book.baseURL}`);
    await book.hunterModule.huntSportURLs(book);
  }
}

async function hunt(){
  while(true){
    await new Promise(resolve => setTimeout(resolve, 5*3600000)) // 5h
    console.log('Hunting...')
    for(const book of books){
      console.log(`Queued hunt from ${book.abbrev} module`);
      await book.module.huntSportURLs(book);
      const urlsFilePath = `./books/${book.abbrev}/matchURLs.json`;
      book.urls = JSON.parse(readFileSync(urlsFilePath));
      console.log(`Loaded file ${book.urls.length} entries from file ${urlsFilePath}`);
    }
  }
}

async function scrape(){ 
  console.log('Loading urls from files...');
  for(const book of books){
    const urlsFilePath = `./books/${book.abbrev}/matchURLs.json`;
    book.urls = JSON.parse(readFileSync(urlsFilePath));
    console.log(`Loaded file ${book.urls.length} entries from file ${urlsFilePath}`);
  }
  console.log('Scraping...')
  const data = {sports: []};
  while(true){
    let i = 0;
    for(i = 0; ; i++){
      for(const book of books){
        if(i < book.urls.length){
          console.log(`Queued scrape from ${book.abbrev} module from ${book.urls[i]}`);
          console.log( await book.scraperModule.scrapeMatchURL(data, book.urls[i]));
        }
      }
      const dataPathOut = 'data/data_out.json';
      console.log(`Saving the results in ${dataPathOut}`);
      writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8')
    }
  }
}

import { arbSports } from './calc/calc.js'
async function calc(){
  while(true){
    await new Promise(resolve => setTimeout(resolve, 5*60000)); // 5min
    console.log(`Calculating...`);
    const arbs = await arbSports(availableAbbrev);
    console.log(`Finished calculations. ${arbs.length} positive arbs.`);
  }
}

// ##############################################################################################################
// ##############################################################################################################
// ##############################################################################################################

import { readFileSync, writeFileSync, existsSync, truncateSync } from 'fs'
const availableAbbrev =  // rest of the book-data is in ./books/${abbrev}/meta.json files
[
  'esb',
  '22', // 15min ratelimiter if too many requests -> IP blockers in place
  'ms',
  'tp',
  'ls',
  'gg'
]
console.log(`seeds of available books: ${availableAbbrev.toString()}`);

// ### Initializing books metadata
console.log('Initializing books metadata...');
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

// ### Running
(async function main(){
  await load();
  await clean();
  // await singleHunt();
  const Pscrape = scrape();
  const Phunt = hunt();
  const Pcalc = calc();
  const promises = [ Pscrape, Phunt, Pcalc ];
  await Promise.allSettled(promises);
})()

// ##############################################################################################################
// ##############################################################################################################
// ##############################################################################################################

// let allScrapePromises = [];
// let i = 0;
// for(const book of books){
//   if( i < book.urls.length){
//     if(book.scraperModule){
//       let promise;
//       promise = book.scraperModule.scrapeMatchURL(data, book.urls[i]);
//       allScrapePromises.push(promise);
//       console.log(`Queued scrape from ${book.abbrev} module on ${i}:${book.urls[i]}`);
//     } else{
//       console.log(`Not scraper module for ${book.abbrev}`)
//     }
//     const dataPathOut = 'data/data_out.json';
//     console.log(`Saving the results in ${dataPathOut}`);
//     writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8')
//   }
// }
// console.log(`Deploying scrape batch of size ${allScrapePromises.length}...`)
// await Promise.allSettled(allScrapePromises);
// console.log(`Scrape batch results:`);
// console.log(allScrapePromises);