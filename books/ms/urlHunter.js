// import puppeteer from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createWriteStream, writeFileSync, readFileSync, existsSync, truncateSync } from "fs"
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

    puppeteer.use(StealthPlugin());
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
        userDataDir: 'C:\\Users\\User\\AppData\\Local\\Temp\\puppeteer_temp',
    }); 
    let page = await browser.newPage();
    await page.setViewport({width:1920, height:768})
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
    });
    await page.goto(meta.baseURL);

    let selector = 'iframe';
    await page.waitForSelector(selector);
    const iframeHandle = await page.$(selector);
    page = await iframeHandle.contentFrame();

    let matchURLs = [];
    try{
        // set checkboxes for all the sports to load all the matches
        const availableEsports = ['Counter-Strike', 'Dota 2', 'League of Legends', 'Valorant', 'Rainbow Six', 'Rocket League', 'Starcraft'];
        for(const esport of availableEsports){
            selector = `span[title="${esport}"] ~ div.chbx`;
            await page.$eval(selector, (el) => { el.classList.add('checked'); });
            const sportCheckbox = await page.$(selector);
            if(sportCheckbox){
                await sportCheckbox.click();
                await new Promise(resolve => setTimeout(resolve, 100));
            } else{
                log.write(`Warning! No sportTab for ${esport} on ${meta.baseURL}.\n`);
            }
        }

        matchURLs = await page.evaluate(async () => {
            const matchURLs = [];
            
            async function processItems(){
                // scroll till all matches are loaded
                let items = document.querySelectorAll('ul.match-list > li');
                let size;
                do{
                    size = items.length;
                    // debug
                    console.log(size);
                    items[items.length-1].scrollIntoView();
                    await new Promise(resolve => setTimeout(resolve, 100));
                    items = document.querySelectorAll('ul.match-list > li');
                    // debug
                    console.log(`items.length=${items.length}`);
                    console.log(`size=${size}`);
                } while( size !== items.length);

                for(const item of items){
                    const clickable = item.querySelector('div[class=market-count] > span');
                    clickable.click();
                    matchURLs.push(window.location.href);
                    console.log(window.location.href);
                    window.history.back();
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            await processItems();
            return matchURLs;
        }) 

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