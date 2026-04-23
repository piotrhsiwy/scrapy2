import { pool } from "./db.js";

//##############################
//###### CALC TABLES
//##############################
/** 
 * DOES NOT UPDATE anything if an entry with the same ARRAY of odd_ids in the link table AND the same value exists
 * INSERTS value and timestamp if an entry with the same ARRAY of odd_ids in the link table exists    AND different value exists
 * INSERTS value and timestamp if an entry with the same ARRAY of odd_ids in the link table does NOT exist
 * @param {WritableStream} log 
 * @param {Array{Integer}} oddsArray e.g. 1 - Arrays of odd_ids of the corresponding odd entries. The length of this array can be {2, 4}. All of those odd_ids are inserted into arbs_odds_link table along with the arb_id.
 * @param {Float} value e.g. 0.02
 * @returns {arb_id, is_new} 
 *  the arb_id of the inserted arb entry. undefined when an errors on insert occurs
 *  is_new is true if an entry with the same ARRAY of odd_ids in the link table did NOT exists
 */
export async function insertArb(log, oddsArray, value){
    const date = new Date();
    let client;
    let arb_id, is_new;
    let ret;
    try{
        if(oddsArray.length == 2){
            
            client = await pool.connect();
            await client.query(`BEGIN`);
            await client.query({
                text:`
                SELECT pg_advisory_xact_lock(
                    hashtext($1), 
                    hashtext($2)
                )`,
                values: [oddsArray[0], oddsArray[1]],
            })
            ret = await client.query( {
                    text:`
                    WITH existing AS (
                        SELECT a.arb_id
                        FROM arbs a
                        WHERE
                            EXISTS (SELECT 1 FROM arbs_odds_link al WHERE al.arb_id = a.arb_id AND al.odd_id = $1) AND
                            EXISTS (SELECT 1 FROM arbs_odds_link al WHERE al.arb_id = a.arb_id AND al.odd_id = $2) AND
                            a.value = $3
                        ORDER BY a.timestamp DESC
                        LIMIT 1
                    ),
                    inserted AS (
                        INSERT INTO arbs (value) 
                        SELECT $3
                        WHERE NOT EXISTS (SELECT 1 FROM existing)
                        RETURNING arb_id
                    )
                    SELECT arb_id, true AS is_new FROM inserted
                    UNION ALL
                    SELECT arb_id, false AS is_new FROM existing
                    `,
                    values: [oddsArray[0], oddsArray[1], value],
            });
            await client.query(`COMMIT`); // this releases the lock automatically 
            arb_id = ret.rows[0].arb_id;
            is_new = ret.rows[0].is_new;
            if(arb_id){
                log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully ${is_new?'INSERTED':'UPDATED'} into arbs: \n\t entry: (${value})\n\t arb_id: ${arb_id}\n`)
            } else {
                log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${value})\n\t Incorrect arb_id: ${arb_id}\n`);
                return;
            }

        } else if(oddsArray.length == 4){

            client = await pool.connect();
            await client.query(`BEGIN`);
            await client.query({
                text:`
                SELECT pg_advisory_xact_lock(
                    hashtext($1 || '-' || $2),
                    hashtext($3 || '-' || $4)
                )`,
                values: [oddsArray[0], oddsArray[1], oddsArray[2], oddsArray[3]],
            })
            ret = await client.query( {
                    text:`
                    WITH existing AS (
                        SELECT a.arb_id
                        FROM arbs a
                        WHERE
                            EXISTS (SELECT 1 FROM arbs_odds_link al WHERE al.arb_id = a.arb_id AND al.odd_id = $1) AND
                            EXISTS (SELECT 1 FROM arbs_odds_link al WHERE al.arb_id = a.arb_id AND al.odd_id = $2) AND
                            EXISTS (SELECT 1 FROM arbs_odds_link al WHERE al.arb_id = a.arb_id AND al.odd_id = $3) AND
                            EXISTS (SELECT 1 FROM arbs_odds_link al WHERE al.arb_id = a.arb_id AND al.odd_id = $4) AND
                            a.value = $5
                        ORDER BY a.timestamp DESC
                        LIMIT 1
                    ),
                    inserted AS (
                        INSERT INTO arbs (value) 
                        SELECT $5
                        WHERE NOT EXISTS (SELECT 1 FROM existing)
                        RETURNING arb_id
                    )
                    SELECT arb_id, true AS is_new FROM inserted
                    UNION ALL
                    SELECT arb_id, false AS is_new FROM existing
                    `,
                    values: [oddsArray[0], oddsArray[1], oddsArray[2], oddsArray[3], value],
            });
            await client.query(`COMMIT`); // this releases the lock automatically 
            arb_id = ret.rows[0].arb_id;
            is_new = ret.rows[0].is_new;
            if(arb_id){
                log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully ${is_new?'INSERTED':'UPDATED'} into arbs: \n\t entry: (${value})\n\t arb_id: ${arb_id}\n`)
            } else {
                log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${value})\n\t Incorrect arb_id: ${arb_id}\n`);
                return;
            }

        } else{
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${oddsArray}, ${value})\n\toddsArray has incorrect length: ${oddsArray.length}\n`);
            return;
        }

        if(is_new){
            let odd_id;
            try{
                for(let i = 0; i < oddsArray.length; i++){
                    odd_id = oddsArray[i];
                    ret = await client.query( {
                            text:`
                            INSERT INTO arbs_odds_link (arb_id, odd_id) 
                            VALUES($1, $2)
                            RETURNING arb_id, odd_id
                            `,
                            values: [arb_id, odd_id],
                    });
                    if(arb_id === ret.rows[0].arb_id && odd_id === ret.rows[0].odd_id){
                        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully INSERTED into arbs_odds_link: \n\t entry: (${arb_id}, ${odd_id})\n`)
                    } else{
                        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${arb_id}, ${odd_id})\n\tThe fields do not match the existing entry\n`);
                    }
                }
            } catch(e){
                // this should be unreachable if the odd is only inserted once (the advisory lock works on the previous query)
                if(e.code === '23505'){
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Trying to insert a arbs_odd_link even though the odd is not new: \n\t entry: (${arb_id}, ${odd_id})\n`)
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${arb_id}, ${odd_id})\n`);
                } else throw e;
            }
        }
            
    } catch(e){
        await client.query(`ROLLBACK`);
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${book}, ${value})\n\t error: ${e.message}\n`)
    } finally{
        if(client) client.release()
        return {arb_id, is_new};
    }
}

