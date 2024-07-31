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
    
    let tuple = {hrefs:[], sports:[], tours:[]};
    try{
        await page.goto(meta.baseURL);
        await page.waitForSelector('ul.liga_menu');
        
        tuple = await page.evaluate( async (baseurl) => {
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
            const hrefs = Array.from(links).map( link => baseurl + link.getAttribute('href'));

            // get sport and tournament names
            const anchors = Array.from(document.querySelectorAll('a[title="Esports"] ~ ul.liga_menu > li > a.link'));
            const text = anchors.map( a => a.textContent);
            const sport_tour = anchors.map( (anchor, index) =>
                text[index]
                    .replace(new RegExp (anchor.children[1].textContent + '$'), '')
                    .replace(/\u000a/g, '\u0020')
                    .trim());
            const tours = [], sports = [];
            for(const str of sport_tour){
                const newSport = str.split('. ')[0];
                if(!sports.some( s => s === newSport)){
                    sports.push(newSport);
                }
                tours.push(str.split('. ')[1]);
            }
            return {hrefs, sports, tours};
        }, meta.baseURLBuilder);

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