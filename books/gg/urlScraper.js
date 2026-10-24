import { createWriteStream, readFileSync } from "fs"
import { promisify } from "util";

import { sportNameMap } from "../sportNameMap.js";
import { marketNameMap } from "../marketNameMap.js";
import { stripTeamName } from "../util/stripTeamName.js";
import { prepPage } from "../page.js";
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

  const page = await prepPage(browser, book);
  try{
    await page.goto(book.urls[i], {waitUntil:'domcontentloaded'});
    const chicken = await page.evaluate( () => document.querySelector('img[src="/spa-assets/image/empty-state/chicken.png"]'));
    if(chicken){
      log.write(`Failure! The 'game not available'-chicken is present! ${book.urls[i]}\n`);
      return 10;
    }

    await page.waitForSelector('div[data-test=market-name]', {timeout: 10000});
    let selector, el, mapping;
    // get sport
    let sportName = await page.evaluate( () => {
      const linkSplit = Array.from(document.querySelector('div[data-test="competitor"]').parentNode.getAttribute('href').split('/'));
      let j = 0;
      for(let i = 0; i < linkSplit.length; i++){
        if(linkSplit[i] === 'esports'){
          j = i+1;
          break;
        }
      }
      if( j ){
        return linkSplit[j];
      } else{
        return 'invalid';
      }
    });
    mapping = sportNameMapping.find( m => m.specificName === sportName);
    if(mapping){
      sportName = sportNameMap[mapping.globalID];
    } else{
      log.write(`Critical Failure! sportName Mapping of '${sportName}' does not exist in ${sportNameMappingPath}\n`);
      return 20;
    }

    // get tournament
//     let tournamentName = 'BLAST Premier: Fall Groups 2024 on ggbet';
//     mapping = tournamentNameMapping.find( m => m.specificName === tournamentName);
//     if(mapping){
//       tournamentName = tournamentNameMap[mapping.globalID];;
//     } else{
//       log.write(`Failure! tournamentName Mapping of '${tournamentName}' does not exist in ${tournamentNameMappingPath}\n`);
//       return;
//     }
//     let tournament = sport.tournaments.findLast(t => t.name === tournamentName );
//     if(!tournament){
//       /* tournament is new */
//       sport.tournaments.push({ name: tournamentName, matches: [] });
//       tournament = sport.tournaments.findLast(t => t.name === tournamentName);
//     }

    // get teamHome, teamAway
    selector = 'div[data-test=score-board-body]';
    const teamsDatetimeHandle = await page.$(selector);
    selector = 'span[data-test=competitor-title]';
    const teams = await teamsDatetimeHandle.$$eval(selector, es => es.map(e => e.textContent));
    const teamHome = stripTeamName(teams[0]);
    const teamAway = stripTeamName(teams[1]);
    
    // get datetime
    const live = await page.$('div[data-test="main-score__home"]');
    let datetime;
    if(live){
      datetime = 'live';
    } else{
      selector = 'div[data-test=competitors]';
      const datetimeRaw = await teamsDatetimeHandle.$eval(selector, e => e.textContent);
      datetime = datestringToISO( datetimeRaw );
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

    // GET ALL THE MARKETS > ODDS > COEFS FOR THIS MATCH
    selector = 'div[data-tab=All]';
    el = await page.waitForSelector(selector);
    await el.click();
    await new Promise(resolve => setTimeout(resolve, 1000));

  // scroll to load all markets — controlled from Node side with a hard timeout
    async function scrollMarkets(page, { maxIterations = 15, scrollPause = 300, timeout = 15000 } = {}) {
      await page.bringToFront();
      const deadline = Date.now() + timeout;
      let prevCount = 0;

      for (let i = 0; i < maxIterations; i++) {
        if (Date.now() > deadline) break;

        const count = await page.$$eval(
          'div[data-test=markets] > div > div',
          els => {
            const last = els[els.length - 1];
            if (last) {
              const odd = last.querySelector('div[data-test=odd-button__result]');
              (odd || last).scrollIntoView();
            }
            return els.length;
          }
        );

        if (count === prevCount) break;
        prevCount = count;
        await new Promise(r => setTimeout(r, scrollPause));
      }
    }

    await scrollMarkets(page);
    
    const marketHandles = await page.$$('div[data-test=markets] > div > div');
    let odd, coef;
    for(const marketHandle of marketHandles){
      // get marketName
      selector = 'div[data-test=market-name]';
      let marketName = await marketHandle.$eval(selector, e => e.textContent.trim());
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
      selector = 'div.w-0.grow';
      const oddColumnHandles = await marketHandle.$$(selector);
      for(const oddColumnHandle of oddColumnHandles){
        selector = 'div.flex.h-8';
        el = await oddColumnHandle.$(selector);
        let oddNamePrefix = null;
        if(el){
          oddNamePrefix = await page.evaluate(e => e.textContent, el);
        }
        oddNamePrefix = oddNamePrefix ? stripTeamName(oddNamePrefix) : '';
        selector = 'div[data-test="odd-button   odd-button--is-active"]'
        const oddHandles = await oddColumnHandle.$$(selector);
        for(const oddHandle of oddHandles){
          selector = 'div[data-test=odd-button__title]';
          let oddName = await oddHandle.$eval(selector, e => e.textContent);
          oddName = stripTeamName(oddName);
          oddName = oddName.replace(/[()+]/g, '');
          if( !oddName.includes(teamHome) && !oddName.includes(teamAway)){
            oddName = oddNamePrefix ? `${oddNamePrefix} ${oddName}` : oddName;
          }
          if(marketName.includes(marketNameMap['CS'])){
            oddName = oddName.split(' ')[1];
          } else if(marketName.includes('Duration')){
            oddName = oddName.replace('minutes', '');
          }
          oddName = oddName.replace(/\s+/g, '');
          if ( marketName === 'Correct score' && teamHome === teamAway && teamAway === teamHome){ // in case of CS market and flipped teamNames, the oddNames in the form of '2:0', etc. need to be flipped as well
            const [left, right] = oddName.split(':');
            oddName = `${right}:${left}`;
            oddName = oddName.replace(teamHome, '');
            oddName = oddName.replace(teamAway, '');
            oddName = oddName.replace('-', ':');
          }
          selector = 'div[data-test=odd-button__result]';
          const valueHandle = await oddHandle.$(selector);
          let value = valueHandle ? await page.evaluate(e => parseFloat(e.textContent), valueHandle) : null;
          const {odd_id:odd_id, is_new:odd_is_new} = await insertOdd(log, match_id, market_id, oddName, book.name, value);
          if(!odd_id){
            log.write(`Failure! Database insert error\n`);
            continue;
          }
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
      await page.goto('about:blank', {timeout:3000});
      await page?.close();
    } catch {
      try{
        const client = await page.createCDPSession();
        await client.send('Page.close');
      } catch {}
    }
    await promisify(log.end).bind(log)();
  }
  
}
