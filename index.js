async function clean(){
  console.log(`Cleaning...`);
  for(const book of books){
    const path = `./books/${book.abbrev}/log.txt`;
    if(existsSync(path)){ truncateSync(path, 0); }
    console.log(`Cleared file ${path}`);
  }
  const path = './calc/log.txt';
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
    const urlsFilePath = `./books/${book.abbrev}/matchURLs.json`;
    book.urls = JSON.parse(readFileSync(urlsFilePath));
    console.log(`Loaded ${book.urls.length} entries from file ${urlsFilePath}`);
  }
}

let mutex = false;
async function hunt(){
  while(true){
    await new Promise(resolve => setTimeout(resolve, 3600000)) // 1h
    console.log('Hunter retrieving lock...')
    while(mutex){ await new Promise(resolve => setTimeout(resolve, 1)); }
    mutex = true;
    for(const book of books){
      console.log(`Queued hunt from ${book.abbrev} module`);
      await book.hunterModule.huntSportURLs(book);
      const urlsFilePath = `./books/${book.abbrev}/matchURLs.json`;
      book.urls = JSON.parse(readFileSync(urlsFilePath));
      console.log(`Reloaded ${book.urls.length} entries from file ${urlsFilePath}`);
    }
    mutex = false;
  }
}

async function scrape(){ 
  // console.log('Loading urls from files...');
  // for(const book of books){
  //   const urlsFilePath = `./books/${book.abbrev}/matchURLs.json`;
  //   book.urls = JSON.parse(readFileSync(urlsFilePath));
  //   console.log(`Loaded file ${book.urls.length} entries from file ${urlsFilePath}`);
  // }
  const data = {sports: []};
  let i = 0;
  while(true){
    console.log('Scraper retrieving lock...')
    if(mutex){
      i = 0;
      while(mutex){ await new Promise(resolve => setTimeout(resolve, 1)); }
    }
    mutex = true;
    const promises = [];
    for(const book of books){
      if(i < book.urls.length){
        let promise = book.scraperModule.scrapeMatchURL(data, book.urls[i]);
        promises.push(promise);
        console.log(`Queued scrape from ${book.abbrev} module urls[${i}]: ${book.urls[i]}`);
      }
    }
    i++;
    for(const book of books){
      if(i < book.urls.length){
        let promise = book.scraperModule.scrapeMatchURL(data, book.urls[i]);
        promises.push(promise);
        console.log(`Queued scrape from ${book.abbrev} module urls[${i}]: ${book.urls[i]}`);
      }
    }
    i++;
    console.log(`Running a batch of ${promises.length} scrapers`);
    console.log( (await Promise.allSettled(promises)).map(e => e.value === 0 ? 'success' : 'failure') );
    const dataPathOut = 'data/data_out.json';
    console.log(`Saving the results in ${dataPathOut}`);
    writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8')
    mutex = false;
    await new Promise(resolve => setTimeout(resolve, 1)) // this timeout is needed to provide some space so that other concurrent tasks currently waiting for a lock can get it, f.e. a hunter
  }
}

import { calcSports } from './calc/calc.js'
async function calc(){
  while(true){
    await new Promise(resolve => setTimeout(resolve, 60000)); // 1min
    console.log(`Calculating...`);
    const calcReport = await calcSports(availableAbbrev);
    console.log(`Finished calculations.`);
    console.log(calcReport);
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
  await singleHunt();
  const Pscrape = scrape();
  const Phunt = hunt();
  const Pcalc = calc();
  const promises = [ Pscrape, Phunt, Pcalc ];
  await Promise.allSettled(promises);
})()

// ##############################################################################################################
// ##############################################################################################################
// ##############################################################################################################