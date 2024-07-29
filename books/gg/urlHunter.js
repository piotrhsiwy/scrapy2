import puppeteer from "puppeteer";
import { createWriteStream, writeFileSync, existsSync, truncateSync } from "fs"
import { promisify } from "util";

async function huntMatchURLs(url, baseurl){
    let page;
    try{
        page = await browser.newPage();
        await page.setViewport({width:1920, height:768})
        await page.goto(url);

        const tuple = await page.evaluate(async (baseurl) => {
            const sportName = document.querySelector('a[data-action="Close sport"] div[data-test="categorizer-sport-list-content-title"]').textContent;
            const tourNames = Array.from(document.querySelectorAll('div[data-test="tournament-list-row-title"]'))
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
            return {hrefs, sportName, tourNames}
        }, baseurl);
        hrefs = [...hrefs, ...tuple.hrefs];
        sportNames.push(tuple.sportName);
        tourNames = [...tourNames, ...tuple.tourNames];
        
        log.write(`Done hunting for hrefs from ${url}\n`);
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
let hrefs = [];
let sports = [];
let tours = [];
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
        await page.goto(meta.baseURL);

        const sportURLs = await page.evaluate(async (baseurl) => {
            return Array.from(document.querySelectorAll('a[data-action="Open sport"]')).map(item => baseurl + item.getAttribute('href'));
        }, meta.baseURL)
        if(sportURLs.length > 0){
            log.write(`Success! Hunting for sportURLs from ${meta.baseURL} succedeed, ${sportURLs.length} entries hunted\n`);
        } else {
            throw error();
        }

        // handle them synchronously to avoid overload (we are multiple tabs in the same browser) <-- TODO test limitation
        for(const url of sportURLs){
            if(url.includes('esports')){
                await huntMatchURLs(url, meta.baseURL);
            }
        }

        log.write(`Done hunting for SportsURLs from ${meta.baseURL}, ${hrefs.length} entries hunted\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${meta.baseURL} failed, ${hrefs.length} entries hunted\n`);
        return -1;
    } finally{
        writeFileSync(sportsPath, JSON.stringify(sports, null, 2));
        writeFileSync(toursPath, JSON.stringify(tours, null, 2));
        writeFileSync(dataOutPath, JSON.stringify(hrefs, null, 2));
        await browser?.close();
        await promisify(log.end).bind(log);
    }
}