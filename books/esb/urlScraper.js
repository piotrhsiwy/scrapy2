import { createWriteStream, readFileSync } from "fs"
import { promisify } from "util";

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

  const page = await browser.newPage();
  await page.setViewport(book.viewport);
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  try{
    await page.goto(book.urls[i],  { waitUntil: 'networkidle2', timeout: 30000 });
    try{
      let selector, el, mapping;
      // check if match is still there
      let count = 0;
      let oPInfoExists = await page.evaluate( () => { return document.querySelector('div.oPInfo') !== null });
      let msg = await page.evaluate( () => document.querySelector('div.msgTxt')?.textContent);
      while( !oPInfoExists && !msg && count < 20){
        oPInfoExists = await page.evaluate( () => { return document.querySelector('div.oPInfo') !== null });
        msg = await page.evaluate( () => document.querySelector('div.msgTxt')?.textContent);
        await new Promise(resolve => setTimeout(resolve, 100));
        count++;
      }
      if(oPInfoExists){
        if(msg){
          log.write(`Failure! div.msgTxt present with textContent=${msg}! ${book.urls[i]}\n`);
          return 10;
        }
      } else{
        log.write(`Failure! The element div.oPInfo is not present! ${book.urls[i]}\n`);
        return 10;
      }
      // get sport
      let infoHandle = await page.$('div.oPInfo');
      let sportName = await infoHandle.$eval('img', e => e.getAttribute('src').split('/').pop().split('.')[0]);
      mapping = sportNameMapping.find( m => m.specificName === sportName);
      if(mapping){
        sportName = sportNameMap[mapping.globalID];
      } else{
        log.write(`Critical Failure! sportName Mapping of '${sportName}' does not exist in ${sportNameMappingPath}\n`);
        return 20;
      }

  //     // get tournament
  //     selector = 'div.leagueName';
  //     let tournamentName = await infoHandle.$eval(selector, e => e.textContent.trim().replace(/\u00a0/, '\u0020'));
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
      selector = 'div.lDTeamName';
      const teams = await page.$$eval(selector, elements => elements.map( e => e.textContent.trim() ));
      const teamHome = stripTeamName(teams[0]);
      const teamAway = stripTeamName(teams[1]);
      
      // get datetime, mode
      selector = 'div.matchStatus';
      el = await infoHandle.$eval(selector, e => e.textContent.trim().replace(/\u00a0/, '\u0020'));
      const datetime = datestringToISO(el.split('B')[0].trim());
      let mode = el.split('B')[1];
      mode = 'B' + mode;    
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
      selector = 'div.matchWrp';
      let marketHandles = await page.$$(selector);
      // scroll until no more elements are loaded
      let old_size, new_size;
      do{
        // await new Promise(resolve => setTimeout(resolve, 1000));
        old_size =  marketHandles.length;
        const lastHandle = marketHandles[marketHandles.length-1];
        if(lastHandle){
          await lastHandle.scrollIntoView();
        }
        await page.waitForNetworkIdle({idleTime: 100});
        marketHandles = await page.$$(selector);
        new_size =  marketHandles.length;
      } while( old_size !== new_size );
      selector = 'div.marketRow';
      const labelsHandle = await page.$(selector);
      selector = 'label';
      const labels = await labelsHandle.$$eval(selector, es => es.map( e => e.textContent));
      const labelHome = labels[0];
      const labelAway = labels[1];
      for(const marketHandle of marketHandles){
        // get marketName
        selector = 'div.matchInfoLeft';
        let marketName = await marketHandle.$eval(selector, e => e.textContent.trim());
        const SplitOnSpaces = marketName.split(' ');
        const HdpSpecial = marketName.split(' Hdp: ');
        if(HdpSpecial.length > 1){ marketName = 'Match Handicap' }
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
        // get odds
        selector = 'div.oddsWrp';
        const oddsHandles = await marketHandle.$$(selector);
        for(let i = 0; i < oddsHandles.length; i++){
          const oddHandle = oddsHandles[i];
          let handle = await oddHandle.$('label');
          if(!handle){
            continue;
          }
          let oddName = await oddHandle.$eval('label', (e) => e.textContent);
          // oddName.replace()
          // if !oddName that means that ths div.oddWrp is indeed one of three and holds an oddName suffix like '23.5' , for Over/Under Market and so on...
          // for Over/Under Total Maps markets, the sufix is the last bit, split on spaces, from the marketName. 
          let sufix = '';
          if(oddsHandles.length === 3){
            if(oddName === 'Over' || oddName === 'Under'){
              sufix = SplitOnSpaces[SplitOnSpaces.length-1];
            } else{
              sufix = await page.evaluate(e => e.parentNode.childNodes[1].textContent, oddHandle);
            }
          }
          oddName = oddName
          .replace(labelHome, teamHome)
          .replace(labelAway, teamAway)
          .replace(/\+/g, '');
          if(HdpSpecial.length > 1){
            /* Match Handicaps are named like this: "BO3 Hdp: VP -1.5". They have exactly 2 odd entries.
            Note: The team in the is not always the first one listed */
            const isFromTitle = HdpSpecial[1].replace(labelHome, teamHome).replace(labelAway, teamAway).includes(oddName);
            if(isFromTitle){
              oddName = HdpSpecial[1].replace(labelHome, teamHome).replace(labelAway, teamAway);
            } else{
              const hdpValue = -1.0 * parseFloat(HdpSpecial[1].split(' ')[1]);
              const isHomeinTitle = HdpSpecial[1].includes(labelHome);
              oddName = `${isHomeinTitle ? teamAway : teamHome} ${hdpValue}`;
            }
          }
          /* Additionally remove spaces is the namse of all odds for a handicap market. This is separate from the previous
          block, because non-map handicap markets do not fulfil the test in if */
          if(marketName.includes('Handicap')){
            oddName = oddName.replace(/\s+/g, '');
          }
          /* first to reach kill
          Explanation: the first-to-reach have been mapped to a single market name.
          hence oddNames have to be adjusted for esb. I append the no kills/rounds
          at the end of the oddName */
          let regex = /Game (\d) First to (\d+) Kills/;
          let match = HdpSpecial[0].match(regex);
          if(match) {
            oddName = `${oddName}${match[2]}`;
          }
          /* first to reach rounds */
          regex = /Game (\d) First to Win (\d+) Rounds/;
          match = HdpSpecial[0].match(regex);
          if(match) {
            oddName = `${oddName}${match[2]}`;
          }
          oddName = oddName + sufix;
          oddName = oddName.toLowerCase();
          if(marketName.includes('Margin')){
            oddName = oddName.replace('/', '');
          }
          if ( marketName === 'Correct score' && teamHome === teamAway && teamAway === teamHome){ // in case of CS market and flipped teamNames, the oddNames in the form of '2:0', etc. need to be flipped as well
            const [left, right] = oddName.split(':');
            oddName = `${right}:${left}`;
          }
          // value = null if an odd is locked
          const is_locked = await oddHandle.evaluate( e =>
            e.classList.contains('locked')
          );
          const value = is_locked ? null : 
            await oddHandle.evaluate( (odd) => {
              // //debugger;
              const label = odd.querySelector('label');
              let labelText = label ? label.textContent : '';
              let value = odd ? parseFloat(odd.textContent.replace(labelText, '').trim()) : null;
              return value;
            })
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
      log.write(`Critical Failure! scraping a match from ${book.urls[i]}. Error code:${error.message}\n`);
      return -1;
    }
  } finally{
    await page?.close()
    await promisify(log.end).bind(log)();
  }
}