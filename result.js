import { createWriteStream, readFileSync } from "fs"
import { promisify } from "util";

import { initDbResult } from './data/db/db.js';
import { openBrowser } from './util.js';
import { datestringToISO } from './results/parser.js';
import { sportNameMap } from "./books/sportNameMap.js";
import { marketNameMap } from "./books/marketNameMap.js";
import { stripTeamName } from './books/util/stripTeamName.js';
import { insertMatch, insertResult } from './data/db/inserter.js';                 
import { getMarketId } from "./data/db/getter.js";
                 
// score in the format of 1:0, 3:2, W:FF...
async function fillGameMarkets(log, match_id, teamHome, teamAway, type, score){
    const mw_id = await getMarketId(marketNameMap['MW']);
    const mwd_id = await getMarketId(marketNameMap['MWD']);
    const split = score.split(':');
    const scoreHome = parseFloat(split[0]);
    const scoreAway = parseFloat(split[1]);
    let winner = scoreHome > scoreAway
        ? teamHome
        : (scoreAway > scoreHome
            ? teamAway
            : 'draw'
        )
    await insertResult(log, match_id, mw_id, [winner]);
    await insertResult(log, match_id, mwd_id, [winner]);

    const mhdp_id = await getMarketId(marketNameMap['MHDP']);
    let winners = [];
    if(type === 'Best of 1'){
        // no handicap markets
    } else if(type === 'Best of 3'){
        // A-1.5, B1.5
        winner = scoreHome-1.5 > scoreAway
            ? (teamHome + '-1.5')
            : (teamAway + '1.5')
        // A1.5, B-1.5
        winners.push(winner);
        winner = scoreHome+1.5 > scoreAway
            ? (teamHome + '1.5')
            : (teamAway + '-1.5')
        winners.push(winner);
        await insertResult(log, match_id, mhdp_id, winners);
    } else if(type === 'Best of 5'){
        // A-1.5, B1.5
        winner = scoreHome-1.5 > scoreAway
            ? (teamHome + '-1.5')
            : (teamAway + '1.5')
        // A1.5, B-1.5
        winners.push(winner);
        winner = scoreHome+1.5 > scoreAway
            ? (teamHome + '1.5')
            : (teamAway + '-1.5')
        winners.push(winner);
        // A-2.5, B2.5
        winner = scoreHome-2.5 > scoreAway
            ? (teamHome + '-2.5')
            : (teamAway + '2.5')
        // A2.5, B-2.5
        winners.push(winner);
        winner = scoreHome+2.5 > scoreAway
            ? (teamHome + '2.5')
            : (teamAway + '-2.5')
        winners.push(winner);
        await insertResult(log, match_id, mhdp_id, winners);
    } else{
        log.write(`Unknown type to calculate handicap markets results: ${type}\n`);
    }

    const mcs_id = await getMarketId(marketNameMap['CS']);
    await insertResult(log, match_id, mcs_id, [score]);

    const mtm_id = await getMarketId(marketNameMap['TM']);
    // i have to pull available overs\unders first
    await insertResult(log, match_id, mcs_id, (scoreHome+scoreAway).toString());
}

async function singleResult(log){
    console.log('Scraping results...')
    const browser = await openBrowser();
    let page = await browser.newPage();
    const baseUrl = "https://www.gosugamers.net/matches/results";

    // load the book-specific mappings from json files
    const sportNameMappingPath = `./results/sportNameMapping.json`;
    let sportNameMapping;
    try{
        sportNameMapping = Object.freeze(JSON.parse(readFileSync(sportNameMappingPath)));
        if(!sportNameMapping){ throw new Error(); }
    } catch (error){
        log.write(`Failure! Cannot open file ${sportNameMappingPath} or incorrect JSON format\n`);
        return -10;
    }

    // get urls
    let urls = [];
    try{
        await page.goto(baseUrl);
        await page.waitForSelector('div.MuiCard-root');
        let isLast = false;
        do{
            // scrape all matches from this page
            const batch = await page.$$eval('div.MuiCard-root a', el => el.map( e => e.getAttribute('href')));
            urls = urls.concat(batch);
            // check is we are on the last page
            await page.waitForSelector('nav.MuiPagination-root ul button.MuiPaginationItem-page');
            isLast = await page.$$eval('nav.MuiPagination-root ul button.MuiPaginationItem-page', el => {
                return el[el.length-1].hasAttribute('current');
            });
            // go to next Page
            await page.waitForSelector('nav.MuiPagination-root ul button.MuiPaginationItem-previousNext');
            const nextButton = await page.$('nav.MuiPagination-root ul button.MuiPaginationItem-previousNext[aria-label="Go to next page"]');
            if(nextButton){
                nextButton.click();
            } else
                throw new Error('no "Go to next page"-button');
            await page.waitForSelector('div.MuiCard-root');
        } while( !isLast );
    } finally{
        try{ await page.close() } catch{ log.write(`Error thrown when closing page ${baseUrl}.\n`); }
    }
    
    // scrape results for each match
    try{
        page = await browser.newPage();
        for(const url of urls){
            await page.goto(url);
            // page.waitForSelector(xyz);

            // sportName
            let sportName = await page.$$eval('ol.MuiBreadcrumbs-ol li p', el => el[1].textContent);
            let mapping = sportNameMapping.find( m => m.specificName === sportName);
            if(mapping){
            sportName = sportNameMap[mapping.globalID];
            } else{
                log.write(`Failure! sportName Mapping of '${sportName}' does not exist in ${sportNameMappingPath}\n`);
                return 20;
            }
            // teamNames
            await page.waitForSelector('div.MuiCard-root');
            const teamNames = await page.$$eval('div.MuiCard-root.mui-17hkr0l span.MuiTypography-root.mui-ibiba0', el => el.map( e => e.textContent));
            const teamHome = stripTeamName(teamNames[0]);
            const teamAway = stripTeamName(teamNames[1]);
            // datetime
            const datestring = await page.$eval('div.MuiCard-root div.mui-zushkq span.MuiTypography-root.mui-1bh8xml', e => e.textContent);
            const datetime = datestringToISO(datestring);

            const {match_id:match_id, is_new:match_is_new} = await insertMatch(log, sportName, teamHome, teamAway, datetime);
            if(match_is_new){
                log.write(`This match is new: ${sportName}, ${teamHome}, ${teamAway}, ${datetime}! Meaning no odds have been scraped for this one anyway. Skipping`);
                continue;
            }
            const type = await page.$eval('div.MuiCard-root div.mui-zushkq span.MuiTypography-p3.mui-1prxljs', e => e.textContent); // {Best of 1, Best of 3, Best of 5}
            const score = await page.$eval('div.MuiCard-root div.mui-zushkq div.MuiStack-root.mui-2k8wvm', e => e.textContent); // 1:0, 3:2, W:FF...
            
            await fillGameMarkets(log, match_id, teamHome, teamAway, type, score)
            
            let gameTabs = await page.$$('div[role="tablist"].mui-17do188 button.MuiTab-root');
            for(let i = 0; i < gameTabs.length-1; i++){
                const gameTab = gameTabs[i];
                const noGameStr = gameTab.toElement("button").textContent.match(/\d+/)[0];
                const noGame = noGameStr === null ? 0 : Number(noGameStr);
            }
        }
    } finally{
        try{ await page.close() } catch{ log.write(`Error thrown when closing match-page\n`); }
        await promisify(log.end).bind(log)();
    }
}

while(true){
    // open a file for logging
    const logFilePath = `./log.txt`
    const log = createWriteStream(logFilePath, {flags: 'a'});

    await initDbResult();
    await singleResult(log);
}
