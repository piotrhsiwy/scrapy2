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
    await page.goto(meta.baseURL);
    await page.waitForSelector('ul.liga_menu');

    let matchURLs = [];
    try{
        
        matchURLs = await page.evaluate( async () => {
            // open up all the tournament tabs to trigger adding event-menus to the dom
            const tabs = document.querySelectorAll('ul.liga_menu > li > a');
            for(const tab of tabs){
                if (tab) {
                    const tabPosition = tab.getBoundingClientRect().top + window.scrollY;
                    window.scrollTo({ top: tabPosition, behavior: 'smooth' });
                }
                tab.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            // scrape the hrefs of the games
            const links = document.querySelectorAll('ul.event_menu > li > a.link');
            return Array.from(links).map( link => link.getAttribute('href')); 
        });
        log.write(`Done hunting for SportsURLs from ${meta.baseURL}, ${matchURLs.length} entries hunted\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${meta.baseURL} failed, ${matchURLs.length} entries hunted\n.`);
        return -1;
    } finally{
        writeFileSync(dataOutPath, JSON.stringify(matchURLs, null, 2));
        await browser?.close();
        await promisify(log.end).bind(log);
    }
}

export async function huntMatchURLs_22(url){
    try{

        let selector;
        selector = 'ul.event_menu > li > a.link';
        await page.waitForSelector(selector);
        matchURLs = await page.$$eval(selector, (items, baseURL) => {
            const matchURLs = [];
            for(const href of items.map( item => item.getAttribute('href'))){
                matchURLs.push(baseURL + href);
            }
            return matchURLs;
        }, baseURL);

        const data = {"urls": matchURLs};
        const dataPathOut = `./books/${bookAbbrev}/matchURLs.json`;
        writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8');


        log.write(`Success! Hunting for MatchURLs_22 from ${url} succeded. Hunted ${matchURLs.length} entries\n`);
        return 0;
    } catch(error){
        log.write(`Critical Failure! Hunting for MatchURLs_22 from ${url} failed on ${matchURLs.length+1}th entry\n`);
        return -1;
    } finally{
        await browser?.close();
        await promisify(log.end).bind(log);
    }
}