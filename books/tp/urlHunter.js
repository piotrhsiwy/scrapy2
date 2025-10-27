import { writeFileSync, truncateSync, existsSync, createWriteStream } from "fs"
import { promisify } from "util";
import { applyPatches, prepPage } from "../page.js";
import { datestringToISO } from "./parser.js";

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

    // const page = await prepPage(browser, book);
    // TODO tp does not work in headless when filtering requests
    const page = await browser.newPage();
    await page.setViewport(book.viewport);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    // call our patcher BEFORE navigating
    await applyPatches(page, {
        timezone: 'America/Los_Angeles',
        deviceMemory: 8,
        hardwareConcurrency: 8,
    });

    let hrefs = [];
    try{
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        await page.waitForSelector('div.infinite-scroll-list', {timeout: 1000});
        
        hrefs = await page.evaluate( async () => {
            // debugger;
            let ret = [];
            const sports = Array.from(document.querySelectorAll('#navigation a')).filter(e =>
                e.classList.contains('group/link') && e.classList.contains('first-of-type:mt-2')
            );
            for(let i = 0; i < sports.length; i++){
                const text = sports[i].querySelector('button')?.textContent;
                const matchCount = parseInt(text);
                if(matchCount > 0){
                    await sports[i].click();
                    while(document.querySelector('[data-testid="match-details-link"') === null){
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                    let newHrefs = Array.from(document.querySelectorAll('[data-testid="match-details-link"]')).map( e => {
                        const divs = Array.from(e.parentNode.querySelectorAll('div'));
                        
                        const index = divs.map( e => {
                            return Array.from(e.classList);
                                                }).findIndex( e => {
                                                    return e.some( className => className.includes('matchTime'));
                                                })
                        let datestring = divs[index]?.textContent;
                        const sectionTitle = e.parentNode.parentNode.parentNode.parentNode.querySelector('div.match-group-title')?.textContent?.trim();
                        const url = e.href;
                        return {datestring, sectionTitle, url}
                    })
                    ret = ret.concat(newHrefs);
                }
            }
            return ret;
        });

        hrefs = hrefs.map(({datestring,  sectionTitle, url}) => {
            let ISOString;
            if(!sectionTitle){
                log.write(`Failure! No sectionTitle for url: ${url}`);
                return undefined;
            } else{
                if(sectionTitle === 'Upcoming'){
                    datestring = sectionTitle + ', ' + datestring;
                } else if(sectionTitle === 'Featured'){
                } else if(sectionTitle.includes('Live')){
                    datestring = 'live';
                } else{
                    const dateMatch = sectionTitle.match(/.*, (.* \d+).*/);
                    const date = dateMatch ? dateMatch[1] : "";
                    datestring = date + ', ' + datestring;
                }

                try{
                    ISOString = datestringToISO(datestring);
                } catch(error){
                    log.write(`Warning! Invalid date of the match under ${url}. Error thrown by the date parser: ${error.message}\n`);
                    return undefined;
                }
            }
            return {
                url: url,
                datetime: ISOString
            };
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
        log.write(error.stack);
        return -1;
    } finally{
        // writeFileSync(toursPath, JSON.stringify(tuple.tours, null, 2));
        // writeFileSync(sportsPath, JSON.stringify(tuple.sports, null, 2));
        writeFileSync(dataOutPath, JSON.stringify(hrefs, null, 2));
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log);
    }
}
