import { createWriteStream, readFileSync } from "fs"
import { promisify } from "util";

import { sportNameMap } from "../sportNameMap.js";
import { marketNameMap } from "../marketNameMap.js";
import { stripTeamName } from "../util/stripTeamName.js";
import { datestringToISO } from "./parser.js";
import { insertMarket, insertMatch, insertOdd, insertUrl } from "../../data/db/inserter.js";

/**
 * 
 * @param {*} s arguments in the format -1.5015
 * @returns two float arguments: -1.5 and 1.5 from the example value
 * 201.01 -> {1, 10, 2}
 * the first float has 2 significant places (the extra argument, is returned at the end)
 * the second float has 2 significant places
 * the third one has 2 significant places
 */
function extractArg(s){
  const f = parseFloat(s);
  const argExtra = Math.round((f/100));
  const arg1 = Math.trunc(f*10)/10;
  const arg2 = Math.round((f-arg1)*10000)/10;
  return {arg1, arg2, argExtra};
}

import axios from 'axios';
let CURRENT_COOKIE = "";
let REFERER = "";
async function fetchMap( mapId ){
  const API_URL = `https://bestwinzz.net/service-api/LineFeed/GetGameZip?id=${mapId}&lng=en&tzo=1&cfview=0&isSubGames=true&GroupEvents=true&countevents=750&country=53&fcountry=53&isNewBuilder=true&partner=151&grMode=4`;
  const HEADERS = {
      'Cookie': CURRENT_COOKIE, 
      'Referer': REFERER, 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest',
  };
  try {
    const response = await axios.get(API_URL, { headers: HEADERS });
    return response.data;
  } catch (error) {
    return { Success: false };
  }
}

import { prepPage } from "../page.js";
import { betsModel, betsModelGroup } from "./map.js";
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

  // prepare headers data for the direct fetch to the API
  const page = await prepPage(browser, book);
  try{
    try{
      await page.goto(book.urls[i], {waitUntil:'domcontentloaded'});
    } catch(error){
      log.write(`Critical Failure! Cannot open page ${book.urls[i]}\n`);
      return -1;
    }
      try{
          await page.waitForSelector('#game-filters option');
      } catch(error){
          // Some games do not have this filter, they just have game markets! Have to craft API call then?
          log.write(`Critical Failure! The '#game-filters option' selector not to be found on ${book.urls[i]}\n`);
          return 10;
      }
    const maps = await page.$$eval('#game-filters option', (es) => {
      return es.map( e => { 
        return {mapName: e.textContent.replace(/\n/g, '').trim(), mapId: e.value}
      })
    });
    const urlSplit = book.urls[i].split('/esports/', 2)[1].split('/', 2);
    const idAndName = urlSplit[0].split(/-(.*)/);
    const leagueId = idAndName[0];
    const leagueName = idAndName[1];
    const slug = urlSplit[1].split(/-(.*)/)[1];
    REFERER = `https://bestwinzz.net/line/esports/${leagueId}-${leagueName}/${maps[0].mapId}-${slug}`;
    const cookiesArray = await page.cookies();
    CURRENT_COOKIE = cookiesArray.map(cookie => 
        `${cookie.name}=${cookie.value}`
    ).join('; ');
    
    let datetime = undefined;
    try{
      const dateString = await page.$eval('a.link.open > span.date', e => e.textContent.trim())
      datetime = datestringToISO( dateString );
    } catch(error){
      log.write(`Critical Failure! Can't read date: ${error.code} from ${book.urls[i]}\n`)
      return -1;
    }

    for(const map of maps){
      const respData = await fetchMap(map.mapId);
      if(respData.Success === true){

        let sportName = respData.Value.SSN;
        var mapping = sportNameMapping.find( m => m.specificName === sportName);
        if(mapping){
          sportName = sportNameMap[mapping.globalID];
        } else{
          log.write(`Failure! sportName Mapping of '${sportName}' does not exist in ${sportNameMappingPath}\n`);
          return 20;
        }
        const teamHome = stripTeamName(respData.Value.O1);
        const teamAway = stripTeamName(respData.Value.O2);
        const {match_id:match_id, is_new:match_is_new} = await insertMatch(log, sportName, teamHome, teamAway, datetime);
        if(!match_id){
          log.write(`Critical Failure! Database insert error\n`);
          return -100;
        }
        const {url_id:url_id, is_new:url_is_new} = await insertUrl(log, match_id, book.name, book.urls[i]);
        if(!url_id){
          log.write(`Failure! Database insert error\n`);
        }
      
        const markets = respData.Value.GE;
        for(const marketEntry of markets){

          const marketPrefix = map.mapName;
          let marketName = marketPrefix + ' ' + betsModelGroup[marketEntry.G]?.N;
          var mapping = marketNameMapping.find( m => m.specificName === marketName);
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

          const cols = marketEntry.E;
          for(const col of cols){
            for(const entry of col){

              const {arg1, arg2, argExtra} = extractArg(entry.P);
              const oddName = betsModel[entry.T].N
                .replace('^1^', teamHome)
                .replace('^2^', teamAway)
                .replace(/\(arg1\)/, arg1)
                .replace(/\(arg2\)/, arg2)
                .replace(/\(argExtra\)/, argExtra)
                .replace(/\(\)/, arg1)
                .replace(/\(\)/, arg2)
                .replace(/\[\]/, entry.PL?.N) 
              const value = entry.C;
              const {odd_id:odd_id, is_new:odd_is_new} = await insertOdd(log, match_id, market_id, oddName, book.name, value);
              if(!odd_id){
                log.write(`Failure! Database insert error\n`);
                continue;
              }
            }
          }
        }
      } else{
        throw new Error("fetchMap failure");
      }
    }
    log.write(`Success! scraping a match from ${book.urls[i]}\n`);
    return 0;
  }catch(error){
    log.write(`Critical Failure! scraping a match from ${book.urls[i]}\n`);
    return -1;
  }finally{
    await page?.close()
    await promisify(log.end).bind(log)();
  }
}
