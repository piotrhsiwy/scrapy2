import { createWriteStream, readFileSync } from "fs"
import { promisify } from 'util';

import { sportNameMap } from "../sportNameMap.js";
import { marketNameMap } from "../marketNameMap.js";
import { stripTeamName } from "../util/stripTeamName.js";
import { datestringToISO } from "./parser.js";
import { insertMarket, insertMatch, insertOdd, insertUrl } from "../../data/db/inserter.js";

export async function scrapeMatchURL(browser, book, i){
  
  let page = await browser.newPage();
  await page.setViewport(book.viewport);
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.goto(book.urls[i], {waitUntil:'domcontentloaded'});
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

  try{

    await page.waitForSelector('span[class*=Breadcrumbs_breadcrumbs__item__]', {timeout: 10000});

    const breadcrumbs = await page.$$eval('span[class*=Breadcrumbs_breadcrumbs__item__]', els => els.map(e => e.textContent));
    let sportName = breadcrumbs[2].trim();
    let mapping = sportNameMapping.find( m => m.specificName === sportName);
    if(mapping){
      sportName = sportNameMap[mapping.globalID];
    } else{
      log.write(`Failure! sportName Mapping of '${sportName}' does not exist in ${sportNameMappingPath}\n`);
      return 20;
    }

    // get teamHome, teamAway
    const teams = breadcrumbs[breadcrumbs.length-1].split(' - ');
    const teamHome = stripTeamName(teams[0]);
    const teamAway = stripTeamName(teams[1]);
    
    // get datetime
    const day = await page.$eval('span[class*=PrematchEventBannerContent_eventBannerContent__day__]', e => e.textContent )
    const hour = await page.$eval('span[class*=PrematchEventBannerContent_eventBannerContent__time__]', e => e.textContent )
    const datetime = datestringToISO(hour + ', ' + day);
    const {match_id:match_id, is_new:match_is_new} = await insertMatch(log, sportName, teamHome, teamAway, datetime);
    if(!match_id){
      log.write(`Critical Failure! Database insert error\n`);
      return -100;
    }
    const {url_id:url_id, is_new:url_is_new} = await insertUrl(log, match_id, book.name, book.urls[i]);
    if(!url_id){
      log.write(`Failure! Database insert error\n`);
    }
    // GET ALL THE MARKETS > ODDS > COEFS FOR THIS MATCH
    const marketHandles = await page.$$('div[class*=Market_defaultPanelMarket__]');
    for(const marketHandle of marketHandles){
      // get marketName
      let marketName = await marketHandle.$eval('h3[class*=NewDefaultAccordion_accordion__title__]', e => e.textContent?.trim());
      mapping = marketNameMapping.find( m => m.specificName === marketName);
      if(mapping){
        marketName = marketNameMap[mapping.globalID];
      } else{
        log.write(`Warning! marketName Mapping of '${marketName}' does not exist in ${marketNameMappingPath}\n`);
        continue;
      }
      const {market_id:market_id, is_new:market_is_new} = await insertMarket(log, marketName);
      if(!market_id){
        log.write(`Critical Failure! Database insert error\n`);
        return -100;
      }
      // get odds
      const oddHandles = await marketHandle.$$('div[id*=outcome_btn__]');
      for(const oddHandle of oddHandles){
        const ValueName = await oddHandle.$$eval('span', es => es.map(e => e.textContent));
        let oddName = stripTeamName(ValueName[1]);
        if ( marketName === 'Correct score' && teamHome === teamAway && teamAway === teamHome){ // in case of CS market and flipped teamNames, the oddNames in the form of '2:0', etc. need to be flipped as well
          const [left, right] = oddName.split(':');
          oddName = `${right}:${left}`;
        }
        const value = parseFloat(ValueName[0]);
        const {odd_id:odd_id, is_new:odd_is_new} = await insertOdd(log, match_id, market_id, oddName, book.name, value);
        if(!odd_id){
          log.write(`Failure! Database insert error\n`);
          continue;
        }
      }
    }

  log.write(`Success! scraping a match from ${book.urls[i]}\n`);
  return 0;    

  } catch (error){
    log.write(`Critical Failure! scraping a match from ${book.urls[i]}\n`);
    return -1;
  } finally{
    try{
      await page?.close()
    } catch{}
    await promisify(log.end).bind(log)();
  }
  
}