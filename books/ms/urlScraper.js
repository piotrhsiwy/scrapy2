import { createWriteStream, readFileSync } from "fs"
import { promisify } from "util";

import { sportNameMap } from "../sportNameMap.js";
import { marketNameMap } from "../marketNameMap.js";
import { stripTeamName } from "../util/stripTeamName.js";
import { datestringToISO } from "./parser.js";
import { insertMarket, insertMatch, insertOdd, insertUrl } from "../../data/db/inserter.js";

export async function scrapeMatchURL(data, browser, book, i){
  
  const pageOriginal = await browser.newPage();
  let page = pageOriginal;
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
    let selector, el, mapping;

    try{
      selector = 'iframe[name="sportsbook_iframe"]';
      await page.waitForSelector(selector, {timeout:3000});
      log.write(`Changing context to iframe ${book.urls[i]}\n`)
      const iframeHandle = await page.$(selector);
      const frame = page = await iframeHandle.contentFrame();
    } catch{
      log.write(`No iframe ${book.urls[i]}\n`)
    }
  
    // get sport
    const breadcrumbs = await page.$eval( 'div.match-title', e => e.textContent.split('keyboard_arrow_right'));
    let sportName = breadcrumbs[0].trim().replace(/\u00a0/g, '\u0020');
    mapping = sportNameMapping.find( m => m.specificName === sportName);
    if(mapping){
      sportName = sportNameMap[mapping.globalID];
    } else{
      log.write(`Failure! sportName Mapping of '${sportName}' does not exist in ${sportNameMappingPath}\n`);
      return 20;
    }

    // get tournament
    // let tournamentName = breadcrumbs[2].trim();
    // mapping = tournamentNameMapping.find( m => m.specificName === tournamentName);
    // if(mapping){
    //   tournamentName = tournamentNameMap[mapping.globalID];
    // } else{
    //   log.write(`Failure! tournamentName Mapping of '${tournamentName}' does not exist in ${tournamentNameMappingPath}\n`);
    // }
    // let tournament = sport.tournaments.findLast(t => t.name === tournamentName );
    // if(!tournament){
    //   /* tournament is new */
    //   sport.tournaments.push({ name: tournamentName, matches: [] });
    //   tournament = sport.tournaments.findLast(t => t.name === tournamentName);
    // }

    // get teamHome, teamAway, datetime, mode
    const teams = breadcrumbs[3].split(' - ');
    const teamHome = stripTeamName(teams[0].trim());
    const teamAway = stripTeamName(teams[1].replace(/\s+Hide All/, '').trim());
    selector = 'div.match-info > p:nth-child(3)';
    el = await page.waitForSelector(selector);
    const datetime = datestringToISO(await page.evaluate( e => e.textContent.trim().replace(/\u00a0/g, '\u0020').split(', ')[1].trim(), el));
//     selector = "div.match-header__bo";
//     el = await page.waitForSelector(selector);
//     const mode = await page.evaluate( e => e.textContent.trim().replace(/\u00a0/g, '\u0020'), el);
    mapping = sportNameMapping.find( m => m.specificName === sportName);
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
    selector = 'div.m-col > div';
    const marketHandles = await page.$$(selector);
    if(marketHandles.length === 0){
      log.write(`No market handles ${book.urls[i]}\n`)
    }
    for(const marketHandle of marketHandles){

      selector = 'div.title > span';
      let marketName = await marketHandle.$eval(selector, e => e.textContent);
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

      selector = 'div.market-odds > div';
      const oddsHandles = await marketHandle.$$(selector);
      for(const oddHandle of oddsHandles){
        let oddName = await oddHandle.$eval('p.odd-name', e => e.textContent); 
        oddName = stripTeamName(oddName).replace(/[()+]/g, '');
        if(! marketName.includes('Correct Score') && ! marketName.includes('Total')){
          oddName = oddName
            .replace(/1|2/, (match) => { return match === '1' ? teamHome : teamAway });
        }
        if ( marketName === 'Correct score' && teamHome === teamAway && teamAway === teamHome){ // in case of CS market and flipped teamNames, the oddNames in the form of '2:0', etc. need to be flipped as well
          const [left, right] = oddName.split(':');
          oddName = `${right}:${left}`;
        }
        const value = await oddHandle.$eval('span.coef', e => parseFloat(e.textContent));
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
      await pageOriginal?.close()
    } catch{}
    await promisify(log.end).bind(log)();
  }
  
}