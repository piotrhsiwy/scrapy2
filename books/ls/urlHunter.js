import { createWriteStream } from "fs"
import { promisify } from "util";
import { prepPage } from "../page.js";
import { datestringToISO } from "./parser.js";
import { insertToScrapeUrl } from "../../data/db/inserter.js";

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
        
        // get hrefs
        const sporthrefs = await page.$$eval('li[id*=sports-menu-sub-item_]', (items, url) => {
            let ret = [];
            for(const item of items){
                const href = item.querySelector('a')?.href;
                ret.push(href);
            }
            return ret;
        });

        for(const sporthref of sporthrefs){

            await page.goto(sporthref);
            try{
                await page.waitForSelector('div[class*=Sportsbook_sportsbook__event__]', {timeout: 5000});
            } catch(TimeoutError){
                log.write(`Warning! No events under url: [${sporthref}]\n`);
            }

            const events = await page.$$('div[class*=Sportsbook_sportsbook__event__]');

            for(const event of events){

                const { url, day, hour } = await page.evaluate(async (event, sporthref) => {
                    // debugger;

                    let iter = event.previousElementSibling;
                    while( iter && !iter.matches('h4[class*=Sportsbook_sportsbook__subtitle__]')){
                        iter = iter.previousElementSibling;
                    }
                    const leagueStub = iter?.textContent.trim().replace('[', '').replace(']', '').toLowerCase().replaceAll(' ', '-');
                    const id = event.querySelector('div[id*=root_market__')?.id.split('__')[1];
                    const url = sporthref + '/' + leagueStub + '/' + id;

                    iter = event.previousElementSibling;
                    while( iter && !iter.matches('h3[class*=Sportsbook_sportsbook__title__]')){
                        iter = iter.previousElementSibling;
                    }
                    const day = await iter.querySelector('span')?.textContent;
                    const hour = await event.querySelector( 'span[class*=Sportsbook_sportsbook__eventDescriptionTime__]')?.textContent;
                    return {url, day, hour};
                }, event, sporthref);

                hrefs.push({
                    url: url,
                    datestring: hour + ', ' + day
                });
            }
        }

        hrefs = hrefs.map( ({url, datestring}) => {
            let ISOString;
            try{
                ISOString = datestringToISO(datestring);
            } catch(error){
                log.write(`Warning! Invalid date of the match under [${url}]:${datestring}. Error thrown by the date parser: ${error.message}\n`);
                return undefined;
            }
            return {
                url: url,
                datetime: ISOString
            };
        } )

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
 