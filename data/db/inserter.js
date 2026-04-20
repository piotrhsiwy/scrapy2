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
 * ALWAYS UPDATES timestamp and value if there exists an entry with the same (book, name)
 * @param {WritableStream} log 
 * @param {Integer} market_id e.g. 1 - id of the corresponding match. This is inserted into the markets_odds_link table along with odd_id.
 * @param {String} name e.g. 'vitality' - for Match Winner Market
 * @param {String} book e.g. 'Esportsbet'
 * @param {String} value  e.g. '1.88'
 * @returns {coef_id, is_new} 
 *  the odd_id of the inserted odd entry. undefined when an errors on insert occurs
 *  is_new is true if entry with the same book already existed
 */
export async function insertOdd(log, market_id, name, book, value){

    const date = new Date();
    let client;
    let odd_id, is_new;
    let ret;
    try{
        client = await pool.connect();
        await client.query(`BEGIN`);
        await client.query({ // this locks hash(book, value)
            text:`
            SELECT pg_advisory_xact_lock(
                hashtext($1), 
                hashtext($2)
            )`,
            values: [book, name],
        })
        ret = await client.query( {
                text:`
                WITH existing AS (
                    SELECT odd_id FROM odds WHERE 
                        name = $1 AND
                        book = $2
                    ORDER BY book ASC
                    LIMIT 1
                ),
                updated AS (
                    UPDATE odds
                    SET 
                        timestamp = CURRENT_TIMESTAMP,
                        value = $3
                    WHERE odd_id = (SELECT odd_id FROM existing)
                    RETURNING odd_id
                ),
                inserted AS (
                    INSERT INTO odds (name, book, value) 
                    SELECT $1, $2, $3
                    WHERE NOT EXISTS (SELECT 1 FROM existing)
                    RETURNING odd_id
                )
                SELECT odd_id, true AS is_new FROM inserted
                UNION ALL
                SELECT odd_id, false AS is_new FROM updated
                `,
                values: [name, book, value],
        });
        await client.query(`COMMIT`); // this releases the lock automatically 
        odd_id = ret.rows[0].odd_id;
        is_new = ret.rows[0].is_new;
        if(odd_id){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully ${is_new?'INSERTED':'UPDATED'} into odds: \n\t entry: (${name}, ${book}, ${value})\n\t odd_id: ${odd_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${name}, ${book}, ${value})\n\t Incorrect odd_id: ${odd_id}\n`);
            return;
        }

        if(is_new){
            try{
                ret = await client.query( {
                        text:`
                        INSERT INTO markets_odds_link (market_id, odd_id) 
                        VALUES($1, $2)
                        RETURNING market_id, odd_id
                        `,
                        values: [market_id, odd_id],
                });
                if(market_id === ret.rows[0].market_id && odd_id === ret.rows[0].odd_id){
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully inserted into markets_odds_link: \n\t entry: (${market_id}, ${odd_id})\n`)
                } else{
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${market_id}, ${odd_id})\n\tThe fields do not match the existing entry\n`);
                }
            } catch(e){
                // this should be unreachable if the odd is only inserted once (the advisory lock works on the previous query)
                if(e.code === '23505' && e.constraint === 'market_odd_link_unique'){
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Trying to insert a market_odd_link even though the odd is not new: \n\t entry: (${market_id}, ${odd_id})\n`)
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${market_id}, ${odd_id})\n`);
                } else throw e;
            }
        }
    
        
    } catch(e){
        await client.query(`ROLLBACK`);
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${book}, ${value})\n\t error: ${e.message}\n`)
    } finally{
        if(client) client.release()
        return {odd_id, is_new};
    }
}

/**
 * does NOT UPDATE any fields if an entry with the same (name, oddName) already exists
 * @param {WritableStream} log 
 * @param {Integer} match_id e.g. 1 - id of the corresponding match. This is inserted into the matches_markets_link table along with market_id.
 * @param {String} name e.g. 'Match Winner'
 * @param {String} oddName  e.g. 'vitality'
 * @returns {market_id, is_new} 
 *  the market_id of the inserted Market entry. undefined when an errors on insert occurs
 *  is_new is true if an entry with the same (name, oddName) already exists
 */
