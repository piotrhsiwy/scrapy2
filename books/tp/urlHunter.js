import puppeteer from "puppeteer";
import { createWriteStream, writeFileSync } from "fs"
import { promisify } from "util";

export async function huntMatchURLs_tp(url){
    // open a file for logging
    const bookAbbrev = 'tp';
    const logFilePath = `./books/${bookAbbrev}/log.txt`
    const log = createWriteStream(logFilePath, {flags: 'a'});

    let browser;
    try{

        browser = await puppeteer.launch({
            headless: 'new',
            args: ["--disable-web-security"]
        });  
        
        const page = await browser.newPage();
        await page.goto(url);
        page.setViewport({width:1000, height:30000})

        const matchURLs = [];
        let selector;
        selector = 'div.infinite-scroll-list';
        await page.waitForSelector(selector);
        const matchGroups = await page.$$(selector);
        for(const matchGroup of matchGroups){
            selector = ':scope > *';
            const matches = await matchGroup.$$(selector);
            for(const match of matches){
                selector = ':scope > a';
                const hrefs = await match.$$(selector);
                if(hrefs.length === 3){
                    const matchURL = await page.evaluate(e => e.getAttribute('href'), hrefs[2]);
                    matchURLs.push(matchURL);
                } else {
                    log.write(`Failure! Unexpected number of hrefs in a ${matchURLs.length+1}th match: ${hrefs.length}\n`);
                }
            }

        }

        const data = {"urls": matchURLs};
        const dataPathOut = './books/tp/matchURLs.json';
        writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8');


        log.write(`Success! Hunting for MatchURLs_tp from ${url} succeded. Hunted ${matchURLs.length} entries\n`);
        return 0;
    } catch(error){
        log.write(`Critical Failure! Hunting for MatchURLs_tp from ${url} failed on ${matchURLs.length+1}th entry\n`);
        return -1;
    } finally{
        await browser?.close();
        await promisify(log.end).bind(log);
    }
}