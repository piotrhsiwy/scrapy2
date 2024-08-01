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
      const promises = [];
      for(const book of books){
        if(i < book.urls.length){
          const promise = book.scraperModule.scrapeMatchURL(data, book.urls[i]);
          promises.push(promise);
          console.log(`Queued scrape from ${book.abbrev} module from ${book.urls[i]}`);
        }
      }
      console.log(`Running a batch of ${promises.length} scrapers`);
      console.log( (await Promise.allSettled(promises)).map(e => e.value === 0 ? 'success' : 'failure') );
      const dataPathOut = 'data/data_out.json';
      console.log(`Saving the results in ${dataPathOut}`);
      writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8')
    }
  }
}

import { calcSports } from './calc/calc.js'
async function calc(){
  while(true){
    console.log(`Calculating...`);
    const calcReport = await calcSports(availableAbbrev);
    console.log(`Finished calculations.`);
    console.log(calcReport);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 5min
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
  await calc();
  // await singleHunt();
  // const Pscrape = scrape();
  // const Phunt = hunt();
  // const Pcalc = calc();
  // const promises = [ Pscrape, Phunt, Pcalc ];
  // await Promise.allSettled(promises);
})()

// ##############################################################################################################
// ##############################################################################################################
// ##############################################################################################################