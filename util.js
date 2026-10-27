import { accessSync, rmSync, readFileSync, existsSync, truncateSync } from 'fs'
import { constants } from 'buffer';

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const availableAbbrev =  // rest of the book-data is in ./books/${abbrev}/meta.json files
[
  // tested HUNTERS, HEADFULL
  // '22',  // OK - OK
  // 'dex', // OK - OK
  // 'esb', // OK - OK
  // 'gg',  // OK - OK
  'ls',  // OK - OK
  // 'tp',  // OK - OK
  // 'ms', FAILS on goto , probably wall
  // 'bnj', // FAILS vercel checkpoint?
]

export function timeframeFrom(from){
  const to = new Date(from);
  to.setFullYear(to.getFullYear() + 1000)
  const timespan = {from:from, to:to.toISOString()};
  return timespan;
}

export function timeframeTo(to){
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1000)
  const timespan = {from:from.toISOString(), to:to};
  return timespan;
}

export function timeframeFromTo(from, to){
  const timespan = {from:from, to:to};
  return timespan;
}

export function timeframeNowMinutes(minutes){
  const now = new Date();
  now.setMinutes(0);
  now.setSeconds(0);
  now.setMilliseconds(0);
  const from = now.toISOString()
  now.setMinutes(now.getMinutes() + minutes);
  const to = now.toISOString();
  const timespan = {from:from, to:to};
  return timespan;
}

export function timeframeNowHours(hours){
  const now = new Date();
  now.setMinutes(0);
  now.setSeconds(0);
  now.setMilliseconds(0);
  const from = now.toISOString()
  now.setHours(now.getHours() + hours);
  const to = now.toISOString();
  const timespan = {from:from, to:to};
  return timespan;
}

export async function loadModules(){

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

    return books;
}

export function cleanLogs(books){
  console.log(`Cleaning...`);
  for(const book of books){
    const path = `./books/${book.abbrev}/log.txt`;
    if(existsSync(path)){ truncateSync(path, 0); }
    console.log(`Cleared file ${path}`);
  }
}

export async function openBrowser(){
  // verifying that the executable is present
  // const BROWSER_EXECUTABLE_PATH = process.env.BROWSER_EXECUTABLE_PATH
  //  || '/home/Piotr/Documents/scrapy2/chrome-headless-shell/linux-147.0.7727.50/chrome-headless-shell-linux64/chrome-headless-shell';
  // const BROWSER_EXECUTABLE_PATH = 'C:\\Users\\Xpite\\AppData\\Local\\Chromium\\Application\\chrome.exe';
  const BROWSER_EXECUTABLE_PATH = '/usr/bin/chromium';
  try{
    accessSync(BROWSER_EXECUTABLE_PATH, constants.X_OK);
  } catch(error){
    if(error.code === 'ENOENT'){
      console.log('Browser executable is missing under: ', BROWSER_EXECUTABLE_PATH);
      return undefined;
    }
  }
  // preparing the userData dir
  const USERDATA_PATH = '/home/Piotr/.userData_temp';
  // const USERDATA_PATH = 'C:\\Users\\Xpite\\AppData\\Local\\Chromium\\userData_temp'
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
      // '--disable-gpu', // (bnj) causes the browser to not pass the Vercel Checkpoint Verification
      // '--disable-web-security', // (bnj) causes the browser to not pass the Vercel Checkpoint Verification
      // '--disable-blink-features=AutomationControlled', // already handled by puppeteerStealth plugin
      // `--proxy-server=${PROXY_URL}`,
      '--proxy-bypass-list=*',
      '--no-startup-window',
      // // '--disk-cache-dir=/dev/null', // does not work with chrome-headless-shell binary (file exists error)
      '--disk-cache-size=1',
      '--aggressive-cache-discard',
      '--disable-notifications',
      '--disable-remote-fonts',
      '--disable-translate',
      '--disable-infobars',
      // // '--disable-reading-from-canvas', // (22bet) causes to not load elements
      '--disable-remote-playback-api',
      '--disable-shared-workers --disable-voice-input',
      '--enable-aggressive-domstorage-flushing',
      '--disable-site-isolation-trials',
      '--disable-features=NetworkService,NetworkServiceInProcess,TranslateUI',
      '--disable-component-extensions-with-background-pages',
      '--disable-extensions',
      // '--disable-background-timer-throttling', // (bnj) causes the browser to not pass the Vercel Checkpoint Verification
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--enable-quic',
    ],
    userDataDir: USERDATA_PATH,
    executablePath: BROWSER_EXECUTABLE_PATH,
    devtools: true,
    waitForInitialPage: false, 
    slowMo:false,
    dumpio:false,
  }); 
  return browser;
}