export async function insertMarket(log, match_id, name, oddName){

    const date = new Date();
    let client;
    let market_id, is_new;
    let ret;
    try{
        client = await pool.connect();
        await client.query(`BEGIN`);
        await client.query({ // this locks hash(name, oddName)
            text:`
            SELECT pg_advisory_xact_lock(
                hashtext($1), 
                hashtext($1)
            )`,
            values: [name]
        });
        ret = await client.query( {
                text:`
                WITH existing AS (
                    SELECT market_id FROM Markets WHERE 
                        name = $1
                    ORDER BY name ASC
                    LIMIT 1
                ),
                inserted AS (
                    INSERT INTO Markets (name) 
                    SELECT $1
                    WHERE NOT EXISTS (SELECT 1 FROM existing)
                    RETURNING market_id
                )
                SELECT market_id, true AS is_new FROM inserted
                UNION ALL
                SELECT market_id, false AS is_new FROM existing
                `,
                values: [name],
        });
        await client.query(`COMMIT`); // this releases the lock automatically 
        market_id = ret.rows[0].market_id;
        is_new = ret.rows[0].is_new;
        if(market_id){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully ${is_new?'INSERTED':'UPDATED'} into Markets: \n\t entry: (${name}, ${oddName})\n\t market_id: ${market_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${name}, ${oddName})\n\t Incorrect market_id: ${market_id}\n`);
            return;
        }

        if(is_new){
            try{
                ret = await client.query( {
                        text:`
                        INSERT INTO matches_markets_link (match_id, market_id) 
                        VALUES($1, $2)
                        RETURNING match_id, market_id
                        `,
                        values: [match_id, market_id],
                });
                if(match_id === ret.rows[0].match_id && market_id === ret.rows[0].market_id){
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully inserted into matches_markets_link: \n\t entry: (${match_id}, ${market_id})\n`)
                } else {
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${match_id}, ${market_id}).\n\t The fields do not match the existing entry\n`);
                }
            } catch(e){
                // this should be unreachable if the market is only inserted once (the advisory lock works on the previous query)
                if(e.code === '23505' && e.constraint === 'match_market_link_unique'){
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Trying to insert a match_market_link even though the market is not new: \n\t entry: (${match_id}, ${market_id})\n`)
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${match_id}, ${market_id})\n`);
                } else throw e;
            }
        }
    
        
    } catch(e){
        await client.query(`ROLLBACK`)
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${name}, ${oddName})\n\t error: ${e.message}\n`)
    } finally{
        if(client) client.release()
        return { market_id, is_new };
    }
}

/**
 * does NOT UPDATE anyfields if entry with the same (book, url) arleady exists
 * @param {WritableStream} log 
 * @param {Integer} match_id e.g. 1 - id of the corresponding match. This is inserted into the matches_urls_link table along with url_id.
 * @param {String} book e.g. 'Esportsbet'
 * @param {String} url  e.g. 'https://esportsbet.io/esportsbull/OddsPage/39513322/47/CS2Betting-1W-TEAM-NUCLEAR-TIGERES'
 * @returns {url_id, is_new} 
 *  the url_id of the inserted Url entry. undefined when an errors on insert occurs
 *  is_new is true if an entry with the same (book, url) already exists
 */
export async function insertUrl(log, match_id ,book, url){

    const date = new Date();
    let client;
    let url_id, is_new;
    let ret;
    try{
        client = await pool.connect();
        await client.query(`BEGIN`);
        await client.query({ // this locks hash(book, url)
            text:`
            SELECT pg_advisory_xact_lock(
                hashtext($1), 
                hashtext($2)
            )`,
            values: [book, url]
        });
        ret = await client.query( {
                text:`
                WITH existing AS (
                    SELECT url_id FROM Urls WHERE 
                        book = $1 AND
                        url = $2
                    ORDER BY book ASC
                    LIMIT 1
                ),
                inserted AS (
                    INSERT INTO Urls (book, url) 
                    SELECT $1, $2
                    WHERE NOT EXISTS (SELECT 1 FROM existing)
                    RETURNING url_id
                )
                SELECT url_id, true AS is_new FROM inserted
                UNION ALL
                SELECT url_id, false AS is_new FROM existing
                `,
                values: [book, url],
        });
        await client.query(`COMMIT`); // this releases the lock automatically 
        url_id = ret.rows[0].url_id;
        is_new = ret.rows[0].is_new;
        if(url_id){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully ${is_new?'INSERTED':'UPDATED'} into Urls: \n\t entry: (${book}, ${url})\n\t url_id: ${url_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${book}, ${url})\n\t Incorrect url_id: ${url_id}\n`);
            return;
        }

        if(is_new){
            try{
                ret = await client.query( {
                        text:`
                        INSERT INTO matches_urls_link (match_id, url_id) 
                        VALUES($1, $2)
                        RETURNING match_id, url_id
                        `,
                        values: [match_id, url_id],
                });
                if(match_id === ret.rows[0].match_id && url_id === ret.rows[0].url_id){
                    if(ret)log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully INSERTED into matches_urls_link: \n\t entry: (${match_id}, ${url_id})\n`)
                } else {
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${match_id}, ${url_id}).\n\t The fields do not match the existing entry\n`);
                }
            } catch(e){
                // this should be unreachable if the url is only inserted once (the advisory lock works on the previous query)
                if(e.code === '23505' && e.constraint === 'match_url_link_unique'){
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Trying to insert a match_url_link even though the url is not new: \n\t entry: (${match_id}, ${url_id})\n`)
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${match_id}, ${url_id})\n`);
                } else throw e;
            }
        }
        
    } catch(e){
        await client.query(`ROLLBACK`)
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${book}, ${url})\n\t error: ${e.message}\n`)
    } finally{
        if(client) client.release();
        return { url_id, is_new };
    }
}

