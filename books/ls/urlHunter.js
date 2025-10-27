import { createWriteStream, writeFileSync, existsSync, truncateSync } from "fs"
import { promisify } from "util";
import { prepPage } from "../page.js";
import { datestringToISO } from "./parser.js";

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
    // open and empty file for data
    const dataOutPath = `./books/${book.abbrev}/matchURLs.json`;
    if(existsSync(dataOutPath)){
        truncateSync(dataOutPath, 0);
    }
    // const sportsPath = `./books/${book.abbrev}/sports.json`;
    // if(existsSync(sportsPath)){
    //     truncateSync(sportsPath, 0);
    // }
    // const toursPath = `./books/${book.abbrev}/tours.json`;
    // if(existsSync(toursPath)){
    //     truncateSync(toursPath, 0);
    // }

    const page = await prepPage(browser, book);
    let hrefs = [];
    try{
        await page.goto(url);
        // // get sport Names
        // tuple.sports = await page.evaluate( () => {
        //     return Array.from(document.querySelectorAll('#sports-menu-item__6000 > ul > li > a')).map( e => e.textContent);
        // });

        // // get tournament Names
        // tuple.tours = await page.evaluate( () => {
        //     const arr = Array.from(document.querySelectorAll('h4')).map( e => e.textContent.trim() );
        //     arr.pop();
        //     return arr;
        // });
        
        // get hrefs
        let selector;
        selector = 'div.osg-coupon__events > div > div.osg-coupon__event-description-row > a';
        await page.waitForSelector(selector);
        hrefs = await page.$$eval(selector, (items, url) => {
            // debugger;
            const matchURLs = [];
            for(const item of items){
                const href = items.map( item => item.getAttribute('href'))
                let hour;
                const rawHour = item.querySelector('span.event-name')?.textContent;
                const split = rawHour?.split('\u00a0', 2);
                if(!rawHour || split.length < 2){
                    matchURLs.push({
                        url: url + href,
                        datestring: undefined
                    });
                } else{
                    hour = split[0];
                    const day = item.closest('div.osg-coupon__sport')?.querySelector('h3')?.textContent;
                    matchURLs.push({
                        url: url + href,
                        datestring: hour + ', ' + day
                    });
                }
            }
            return matchURLs;
        }, book.baseURLBuilder);

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
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted\n`);
        return -1;
    } finally{
        writeFileSync(dataOutPath, JSON.stringify(hrefs, null, 2));
        // writeFileSync(toursPath, JSON.stringify(tuple.tours, null, 2));
        // writeFileSync(sportsPath, JSON.stringify(tuple.sports, null, 2));
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log);
    }
}