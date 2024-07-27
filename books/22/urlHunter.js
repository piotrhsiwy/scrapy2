import puppeteer from "puppeteer";
import { createWriteStream, writeFileSync } from "fs"
import { promisify } from "util";

export async function huntMatchURLs_22(url){
    // open a file for logging
    const bookAbbrev = '22';
    const logFilePath = `./books/${bookAbbrev}/log.txt`
    const log = createWriteStream(logFilePath, {flags: 'a'});

    let browser;
    let matchURLs = [];
    const baseURL = 'https://22bets.me/en/';
    try{

        browser = await puppeteer.launch({
            headless: 'new',
            args: ["--disable-web-security"]
        });  
        
        const page = await browser.newPage();
        await page.setViewport({width:1920, height:768})
        await page.goto(url);

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