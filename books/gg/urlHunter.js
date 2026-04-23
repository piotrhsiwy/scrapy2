import { createWriteStream, } from "fs"
import { promisify } from "util";
import { prepPage } from "../page.js";
import { datestringToISO } from "./parser.js";
import { insertToScrapeUrl } from "../../data/db/inserter.js";

// global variables in this module
let log;
/**
 * this function only gets one URL and is the only one exposed to the outside
 * 
 * @param meta metadata of this book, loaded from ./books/XYZ/meta.json
 * all the required file locations are built from content of the metadata
 */
export async function huntSportURLs(browser, book){
    const url = book.baseURL;
    // open a file for logging
    const logFilePath = `./books/${book.abbrev}/log.txt`;
    log = createWriteStream(logFilePath, {flags: 'a'});
    // open and empty writing stream
    
    let hrefs = [];
    let page;
    try{
        page = await prepPage(browser, book);
        await page.goto(url);
        
        await page.waitForSelector('a[data-action="Open sport"]');
        
        hrefs = await page.evaluate( async () => {
            debugger;

            async function waitMax(max){
                let delay = 0;
                let delta = 10;
                let matches = document.querySelectorAll('div[data-test=sport-event-in-view-subscription] > a');
                let size;
                do{
                    size = matches.length;
                    await new Promise(resolve => setTimeout(resolve, delta));
                    delay += delta;
                    matches = document.querySelectorAll('div[data-test=sport-event-in-view-subscription] > a');
                } while(size === matches.length && delay < max);
                return matches;
            }
            
            const sports = document.querySelectorAll('a[data-action="Open sport"]');
            let ret = [];
            for(const sport of sports){
                const href = sport.getAttribute('href');
                if(href.includes('esport') &&
                !href.includes('esports_basketball') &&
                !href.includes('esports_fifa')){
                    sport.click();
                    const NAVI_DELAY = 1000;
                    await new Promise(resolve => setTimeout(resolve, NAVI_DELAY));
                    let matches = document.querySelectorAll('div[data-test=sport-event-in-view-subscription] > a');
                    let size;
                    do{
                        size = matches.length;
                        matches[matches.length-1]?.scrollIntoView();
                        matches = await waitMax(NAVI_DELAY);
                    } while(size !== matches.length);
                
                    let array = Array.from(document.querySelectorAll('div[data-test=sport-event-in-view-subscription] a')).map((e) => {
                        const url = e.href;
                        const datetime = e.querySelector('div.text-sm.text-grey-500.opacity-100')?.textContent?.trim();
                        return {
                            url: url,
                            datestring: datetime,
                        }
                    });
                    array = array.filter(e => e.url.includes('match') && !!e.datestring );
                    ret = ret.concat(array);
                }
            }
            return ret;
        });

        // parse the datestrings
        hrefs = hrefs.map(e => {
            if(!e.datestring){
                return undefined;
            } else{
                let ISOString;
                try{
                    ISOString = datestringToISO(e.datestring);
                } catch(error){
                    log.write(`Warning! Invalid date of the match under [${e.url}]:${e.datestring}. Error thrown by the date parser: ${error.message}\n`);
                    return undefined;
                }
                return {
                    url: e.url,
                    datetime: ISOString
                }
            }
        })

        // prune the hrefs array
        log.write(`Success! ${hrefs.length} hrefs from ${url} before pruning!\n`);
        const hrefsPruned = hrefs.filter(e => e);

        log.write(`Success! Hunted ${hrefsPruned.length} hrefs from ${url}\n`);
        hrefs = hrefsPruned;

        for(const href of hrefsPruned){
            await insertToScrapeUrl(log, book.name, href.url, href.datetime);
        }

        return 0;

    } catch(error){
        log.write(`Critical Failure! Error message: ${error.message}. Error stack: ${error.stack} Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted\n`);
        return -1;
    } finally{
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log)();
    }
}
