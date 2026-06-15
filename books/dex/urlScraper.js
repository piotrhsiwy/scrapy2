import { createWriteStream, readFileSync } from "fs"
import { promisify } from "util";

import { sportNameMap } from "../sportNameMap.js";
import { marketNameMap } from "../marketNameMap.js";
import { stripTeamName } from "../util/stripTeamName.js";
import { datestringToISO } from "./parser.js";
import { prepPage } from "../page.js";
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

  let page = await prepPage(browser, book);
  // let page = await browser.newPage();
  const originalPage = page;

  try{
    let selector, mapping;

    await page.goto(book.urls[i]);
    const popup = await page.waitForSelector('img[src="/assets/icons/close.svg"]');
    await popup.click();

    const shadowRoot = '#sportsbook-app'
    const shadowRootPrefix = '#sportsbook-app >>> ';

    await page.waitForSelector( shadowRootPrefix + 'div.games-stream__title-item a', {timeout:30000})

    // get sport
    const SportTournament = await page.$eval(shadowRootPrefix + 'div.games-stream__title-item a', e => e.textContent);
    let sportName = SportTournament.split('. ')[0];
    mapping = sportNameMapping.find( m => m.specificName === sportName);
    if(mapping){
      sportName = sportNameMap[mapping.globalID];
    } else{
      log.write(`Critical Failure! sportName Mapping of '${sportName}' does not exist in ${sportNameMappingPath}\n`);
      return 20;
    }

    // get teamHome, teamAway
    let teams = await page.$$eval(shadowRootPrefix + 'div.sb-pro__name', elements => elements.map( e => e.textContent.trim() ));
    if(teams.length != 2){
      teams = await page.$$eval(shadowRootPrefix + 'div.slider-event-pro__team-name', elements => elements.map( e => e.textContent.trim() ));
      if(teams.length != 2){
        log.write(`Failure! Read incorrect number of team names for this game (possibly none)\n`);
        return 10;
      }
    }
    const teamHome = stripTeamName(teams[0]);
    const teamAway = stripTeamName(teams[1]);
    
    // get datetime, mode
    const isLive = await page.$(shadowRootPrefix + 'div._badge--live');
    let datetime;
    if(isLive){
      datetime = 'live';
    } else{
      const datestring = await page.$eval(shadowRootPrefix + 'div.slider-event-pro__info-date span', e => e.textContent.trim().replace(/\u00a0/, '\u0020'));
      datetime = datestringToISO(datestring);
    }
    const {match_id:match_id, is_new:match_is_new} = await insertMatch(log, sportName, teamHome, teamAway, datetime);
    if(!match_id){
      log.write(`Critical Failure! Database insert error\n`);
      return -100;
    }
    const {url_id:url_id, is_new:url_is_new} = await insertUrl(log, match_id, book.name, book.urls[i]);
    if(!url_id){
      log.write(`Failure! Database insert error\n`);
    }

    // check filter 'All markets'
    await page.evaluate( async(shadowRoot) => {
      const filters = Array.from(document.querySelector(shadowRoot).shadowRoot.querySelectorAll('span.games-stream-pro-nav__item-text'));
      const allMarketsFilter = filters.find( e => e.textContent.includes('FILTER.ALL'));
      if(allMarketsFilter){
        await allMarketsFilter.click();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }, shadowRoot)
    // GET ALL THE MARKETS > ODDS > COEFS FOR THIS MATCH
    selector = 'div.game-event__market-wrapper';
    let marketHandles = await page.$$(shadowRootPrefix + selector);
    // scroll until no more elements are loaded
    let old_size, new_size;
    do{
      // await new Promise(resolve => setTimeout(resolve, 1000));
      old_size =  marketHandles.length;
      await marketHandles[marketHandles.length-1].scrollIntoView();
      await new Promise(resolve => setTimeout(resolve, 100));
      marketHandles = await page.$$(shadowRootPrefix + selector);
      new_size =  marketHandles.length;
    } while( old_size !== new_size );
    for(const marketHandle of marketHandles){
      // get marketName
      selector = 'div.game-event-market__title';
      let marketName = await marketHandle.$eval(selector, e => e.textContent.trim());
      const origMarketName = marketName;
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
      const {market_id:market_id, is_new:market_is_new} = await insertMarket(log, marketName);
      if(!market_id){
        log.write(`Critical Failure! Database insert error\n`);
        return -100;
      }
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
        let suffix = '';
        let oddName = await oddHandle.$eval(selector, (e) => e.textContent.toLowerCase())
          /* thigs to check when implementing oddName sanitization:
          - toLowerCase() everything at the beggining
          - removing + for Handicap markets with .replace(/\+/g, '')
          - teamName stripping using stripTeamName
          - replace the separator correctly for Correct Score markets: 2-0 -> 2:0
          */
        oddName = oddName.replace(/\+/g, '');
        oddName = stripTeamName(oddName);
        if(marketName.includes('Correct Score')){
          oddName = oddName.replace('-',':');
        } else if(marketName.includes('First to Reach Kills')){
          suffix = origMarketName.match(/\d+/)[0];
        } else if(marketName.includes('Kill Maker')){
          suffix = origMarketName.match(/\d+/)[0];
        }
        oddName = oddName + suffix;
        // get coef
        selector = 'span.outcome__number'
        const value = await oddHandle.$eval(selector, (e) => {
          const text = e.textContent;
          const f = parseFloat(text);
          if(!Number.isNaN(f)){
            return f;
          } else{
            return null;
          }
        });
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
    log.write(`Critical Failure! scraping a match from ${book.urls[i]}. Error code:${error}\n`);
    return -1; 
  } finally{
    await originalPage?.close()
    await promisify(log.end).bind(log)();
  }
}