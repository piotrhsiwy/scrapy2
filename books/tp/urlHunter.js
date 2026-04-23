import { createWriteStream } from "fs"
import { promisify } from "util";
import { applyPatches, prepPage } from "../page.js";
import { datestringToISO } from "./parser.js";
import { insertToScrapeUrl } from "../../data/db/inserter.js";

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

    // const page = await prepPage(browser, book);
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
        await page.goto(url);

        // this is the initial sync locking on the page before navigation. Waits Until number of games in the All Tab is not empty.
        while(await page.$('div[data-testid=AllTab] span') === null){
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        while(true){
            const content = await page.$eval('div[data-testid=AllTab] span', e => e.textContent)
            if(content != ''){
              break; 
            } else{
              await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        hrefs = await page.evaluate( async () => {
            debugger;
            let ret = [];
            const sports = Array.from(document.querySelectorAll('#navigation a')).filter(e =>
                e.classList.contains('group/link') && e.classList.contains('first-of-type:mt-2') &&
                !e.href.includes('ebasketball') &&
                !e.href.includes('eamerican-football') &&
                !e.href.includes('esoccer')
            );
            for(let i = 0; i < sports.length; i++){
                const text = sports[i].querySelector('button')?.textContent;
                const matchCount = parseInt(text);
                if(matchCount > 0){
                    await sports[i].click();
                    // i have to wait until the filter applies and only the matches from this sport are shown
                    // 1. Loop until breadcrumbs exist (they exist only when a sport is selected)
                    while(document.querySelector('div[data-testid=breadcrumbs]') === null){
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    // 2. Loop until breadcrumbs match the just clicked sport (I don't unselect the prev filter)
                    while(document.querySelector('div[data-testid=breadcrumbs] button[data-base-ui-navigation-menu-trigger] div.truncate').textContent !== sports[i].querySelector('div.text-base').textContent){
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    // 3. Loop until the first match entry is loaded (order of the steps 1-3 seems to ensure that the list has been reloaded)
                    // Only if more than 0 entries in AllTab
                    const matchesInAllTab = document.querySelector('div[data-testid=AllTab] span')?.textContent;
                    if(matchesInAllTab && matchesInAllTab > 0){
                        while(document.querySelector('div[data-testid*=match-list-row-]') === null){
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                    // 4. Even then, the entries seem to be loaded only partially when I dont await here
                    await new Promise(resolve => setTimeout(resolve, 500));
                    // 5. Read the entries
                    let newHrefs = Array.from(document.querySelectorAll('div[data-testid*=match-list-row-]')).map( e => {
                        const datestring = e.querySelector('div[data-testid*=match-time-]')?.textContent;
                        const url = e.querySelector('a[data-testid=match-details-link]')?.href;
                        let iter = e.previousElementSibling;
                        while( iter && iter.matches('div[data-testid*=match-list-row-')){
                            iter = iter.previousElementSibling;
                        }
                        const sectionTitle = iter?.textContent?.trim();
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
                log.write(`Warning! No sectionTitle for url: ${url}\n`);
            } else{
                if(sectionTitle.includes('Live')){
                    datestring = 'live';
                }
            }

            try{
                ISOString = datestringToISO(datestring);
            } catch(error){
                log.write(`Warning! Invalid date of the match under ${url}. Error thrown by the date parser: ${error.message}\n`);
                return undefined;
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

        for(const href of hrefsPruned){
            await insertToScrapeUrl(log, book.name, href.url, href.datetime);
        }

        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted\n`);
        log.write(error.message);
        log.write(error.stack);
        return -1;
    } finally{
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log)();
    }
}