/** 
 * DOES NOT UPDATE anything if an entry with the same odd_id in the link table AND the same strength exists
 * INSERTS a new entry with a current timestamp and strength if an entry with the same odd_id in the link table AND different strength exists
 * INSERTS a new entry with a current timestamp and strength if an entry with the same odd_id in the link table does not exist
 * @param {WritableStream} log 
 * @param {Integer} odd_id e.g. 1 - id of the corresponding odd entry. This id is inserted into evs_odds_link table along with the ev_id.
 * @param {Float} strength e.g. -0.051234 is the strength of the EV bet, heuristic value that expresses how strong of an arb we would have, if we could arb against the average of the market.
 * @param {Float} probDeviationInTermsOfStdDev e.g. 1234.1234
 * @returns {ev_id, is_new} 
 *  the ev_id of the inserted ev entry. undefined when an errors on insert occurs
 *  is_new is true if an entry with the same odd_id in the link table did NOT exist
 */
export async function insertEv(log, odd_id, strength, probDeviationInTermsOfStdDev){
    const date = new Date();
    let client;
    let ev_id, is_new;
    let ret;
    try{
        client = await pool.connect();
        await client.query(`BEGIN`);
        await client.query({ // this locks hash(odd_id, strength, probDeviationInTermsOfStdDev)
            text:`
            SELECT pg_advisory_xact_lock(
                hashtext($1 || '-' || $2), 
                hashtext($3)
            )`,
            values: [odd_id, strength, probDeviationInTermsOfStdDev],
        })
        ret = await client.query( {
                text:`
                WITH existing AS (
                    SELECT e.ev_id
                    FROM evs e JOIN evs_odds_link el ON e.ev_id = el.ev_id
                    WHERE
                        el.odd_id = $1 AND
                        e.strength = $2 AND
                        e.probDeviationInTermsOfStdDev = $3
                    ORDER BY e.timestamp DESC
                    LIMIT 1
                ),
                inserted AS (
                    INSERT INTO evs (strength, probDeviationInTermsOfStdDev) 
                    SELECT $2, $3
                    WHERE NOT EXISTS (SELECT 1 FROM existing)
                    RETURNING ev_id
                )
                SELECT ev_id, true AS is_new FROM inserted
                UNION ALL
                SELECT ev_id, false AS is_new FROM existing
                `,
                values: [odd_id, strength, probDeviationInTermsOfStdDev],
        });
        await client.query(`COMMIT`); // this releases the lock automatically 
        ev_id = ret.rows[0].ev_id;
        is_new = ret.rows[0].is_new;
        if(ev_id){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully ${is_new?'INSERTED':'UPDATED'} into evs: \n\t entry: (${strength}, ${probDeviationInTermsOfStdDev})\n\t ev_id: ${ev_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${strength}, ${probDeviationInTermsOfStdDev})\n\t Incorrect ev_id: ${ev_id}\n`);
            return;
        }

        if(is_new){
            try{
                ret = await client.query( {
                        text:`
                        INSERT INTO evs_odds_link (ev_id, odd_id) 
                        VALUES($1, $2)
                        RETURNING ev_id, odd_id
                        `,
                        values: [ev_id, odd_id],
                });
                if(ev_id === ret.rows[0].ev_id && odd_id === ret.rows[0].odd_id){
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully INSERTED into evs_odds_link: \n\t entry: (${ev_id}, ${odd_id})\n`)
                } else{
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${ev_id}, ${odd_id})\n\tThe fields do not match the existing entry\n`);
                }
            } catch(e){
                // this should be unreachable if the odd is only inserted once (the advisory lock works on the previous query)
                if(e.code === '23505'){
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Trying to insert a evs_odds_link even though the odd is not new: \n\t entry: (${ev_id}, ${odd_id})\n`)
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${ev_id}, ${odd_id})\n`);
                } else throw e;
            }
        }
    
        
    } catch(e){
        await client.query(`ROLLBACK`);
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${odd_id}, ${strength}, ${probDeviationInTermsOfStdDev})\n\t error: ${e.message}\n`)
    } finally{
        if(client) client.release()
        return {ev_id, is_new};
    }
}

