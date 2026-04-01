import { createWriteStream, readFileSync } from "fs"
import { promisify } from 'util';

import { sportNameMap } from "../sportNameMap.js";
import { marketNameMap } from "../marketNameMap.js";
import { stripTeamName } from "../util/stripTeamName.js";
import { insertCoefIntoOdd, insertMarketIntoMatch, insertMatchIntoSport, insertOddIntoMarket, insertSportIntoData } from "../../data/util/inserter.js";
import { datestringToISO } from "./parser.js";

export async function scrapeMatchURL(data, browser, book, i){
  
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
    if(!sportNameMapping){ throw error(); }
  } catch (error){
    log.write(`Failure! Cannot open file ${sportNameMappingPath} or incorrect JSON format\n`);
    return -10;
  }
  const marketNameMappingPath = `books/${bookAbbrev}/marketNameMapping.json`;
  let marketNameMapping;
  try{
    marketNameMapping = Object.freeze(JSON.parse(readFileSync(marketNameMappingPath)));
    if(!marketNameMapping){ throw error(); }
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
    let sport = insertSportIntoData(log, data, sportName);

    // get teamHome, teamAway
    const teams = breadcrumbs[breadcrumbs.length-1].split(' - ');
    const teamHome = stripTeamName(teams[0]);
    const teamAway = stripTeamName(teams[1]);
    
    // get datetime
    const day = await page.$eval('span[class*=PrematchEventBannerContent_eventBannerContent__day__]', e => e.textContent )
    const hour = await page.$eval('span[class*=PrematchEventBannerContent_eventBannerContent__time__]', e => e.textContent )
    const datetime = datestringToISO(hour + ', ' + day);
    let match = insertMatchIntoSport(log, sport, teamHome, teamAway, datetime, book.name, book.urls[i]);
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
      let market = insertMarketIntoMatch(log, match, marketName);
      // get odds
      const oddHandles = await marketHandle.$$('div[id*=outcome_btn__]');
      for(const oddHandle of oddHandles){
        const ValueName = await oddHandle.$$eval('span', es => es.map(e => e.textContent));
        let oddName = stripTeamName(ValueName[1]);
        if ( market.name === 'Correct score' && market.teamHome === teamAway && market.teamAway === teamHome){ // in case of CS market and flipped teamNames, the oddNames in the form of '2:0', etc. need to be flipped as well
          const [left, right] = oddName.split(':');
          oddName = `${right}:${left}`;
        }
        let odd = insertOddIntoMarket(log, market, oddName);
        const value = parseFloat(ValueName[0]);
        let coef = insertCoefIntoOdd(log, odd, book.name, value);
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
    await promisify(log.end).bind(log);
  }
  
}