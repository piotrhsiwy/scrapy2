import { createWriteStream, writeFileSync, existsSync, truncateSync } from "fs"
import { promisify } from "util";
import { prepPage } from "../page.js";

async function huntMatchURLs(browser, book, hrefs, url){
    try{
        const page = await prepPage(browser, book);
        await page.goto(url);

        const ret = await page.evaluate(async (baseurl) => {
            // const sports = document.querySelector('a[data-action="Close sport"] div[data-test="categorizer-sport-list-content-title"]').textContent;
            // const tours = Array.from(document.querySelectorAll('div[data-test="tournament-list-row-title"]'))
            //     .map( e => e.textContent );
        }, book.baseURLBuilder);
        hrefs = hrefs.concat(ret);
        
        log.write(`Done hunting for hrefs from ${url}. ${hrefs.length - hrefs.length} + ${hrefs.length} new entries\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for hrefs from ${url} failed.\n`);
        return -1;
    } finally{
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
    }
}

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
    
    let hrefs = [];
    try{
        const page = await prepPage(browser, book);
        page.goto(url);
        
        await page.waitForSelector('a[data-action="Open sport"]');
        hrefs = await page.evaluate( async (baseurl) => {
            // debugger;

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
                if(href.includes('esport')){
                    sport.click();
                    const NAVI_DELAY = 3000;
                    await new Promise(resolve => setTimeout(resolve, NAVI_DELAY));
                    let matches = document.querySelectorAll('div[data-test=sport-event-in-view-subscription] > a');
                    let size;
                    do{
                        size = matches.length;
                        matches[matches.length-1].scrollIntoView();
                        matches = await waitMax(NAVI_DELAY);
                    } while(size !== matches.length);
                    ret = ret.concat(Array.from(matches).map( match => baseurl + match.getAttribute('href')));
                }
            }
            return ret;
        }, book.baseURLBuilder);
            
        log.write(`Done hunting for sportsURLs from ${url}, ${hrefs.length} entries hunted\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted\n`);
        return -1;
    } finally{
        writeFileSync(dataOutPath, JSON.stringify(hrefs, null, 2));
        // writeFileSync(sportsPath, JSON.stringify(tuple.sports, null, 2));
        // writeFileSync(toursPath, JSON.stringify(tuple.tours, null, 2));
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log);
    }
}