import { createWriteStream, readFileSync } from "fs"
import { promisify } from "util";

import { sportNameMap } from "../sportNameMap.js";
import { marketNameMap } from "../marketNameMap.js";
import { stripTeamName } from "../util/stripTeamName.js";
import { insertCoefIntoOdd, insertMarketIntoMatch, insertMatchIntoSport, insertOddIntoMarket, insertSportIntoData } from "../../data/util/inserter.js";
import { datestringToISO } from "./parser.js";
import { prepPage } from "../page.js";

export async function scrapeMatchURL(data, browser, book, i){
  
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

  let page = await prepPage(browser, book);
  // let page = await browser.newPage();
  const originalPage = page;

  try{
    let selector, mapping;

    await page.goto(book.urls[i]);
    const popup = await page.waitForSelector('img[src="/assets/icons/close.svg"]');
    await popup.click();

    const iframeHandle = await page.$('iframe');
    page = await iframeHandle.contentFrame();
    await page.waitForSelector('div.games-stream__title-item a', {timeout:30000})

    // get sport
    const SportTournament = await page.$eval('div.games-stream__title-item a', e => e.textContent);
    let sportName = SportTournament.split('. ')[0];
    mapping = sportNameMapping.find( m => m.specificName === sportName);
    if(mapping){
      sportName = sportNameMap[mapping.globalID];
    } else{
      log.write(`Critical Failure! sportName Mapping of '${sportName}' does not exist in ${sportNameMappingPath}\n`);
      return 20;
    }
    let sport = insertSportIntoData(log, data, sportName);

    // get teamHome, teamAway
    let teams = await page.$$eval('div.sb-pro__name', elements => elements.map( e => e.textContent.trim() ));
    if(teams.length != 2){
      teams = await page.$$eval('div.slider-event-pro__team-name', elements => elements.map( e => e.textContent.trim() ));
      if(teams.length != 2){
        log.write(`Failure! Read incorrect number of team names for this game (possibly none)\n`);
        return 10;
      }
    }
    const teamHome = stripTeamName(teams[0]);
    const teamAway = stripTeamName(teams[1]);
    
    // get datetime, mode
    const isLive = await page.$('div._badge--live');
    let datetime;
    if(isLive){
      datetime = 'live';
    } else{
      const datestring = await page.$eval('div.slider-event-pro__info-date span', e => e.textContent.trim().replace(/\u00a0/, '\u0020'));
      datetime = datestringToISO(datestring);
    }
    let match = insertMatchIntoSport(log, sport, teamHome, teamAway, datetime, book.name, book.urls[i]);

    // check filter 'All markets'
    await page.evaluate( async() => {
      const filters = Array.from(document.querySelectorAll('span.games-stream-pro-nav__item-text'));
      const allMarketsFilter = filters.find( e => e.textContent.includes('FILTER.ALL'));
      if(allMarketsFilter){
        await allMarketsFilter.click();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    })
    // GET ALL THE MARKETS > ODDS > COEFS FOR THIS MATCH
    selector = 'div.game-event__market-wrapper';
    let marketHandles = await page.$$(selector);
    // scroll until no more elements are loaded
    let old_size, new_size;
    do{
      // await new Promise(resolve => setTimeout(resolve, 1000));
      old_size =  marketHandles.length;
      await marketHandles[marketHandles.length-1].scrollIntoView();
      await new Promise(resolve => setTimeout(resolve, 100));
      marketHandles = await page.$$(selector);
      new_size =  marketHandles.length;
    } while( old_size !== new_size );
    // selector = 'div.marketRow';
    // const labelsHandle = await page.$(selector);
    // selector = 'label';
    // const labels = await labelsHandle.$$eval(selector, es => es.map( e => e.textContent));
    // const labelHome = labels[0];
    // const labelAway = labels[1];
    for(const marketHandle of marketHandles){
      // get marketName
      selector = 'div.game-event-market__title';
      let marketName = await marketHandle.$eval(selector, e => e.textContent.trim());
      mapping = marketNameMapping.find( m => m.specificName === marketName);
      if(mapping){
        const globalName = marketNameMap[mapping.globalID];
        if(globalName){
          marketName = globalName;
        } else{
          log.write(`Warning! marketName Mapping of '${marketName}' does not exist in ${marketNameMap}\n`);
          continue;
        }
      } else{
        log.write(`Warning! marketName Mapping of '${marketName}' does not exist in ${marketNameMappingPath}\n`);
        continue;
      }
      let market = insertMarketIntoMatch(log, match, marketName);
      // get odd
      selector = 'button.outcome';
      const oddsHandles = await marketHandle.$$(selector);
      for(let i = 0; i < oddsHandles.length; i++){
        const oddHandle = oddsHandles[i];
        selector = 'span.outcome__status';
        let handle = await oddHandle.$(selector);
        if(!handle){
          continue;
        }
        const oddName = await oddHandle.$eval(selector, (e) => e.textContent);
        let odd = insertOddIntoMarket(log, market, oddName);
        // get coef
        selector = 'span.outcome__number'
        const coef = await oddHandle.$eval(selector, (e) => {
          const text = e.textContent;
          const f = parseFloat(text);
          if(!Number.isNaN(f)){
            return f;
          } else{
            return null;
          }
        });
        insertCoefIntoOdd(log, odd, book.name, coef)
      }
    }

    log.write(`Success! scraping a match from ${book.urls[i]}\n`);
    return 0;    

  } catch (error){
    log.write(`Critical Failure! scraping a match from ${book.urls[i]}. Error code:${error}\n`);
    return -1; 
  } finally{
    await originalPage?.close()
    await promisify(log.end).bind(log)();
  }
}