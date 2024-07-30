import puppeteer from "puppeteer";
import { createWriteStream, writeFileSync, existsSync, truncateSync } from "fs"
import { promisify } from "util";

async function huntMatchURLs(url, baseurl){
    let page;
    try{
        page = await browser.newPage();
        await page.setViewport({width:1920, height:768})
        await page.goto(url);

        const ret = await page.evaluate(async (baseurl) => {
            const sports = document.querySelector('a[data-action="Close sport"] div[data-test="categorizer-sport-list-content-title"]').textContent;
            const tours = Array.from(document.querySelectorAll('div[data-test="tournament-list-row-title"]'))
                .map( e => e.textContent );
            await new Promise(resolve => setTimeout(resolve, 2000));
            let matches = document.querySelectorAll('div[data-test=sport-event-in-view-subscription] > a');
            let size;
            do{
                size = matches.length;
                matches[matches.length-1].scrollIntoView();
                await new Promise(resolve => setTimeout(resolve, 2000));
                matches = document.querySelectorAll('div[data-test=sport-event-in-view-subscription] > a');
            } while(size !== matches.length);
            const hrefs = Array.from(matches).map( match => baseurl + match.getAttribute('href'));
            return {hrefs, sports, tours}
        }, baseurl);
        tuple.hrefs = tuple.hrefs.concat(ret.hrefs);
        tuple.sports.push(ret.sports);
        tuple.tours = tuple.tours.concat(ret.tours);
        
        log.write(`Done hunting for hrefs from ${url}. ${tuple.hrefs.length} + ${ret.hrefs.length} new entries\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for hrefs from ${url} failed.\n`);
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
        await page.setViewport({width:1920, height:768})
        page.setDefaultTimeout(120000); // 2mins max timeout
        await page.goto(meta.baseURL);

        const sportURLs = await page.evaluate(async (baseurl) => {
            return Array.from(document.querySelectorAll('a[data-action="Open sport"]')).map(item => baseurl + item.getAttribute('href'));
        }, meta.baseURLBuilder)
        if(sportURLs.length > 0){
            log.write(`Success! Hunting for sportURLs from ${meta.baseURL} succedeed, ${sportURLs.length} entries hunted\n`);
        } else {
            throw error();
        }

        // handle them synchronously to avoid overload (we are multiple tabs in the same browser) <-- TODO test limitation
        for(const url of sportURLs){
            if(url.includes('esports')){
                await huntMatchURLs(url, meta.baseURLBuilder);
            }
        }

        log.write(`Done hunting for SportsURLs from ${meta.baseURL}, ${tuple.hrefs.length} entries hunted\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${meta.baseURL} failed, ${tuple.hrefs.length} entries hunted\n`);
        return -1;
    } finally{
        writeFileSync(sportsPath, JSON.stringify(tuple.sports, null, 2));
        writeFileSync(toursPath, JSON.stringify(tuple.tours, null, 2));
        writeFileSync(dataOutPath, JSON.stringify(tuple.hrefs, null, 2));
        await browser.close();
        await promisify(log.end).bind(log);
    }
}