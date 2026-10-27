import { createWriteStream } from "fs"
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
    const url = book.baseURL;
    // open a file for logging
    const logFilePath = `./books/${book.abbrev}/log.txt`;
    const log = createWriteStream(logFilePath, {flags: 'a'});

    // const page = await prepPage(browser, book);
    const page = await browser.newPage();
    let hrefs = [];

    async function huntPage(){
        const matches = await page.evaluate( async () => {

            /**
             * magial function written by copilot to grab eventId, needed to build url
             * usage:
             *  const eventId = findEvent(e[Object.keys(e).find(k => k.startsWith('__reactProps'))])?.id;
             * 
             *  */ 
            function findEvent(root) {
                const seen = new Set();
                const stack = [root];

                while (stack.length) {
                    const node = stack.pop();

                    if (node === null || typeof node !== 'object') {
                        continue;
                    }

                    if (seen.has(node)) {
                        continue;
                    }

                    seen.add(node);

                    if (node.event && node.event.id) {
                        return node.event;
                    }

                    if (Array.isArray(node)) {
                        stack.push(...node);
                    } else {
                        stack.push(...Object.values(node));
                    }
                }

                return null;
            }

            
            // debugger;
            const widget = document.querySelector('#altenar-sportsbook div');
            const shadow = widget.shadowRoot;

            const matches = Array.from(shadow.querySelectorAll('div[class^=EventBoxRoot]')) .map(e => {
                if(!e){
                    return null;
                } else{
                    const datetime = e.querySelector('div[class^=DateTime]')?.textContent;
                    const tourSport = e.querySelector('div[class^=CategoryChampionship]')?.textContent;
                    const tourSportRegex = /^(.*?)\s•\s(.*?)$/;
                    const teams = Array.from(e.querySelectorAll('div[class^=CompetitorNameBase]')).map(e => e.textContent.toLowerCase().trim().replace(/\s+/g, '-'));
                    const eventId = findEvent(e[Object.keys(e).find(k => k.startsWith('__reactProps'))])?.id;
                    return {
                        datetime: datetime,
                        tournament: tourSport.match(tourSportRegex)[1].toLowerCase().trim().replace(/\s+/g, '-'),
                        sport: tourSport.match(tourSportRegex)[2].toLowerCase().trim().replace(/\s+/g, '-'),
                        teamHome: teams[0],
                        teamAway: teams[1],
                        eventId: eventId
                    }
                }
            })

            return matches;
        })

        const hrefsBatch = matches.map( e => {
            return {
                url: book.baseURLBuilder + e.sport + '/' + e.tournament + '/' + e.teamHome + '-vs-' + e.teamAway + '-' + e.eventId,
                datestring: e.datetime
            }
        });

        hrefs.push(...hrefsBatch);
    }

    try{

        await page.goto(url);
        await page.waitForSelector('#altenar-sportsbook div', {timeout:10000});
        await page.waitForSelector('#altenar-sportsbook div >>>> div[class^=PaginatorContainer] button[class^=Page]', {timeout:3000});
        await page.waitForSelector('#altenar-sportsbook div >>>> div[class^=EventBoxRoot]', {timeout:3000});
        await page.waitForSelector('#altenar-sportsbook div >>>> div[class^=EventBoxRoot] div[class^=CompetitorNameBase]', {timeout:3000});

        let buttons;
        while(true){

            await huntPage();

            const NEXT_PAGE_INTERVAL = 1000;
            const isLastPage = await page.evaluate( async (interval) => {
                // debugger;
                const widget = document.querySelector('#altenar-sportsbook div');
                const shadow = widget.shadowRoot;
                const buttons = Array.from(shadow.querySelectorAll('div[class^=PaginatorContainer] button[class^=Page]'));
                await buttons[buttons.length-1].click();
                await new Promise(resolve => setTimeout(resolve, interval));
                if(buttons[buttons.length-1].disabled){
                    return true;
                } else{
                    return false;
                }
            }, NEXT_PAGE_INTERVAL)

            if(isLastPage){
                await huntPage();
                break;
            }

        }

        // parse datestrings
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
        log.write(`Critical Failure! Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted\n${error.message}\n`);
        return -1;
    } finally{
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log)();
    }
}
 