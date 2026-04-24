import { Queue } from "async-await-queue";
import { timeframeNowHours, openBrowser, cleanLogs, loadModules } from './util.js';
import { getToScrapeUrls } from "./data/db/getter.js";
import { initDbData } from "./data/db/db.js";
import { parseArgs } from 'node:util';

// await initDbData();
const books = await loadModules();

cleanLogs(books);

const options = {
  hours: { type: 'string', short: 'h', default: '24' },
  concurrency: { type: 'string', short: 'c', default: '16' },
};
const { values } = parseArgs({ options });
const HOURS = parseInt(values.hours);
const CONCURRENCY = parseInt(values.concurrency);

while(true){
  const myq = new Queue(CONCURRENCY, 100);
  const q = [];
  /** load urls (attach them to the respective book object) ****************/
  console.log('Getting urls from db...');
  const timeframe = timeframeNowHours(HOURS);
  for(const book of books){
    const ret = await getToScrapeUrls(timeframe, book.name);
    book.urls = ret.flatMap(e => e.url);
    // book.urls = ret.length ? book.urls : [];
  }

  const browser = await openBrowser();
  for(let i = 0; ; i++){
    let anyUrlUnderI = false;
    /** scrape ****************************/
    for(const book of books){
      if(i < book.urls.length){
        async function wrapper(browser, book, i){
          let ret;
          try{
            ret = await book.scraperModule.scrapeMatchURL(browser, book, i);
          } catch(e){
            throw e;
          }
          const date = new Date();  
          console.log(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Completed scrape with result: ${ret} from ${book.urls[i]}`);
        }
        q.push(myq.run(() => wrapper(browser, book, i)
          .catch((e) => console.error(e))));
        console.log(`Queued scrape from ${book.abbrev} module urls[${i}]: ${book.urls[i]}`);
        anyUrlUnderI = true;
      }
    }
    if(!anyUrlUnderI){
      break;
    }
  }
  await Promise.all(q);
  await browser.close();
} 