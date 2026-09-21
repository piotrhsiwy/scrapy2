import { createWriteStream, readFileSync } from "fs"
import { promisify } from "util";

import { initDbResult } from './data/db/db.js';
import { openBrowser } from './util.js';
import { datestringToISO } from './results/parser.js';
import { sportNameMap } from "./books/sportNameMap.js";
import { marketNameMap } from "./books/marketNameMap.js";
import { stripTeamName } from './books/util/stripTeamName.js';
import { insertMatch, insertResult } from './data/db/inserter.js';                 
import { getMarketId, getOddnamesForMatchMarket } from "./data/db/getter.js";
                 
async function fillMapMarkets(log, match_id, teamHome, teamAway, mapNo, score){

    const split = score.split(':');
    const scoreHome = parseFloat(split[0]);
    const scoreAway = parseFloat(split[1]);

    if(scoreHome !== scoreAway){
        const mxw_id = getMarketId(marketNameMap['M' + mapNo + 'W']);
        insertResult(log, match_id, mxw_id, [scoreHome > scoreAway ? teamHome : teamAway])
    }
    const mxwd_id = getMarketId(marketNameMap['M' + mapNo + 'WD']);
    insertResult(log, match_id, mxwd_id, [scoreHome > scoreAway ? 
        teamHome 
        : (scoreHome === scoreAway ? "draw": teamAway )])

    const sum = scoreHome + scoreAway;
    // this is an over/under market so I need to pull available odds first
    const tkmx_id = getMarketId(marketNameMap['TKM' + mapNo]);
    const oddnames = getOddnamesForMatchMarket(match_id, tkmx_id) ?? [];
    const winners = [];
    for(const odd of oddnames){
        const match = odd.match(/(over|under)(.*)/);
        const ou = match[1];
        const val = Number(match[2]);
        if(ou === 'over' && val > sum){
            winners.push()
        }
    }
    insertResult(log, match_id, tkmx_id, [sum.toString()]);
    
    // // LOL
    // FBM1:       'First Blood Map 1',
    // TKM1:       'Total Kills Map 1',
    // FDM1:       'First Dragon Map 1',
    // FTM1:       'First Tower Map 1',
    // FBARM1:     'First Baron Map 1',
    // FATKM1:     'First Atakhan Map 1',
    // FHERM1:     'First Herald Eye Map 1',
    // FINHIBM1:   'First Inhibitor Map 1',
    // FTRKM1:     'First to Reach Kills Map 1',
    // TDRGM1:     'Total Dragons Map 1',
    // TDRGHDPM1:  'Total Dragons Handicap Map 1',
    // BDRGM1:     'Both Teams to slay a Dragon Map 1',
    // BBARM1:     'Both Teams to slay a Baron Map 1',
    // BINHIBM1:   'Both Teams to destroy Inhibitor Map 1',
    // TBARM1:     'Total Barons Map 1',
    // TINHIBM1:   'Total Inhibitors Map 1',
    // KHDPM1:     'Kills Handicap Map 1',
    // DURM1:      'Map Duration Map 1',
    // TTM1:       'Total Towers Map 1',
    // TTHDPM1:    'Total Towers Handicap Map 1',
    // MTM1:       'More Towers Map 1',
    // KMM1:       'Kill Maker Map 1',
    // BARTYPM1:   'Baron Type Map 1',
    // FDRGTYPM1:  'First Dragon Type Map 1',
    // QUADM1:     'Quadrakill Map 1 Yes/No',
    // PENTM1:     'Pentakill Map 1 Yes/No',
    // TRIPLEM1:   'Triplekill Map 1 Yes/No',
    // // CS2
    // CSM1:       'Correct Score Map 1',
    // OT1:        'Overtime Map 1',
    // ACE1:       'Ace Map 1',
    // RHDPM1:     'Rounds Handicap Map 1',
    // TRM1:       'Total Rounds Map 1',
    // TROE1:      'Total Rounds Odd/Even Map 1',
    // FTRRM1:     'First to Reach Rounds Map 1',
    // R1WM1:      'Round 1 Winner Map 1',
    // R13WM1:     'Round 13 Winner Map 1',
    // WMM1:       'Winning Margin Map 1',
    // FHWM1:      'First Half Winner Map 1',
    // SHWM1:      'Second Half Winner Map 1',
    // FHRHDPM1:   'First Half Round Handicap Map 1',
    // R1TKM1:     'Round 1 Total Kills Map 1',
    // R13TKM1:    'Round 13 Total Kills Map 1',
    // R1FKM1:     'Round 1 First Kill Map 1',
    // R13FKM1:    'Round 13 First Kill Map 1',
    // GRNDM1:     'Grenade Kill Map 1 Yes/No',
    // ZEUSM1:     'Zeus Kill Map 1 Yes/No',
    // KNIFEM1:    'Knife Kill Map 1 Yes/No',
    // MLTVM1:     'Molotov Kill Map 1 Yes/No',
    // // DOTA2
    // FROSHM1:    'First to Kill Roshan Map 1',
    // FBRCKSM1:   'First to Destroy Barracks Map 1',
    // BBRCKSM1:   'Both Teams to Destroy Barracks Map 1',
    // FTORMM1:    'First to Kill Tormentor Map 1',
    // FCOURM1:    'First to Kill Courier Map 1',
    // ULTRAM1:    'Ultrakill Map 1 Yes/No',
    // RAMPM1:     'Rampage Map 1 Yes/No',
    // GDLKM1:     'Godlike Map 1 Yes/No',
    // TROSHM1:    'Total Roshans Map 1',
    // MROSHM1:    'More Roshans Map 1',
    // BROSHM1:    'Both Teams to Slay Roshan Map 1',
    // MEGAM1:     'Megacreeps Map 1 Yes/No',
    // DRAPM1:     'Divine Rapier Built Map 1 Yes/No',
    // AOTIM1:     'Aegis Of The Immortal Snatched Map 1 Yes/No',
    // // MOBILE MOBA
    // FTYRM1:     'First Tyrant Map 1',
    // FDOMM1:     'First Dominator Map 1',
    // // VALORANT
    // FHWWDM1:    'First Half Winner incl. Draw Map 1',
    // SHWWDM1:    'Second Half Winner incl. Draw Map 1',
    // CSFHM1:     'Correct Score First Half Map 1',
    // RHDPFHM1:   'Round Handicap First Half Map 1',
    // RHDPSHM1:   'Round Handicap Second Half Map 1',
}

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
    const sum = scoreHome + scoreAway;
    await insertResult(log, match_id, mtm_id, [sum.toString()]);

    const mtmoe_id = await getMarketId(marketNameMap['TMOE']);
    await insertResult(log, match_id, mtmoe_id, [scoreHome ? "odd" : "even"]);

    // TR:         'Total Rounds',
    // TRHDP:      'Total Rounds Handicap',
    // TK:         'Total Kills',
    // TKHDP:      'Total Kills Handicap',
    // TT:         'Total Towers',
    // TDRG:       'Total Dragons',
    // TINHIB:     'Total Inhibitors',

    const mt1twatlom_id = await getMarketId(marketNameMap['T1TWATLOM']);
    await insertResult(log, match_id, mt1twatlom_id, [scoreHome ? "yes" : "no"]);

    const mt2twatlom_id = await getMarketId(marketNameMap['T2TWATLOM']);
    await insertResult(log, match_id, mt2twatlom_id, [scoreAway ? "yes" : "no"]);

    // OT:         'Overtime',
}