//##############################
//###### DATA TABLES
//##############################
/**
 * ALWAYS UPDATES timestamp and value if there exists an entry with the same (book, name)
 * @param {WritableStream} log 
 * @param {Integer} match_id e.g. 1 - id of the corresponding match. This is inserted into the matches_odds_link table along with odd_id.
 * @param {Integer} market_id e.g. 1 - id of the corresponding market. This is inserted into the markets_odds_link table along with odd_id.
 * @param {String} name e.g. 'vitality' - for Match Winner Market
 * @param {String} book e.g. 'Esportsbet'
 * @param {String} value  e.g. '1.88'
 * @returns {coef_id, is_new} 
 *  the odd_id of the inserted odd entry. undefined when an errors on insert occurs
 *  is_new is true if entry with the same book already existed
 */
export async function insertOdd(log, match_id, market_id, name, book, value){

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
                    SELECT odd_id 
                    FROM odds o WHERE 
                        EXISTS (SELECT 1 FROM matches_odds_link mtl WHERE o.odd_id = mtl.odd_id AND mtl.match_id = $1) AND
                        EXISTS (SELECT 1 FROM markets_odds_link mkl WHERE o.odd_id = mkl.odd_id AND mkl.market_id = $2) AND
                        o.name = $3 AND
                        o.book = $4
                    ORDER BY o.book ASC
                    LIMIT 1
                ),
                updated AS (
                    UPDATE odds
                    SET 
                        timestamp = CURRENT_TIMESTAMP,
                        value = $5
                    WHERE odd_id = (SELECT odd_id FROM existing)
                    RETURNING odd_id
                ),
                inserted AS (
                    INSERT INTO odds (name, book, value) 
                    SELECT $3, $4, $5
                    WHERE NOT EXISTS (SELECT 1 FROM existing)
                    RETURNING odd_id
                )
                SELECT odd_id, true AS is_new FROM inserted
                UNION ALL
                SELECT odd_id, false AS is_new FROM updated
                `,
                values: [match_id, market_id, name, book, value],
        });
        await client.query(`COMMIT`); // this releases the lock automatically 
        odd_id = ret.rows[0].odd_id;
        is_new = ret.rows[0].is_new;
        if(odd_id){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully ${is_new?'INSERTED':'UPDATED'} into odds: \n\t entry: (${match_id}, ${market_id}, ${name}, ${book}, ${value})\n\t odd_id: ${odd_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${match_id}, ${market_id}, ${name}, ${book}, ${value})\n\t Incorrect odd_id: ${odd_id}\n`);
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
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully INSERTED into markets_odds_link: \n\t entry: (${market_id}, ${odd_id})\n`)
                } else{
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${market_id}, ${odd_id})\n\tThe fields do not match the existing entry\n`);
                }

                ret = await client.query( {
                        text:`
                        INSERT INTO matches_odds_link (match_id, odd_id) 
                        VALUES($1, $2)
                        RETURNING match_id, odd_id
                        `,
                        values: [match_id, odd_id],
                });
                if(match_id === ret.rows[0].match_id && odd_id === ret.rows[0].odd_id){
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully INSERTED into matches_odds_link: \n\t entry: (${match_id}, ${odd_id})\n`)
                } else{
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${match_id}, ${odd_id})\n\tThe fields do not match the existing entry\n`);
                }
            } catch(e){
                // this should be unreachable if the odd is only inserted once (the advisory lock works on the previous query)
                if(e.code === '23505'){
                    log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Trying to insert a markets_odds_link or matches_odds_link even though the odd is not new: \n\t entry: (${market_id}, ${odd_id})\n`)
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
 * @param {String} name e.g. 'Match Winner'
 * @param {String} oddName  e.g. 'vitality'
 * @returns {market_id, is_new} 
 *  the market_id of the inserted Market entry. undefined when an errors on insert occurs
 *  is_new is true if an entry with the same (name, oddName) already exists
 */
export async function insertMarket(log, name){

    const date = new Date();
    let client;
    let market_id, is_new;
    let ret;
    try{
        client = await pool.connect();
        await client.query(`BEGIN`);
        await client.query({ // this locks hash(name)
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
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully ${is_new?'INSERTED':'UPDATED'} into Markets: \n\t entry: (${name})\n\t market_id: ${market_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${name})\n\t Incorrect market_id: ${market_id}\n`);
            return;
        }

    } catch(e){
        await client.query(`ROLLBACK`)
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${name})\n\t error: ${e.message}\n`)
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

//##############################
//###### HUNT TABLES
//##############################
/**
 *  DOES NOT UPDATE any fields, if an entry with the same url and datetime within the same day already exists
 * @param {WritableStream} log 
 * @param {String} book e.g. 'Esportsbet'
 * @param {String} url  e.g. 'https://esportsbet.io'
 * @param {String} datetime datetime of the match is in the ISO8601 format
 * @returns {toscrapeurl_id, is_new}
 *  the tposcrape_url of the inserted entry. undefined when an errors on insert occurs
 *  is_new is true if an entry with the same (url, datetime+-24h) already exists
 */
export async function insertToScrapeUrl(log, book, url, datetime){

    const date = new Date();
    let client;
    let toscrapeurl_id, is_new;
    try{
        client = await pool.connect();
        // we wrap this into a transaction with advisory lock, to avoid race condition:
        // when the match does not exist yet, so the first select returns nothing, so there 
        // is nothing marked with 'FOR UPDATE' and so more than one client can try and 
        // insert this match
        const ret = await client.query( {
                text:`
                WITH existing AS (
                    SELECT toscrapeurl_id FROM toscrapeurl 
                    WHERE 
                        url = $1 AND
                        datetime <= $3::timestamp + INTERVAL '24 hours' AND 
                        datetime >= $3::timestamp - INTERVAL '24 hours'
                    ORDER BY datetime ASC
                    LIMIT 1
                    FOR UPDATE
                ),
                inserted AS (
                    INSERT INTO toscrapeurl(book, url, datetime)
                    SELECT $1, $2, $3::timestamp
                    WHERE NOT EXISTS (SELECT 1 FROM existing)
                    RETURNING toscrapeurl_id
                )
                SELECT toscrapeurl_id, false AS is_new FROM existing
                UNION ALL
                SELECT toscrapeurl_id, true AS is_new FROM inserted
                `,
                values: [book, url, datetime],
        });
        toscrapeurl_id = ret.rows[0].toscrapeurl_id;
        is_new = ret.rows[0].is_new;
        if(toscrapeurl_id){
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Successfully ${is_new?'INSERTED':'UPDATED'} into toscrapeurls: \n\t entry: (${book}, ${url}, ${datetime})\n\t toscrapeurl_id: ${toscrapeurl_id}\n`)
        } else {
            log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Inserter error when inserting: \n\t entry: (${book}, ${url}, ${datetime})\n\t Incorrect toscrapeurl_id: ${toscrapeurl_id}\n`);
        }
        
    } catch(e){
        await client.query(`ROLLBACK`);
        log.write(`[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] Database error when inserting: \n\t entry: (${book}, ${url}, ${datetime})\n\t error: ${e.message}\n`)
    } finally{
        if(client) client.release()
        return { toscrapeurl_id, is_new };
    }
}