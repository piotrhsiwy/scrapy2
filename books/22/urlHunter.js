import { createWriteStream, writeFileSync, existsSync, truncateSync } from "fs"
import { promisify } from "util";
import { prepPage } from "../page.js";

/**
 * this function only gets one URL and is the only one exposed to the outside
 * 
 * @param meta metadata of this book, loaded from ./books/XYZ/meta.json
 * all the required file locations are built from content of the metadata
 */
export async function huntSportURLs(browser, book){
    const url = book.baseURL;
    // open a file for logging
    const logFilePath = `./books/${book.abbrev}/log.txt`;
    const log = createWriteStream(logFilePath, {flags: 'a'});
    // open and empty file for data
    const dataOutPath = `./books/${book.abbrev}/matchURLs.json`;
    if(existsSync(dataOutPath)){
        truncateSync(dataOutPath, 0);
    }
    // const sportsPath = `./books/${book.abbrev}/sports.json`;
    // if(existsSync(sportsPath)){
    //     truncateSync(sportsPath, 0);
    // }
    // const toursPath = `./books/${book.abbrev}/tours.json`;
    // if(existsSync(toursPath)){
    //     truncateSync(toursPath, 0);
    // }

    const page = await prepPage(browser, book);
    let hrefs = [];
    try{
        await page.goto(url);
        // Function to remove script tags from the page
        await page.evaluate(() => {
            const scripts = document.querySelectorAll('script');
            scripts.forEach(script => script.remove());
            const metas = document.querySelectorAll('meta');
            metas.forEach(meta => meta.remove());
        });

        await page.waitForSelector('ul.liga_menu');
        
        hrefs = await page.evaluate( async (baseurl) => {
            //debugger;
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
            const ret = Array.from(links).map( link => baseurl + link.getAttribute('href'));
            return ret;

            // // get sport and tournament names
            // const anchors = Array.from(document.querySelectorAll('a[title="Esports"] ~ ul.liga_menu > li > a.link'));
            // const text = anchors.map( a => a.textContent);
            // const sport_tour = anchors.map( (anchor, index) =>
            //     text[index]
            //         .replace(new RegExp (anchor.children[1].textContent + '$'), '')
            //         .replace(/\u000a/g, '\u0020')
            //         .trim());
            // const tours = [], sports = [];
            // for(const str of sport_tour){
            //     const newSport = str.split('. ')[0];
            //     if(!sports.some( s => s === newSport)){
            //         sports.push(newSport);
            //     }
            //     tours.push(str.split('. ')[1]);
            // }
            // return {hrefs, sports, tours};
        }, book.baseURLBuilder);

        log.write(`Done hunting for SportsURLs from ${url}, ${hrefs.length} entries hunted\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${url} failed, ${hrefs.length} entries hunted\n`);
        return -1;
    } finally{
        // writeFileSync(sportsPath, JSON.stringify(tuple.sports, null, 2));
        // writeFileSync(toursPath, JSON.stringify(tuple.tours, null, 2));
        writeFileSync(dataOutPath, JSON.stringify(hrefs, null, 2));
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${url}\n`); }
        await promisify(log.end).bind(log);
    }
}