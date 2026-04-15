import { pool } from "./db.js";
import { ISO8601ToPretty, prettyToDate } from "./prettify.js";

/**
 * 
 * @param {*} log 
 * @param {*} odd 
 * @param {*} book 
 * @param {*} value 
 * @returns the coef that has just been added/created
 */
export function insertCoefIntoOdd(log, odd, book, value){
    let coef = odd.coefs.findLast(c => c.book === book);
    if(!coef){
        /* the coef is new */
        // log.write(`Warning! This coef is new: ${book.name}: ${value}\n`);
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
        // log.write(`Warning! This odd is new: ${oddName}\n`);
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
        // log.write(`Warning! This market is new: ${marketName}\n`);
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
 * @param {*} datetime is in the ISO8601 format or 'live'
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
      // log.write(`Warning! This match is new: ${teamHome}, ${teamAway}, ${datetime}\n`);
      sport.matches.push({ 
        teamHome: teamHome,
        teamAway: teamAway,
        datetime: datetime,
        urls: [{book: book, url: url}],
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
 * @param {WritableStream} log 
 * @param {String} sport e.g. 'Counter-Strike 2'
 * @param {String} teamHome  e.g. 'vitality'
 * @param {String} teamAway  e.g. 'g2'
 * @param {String} datetime is in the ISO8601 format
 * @returns the match_id of the inserted match.
 *      undefined when an errors on insert occurs
 */
export async function insertMatch(log, sport, teamHome, teamAway, datetime){

    let client;
    let match_id;
    try{
        client = await pool.connect();
        const ret = await client.query( {
                text:`INSERT INTO Matches (sport, teamHome, teamAway, datetime) VALUES($1, $2, $3, $4) RETURNING match_id`,
                values: [sport, teamHome, teamAway, datetime],
        });
        match_id = ret.rows[0].match_id;
        
    } catch(e){
        log.write(`Database error when inserting: ${sport, teamHome, teamAway, datetime}\n`)
        client.query(`ROLLBACK`);
    } finally{
        client.query('COMMIT')
        client.release()
        return match_id;
    }
}