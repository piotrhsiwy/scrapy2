import { createWriteStream, readFileSync } from "fs"
import { promisify } from 'util';

import { sportNameMap } from "../sportNameMap.js";
import { marketNameMap } from "../marketNameMap.js";
import { stripTeamName } from "../util/stripTeamName.js";
import { datestringToISO } from "./parser.js";
import { insertMarket, insertMatch, insertOdd, insertUrl } from "../../data/db/inserter.js";

export async function scrapeMatchURL(browser, book, i){
  
  const bookAbbrev = book.abbrev; 
  // open a file for logging
  const logFilePath = `books/${bookAbbrev}/log.txt`
  const log = createWriteStream(logFilePath, {flags: 'a'});

  // load the book-specific mappings from json files
  const sportNameMappingPath = `books/${bookAbbrev}/sportNameMapping.json`;
  let sportNameMapping;
  try{
    sportNameMapping = Object.freeze(JSON.parse(readFileSync(sportNameMappingPath)));
    if(!sportNameMapping){ throw new Error(); }
  } catch (error){
    log.write(`Failure! Cannot open file ${sportNameMappingPath} or incorrect JSON format\n`);
    return -10;
  }

  const marketNameMappingPath = `books/${bookAbbrev}/marketNameMapping.json`;
  let marketNameMapping;
  try{
    marketNameMapping = Object.freeze(JSON.parse(readFileSync(marketNameMappingPath)));
    if(!marketNameMapping){ throw new Error(); }
  } catch (error){
    log.write(`Failure! Cannot open file ${marketNameMappingPath} or incorrect JSON format\n`);
    return -10;
  }

  let page;
  try{

    page = await browser.newPage();
    await page.goto(book.urls[i]);

    try{
      await page.waitForSelector('#altenar-sportsbook div', {timeout:10000});
    } catch{
      log.write(`Critical Failure! Initial selector on the page could not be awaited (10s) from ${book.urls[i]}\n`);
      return -1;
    }
    
    try{
      await page.waitForSelector('#altenar-sportsbook div >>>> button[class^=Breadcrumb-sc-]', {timeout:3000});
      await page.waitForSelector('#altenar-sportsbook div >>>> databet-widget[type=basic_scoreboard] >>>> p', {timeout:3000});
      await page.waitForSelector('#altenar-sportsbook div >>>> div[class^=TabWrapper-sc-]', {timeout:3000});
      await page.waitForSelector('#altenar-sportsbook div >>>> div[class^=EventDetailsMarketBoxRoot-sc-]', {timeout:3000});
    } catch{
      log.write(`Critical Failure! One of the required selectors on the page could not be awaited (3s) from ${book.urls[i]}\n`);
      return -1;
    }

    const breadcrumbs = await page.$$eval('#altenar-sportsbook div >>>> button[class^=Breadcrumb-sc-]', els => els.map(e => e.textContent));
    let sportName = breadcrumbs[1].trim();
    let mapping = sportNameMapping.find( m => m.specificName === sportName);
    if(mapping){
      sportName = sportNameMap[mapping.globalID];
    } else{
      log.write(`Failure! sportName Mapping of '${sportName}' does not exist in ${sportNameMappingPath}\n`);
      return 20;
    }

    // get teamHome, teamAway
    const teams = breadcrumbs[3].split('vs');
    const teamHome = stripTeamName(teams[0]);
    const teamAway = stripTeamName(teams[1]);
    
    // get datetime
    const [hour, day] = await page.$$eval('#altenar-sportsbook div >>>> databet-widget[type=basic_scoreboard] >>>> p', els => els.map(e => e.textContent));
    /** this is taken as an indicator that the game is live. The game-in-progress layout results in this grab */
    if(day === 'Teams'){
      log.write(`Failure! Layout indicates that the game is live! from ${book.urls[i]}\n`);
      return 10;
    }
    const datetime = datestringToISO(day + ' • ' + hour);
    const {match_id:match_id, is_new:match_is_new} = await insertMatch(log, sportName, teamHome, teamAway, datetime);
    if(!match_id){
      log.write(`Critical Failure! Database insert error from ${book.urls[i]}\n`);
      return -100;
    }
    const {url_id:url_id, is_new:url_is_new} = await insertUrl(log, match_id, book.name, book.urls[i]);
    if(!url_id){
      log.write(`Failure! Database insert error\n`);
    }

    // GET ALL THE MARKETS > ODDS > COEFS FOR THIS MATCH
    // swich to Tab showing all markets at once
    const allTab = await page.$('#altenar-sportsbook div >>>> div[class^=TabWrapper-sc-]');
    await allTab.click();
    const NAVI_INTERVAL = 1000;
    await new Promise(resolve => setTimeout(resolve, NAVI_INTERVAL));

    // open all collapsed markets
    await page.evaluate(async () => {
      const widget = document.querySelector('#altenar-sportsbook div');
      const shadow = widget.shadowRoot;

      shadow.querySelectorAll('div[class^=EventDetailsMarketWrapperBase-sc-]');
      const collapsed = Array.from(shadow.querySelectorAll('div[class^=EventDetailsMarketBoxRoot-sc-]'))
          .filter(e => !e.querySelector('div[class^=EventDetailsMarketWrapperBase-sc-]'))
          .map(e => e.querySelector('div[class^=EventDetailsMarketHeader-sc-]'));
      for(const e of collapsed){
          await e.click();
      }
    })
    await new Promise(resolve => setTimeout(resolve, NAVI_INTERVAL));

    const marketHandles = await page.$$('#altenar-sportsbook div >>>> div[class^=EventDetailsMarketBoxRoot-sc-]');
    for(const marketHandle of marketHandles){
      // get marketName
      let marketName = await marketHandle.$eval('div[class^=EventDetailsMarketName-sc-]', e => e.textContent?.trim());
      mapping = marketNameMapping.find( m => m.specificName === marketName);
      if(mapping){
        marketName = marketNameMap[mapping.globalID];
      } else{
        log.write(`Warning! marketName Mapping of '${marketName}' does not exist in ${marketNameMappingPath}\n`);
        continue;
      }
      const {market_id:market_id, is_new:market_is_new} = await insertMarket(log, marketName);
      if(!market_id){
        log.write(`Critical Failure! Database insert error from ${book.urls[i]}\n`);
        return -100;
      }
      // get odds
      const oddHandles = await marketHandle.$$('button[class^=OddBoxButton-sc-]');
      for(const oddHandle of oddHandles){
        const nameRaw = await oddHandle.$eval('span[class^=OddLabel-sc-]', e => e.textContent);
        let specialValue;
        try{
          specialValue = await oddHandle.$eval('span[class^=OddSpecialValue-sc-]', e => e.textContent);
        } catch{ /** ignore - this just means there is no special value for this odd */ }
        const valueRaw = await oddHandle.$eval('div[class^=OddValue-sc-]', e => e.textContent);
        let oddName = stripTeamName(nameRaw);
        if(marketName.includes('Handicap') && specialValue){
          oddName = oddName + specialValue.replace('+', '');
        }
        if ( marketName === 'Correct score' && teamHome === teamAway && teamAway === teamHome){ // in case of CS market and flipped teamNames, the oddNames in the form of '2:0', etc. need to be flipped as well
          const [left, right] = oddName.split(':');
          oddName = `${right}:${left}`;
        }
        const value = parseFloat(valueRaw);
        const {odd_id:odd_id, is_new:odd_is_new} = await insertOdd(log, match_id, market_id, oddName, book.name, value);
        if(!odd_id){
          log.write(`Failure! Database insert error from ${book.urls[i]}\n`);
          continue;
        }
      }
    }

  log.write(`Success! scraping a match from ${book.urls[i]}\n`);
  return 0;    

  } catch (error){
    log.write(`Critical Failure! scraping a match from ${book.urls[i]}\n\t${error.message}\n`);
    return -1;
  } finally{
    try{
      await page?.close()
    } catch{}
    await promisify(log.end).bind(log)();
  }
  
}