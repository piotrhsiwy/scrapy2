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
 * @param {Integer} market_id e.g. 1 - id of the corresponding match. This is inserted into the markets_coefs_link table along with coef_id.
 * @param {String} book e.g. 'Esportsbet'
 * @param {String} oddName  e.g. '1.88'
 * @returns the coef_id of the inserted Coef entry.
 *      undefined when an errors on insert occurs
 */
export async function insertCoef(log, market_id, book, value){

    const date = new Date();
    let client;
    let coef_id;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query( {
                text:`INSERT INTO Coefs (book, value) VALUES($1, $2) RETURNING coef_id`,
                values: [book, value],
        });
        coef_id = ret.rows[0].coef_id;
        if(coef_id){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully inserted into Coefs: \n\t entry: (${book}, ${value})\n\t coef_id: ${coef_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${book}, ${value})\n\t Incorrect coef_id: ${coef_id}\n`);
            return coef_id;
        }

        ret = await client.query( {
                text:`INSERT INTO markets_coefs_link (market_id, coef_id) VALUES($1, $2)`,
                values: [market_id, coef_id],
        });
        if(ret.rowCount === 1){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully inserted into markets_coefs_link: \n\t entry: (${market_id}, ${coef_id})\n`)
        } else{
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${market_id}, ${coef_id})\n\t Incorrect rowCount: ${ret.rowCount}\n`);
        }
    
        
    } catch(e){
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${book}, ${value})\n\t error: ${e.message}\n`)
    } finally{
        if(client) client.release()
        return coef_id;
    }
}

/**
 * @param {WritableStream} log 
 * @param {Integer} match_id e.g. 1 - id of the corresponding match. This is inserted into the matches_markets_link table along with market_id.
 * @param {String} name e.g. 'Match Winner'
 * @param {String} oddName  e.g. 'vitality'
 * @returns the market_id of the inserted Market entry.
 *      undefined when an errors on insert occurs
 */
export async function insertMarket(log, match_id, name, oddName){

    const date = new Date();
    let client;
    let market_id;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query( {
                text:`INSERT INTO Markets (name, oddName) VALUES($1, $2) RETURNING market_id`,
                values: [name, oddName],
        });
        market_id = ret.rows[0].market_id;
        if(market_id){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully inserted into Markets: \n\t entry: (${name}, ${oddName})\n\t market_id: ${market_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${name}, ${oddName})\n\t Incorrect market_id: ${market_id}\n`);
            return market_id;
        }

        ret = await client.query( {
                text:`INSERT INTO matches_markets_link (match_id, market_id) VALUES($1, $2)`,
                values: [match_id, market_id],
        });
        if(ret.rowCount === 1){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully inserted into matches_markets_link: \n\t entry: (${match_id}, ${market_id})\n`)
        } else{
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${match_id}, ${market_id})\n\t Incorrect rowCount: ${ret.rowCount}\n`);
        }
    
        
    } catch(e){
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${name}, ${oddName})\n\t error: ${e.message}\n`)
    } finally{
        if(client) client.release()
        return market_id;
    }
}

/**
 * @param {WritableStream} log 
 * @param {Integer} match_id e.g. 1 - id of the corresponding match. This is inserted into the matches_urls_link table along with url_id.
 * @param {String} book e.g. 'Esportsbet'
 * @param {String} url  e.g. 'https://esportsbet.io/esportsbull/OddsPage/39513322/47/CS2Betting-1W-TEAM-NUCLEAR-TIGERES'
 * @returns the url_id of the inserted Url entry.
 *      undefined when an errors on insert occurs
 */
export async function insertUrl(log, match_id ,book, url){

    const date = new Date();
    let client;
    let url_id;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query( {
                text:`INSERT INTO Urls (book, url) VALUES($1, $2) RETURNING url_id`,
                values: [book, url],
        });
        url_id = ret.rows[0].url_id;
        if(url_id){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully inserted into Urls: \n\t entry: (${book}, ${url})\n\t url_id: ${url_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${book}, ${url})\n\t Incorrect url_id: ${url_id}\n`);
            return url_id;
        }

        ret = await client.query( {
                text:`INSERT INTO matches_urls_link (match_id, url_id) VALUES($1, $2)`,
                values: [match_id, url_id],
        });
        if(ret.rowCount === 1){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully inserted into matches_urls_link: \n\t entry: (${match_id}, ${url_id})\n`)
        } else{
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${match_id}, ${url_id})\n\t Incorrect rowCount: ${ret.rowCount}\n`);
        }
    
        
    } catch(e){
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${book}, ${url})\n\t error: ${e.message}\n`)
    } finally{
        if(client) client.release()
        return url_id;
    }
}

/**
 * @param {WritableStream} log 
 * @param {String} sport e.g. 'Counter-Strike 2'
 * @param {String} teamHome  e.g. 'vitality'
 * @param {String} teamAway  e.g. 'g2'
 * @param {String} datetime is in the ISO8601 format
 * @returns the match_id of the inserted Match.
 *      undefined when an errors on insert occurs
 */
export async function insertMatch(log, sport, teamHome, teamAway, datetime){

    const date = new Date();
    let client;
    let match_id;
    try{
        client = await pool.connect();
        const ret = await client.query( {
                text:`INSERT INTO Matches (sport, teamHome, teamAway, datetime) VALUES($1, $2, $3, $4) RETURNING match_id`,
                values: [sport, teamHome, teamAway, datetime],
        });
        match_id = ret.rows[0].match_id;
        if(match_id){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully inserted into Mathces: \n\t entry: (${sport}, ${teamHome}, ${teamAway}, ${datetime})\n\t match_id: ${match_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${sport}, ${teamHome}, ${teamAway}, ${datetime})\n\t Incorrect match_id: ${match_id}\n`);
        }
        
    } catch(e){
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${sport}, ${teamHome}, ${teamAway}, ${datetime})\n\t error: ${e.message}\n`)
    } finally{
        if(client) client.release()
        return match_id;
    }
}