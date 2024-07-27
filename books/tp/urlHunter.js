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
        } else{
            log.write(`Failure! No tournamentURLs from ${url} failed.\n`);
        }
        return 0;
    
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
 */
export async function huntSportURLs_tp(url, dataPathOut){
    // open a file for logging
    const bookAbbrev = 'tp';
    const logFilePath = `./books/${bookAbbrev}/log.txt`
    log = createWriteStream(logFilePath, {flags: 'a'});
    // open and empty writing stream
    if(existsSync(dataPathOut)){
        truncateSync(dataPathOut, 0);
    }
    
    try{
        browser = await puppeteer.launch({
            headless: true,
            args: ["--disable-web-security"]
        });   
        const page = await browser.newPage();
        await page.setViewport({width:1920, height:30000})
        await page.goto(url);

        let selector = 'div.navigation-element a';
        const sportURLs = await page.$$eval(selector, items => items.map( i => i.getAttribute('href')));
        if(sportURLs.length > 0){
            log.write(`Success! Hunting for sportURLs from ${url} succedeed. Scraped ${sportURLs.length+1} entries\n`);
        } else {
            throw error();
        }

        // handle them synchronously to avoid overload (we are multiple tabs in the same browser) <-- TODO test limitation
        for(const sportURL of sportURLs){
            await huntTournamentURLs(sportURL);
        }
        log.write(`Done hunting for SportsURLs from ${url}\n`);
        writeFileSync(dataPathOut, JSON.stringify(matchURLs, null, 2));
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${url} failed.\n`);
        return -1;
    } finally{
        await browser?.close();
        await promisify(log.end).bind(log);
    }
}