import { Queue } from "async-await-queue";
import { writeFileSync, truncateSync, existsSync, createWriteStream } from "fs"
import { promisify } from "util";
import { prepPage } from "../page.js";

/**
 * this function only gets one URL and is the only one exposed to the outside
 * 
 * @param book bookdata of this book, loaded from ./books/XYZ/book.json
 * all the required file locations are built from content of the bookdata
*/
export async function huntSportURLs(browser, book){
    const url = book.baseURL;

    // open a file for logging
    const logFilePath = `./books/${book.abbrev}/log.txt`;
    const log = createWriteStream(logFilePath, {flags: 'a'});
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

    const page = await prepPage(browser, book);
    let hrefs = [];
    try{
        await page.goto(url);

        await page.waitForSelector('div.infinite-scroll-list');
        hrefs = await page.evaluate( async () => {
            //debugger;
            const ret = [];
            const sports = document.querySelectorAll('div.navigation-element a');
            for(const sport of sports){
                const elSizeGames = sport.querySelector('div.navigation-element-heading__side');
                const sizeGames = elSizeGames ? parseInt(elSizeGames.textContent) : 0;
                if(sizeGames){
                    await sport.click();
                    let matchGroups = document.querySelectorAll('div.infinite-scroll-list');
                    while( matchGroups.length === 0 ){
                        await new Promise(resolve => setTimeout(resolve, 100));
                        matchGroups = document.querySelectorAll('div.infinite-scroll-list');
                    }
                    let newHrefs = 0;
                    let size;
                    do{
                        size = matchGroups.length;
                        window.scrollTo(0, document.body.scrollHeight);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        matchGroups = document.querySelectorAll('div.infinite-scroll-list');
                    } while( size != matchGroups.length);
                    for(const matchGroup of matchGroups){
                        const matches = matchGroup.querySelectorAll(':scope > *');
                        for(const match of matches){
                            const hrefsLocal = match.querySelectorAll(':scope > a');
                            if(hrefsLocal.length === 3){
                                const href = hrefsLocal[2].getAttribute('href');
                                ret.push(href);
                                newHrefs++;
                            }
                        }
                    }
                }
            }
            return ret;
        });
        log.write(`Success! Hunted ${hrefs.length} hrefs from ${url}\n`);

        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted\n`);
        log.write(error.message);
        return -1;
    } finally{
        // writeFileSync(toursPath, JSON.stringify(tuple.tours, null, 2));
        // writeFileSync(sportsPath, JSON.stringify(tuple.sports, null, 2));
        writeFileSync(dataOutPath, JSON.stringify(hrefs, null, 2));
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log);
    }
}