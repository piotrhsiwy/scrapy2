import puppeteer from "puppeteer";
import { createWriteStream, writeFileSync, existsSync, truncateSync } from "fs"
import { promisify } from "util";

async function huntMatchURLs(url, baseurl){
    let page;
    try{
        page = await browser.newPage();
        await page.setViewport({width:1920, height:768})
        await page.goto(url);

        matchURLs = matchURLs.concat(await page.evaluate(async (baseurl) => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            let matches = document.querySelectorAll('div[data-test=sport-event-in-view-subscription] > a');
            let size;
            do{
                size = matches.length;
                matches[matches.length-1].scrollIntoView();
                await new Promise(resolve => setTimeout(resolve, 2000));
                matches = document.querySelectorAll('div[data-test=sport-event-in-view-subscription] > a');
            } while(size !== matches.length);

            return Array.from(matches).map( match => baseurl + match.getAttribute('href'));
        }, baseurl));
        
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

// global variables in this module
let browser;
let log;
let matchURLs = [];
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

        log.write(`Done hunting for SportsURLs from ${meta.baseURL}, ${matchURLs.length} entries hunted\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${meta.baseURL} failed, ${matchURLs.length} entries hunted\n`);
        return -1;
    } finally{
        writeFileSync(dataOutPath, JSON.stringify(matchURLs, null, 2));
        await browser?.close();
        await promisify(log.end).bind(log);
    }
}