import { createWriteStream } from "fs"
import { prepPage } from "../page.js";
import { datestringToISO } from "./parser.js";
import { insertToScrapeUrl } from "../../data/db/inserter.js";
import { promisify } from "util";

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
    const log = createWriteStream(logFilePath, {flags: 'a'});

    const page = await prepPage(browser, book);
    let hrefs = [];
    try{
        await page.goto(url);
        // Function to remove script tags from the page
        await page.evaluate(() => {
            const scripts = document.querySelectorAll('script');
            scripts.forEach(script => script.remove());
            const metas = document.querySelectorAll('meta');
            metas.forEach(meta => meta.remove());
        });

        await page.waitForSelector('ul.liga_menu');
        
        hrefs = await page.evaluate( async () => {
            // debugger;
            // open up all the tournament tabs to trigger adding event-menus to the dom (we scrape links fromt the left bar)
            const tabs = document.querySelectorAll('ul.liga_menu > li > a');
            for(const tab of tabs){
                tab.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // scrape the hrefs of the games
            const games = Array.from(document.querySelectorAll('ul.event_menu > li > a'));
            const ret = games.map(e => {
                return {
                    url: e.href,
                    datestring: e.querySelector('span[class=date]')?.textContent
                }
            })
            return ret;
        });

        hrefs = hrefs.map(({url, datestring}) => {
            let ISOString;
            try{
                ISOString = datestringToISO(datestring);
            } catch(error){
                log.write(`Warning! Invalid date of the match under ${url}. Error thrown by the date parser: ${error.message}\n`);
                return undefined;
            }
            return {
                url: url,
                datetime: ISOString
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
        log.write(`Critical Failure! Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted\n`);
        return -1;
    } finally{
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log)();
    }
}