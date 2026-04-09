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
        await page.waitForSelector('div.lg_inrInfo');
        hrefs = await page.evaluate(async () => {
            // debugger;
            const ret = [];
            let allTours = document.querySelectorAll('div.lg_inrInfo');
            let curDispMatchrows = 0;
            let indicesOfVisible = [];
            for(let i = 0; i < allTours.length || curDispMatchrows !== 0; i++){

                let matchesInNextTour;
                if(i < allTours.length){
                    matchesInNextTour = parseInt(allTours[i].children[1].textContent);
                }

                if( (curDispMatchrows !== 0 && curDispMatchrows + matchesInNextTour > 50) || i === allTours.length){

                    // await new Promise(resolve => setTimeout(resolve, 2000));
                    // scrape
                    let items = [];
                    while( items.length !== curDispMatchrows){
                        items = document.querySelectorAll('[data-parentmatchid]');
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    for(let j = 0; j < items.length; j++){
                        // the matchURL is built as follows: baseURL + ID + '/' + specificID (of the sport)
                        const sportName = items[j].classList[1];
                        const matchID = items[j].getAttribute('data-parentmatchid')
                        const datestring = items[j].querySelector('div.mSDateTime')?.textContent?.trim();
                        ret.push({matchID, sportName, datestring});
                    }
                    // window.nodeLog('size of items:' + items.length);

                    // do this sequence to reset all the visible tournaments
                    let temp = undefined;
                    while(temp === undefined){
                        temp = document.querySelector('div.leagueName')
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    await temp.click();
                    temp = undefined;
                    while(temp === undefined){
                        temp = document.querySelector('i.icon-arrow-left')
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    await temp.click();

                    // continue where you left off
                    const tempLen = allTours.length;
                    allTours = [];
                    while( allTours.length !== tempLen ){
                        allTours = document.querySelectorAll('div.lg_inrInfo');
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    curDispMatchrows = 0; 
                    // decrease i to not skip any tournament (offset the one run of the i-loop used to scrape)
                    i--;

                } else{

                    // enq aka click
                    allTours[i].click();
                    while(!allTours[i].classList.contains('inrActive')){
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    indicesOfVisible.push(i);
                    curDispMatchrows += matchesInNextTour;
                    if(curDispMatchrows > 50){
                        curDispMatchrows = 50;
                    }
                    continue;

                }
            }
            return ret;
        })

        hrefs = hrefs.map( ({matchID, sportName, datestring}) => {
            let sportID = 0;
            const mapping = sportNameMapping.find( m => m.specificName === sportName )
            if(mapping){
                sportID = mapping.specificID;
            } else{
                log.write(`Critical Failure! sportName Mapping of '${sportName}' to specificID does not exist in ${sportNameMappingPath}. Cannot build matchURL.\n`);
                return -1;
            }
            const matchURL = url + 'OddsPage/' + matchID + '/' + sportID;
            let ISOString;
            try{
                ISOString = datestringToISO(datestring);
            } catch(error){
                log.write(`Warning! Invalid date of the match under [${matchURL}]:${datestring}. Error thrown by the date parser: ${error.message}\n`);
                return undefined;
            }
            return {
                url: matchURL,
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
        await promisify(log.end).bind(log);
    }
}