async function singleResult(log){
    console.log('Scraping results...')
    const browser = await openBrowser();
    let page = await browser.newPage();
    const baseUrl = "https://www.gosugamers.net";
    const matchesUrl = "/matches/results";

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
        await page.goto(baseUrl + matchesUrl);
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
                throw new Error('No "Go to next page"-button');
            await page.waitForSelector('div.MuiCard-root');
        } while( !isLast && urls.length <= 9 );
    } catch{
        log.write(`Error thrown when hunting result's urls ${baseUrl}.\n`);
        await browser.close();
    } finally{
        log.write(`I have hunted ${urls.length} urls from ${baseUrl}.\n`);
    }
    
    // scrape results for each match
    page = await browser.newPage();
    try{
        for(const url of urls){
            await page.goto(baseUrl + url);
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
                log.write(`This match is new: ${sportName}, ${teamHome}, ${teamAway}, ${datetime}! Meaning no odds have been scraped for this one anyway. Skipping\n`);
                continue;
            }
            const type = await page.$eval('div.MuiCard-root div.mui-zushkq span.MuiTypography-p3.mui-1prxljs', e => e.textContent); // {Best of 1, Best of 3, Best of 5}
            const score = await page.$eval('div.MuiCard-root div.mui-zushkq div.MuiStack-root.mui-2k8wvm', e => e.textContent); // 1:0, 3:2, W:FF...
            
            await fillGameMarkets(log, match_id, teamHome, teamAway, type, score)
            
            // scroll to the bottom to load all content
            await page.evaluate(() => {
                window.scrollBy(0, document.body.scrollHeight);
            });
            const maxWaitForTabs = 1000;
            const intervalWaitForTabs = 100;
            for(let i = 0; i+=intervalWaitForTabs; i <= maxWaitForTabs){
                await new Promise( resolve => setTimeout(resolve, intervalWaitForTabs));
                const tabs = await page.$('div.MuiTabs-root');
                if(tabs){
                    break;
                }
            }
            let gameTabs = await page.$$('div[role="tablist"].mui-17do188 button.MuiTab-root');
            let gameTabsNumbers = await page.$$eval('div[role="tablist"].mui-17do188 button.MuiTab-root', el => {
                return el.map( e => e.textContent.match(/\d+/)[0]);
            })
            for(let i = 0; i < gameTabs.length-1; i++){
                const gameTab = gameTabs[i];
                const gameTabNumber = gameTabsNumbers[i];
            }
        }
    } finally{
        try{ await page.close() } catch(e){ log.write(`Error thrown when closing originalPageMatch.\n\t${e.message}\n`); }
        await browser.close();
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
