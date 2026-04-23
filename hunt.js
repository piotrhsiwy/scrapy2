import { initDbHunt } from './data/db/db.js';
import { openBrowser, loadModules, cleanLogs} from './util.js'

async function singleHunt(){
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

// await initDbHunt();
const browser = await openBrowser();
const books = await loadModules();

cleanLogs(books);
while(true){
    await singleHunt();
}
