import { createWriteStream, readFileSync } from "fs"
import { promisify } from "util";

import { sportNameMap } from "../sportNameMap.js";
import { marketNameMap } from "../marketNameMap.js";
import { stripTeamName } from "../util/stripTeamName.js";
import { datestringToISO } from "./parser.js";
import { prepPage } from "../page.js";
import { insertMarket, insertMatch, insertOdd, insertUrl } from "../../data/db/inserter.js";

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
 
  // let page = await prepPage(browser, book);
  let page = await browser.newPage();
  const originalPage = page;

  try{
    let selector, mapping;

    await page.goto(book.urls[i]);

    const el = await page.waitForSelector('span.live-badge, iframe, div.container-event', { timeout: 30000 })
    if(el){
      const tag = await el.evaluate(e => e.tagName);
      if(tag === 'SPAN' && await el.evaluate(e => e.textContent) == 'LIVE'){
        log.write(`Failure! The LIVE badge is present on the page ${book.urls[i]}\n`);
        return 10;
      } else if(tag === 'DIV'){
        ;
      } else if(tag === 'IFRAME'){
        page = await el.contentFrame();
      }
    }
    await page.waitForSelector('div.markets', {timeout:10000})

    // get sport
    let sportName = await page.$$eval('div.breadcrumb div.breadcrumb-list ul li a', els => {
      let sport;
      if(els.length >= 3){
        const SportTournament = els[2].textContent;
        sport = SportTournament.split(' - ')[0].replace('\n', '').trim();
      }
      return sport;
    })
    if(!sportName){
      log.write(`Critical Failure! Could not get sportName on ${book.urls[i]}\n`);
      return 21;
    }
    mapping = sportNameMapping.find( m => m.specificName === sportName);
    if(mapping){
      sportName = sportNameMap[mapping.globalID];
    } else{
      log.write(`Critical Failure! sportName Mapping of '${sportName}' does not exist in ${sportNameMappingPath}\n`);
      return 20;
    }

    // get teamHome, teamAway
    let teamHome = await page.$eval('div.header-title div.actor-1', e => e.textContent);
    teamHome = stripTeamName(teamHome);
    let teamAway = await page.$eval('div.header-title div.actor-2', e => e.textContent);
    teamAway = stripTeamName(teamAway);
    
    // get datetime, mode
    const datestring = await page.$eval('div.date-event', e => e.textContent.trim().replace(/\u00a0/, '\u0020'));
    const datetime = datestringToISO(datestring);
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
    selector = 'div.container-event';
    let marketHandles = await page.$$(selector);
    for(const marketHandle of marketHandles){
      // get marketName
      selector = 'div.question-header p';
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
      selector = 'span.odd';
      const oddsHandles = await marketHandle.$$(selector);
      for(let i = 0; i < oddsHandles.length; i++){
        const oddHandle = oddsHandles[i];
        selector = 'span.actor-label';
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
          oddName = oddName
            .replace(teamHome, '')
            .replace(teamAway, '');
        } else if(marketName.includes('Handicap')){
          // translate (-1.5)teamName into teamName-1.5
          oddName = oddName.replace(/^\((-?\d+\.?\d*)\)(.+)$/, '$2$1');
        }
        oddName = oddName + suffix;
        // get coef
        selector = 'span.odd-value-live'
        const value = await oddHandle.$eval(selector, (e) => {
          const text = e.parentNode.textContent.replace('\n', '').trim();
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