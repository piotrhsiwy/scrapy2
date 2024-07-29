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
    const bookAbbrev = 'esb';
    const logFilePath = `./books/${bookAbbrev}/log.txt`
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
        // devtools: true,
        // dumpio: true,
    }); 
    let page = await browser.newPage();
    await page.setViewport({width:1920, height:768})
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
    });
    // await page.setRequestInterception(true);
    
    // page.on('request', (request) => {
    //     request.continue();
    // });
    // page.on('response', async (response) => {
    //     if(response.url() === 'https://w2e-api.esportsmatrix.io/api/esbull/api/GetIndexMatchV2'){
    //         console.log(`Response intercepted`);
    //         const responseBody = await response.json();
    //         console.log(responseBody);
    //     }
    // });
    await page.goto(meta.baseURL);
    await page.waitForNetworkIdle();

    let tuple = {hrefs:[], sports:[], tours:[]};
    try{
        // // Define the function to handle logging inside evaluate call
        // function logHandler(log) {
        //     return (msg) => {
        //         console.log(msg);
        //     };
        // }
        // // Expose the log handler to the page
        // await page.exposeFunction('nodeLog', logHandler(log));
        tuple = await page.evaluate(async () => {
            debugger;
            const hrefs = [];
            let allTours = [];
            const sports = Array.from(document.querySelectorAll('div.lg_itmInfo'))
                .map( e => e.textContent);
            const tours = Array.from(document.querySelectorAll('div.lg_infoWrp'))
                .map( e => e.textContent);
            allTours = document.querySelectorAll('div.lg_inrInfo');
            // window.nodeLog(`alltours: ${allTours}`);
            // window.nodeLog(`alltoursSize: ${allTours.length}`);
            let curDispMatchrows = 0;
            let indicesOfVisible = [];
            for(let i = 0; i < allTours.length || curDispMatchrows !== 0; i++){

                if(i < allTours.length){
                    matchesInNextTour = parseInt(allTours[i].children[1].textContent);
                }

                if(curDispMatchrows + matchesInNextTour > 50 || i === allTours.length){

                    await new Promise(resolve => setTimeout(resolve, 2000));
                    // scrape
                    const items = document.querySelectorAll('div.matchRow');
                    // window.nodeLog('size of items:' + items.length);
                    for(let i = 0; i < items.length; i++){
                        const item = document.querySelectorAll('div.matchRow')[i];
                        // window.nodeLog('item: inside forloop' + item);
                        if(!item){
                            // window.nodeLog(`Failure! Item is not clickable ${window.location.href}, entry: ${hrefs.length}\n`);
                            continue;
                        }
                        await item.click();
                        // TODO this timer can be removed for faster performance, but then it looks less human?
                        // await new Promise(resolve => setTimeout(resolve, 100));
                        // window.nodeLog(`pushing: ` + window.location.href);
                        hrefs.push(window.location.href);
                        // window.nodeLog(`index ${hrefs.length-1} hunted matchURL: ${window.location.href}\n`);
                        const clickBack = document.querySelector('i.icon-arrow-left');
                        if(!clickBack){
                            // window.nodeLog(`Critical Failure! No clickable icon-arrow-left ${window.location.href}, entry: ${hrefs.length}. Cannot come back.\n`);
                            return hrefs;
                        }
                        await clickBack.click();
                        // TODO this timer can be removed for faster performance, but then it looks less human?
                        // await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    // clean the q aka unclick
                    allTours = document.querySelectorAll('div.lg_inrInfo');
                    while(indicesOfVisible.length !== 0){
                        allTours[indicesOfVisible.pop()].click();
                    }
                    curDispMatchrows = 0;

                } else{

                    // enq aka click
                    allTours[i].click();
                    indicesOfVisible.push(i);
                    curDispMatchrows += matchesInNextTour;
                    continue;

                }
            }
            return {hrefs, sports, tours};
        })

        log.write(`Done hunting for SportsURLs from ${meta.baseURL}, ${tuple.hrefs.length} entries hunted\n`);
        return 0;

    } catch(error){
        log.write(`Critical Failure! Hunting for sportURLs from ${meta.baseURL} failed, ${tuple.hrefs.length} entries hunted.\n`);
    } finally{
        writeFileSync(sportsPath, JSON.stringify(tuple.sports, null, 2));
        writeFileSync(toursPath, JSON.stringify(tuple.tours, null, 2));
        writeFileSync(dataOutPath, JSON.stringify(tuple.hrefs, null, 2), 'utf8');
        await browser?.close();
        await promisify(log.end).bind(log);
    }
}