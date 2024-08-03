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

// let mutex = false;
// async function hunt(){
//   while(true){
//     await new Promise(resolve => setTimeout(resolve, 3*3600000)) // 1h
//     console.log('Hunter retrieving lock...')
//     while(mutex){ await new Promise(resolve => setTimeout(resolve, 1)); }
//     mutex = true;
//     for(const book of books){
//       console.log(`Queued hunt from ${book.abbrev} module`);
//       await book.hunterModule.huntSportURLs(book);
//       const urlsFilePath = `./books/${book.abbrev}/matchURLs.json`;
//       book.urls = JSON.parse(readFileSync(urlsFilePath));
//       console.log(`Reloaded ${book.urls.length} entries from file ${urlsFilePath}`);
//     }
//     mutex = false;
//   }
// }

async function save(data){
  const dataPathOut = 'data/data_out.json';
  console.log(`Saving the results in ${dataPathOut}`);
  writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8')
}

import { calcSports } from './calc/calc.js'
async function calc(){
  console.log('Calculating...')
  const calcReport = await calcSports();
  console.log(`Finished calculations.`);
  console.log(calcReport);
}

async function savecalc(data){
  await save(data);
  await calc();
}


import { Queue } from "async-await-queue";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth"
async function scrape(){ 
  console.log('Loading urls from files...');
  for(const book of books){
    const urlsFilePath = `./books/${book.abbrev}/matchURLs.json`;
    try{
      book.urls = JSON.parse(readFileSync(urlsFilePath));
    } catch(error){
      console.log(`Loading file ${urlsFilePath} failed.`)
      return -1;
    }
    console.log(`Loaded file ${book.urls.length} entries from file ${urlsFilePath}`);
  } 
  console.log('Preparing browser and pages...');
  puppeteer.use(StealthPlugin());
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security',
      '--proxy-server="direct://"',
      '--proxy-bypass-list=*',
    ],
    userDataDir: 'C:\\Users\\User\\AppData\\Local\\Temp\\puppeteer_temp',
    devtools: false,
  }); 
  const data = {sports: []};
  let i = 0;
  while(true){
    const myq = new Queue(10, 1000);
    const q = [];
    for(let i = 0; ; i++){
      let anyUrlUnderI = false;
      for(const book of books){
        if(i < book.urls.length){
          console.log(`Preparing page for: ${book.urls[i]}`)
          async function wrapper(data, browser, book, i){
            let ret;
            try{
              ret = await book.scraperModule.scrapeMatchURL(data, browser, book, i);
            } catch(e){
              throw e;
            }
            console.log(`Completed scrape with result: ${ret} from ${book.urls[i]}`);
          }
          q.push(myq.run(() => wrapper(data, browser, book, i)
            .catch((e) => console.error(e))));
          console.log(`Queued scrape from ${book.abbrev} module urls[${i}]: ${book.urls[i]}`);
          anyUrlUnderI = true;
        }
      }
      if(i%10 === 0){
        q.push(myq.run(() => savecalc(data)).catch((e) => console.error(e)));
        console.log(`Queued savecalc()`);
      }
      if(!anyUrlUnderI){
        break;
      }
    }
    await Promise.all(q);
    await singleHunt(); } 
}


// ##############################################################################################################
// ##############################################################################################################
// ##############################################################################################################

import { readFileSync, writeFileSync, existsSync, truncateSync } from 'fs'
const availableAbbrev =  // rest of the book-data is in ./books/${abbrev}/meta.json files
[
  'ms',
  'tp',
  'gg',
  'ls',
  'esb',
  '22', // 15min ratelimiter if too many requests -> IP blockers in place
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
  await calc();
  await calc();
  // await singleHunt();
  // await scrape();
})()

// ##############################################################################################################
// ##############################################################################################################
// ##############################################################################################################