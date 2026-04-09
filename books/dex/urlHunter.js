import { createWriteStream, writeFileSync, existsSync, truncateSync, readFileSync } from "fs"
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
    const bookAbbrev = book.abbrev;
    const url = book.baseURL;

    // open a file for logging
    const logFilePath = `./books/${bookAbbrev}/log.txt`
    const log = createWriteStream(logFilePath, {flags: 'a'});
    // open and empty file for data
    const dataOutPath = `./books/${book.abbrev}/matchURLs.json`;
    if(existsSync(dataOutPath)){
        truncateSync(dataOutPath, 0);
    }

    // load the book-specific mappings from json files
    const sportNameMappingPath = `books/${bookAbbrev}/sportNameMapping.json`;
    let sportNameMapping;
    try{
        sportNameMapping = Object.freeze(JSON.parse(readFileSync(sportNameMappingPath)));
        if(!sportNameMapping){ throw error(); }
    } catch (error){
        log.write(`Failure! Cannot open file ${sportNameMappingPath} or incorrect JSON format\n`);
        return -10;
    }

    const page = await prepPage(browser, book);
    let hrefs = [];
    try{
        await page.goto(url);
        const popup = await page.waitForSelector('img[src="/assets/icons/close.svg"]');
        await popup.click();
        await page.waitForSelector('div.games-nav__group-pro', {timeout:30000});
        
        // get sports from menu
        const sports = await page.$$('div.games-nav__group-pro._disciplines a.games-nav__item-pro');
        for(const sport of sports){
            await sport.click();
            // select the Prematch filter
            const prematchButtonArray = await page.$$eval('a.lobby-filters__item-pro span[class=lobby-filters__item-text]', els => {
                els.filter(e.textContent == 'Prematch')
            })
            if(prematchButtonArray == []){
                log.write(`Warning! Prematch button not found.\n`);
            } else{
                await prematchButtonArray[0].click();
                await page.waitForSelector('div.grid-line', {timeout:3000});
                // get hrefs for each game
                batchHrefs = await page.$$eval('a.grid-event', els => els.map(e => {
                    debugger;
                    const day = e
                        .closest('div.grid-line__content')
                        .parentElement
                        .querySelector('div.grid-line__title .grid-line__title-main span')
                        .textContent;
                    const time = e.querySelector('div.grid-event__time span').textContent;
                    url = e.querySelector('a.grid-event__competitors').href
                    return {
                        url: url,
                        datestring: day + ', ' + time
                    }
                }))
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
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted.\n`);
        log.write(error.message);
        return -1;
    } finally{
        // writeFileSync(sportsPath, JSON.stringify(tuple.sports, null, 2));
        // writeFileSync(toursPath, JSON.stringify(tuple.tours, null, 2));
        writeFileSync(dataOutPath, JSON.stringify(hrefs, null, 2), 'utf8');
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        promisify(log.end).bind(log);
    }
}