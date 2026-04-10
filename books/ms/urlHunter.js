import { createWriteStream, writeFileSync, existsSync, truncateSync } from "fs"
import { promisify } from "util";
import { prepPage } from "../page.js";
import { datestringListToISO } from "./parser.js";

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

    let page = await prepPage(browser, book);
    const originalPage = page;
    let hrefs = [];
    try {
        await page.goto(url);

        let selector = 'iframe';
        await page.waitForSelector(selector);
        const iframeHandle = await page.$(selector);
        page = await iframeHandle.contentFrame();

        // set checkboxes for all the sports to load all the matches
        // all available esports ever on this book
        const availableEsports = ['Counter-Strike', 'Dota 2', 'League of Legends', 'Valorant', 'Rainbow Six', 'Rocket League', 'Starcraft', 'Call of Duty', 'StarCraft BroodWar'];
        for (const esport of availableEsports) {
            selector = `span[title="${esport}"] ~ div.chbx`;
            const available = await page.$(selector);
            if (available) {
                await page.$eval(selector, (el) => { el.classList.add('checked'); });
                const sportCheckbox = await page.$(selector);
                if (sportCheckbox) {
                    await sportCheckbox.click();
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    log.write(`Warning! No sportTab checkbox for ${esport} on ${url}.\n`);
                }
            } else {
                log.write(`Warning! No sportTab for ${esport} on ${url}.\n`);
            }
        }

        // // get sport Names
        // tuple.sports = await page.evaluate(() => {
        //     return Array.from(document.querySelectorAll('div.sportname span[title]')).map( e => e.getAttribute('title'));
        // });

        // // get tournament Names, after all the boxes have been checked
        // tuple.tours = await page.evaluate( () => {
        //     return Array.from(document.querySelectorAll('div[country="tournaments"] ~ div.title > span[title]')).map( e => e.textContent );
        // });

        hrefs = await page.evaluate(async () => {
            // debugger;
            const ret = [];
            async function processItems() {
                // scroll till all matches are loaded
                let items = document.querySelectorAll('ul.match-list > li');
                let size;
                do {
                    size = items.length;
                    // debug
                    // console.log(size);
                    items[items.length - 1].scrollIntoView();
                    await new Promise(resolve => setTimeout(resolve, 100));
                    items = document.querySelectorAll('ul.match-list > li');
                    // debug
                    // console.log(`items.length=${items.length}`);
                    // console.log(`size=${size}`);
                } while (size !== items.length);

                for (const item of items) {
                    const clickable = item.querySelector('div[class=market-count] > span');
                    // get datestring
                    const [day, time] = Array.from(item.querySelectorAll('div.start-time > p')).map( e => e?.textContent);
                    clickable.click();
                    const url = window.location.href;
                    ret.push({
                        url: url,
                        day: day,
                        time: time
                    });
                }
            }
            await processItems();
            return ret;
        }) 

        hrefs = hrefs.map(({url, day, time}) => {
            let ISOString;
            try{
                ISOString = datestringListToISO(day, time);
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
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted\n`);
        log.write(error.message);
        return -1;
    } finally{
        writeFileSync(dataOutPath, JSON.stringify(hrefs, null, 2));
        // writeFileSync(toursPath, JSON.stringify(tuple.tours, null, 2));
        // writeFileSync(sportsPath, JSON.stringify(tuple.sports, null, 2));
        try{ await originalPage.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log)();
    }
}
