import { createWriteStream, writeFileSync, existsSync, truncateSync } from "fs"
import { promisify } from "util";
import { prepPage } from "../page.js";

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
        await page.waitForSelector('div.lg_inrInfo');
        hrefs = await page.evaluate(async () => {
            //debugger;
            const ret = [];
            let allTours = document.querySelectorAll('div.lg_inrInfo');
            let curDispMatchrows = 0;
            let indicesOfVisible = [];
            for(let i = 0; i < allTours.length || curDispMatchrows !== 0; i++){

                let matchesInNextTour;
                if(i < allTours.length){
                    matchesInNextTour = parseInt(allTours[i].children[1].textContent);
                }

                if(curDispMatchrows + matchesInNextTour > 50 || i === allTours.length){

                    await new Promise(resolve => setTimeout(resolve, 2000));
                    // scrape
                    const items = document.querySelectorAll('div.matchRow');
                    // window.nodeLog('size of items:' + items.length);
                    for(let i = 0; i < items.length; i++){
                        const item = document.querySelectorAll('div.matchRow')[i];
                        // window.nodeLog('item: inside forloop' + item);
                        if(!item){
                            // window.nodeLog(`Failure! Item is not clickable ${page.url}, entry: ${hrefs.length}\n`);
                            continue;
                        }
                        await item.click();
                        // OPT this timer can be removed for faster performance, but then it looks less human?
                        // await new Promise(resolve => setTimeout(resolve, 100));
                        // window.nodeLog(`pushing: ` + page.url);
                        ret.push(window.location.href);
                        // window.nodeLog(`index ${hrefs.length-1} hunted matchURL: ${page.url}\n`);
                        const clickBack = document.querySelector('i.icon-arrow-left');
                        if(!clickBack){
                            // window.nodeLog(`Critical Failure! No clickable icon-arrow-left ${page.url}, entry: ${hrefs.length}. Cannot come back.\n`);
                            return ret;
                        }
                        await clickBack.click();
                        // OPT this timer can be removed for faster performance, but then it looks less human?
                        // await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    // clean the q aka unclick
                    allTours = document.querySelectorAll('div.lg_inrInfo');
                    while(indicesOfVisible.length !== 0){
                        allTours[indicesOfVisible.pop()].click();
                    }
                    curDispMatchrows = 0;

                } else{

                    // enq aka click
                    allTours[i].click();
                    indicesOfVisible.push(i);
                    curDispMatchrows += matchesInNextTour;
                    continue;

                }
            }
            return ret;
        })

        log.write(`Done hunting for SportsURLs from ${url}, ${hrefs.length} entries hunted\n`);
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
        await promisify(log.end).bind(log);
    }
}