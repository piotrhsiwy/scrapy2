/**
 * 
 * @param {*} log 
 * @param {*} odd 
 * @param {*} book 
 * @param {*} value 
 * @returns the coef that has just been added/created
 */
import { ISO8601ToPretty, prettyToDate } from "./prettify.js";
export function insertCoefIntoOdd(log, odd, book, value){
    let coef = odd.coefs.findLast(c => c.book === book);
    if(!coef){
        /* the coef is new */
        log.write(`Warning! This coef is new: ${book.name}: ${value}\n`);
        const timestamp = ISO8601ToPretty(new Date().toISOString());
        odd.coefs.push({timestamp: timestamp, book: book, value: value});
    } else{
        /* the coef already exists */
        // update policy: always update
        coef.timestamp = ISO8601ToPretty(new Date().toISOString());
        coef.value = value;
    }
    return coef;
}

/**
 * 
 * @param {*} log 
 * @param {*} market 
 * @param {*} oddName 
 * @returns the odd that has just been updated/created
 */
export function insertOddIntoMarket(log, market, oddName){
    let odd = market.odds.findLast(o => o.name === oddName);
    if(!odd){
        /* the odd is new */
        log.write(`Warning! This odd is new: ${oddName}\n`);
        market.odds.push({name: oddName, coefs: []})
        odd = market.odds.findLast(o => o.name === oddName);
    } else{
        /* the odd already exists */
    }
    return odd;
}

/**
 * 
 * @param {*} log 
 * @param {*} match 
 * @param {*} marketName 
 * @returns the market that has just been updated/created
 */
export function insertMarketIntoMatch( log, match, marketName){
    let market = match.markets.findLast(m => m.name === marketName);
    if(!market){
        /* the market is new */
        log.write(`Warning! This market is new: ${marketName}\n`);
        match.markets.push({name: marketName, odds: []});
        market = match.markets.findLast(m => m.name === marketName);
    } else{
        /* the market already exists */
    }
    return market;
}

/**
 * 
 * @param {*} sport 
 * @param {*} teamHome 
 * @param {*} teamAway 
 * @param {*} datetime 
 * @returns the match that has just been updated/created
 */
export function insertMatchIntoSport( log, sport, teamHome, teamAway, datetime, book, url){
    datetime = ISO8601ToPretty(datetime);
    let match = sport.matches.findLast(m =>
        (
          m.datetime === datetime || (Math.abs( prettyToDate(m.datetime).getTime() - prettyToDate(datetime).getTime() ) <= 3*60*60*1000) 
          // maximum of 3h difference is allowed, becuase some books have different datetimes
        )
        &&
        (
          m.teamHome === teamHome &&
          m.teamAway === teamAway
        )
        ||
        ( 
          m.teamHome === teamAway && // inverted Home/Away ordering, but still the same datetime => the same event
          m.teamAway === teamHome
        )
    )
    if(!match){
      /* the match is new */
      log.write(`Warning! This match is new: ${teamHome}, ${teamAway}, ${datetime}\n`);
      sport.matches.push({ 
        teamHome: teamHome,
        teamAway: teamAway,
        datetime: datetime,
        urls: [],
        markets: []
      });
      match = sport.matches.findLast(m =>
          m.teamHome === teamHome &&
          m.teamAway === teamAway &&
          m.datetime === datetime
      );
    } else{
      /* the match already exists */
      let record = match.urls.findLast( (u) => u.book === book);
      if(record){
        // update policy: never update the match url
      } else{
        match.urls.push({book: book, url: url});
      }
    }
    return match;
}

/**
 * 
 * @param {*} log 
 * @param {*} data 
 * @param {*} sportName 
 * @returns the sport that has just been updated/created 
 */
export function insertSportIntoData(log, data, sportName){
    let sport = data.sports.findLast(s => s.name === sportName);
    if(!sport){
        /* the sport is new */
        log.write(`Warning! This sport is new: ${sportName}\n`);
        data.sports.push({ name: sportName, matches: [] });
        sport = data.sports.findLast(s => s.name === sportName);
    } else{
        /* the sport already exists */
    }
    return sport;
}