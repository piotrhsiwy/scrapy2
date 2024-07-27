import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createWriteStream, writeFileSync, readFileSync } from "fs"
import { promisify } from "util";

export async function huntMatchURLs_ms(url){
    // open a file for logging
    const bookAbbrev = 'ms';
    const logFilePath = `./books/${bookAbbrev}/log.txt`
    const log = createWriteStream(logFilePath, {flags: 'a'});

    const matchURLs = [];
    let browser;
    try{

        puppeteer.use(StealthPlugin());
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--disable-web-security',
            ]
        }); 
        let page = await browser.newPage();
        await page.setViewport({width:1920, height:768})
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9'
        });
        await page.goto(url);
        let selector;
        selector = 'iframe';
        await page.waitForSelector(selector);
        const iframeHandle = await page.$(selector);
        page = await iframeHandle.contentFrame();

        // get the book-specific tournamentMapping
        const tournamentNameMappingPath = `./books/${bookAbbrev}/tournamentNameMapping.json`;
        let tournamentNameMapping;
        try{
          tournamentNameMapping = Object.freeze(JSON.parse(readFileSync(tournamentNameMappingPath)));
        } catch (error){
          log.write(`Failure! Cannot open file ${tournamentNameMappingPath}\n`);
          throw error(`Failure! Cannot open file ${tournamentNameMappingPath}`);
        }

        selector = 'span[title="Counter-Strike"]';
        const sportTab = await page.$(selector);
        await sportTab.click();
        selector = 'span[title="Tournaments"]';
        const tournamentsTab = await page.$(selector);
        await tournamentsTab.click();
        const specificTournamentName = tournamentNameMapping.mapping.find( t => t.globalID === 'BPFG2024').specificName;
        selector = `span[title="${specificTournamentName}"]`;
        const targetTab = await page.$(selector);
        await targetTab.click();
        await new Promise(resolve => setTimeout(resolve, 100));

        const matchURLs = await page.evaluate(async() => {
            const matchURLs = [];
            
            async function processItems(){
                const items = Array.from(document.querySelectorAll('ul.match-list > li'));

                for(const item of items){
                    const clickable = item.querySelector('p.team-name');
                    clickable.click();
                    matchURLs.push(window.location.href);
                    console.log(window.location.href);
                    window.history.back();
                }
            }

            await processItems();
            return matchURLs;
        }) 

        const data = {"urls": matchURLs};
        const dataPathOut = `./books/${bookAbbrev}/matchURLs.json`;
        writeFileSync(dataPathOut, JSON.stringify(data, null, 2), 'utf8');


        log.write(`Success! Hunting for MatchURLs_tp from ${url} succeded. Hunted ${matchURLs.length} entries\n`);
        return 0;
    } catch(error){
        log.write(`Critical Failure! Hunting for MatchURLs_tp from ${url} failed on entry:${matchURLs.length+1}\n`);
        return -1;
    } finally{
        await browser?.close();
        await promisify(log.end).bind(log);
    }
}