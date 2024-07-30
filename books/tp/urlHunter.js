import puppeteer from "puppeteer";
import { writeFileSync, truncateSync, existsSync, createWriteStream } from "fs"
import { promisify } from "util";
import { error } from "console";

async function huntMatchURLs(url){
    let page;
    try{
        page = await browser.newPage();
        await page.setViewport({width:1920, height:30000})
        page.setDefaultTimeout(120000); // 2mins max timeout
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
                    const href = await page.evaluate(e => e.getAttribute('href'), hrefs[2]);
                    tuple.hrefs.push(href);
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

        // get the tournamentURLs to pass further down
        page = await browser.newPage();
        await page.setViewport({width:1920, height:30000})
        page.setDefaultTimeout(120000); // 2mins max timeout
        await page.goto(url);

        // get the tournament Names
        const newTours = await page.$$eval( `div.competition a > div.navigation-title`, items => items.map( i => i.textContent))
        tuple.tours = tuple.tours.concat(newTours);

        let selector = 'div.navigation-element.navigation-element--selected';
        await page.hover(selector);
        selector = 'div.thp-accordion__content.opened';
        await page.waitForSelector(selector);
        selector = 'div.competition a'
        const tournamentURLs = await page.$$eval( selector, items => items.map( i => i.getAttribute('href')));
        if(tournamentURLs.length > 0){
            
            // TODO test performance limits when parallelizing
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
const tuple = {hrefs:[], sports:[], tours:[]};
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
    const toursPath = `./books/${meta.abbrev}/tours.json`;
    if(existsSync(toursPath)){
        truncateSync(toursPath, 0);
    }
    
    try{
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--disable-web-security',
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
        page.setDefaultTimeout(120000); // 2mins max timeout
        await page.goto(meta.baseURL);

        const ret = await page.evaluate( async () => {
            const tournamentURLs = Array.from(document.querySelectorAll('div.navigation-element a')).map( i => i.getAttribute('href'));
            const sports = Array.from(document.querySelectorAll('.navigation-element-heading__collapsing-text')).map( i => i.textContent);
            return {tournamentURLs, sports};
        });
        tuple.sports = ret.sports;

        if(ret.tournamentURLs.length > 0){
            log.write(`Success! Hunting for sportURLs from ${meta.baseURL} succedeed, ${tuple.hrefs.length} entries hunted\n`);
        } else {
            throw error();
        }

        // handle them synchronously to avoid overload (we are multiple tabs in the same browser) <-- TODO test limitation
        for(const url of ret.tournamentURLs){
            await huntTournamentURLs(url);
        }

        log.write(`Done hunting for SportsURLs from ${meta.baseURL}, ${tuple.hrefs.length} entries hunted\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${meta.baseURL} failed, ${tuple.hrefs.length} entries hunted\n`);
        return -1;
    } finally{
        writeFileSync(toursPath, JSON.stringify(tuple.tours, null, 2));
        writeFileSync(sportsPath, JSON.stringify(tuple.sports, null, 2));
        writeFileSync(dataOutPath, JSON.stringify(tuple.hrefs, null, 2));
        await browser.close();
        await promisify(log.end).bind(log);
    }
}