/**
 * does NOT UPDATE any fields, if with the same (sport, teamHome, teamAway, datetime+-3h) already exists
 *  this includes the datetime field, where datetime is not the same but inside the window
 * @param {WritableStream} log 
 * @param {String} sport e.g. 'Counter-Strike 2'
 * @param {String} teamHome  e.g. 'vitality'
 * @param {String} teamAway  e.g. 'g2'
 * @param {String} datetime is in the ISO8601 format
 * @returns {match_id, is_new}
 *  the match_id of the inserted Match. undefined when an errors on insert occurs
 *  is_new is true if a Match with the same (sport, teamHome, teamAway, datetime+-3h) already exists
 */
export async function insertMatch(log, sport, teamHome, teamAway, datetime){

    const date = new Date();
    let client;
    let match_id, is_new;
    try{
        client = await pool.connect();
        // we wrap this into a transaction with advisory lock, to avoid race condition:
        // when the match does not exist yet, so the first select returns nothing, so there 
        // is nothing marked with 'FOR UPDATE' and so more than one client can try and 
        // insert this match
        await client.query(`BEGIN`);
        await client.query({ // this locks hash(sport, teamHome, teamAway)
            text:`
            SELECT pg_advisory_xact_lock(
                hashtext($1), 
                hashtext($2 || '-' || $3)
            )`,
            values: [sport, teamHome, teamAway]
        });
        // // This snippet can be used to update existing entry
        // updated AS (
        //     UPDATE Matches
        //     SET datetime = Matches.datetime
        //     WHERE match_id = (SELECT match_id FROM existing)
        //     RETURNING match_id
        // ),
        const ret = await client.query( {
                text:`
                WITH existing AS (
                    SELECT match_id FROM Matches WHERE 
                        sport = $1 AND
                        teamHome = $2 AND 
                        teamAway = $3 AND 
                        datetime >= $4::timestamp - INTERVAL '3 hours' AND
                        datetime <= $4::timestamp + INTERVAL '3 hours'
                    ORDER BY datetime ASC
                    LIMIT 1
                    FOR UPDATE
                ),
                inserted AS (
                    INSERT INTO Matches (sport, teamHome, teamAway, datetime) 
                    SELECT $1, $2, $3, $4::timestamp
                    WHERE NOT EXISTS (SELECT 1 FROM existing)
                    RETURNING match_id
                )
                SELECT match_id, false AS is_new FROM existing
                UNION ALL
                SELECT match_id, true AS is_new FROM inserted
                `,
                values: [sport, teamHome, teamAway, datetime],
        });
        await client.query(`COMMIT`); // the lock is automatically released here
        match_id = ret.rows[0].match_id;
        is_new = ret.rows[0].is_new;
        if(match_id){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully ${is_new?'INSERTED':'UPDATED'} into Matches: \n\t entry: (${sport}, ${teamHome}, ${teamAway}, ${datetime})\n\t match_id: ${match_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${sport}, ${teamHome}, ${teamAway}, ${datetime})\n\t Incorrect match_id: ${match_id}\n`);
        }
        
    } catch(e){
        await client.query(`ROLLBACK`);
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${sport}, ${teamHome}, ${teamAway}, ${datetime})\n\t error: ${e.message}\n`)
    } finally{
        if(client) client.release()
        return { match_id, is_new };
    }
}