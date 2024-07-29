import puppeteer from "puppeteer";
import { createWriteStream, writeFileSync, existsSync, truncateSync } from "fs"
import { promisify } from "util";

/**
 * this function only gets one URL and is the only one exposed to the outside
 * 
 * @param meta metadata of this book, loaded from ./books/XYZ/meta.json
 * all the required file locations are built from content of the metadata
 */
export async function huntSportURLs(meta){
    // open a file for logging
    const logFilePath = `./books/${meta.abbrev}/log.txt`;
    const log = createWriteStream(logFilePath, {flags: 'a'});
    // open and empty file for data
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

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--disable-web-security',
        ],
    }); 
    let page = await browser.newPage();
    await page.setViewport({width:1920, height:768})
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
    });
    page.setDefaultTimeout(120000); // 2mins max timeout
    await page.goto(meta.baseURL);
    await page.waitForNetworkIdle();

    const tuple = {hrefs:[], sports:[], tours:[]};
    try{
        // get sport Names
        tuple.sports = await page.evaluate( () => {
            return Array.from(document.querySelectorAll('#sports-menu-item__6000 > ul > li > a')).map( e => e.textContent);
        });

        // get tournament Names
        tuple.tours = await page.evaluate( () => {
            return Array.from(document.querySelectorAll('h4')).map( e => e.textContent.split('] ')[1].trim() );
        });
        
        // get hrefs
        let selector;
        selector = 'div.osg-coupon__events > div > div.osg-coupon__event-description-row > a';
        await page.waitForSelector(selector);
        tuple.hrefs = await page.$$eval(selector, (items, url) => {
            const matchURLs = [];
            for(const href of items.map( item => item.getAttribute('href'))){
                matchURLs.push(url + href);
            }
            return matchURLs;
        }, meta.baseURL);

        log.write(`Done hunting for SportsURLs from ${meta.baseURL}, ${tuple.hrefs.length} entries hunted\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${meta.baseURL} failed, ${tuple.hrefs.length} entries hunted\n`);
        return -1;
    } finally{
        writeFileSync(toursPath, JSON.stringify(tuple.tours, null, 2));
        writeFileSync(sportsPath, JSON.stringify(tuple.sports, null, 2));
        writeFileSync(dataOutPath, JSON.stringify(tuple.hrefs, null, 2));
        await browser?.close();
        await promisify(log.end).bind(log);
    }
}