import puppeteer from "puppeteer";
import { writeFileSync, truncateSync, existsSync, createWriteStream } from "fs"
import { promisify } from "util";
import { error } from "console";

async function huntMatchURLs(url){
    let page;
    try{
        page = await browser.newPage();
        await page.setViewport({width:1920, height:30000})
        await page.goto(url);

        let selector;
        selector = 'div.infinite-scroll-list';
        await page.waitForSelector(selector);
        const matchGroups = await page.$$(selector);
        for(const matchGroup of matchGroups){
            selector = ':scope > *';
            const matches = await matchGroup.$$(selector);
            for(const match of matches){
                selector = ':scope > a';
                const hrefs = await match.$$(selector);
                if(hrefs.length === 3){
                    const matchURL = await page.evaluate(e => e.getAttribute('href'), hrefs[2]);
                    matchURLs.push(matchURL);
                } else {
                    log.write(`Failure! Unexpected number of hrefs in a ${matchURLs.length+1}th match: ${hrefs.length}\n`);
                }
            }

        }
        log.write(`Done hunting for matchURLs from ${url}\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for matchURLs from ${url} failed.\n`);
        return -1;
    } finally{
        try{ await page.close(); }
        catch(error){log.write(`Warning! Error when closing page ${url}`);}
    }
}

async function huntTournamentURLs(url){
    let page;
    try{
        page = await browser.newPage();
        await page.setViewport({width:1920, height:30000})
        await page.goto(url);
        let selector = 'div.navigation-element.navigation-element--selected';
        await page.hover(selector);
        selector = 'div.thp-accordion__content.opened';
        await page.waitForSelector(selector);
        selector = 'div.competition a'
        const tournamentURLs = await page.$$eval( selector, items => items.map( i => i.getAttribute('href')));
        if(tournamentURLs.length > 0){
            // const tournamentNames = await page.$$eval( `${selector} > div.navigation-title`, items => items.map( i => i.textContent));
            // might be useful when automatically creating book-specific tournamentNameMappings
            
            // TODO test performance
            for(const tournamentURL of tournamentURLs){
                await huntMatchURLs(tournamentURL);
            }
            log.write(`Done hunting for TournamentURLs from ${url}\n`);
            return 0;
        } else{
            log.write(`Failure! No tournamentURLs from ${url} failed.\n`);
            return -1
        }
    
    } catch(error){
        log.write(`Critical Failure! Hunting for tournamentURLs from ${url} failed.\n`);
        return -1;
    } finally{
        try{ await page.close(); }
        catch(error){log.write(`Warning! Error when closing page ${url}`);}
    }
}

// global variables in this module
let browser;
let log;
const matchURLs = [];
/**
 * this function only gets one URL and is the only one exposed to the outside
 * 
 * @param meta metadata of this book, loaded from ./books/XYZ/meta.json
 * all the required file locations are built from content of the metadata
 */
export async function huntSportURLs(meta){
    // open a file for logging
    const logFilePath = `./books/${meta.abbrev}/log.txt`;
    log = createWriteStream(logFilePath, {flags: 'a'});
    // open and empty writing stream
    const dataOutPath = `./books/${meta.abbrev}/matchURLs.json`;
    if(existsSync(dataOutPath)){
        truncateSync(dataOutPath, 0);
    }
    const sportsPath = `./books/${meta.abbrev}/sports.json`;
    if(existsSync(sportsPath)){
        truncateSync(sportsPath, 0);
    }
    
    let sportNames = [];
    try{
        browser = await puppeteer.launch({
            headless: true,
            args: [
                "--disable-web-security",
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-web-security',
            ]
        });   
        const page = await browser.newPage();
        await page.setViewport({width:1920, height:30000})
        await page.goto(meta.baseURL);

        const tuple = await page.evaluate(async () => {
            const hrefs = Array.from(document.querySelectorAll('div.navigation-element a')).map( i => i.getAttribute('href'));
            const names = Array.from(document.querySelectorAll('.navigation-element-heading__collapsing-text')).map( i => i.textContent);
            return {hrefs, names};
        });
        sportNames = tuple.names;

        if(tuple.hrefs.length > 0){
            log.write(`Success! Hunting for sportURLs from ${meta.baseURL} succedeed, ${tuple.hrefs.length} entries hunted\n`);
        } else {
            throw error();
        }

        // handle them synchronously to avoid overload (we are multiple tabs in the same browser) <-- TODO test limitation
        for(const url of tuple.hrefs){
            await huntTournamentURLs(url);
        }

        log.write(`Done hunting for SportsURLs from ${meta.baseURL}, ${matchURLs.length} entries hunted\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${meta.baseURL} failed, ${matchURLs.length} entries hunted\n`);
        return -1;
    } finally{
        writeFileSync(sportsPath, JSON.stringify(sportNames, null, 2));
        writeFileSync(dataOutPath, JSON.stringify(matchURLs, null, 2));
        await browser?.close();
        await promisify(log.end).bind(log);
    }
}