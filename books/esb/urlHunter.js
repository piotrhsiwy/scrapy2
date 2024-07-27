import puppeteer from "puppeteer";
import { createWriteStream, writeFileSync } from "fs"
import { promisify } from "util";

export async function huntMatchURLs_esb(url){
    // open a file for logging
    const bookAbbrev = 'esb';
    const logFilePath = `./books/${bookAbbrev}/log.txt`
    const log = createWriteStream(logFilePath, {flags: 'a'});

    let matchURLs = [];
    let browser;
    try{

        browser = await puppeteer.launch({
            headless: true,
            args: ["--disable-web-security"]
        });   
        const page = await browser.newPage();
        await page.setViewport({width:1920, height:768})
        await page.goto(url);

        let selector;
        selector = 'div.cs2 > div > div.lg_itmBtn';
        await page.waitForSelector(selector);
        const button = await page.$(selector);
        await page.waitForNetworkIdle();
        await button.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        selector = 'div.cs2 div.lg_infoWrp';
        const specificTournamentName = 'BLAST Premier: Fall Groups 2024';
        await page.waitForSelector(selector);
        const tournamentHandles = await page.$$(selector);
        for(const tournamentHandle of tournamentHandles){
            const text = await page.evaluate(tournamentHandle => tournamentHandle.textContent, tournamentHandle);
            if(text === specificTournamentName){
                await tournamentHandle.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                // console.log('Clicked on the tournamentHandle');
                break;
            }
        }

        matchURLs = await page.evaluate(async () => {
            const matchURLs = [];
            
            async function processItems(){
                const items = Array.from(document.querySelectorAll('div.matchRow'));
                size = items.length;
                for(let i = 0; i < size; i++){
                    const item = Array.from(document.querySelectorAll('div.matchRow'))[i];
                    await item.click();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    matchURLs.push(window.location.href);
                    // console.log(window.location.href);
                    const clickBack = document.querySelector('i.icon-arrow-left');
                    await clickBack.click();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            await processItems();
            return matchURLs;
        });

        const data = {"urls": matchURLs};
        const dataPathOut = `./books/${bookAbbrev}/matchURLs.json`;
        writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8');

        log.write(`Success! Hunting for MatchURLs_esb from ${url} succeded. Hunted ${matchURLs.length} entries\n`);
        return 0;
    } catch(error){
        log.write(`Critical Failure! Hunting for MatchURLs_esb from ${url} failed on ${matchURLs.length+1}th entry\n`);
        return -1;
    } finally{
        await browser?.close();
        await promisify(log.end).bind(log);
    }
}