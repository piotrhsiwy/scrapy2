import { createWriteStream, readFileSync } from "fs"
import { promisify } from "util";
import { prepPage } from "../page.js";
import { datestringToISO } from "./parser.js";
import { insertToScrapeUrl } from "../../data/db/inserter.js";

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

    // load the book-specific mappings from json files
    const sportNameMappingPath = `books/${bookAbbrev}/sportNameMapping.json`;
    let sportNameMapping;
    try{
        sportNameMapping = Object.freeze(JSON.parse(readFileSync(sportNameMappingPath)));
        if(!sportNameMapping){ throw new Error(); }
    } catch (error){
        log.write(`Failure! Cannot open file ${sportNameMappingPath} or incorrect JSON format\n`);
        return -10;
    }

    let page = await prepPage(browser, book);
    const originalPage = page;

    let hrefs = [];
    try{
        await page.goto(url);

        const popup = await page.waitForSelector('img[src="/assets/icons/close.svg"]');
        await popup.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        const popup2 = await page.waitForSelector('img[src="/assets/icons/close.svg"]');
        await popup2.click();

        await page.waitForSelector('#sportsbook-app', {timeout:30000});
        
        // get sports from menu
        const shadowRoot = '#sportsbook-app'
        const shadowRootPrefix = '#sportsbook-app >>> ';
        const sports = await page.$$(shadowRootPrefix + 'div.games-nav__group-pro._disciplines a.games-nav__item-pro');
        const sportNameCounts = await page.$$eval(shadowRootPrefix + 'div.games-nav__group-pro._disciplines a.games-nav__item-pro', els => els.map( e => e.textContent));
        for(let i = 0; i < sports.length; i++){
            const sport = sports[i];
            const sportNameCount = sportNameCounts[i];
            if(sportNameCount && sportNameCount.includes('EFOOTBALL')
                || sportNameCount.includes('ETENNIS')
                || sportNameCount.includes('EHOCKEY')
                || sportNameCount.includes('EBASKETBALL')
            ){
                continue;
            }
            // using native click() since puppeteer's click() didn't do the job
            await page.evaluate(async (i, shadowRoot) => {
                document.querySelector(shadowRoot).shadowRoot.querySelectorAll('div.games-nav__group-pro._disciplines a.games-nav__item-pro')[i].click();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }, i, shadowRoot)
            // select the Prematch filter
            const prematchButton = await page.$$eval(shadowRootPrefix + 'a.lobby-filters__item-pro span[class=lobby-filters__item-text]', async els => {
                const button = els.find(e => e.textContent.includes('PREMATCH'))
                if(button){
                    await button.click();
                } else {
                }
            })
            try{
                await page.waitForSelector(shadowRootPrefix + 'div.grid-el-line', {timeout:3000});
            } catch(e){
                log.write(`Warning! Timeout 3s when waiting for selector 'div.grid-line' for sport ${sport.textContent}. Possibly no matches\n`);
                continue;
            }
            const batchHrefs = await page.evaluate(async (shadowRoot) => {
                // debugger;
                const total = document.querySelector(shadowRoot).shadowRoot.querySelectorAll('div.grid-el-event').length;
                const batchHrefs = []
                do{
                    const els = Array.from(document.querySelector(shadowRoot).shadowRoot.querySelectorAll('div.grid-el-event.grid-el-event-pro'));
                    const newHrefs =  els.map( e => {
                        const day = e
                            .closest('div.grid-el-line__content')
                            .parentElement
                            .querySelector('div.grid-el-line__title .grid-el-line__title-main span')
                            .textContent;
                        const time = e.querySelector('div.grid-el-event__time').textContent;
                        const url = e.querySelector('a.grid-el-event__competitors').href
                        return {
                            url: url,
                            datestring: day + ', ' + time
                        }
                    }) 
                    for(const href of newHrefs){
                        if(!batchHrefs.find(e => e.url === href.url)){
                            batchHrefs.push(href);
                        }
                    }
                    const lastElement = els[els.length-1];
                    if(lastElement) lastElement.scrollIntoView();
                    await new Promise(resolve => setTimeout(resolve, 500));
                } while(batchHrefs.length < total);
                return batchHrefs;
            }, shadowRoot);
            hrefs = hrefs.concat(batchHrefs);
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

        for(const href of hrefsPruned){
            await insertToScrapeUrl(log, book.name, href.url, href.datetime);
        }

        return 0;

    } catch(error){
        log.write(error.message);
        log.write(`Critical Failure! Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted.\n`);
        return -1;
    } finally{
        try{ await originalPage.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log)();
    }
}