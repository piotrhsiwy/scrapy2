async function cleanLogs(){
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

async function loadModules(){
  console.log(`Loading modules...`);
  for(let i = 0; i < books.length; i++){
    const hunterModuleName = `./books/${books[i].abbrev}/urlHunter.js`;
    const scraperModuleName = `./books/${books[i].abbrev}/urlScraper.js`;
    await import(hunterModuleName).then( async (module) => {
      books[i].hunterModule = module; 
      console.log(`Imported module ${hunterModuleName}`);
    }, () => {
      console.log(`Importing module failed ${hunterModuleName}`);
    });
    await import(scraperModuleName).then( async (module) => {
      books[i].scraperModule = module; 
      console.log(`Imported module ${scraperModuleName}`);
    }, () => {
      console.log(`Importing module failed ${scraperModuleName}`);
    });
    if( ! books[i].hunterModule || ! books[i].scraperModule ){
      books.splice(i, 1);
      i--;
    }
  }
}

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
async function openBrowser(){
  // verifying that the executable is present
  // const BROWSER_EXECUTABLE_PATH = '/usr/bin/chromium';
  const BROWSER_EXECUTABLE_PATH = 'C:\\Users\\Xpite\\AppData\\Local\\Chromium\\Application\\chrome.exe';
  try{
    accessSync(BROWSER_EXECUTABLE_PATH, constants.X_OK);
  } catch(error){
    if(error.code === 'ENOENT'){
      console.log('Browser executable is missing under: ', BROWSER_EXECUTABLE_PATH);
      return undefined;
    }
  }
  // preparing the userData dir
  // const USERDATA_PATH = '/home/Piotr/.config/chromium/temp';
  const USERDATA_PATH = 'C:\\Users\\Xpite\\AppData\\Local\\Chromium\\userData_temp'
  try{
    console.log('Clearing the userData directory under: ', USERDATA_PATH);
    rmSync(USERDATA_PATH, {recursive: true, force: true});
  } catch(error){
    if(error.code === 'ENOENT' || error.code === 'ENOTDIR'){
      console.log('This is a file, not a directory! ', BROWSER_EXECUTABLE_PATH);
    }
  }
  console.log('Browser instance will be ran on the following userData directory:', USERDATA_PATH);
  console.log('Preparing browser and pages...');
  puppeteer.use(StealthPlugin());
  const browser = await puppeteer.launch({
  headless: true,
    args: [
      // '--host-resolver-rules=MAP thunderpick.io 172.64.154.81',
      // '--host-resolver-rules=MAP static.cloudflareinsights.com 104.16.80.73',
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-blink-features=AutomationControlled',
      '--proxy-server="direct://"',
      '--proxy-bypass-list=*',
      '-no-startup-window',
      '--disk-cache-dir=./NUL',
      '--disk-cache-size=1',
      '--aggressive-cache-discard',
      '--disable-notifications',
      '--disable-remote-fonts',
      // '--disable-reading-from-canvas', // causes 22bet to not load elements
      '--disable-remote-playback-api',
      '--disable-shared-workers --disable-voice-input',
      '--enable-aggressive-domstorage-flushing',
      '--disable-site-isolation-trials',
      '--disable-features=NetworkService,NetworkServiceInProcess',
    ],
    userDataDir: USERDATA_PATH,
    executablePath: BROWSER_EXECUTABLE_PATH,
    devtools: false,
    waitForInitialPage: false, 
    slowMo:false,
    dumpio:false,
  }); 

  return browser;
}
  
async function singleHunt(browser){
  console.log('Hunting...')
  for(const book of books){ 
    const MAX_RETRIES = 3;
    let count =  MAX_RETRIES;
    let ret;
    do{
      console.log(`Hunt from ${book.abbrev} module ${book.baseURL}. Retries left: ${count}`);
      ret = await book.hunterModule.huntSportURLs(browser, book);
      console.log(`Returned ${ret}.`);
    } while(ret !== 0 && count--);
  }
}

const DATA_FILE_PATH = 'data/data_out.json';
function loadData(){
  let data = {sports:[]};
  try{
    console.log(`Loading the data file: ${DATA_FILE_PATH}`);
    accessSync(DATA_FILE_PATH, constants.W_OK | constants.R_OK);
    data = JSON.parse(readFileSync(DATA_FILE_PATH));
  } catch(error){
    if(error.code === 'ENOENT'){
      console.log(`Data file does not exist. Creating file: ${DATA_FILE_PATH}. Starting with empty data = {sports:[]}`);
      writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    }
  } finally{
    return data;
  }
}

function saveData(data){
  console.log(`Saving the results in ${DATA_FILE_PATH}`);
  writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf8')
}

import { calcSports } from './calc/calc.js'
async function calc(arbCutoff, evCutoff){
  console.log('Calculating...')
  const calcReport = await calcSports(arbCutoff, evCutoff);
  console.log(`Finished calculations.`);
  console.log(calcReport);
}

import { Queue } from "async-await-queue";
import { ISO8601ToDate } from "./data/util/prettify.js";
async function run(){ 
  if(books.length === 0){
    console.log(`No books available.`);
    return -1;
  }
  /** load data *******************/
  const data = loadData();
  /********************************* */
  while(true){;
    //  new
    const myq = new Queue(1, 1000);
    /**
     * Total execution times for the first 25 scrapes (until the first calc() call is hit) for different queue sizes
     * 8      0       3:07
     * 16     10      3:03
     * 16     100     3:26
     * 32     10      3:08
     * 64     0       3:21
     * 64     10      3:16
     * size   delay   time[s]
     * 5      10      76 
     * 5      1000    92
     * 10     10      71
     * 10     100     76
     * 10     1000    83
     * 20     10      71
     * 20     1000    82 
     * 64     1000    77 
     */
    const q = [];
    const browser = await openBrowser();
    try{
      /** hunt and load urls ****************/
      await singleHunt(browser);
      console.log('Loading urls from files...');
      for(const book of books){
        const urlsFilePath = `./books/${book.abbrev}/matchURLs.json`;
        try{
          book.urls = JSON.parse(readFileSync(urlsFilePath));
          book.urls.sort((a, b) => ISO8601ToDate(a.datetime).getTime() - ISO8601ToDate(b.datetime).getTime() );
          for(let i = 0; i < book.urls.length; i++){
            const daysIntoTheFuture = 1;
            if(ISO8601ToDate(book.urls[i].datetime).getTime() - new Date().getTime() > daysIntoTheFuture*24*60*60*1000){
              book.urls.splice(i, book.urls.length - (i+1));
              break;
            }
          }
          book.urls = book.urls.flatMap(e => e.url);
        } catch(error){
          console.log(`Loading file ${urlsFilePath} failed.`)
          return -1;
        }
        console.log(`Loaded file ${book.urls.length} entries from file ${urlsFilePath}`);
      } 
      /************************************ */
      for(let i = 0; ; i++){
        let anyUrlUnderI = false;
        /** scrape ****************************/
        for(const book of books){
          if(i < book.urls.length){
            async function wrapper(data, browser, book, i){
              let ret;
              try{
                ret = await book.scraperModule.scrapeMatchURL(data, browser, book, i);
              } catch(e){
                throw e;
              }
              const date = new Date();  
              console.log(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Completed scrape with result: ${ret} from ${book.urls[i]}`);
            }
            q.push(myq.run(() => wrapper(data, browser, book, i)
              .catch((e) => console.error(e))));
            // console.log(`Queued scrape from ${book.abbrev} module urls[${i}]: ${book.urls[i]}`);
            anyUrlUnderI = true;
          }
        }
        if(i%2 === 1){
          saveData(data);
          // q.push(myq.run(() => calc(arbCutoff, evCutoff)).catch((e) => console.error(e)));
          // console.log(`Queued savecalc()`);
        }
        if(!anyUrlUnderI){
          break;
        }
        await Promise.all(q);
        /******************************* */
      }
    } finally{
      await browser?.close(); 
    }
  } 
}


// ##############################################################################################################
// ##############################################################################################################
// ##############################################################################################################

import { readFileSync, writeFileSync, existsSync, truncateSync, accessSync, rmSync } from 'fs'
import { constants } from "buffer";
const availableAbbrev =  // rest of the book-data is in ./books/${abbrev}/meta.json files
[
  'tp',
  'esb',
  'ls',
  'gg',
  `ms`,
  '22', // 15min ratelimiter if too many requests -> IP blockers in place
// // restricted from germany so use one of the mirrors: bestwinzz.com 22bets.me
]
console.log(`seeds of availabuule books: ${availableAbbrev.toString()}`);

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
  await loadModules();
  await cleanLogs();
  await run();
})()

// ##############################################################################################################
// ##############################################################################################################
// ##############################################################################################################
