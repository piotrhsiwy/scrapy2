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

    let page = await browser.newPage();
    // let page = await prepPage(browser, book);
    const originalPage = page;

    let hrefs = [];
    try{
        await page.goto(url);

        // const el = await page.$('p');
        // const attrName = await el.evaluate(el =>
        // [...el.attributes].find(a => a.name.startsWith('data-astro-cid-'))?.name
        // );
        // const isVercelCheckpoint = await page.$(`p[${attrName}]`);

        const iframeHandle = await page.waitForSelector('iframe', {timeout:30000});
        page = await iframeHandle.contentFrame();

        await page.waitForSelector('div#tab-system-alone', {timeout:30000});
        
        // get tournaments
            // click All eSports tab
        try{
            await page.evaluate( async () => {
                const tabs = Array.from(document.querySelectorAll('div#tab-system-alone ul li a'));
                const AlleSportsTab = tabs.find(e => e.textContent.trim() === 'All eSports');
                if(AlleSportsTab){
                    AlleSportsTab.click();
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    throw new Error('All eSports tab is undefined');
                }
            })
        } catch(e){
            log.write(`Failure! Hunting for sportURLs from ${url} failed. Could not find 'All eSports' tab.\n`);
            return -1;
        }
            // open all the esport tabs
        await page.evaluate( async () => {
            const tabs = Array.from(document.querySelectorAll('li.title.item-category i.arrow-closed'));
            tabs.forEach(t => t.click())
            await new Promise(resolve => setTimeout(resolve, 100));
        })
            // get the tournament urls
        const tournamentUrls = await page.$$eval('li.item-competition a', els => els.map( e => e.href));
        for(const tournamentUrl of tournamentUrls){
            const tpage = await prepPage(browser, book)
            try{
                await tpage.goto(tournamentUrl);

                await tpage.waitForSelector('div.upcoming-events', {timeout:30000});

                const batch = await tpage.$$eval('div.lines div.event-part', els => els.map( e => {
                    // debugger;
                    const datestring = e.querySelector('div.date-event').textContent;
                    const url = e.querySelector('a.snc-link-to-event').href;
                    return {url, datestring};
                }))

                hrefs = hrefs.concat(batch);

            } catch(e){
                log.write(`Warning! Error: ${e.message} when hunting for tournament under: ${tournamentUrl}\n`);
            } finally{
                try{ await tpage.close() } catch{ log.write(`Error thrown when closing page ${tournamentUrl}\n`); }
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
        log.write(error.message);
        log.write(`\nCritical Failure! Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted.\n`);
        return -1;
    } finally{
        writeFileSync(dataOutPath, JSON.stringify(hrefs, null, 2), 'utf8');
        try{ await originalPage.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log)();
    }
}