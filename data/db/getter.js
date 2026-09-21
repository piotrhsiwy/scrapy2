import { pool } from "./db.js";

export async function getOdds(){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                SELECT *
                FROM odds o
                ORDER BY o.timestamp ASC
            `,
        }); 
    } finally{
        if(client) client.release();
    }
    return ret.rows;
}

export async function getOddsTimeframe({from, to}){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                SELECT o.*
                FROM odds o
                    JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                    JOIN matches mt ON mt.match_id = mto.match_id
                WHERE
                    mt.datetime >= $1::timestamp AND
                    mt.datetime <= $2::timestamp
                ORDER BY mt.datetime ASC
            `,
            values:[from, to]
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows;
}

export async function getEvsTimeframe({from, to}){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                SELECT DISTINCT ON (eo.odd_id) 
                    e.ev_id
                FROM evs e
                    JOIN evs_odds_link eo ON eo.ev_id = e.ev_id
                    JOIN matches_odds_link mto ON mto.odd_id = eo.odd_id
                    JOIN matches mt ON mt.match_id = mto.match_id
                WHERE
                    mt.datetime >= $1::timestamp AND
                    mt.datetime <= $2::timestamp
                ORDER BY
                    eo.odd_id,
                    e.timestamp DESC;
            `,
            values:[from, to]
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows;
}

/**
 * the length of Array in @return is the number of odds present in this market.
 * the return Array from this function is the to be UNIQUE-D with respect to oddName, to get the actual market type:
 * like in the example below.
 * 
 * Example: if the length is 2, this is a binary Market, like 'Match Winner', if it's 4, it could be 'Correct Score' 
 * market on a BO3 game.
 */
export async function getMarketType(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                WITH target AS (
                    SELECT mko.market_id, mto.match_id, o.name
                    FROM odds o 
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                    WHERE o.odd_id = $1
                    LIMIT 1
                ),
                markettype AS(
                    SELECT 
                        o.name,
                        o.odd_id
                    FROM odds o
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                    WHERE
                        mko.market_id = (SELECT market_id FROM target) AND
                        mto.match_id = (SELECT match_id FROM target)
                )
                SELECT * FROM markettype
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows;
}

export async function getOddnamesForMatchMarket(match_id, market_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                SELECT o.name
                FROM
                    odds o,
                    markets_odds_link mkol,
                    matches_odds_link mtol
                WHERE
                    mtol.match_id = $1 AND
                    mkol.market_id = $2
            `,
            values: [match_id, market_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }

    if(ret){
        return ret.rows;
    } else{
        return ret;
    }
}

export async function getOddWithBrothers(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            // the order of the columns in the DISTINCT ON has to match the order used in the index idx_name_book_timestamp perfectly
            text:`
                WITH target AS (
                    SELECT 
                        mko.market_id,
                        mto.match_id,
                        o.name
                    FROM odds o 
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                    WHERE o.odd_id = $1
                    LIMIT 1
                ),
                distinct_books AS (
                    SELECT DISTINCT o.book
                    FROM odds o
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                        JOIN target t ON mto.match_id = t.match_id 
                                    AND mko.market_id = t.market_id 
                                    AND o.name = t.name
                )
                SELECT latest_odd.*
                FROM target t
                CROSS JOIN distinct_books db
                CROSS JOIN LATERAL (
                    -- For each book, instantly fetch the youngest odd using the index
                    SELECT o.*
                    FROM odds o
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                    WHERE o.name = t.name
                    AND o.book = db.book
                    AND mko.market_id = t.market_id
                    AND mto.match_id = t.match_id
                    ORDER BY 
                        o.name, 
                        o.book, 
                        o.timestamp DESC
                    LIMIT 1
                ) latest_odd;
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }

    if(ret){
        return ret.rows;
    } else{
        return ret;
    }
}

/**
 * 
 * Care that it @returns any odd that belongs to the opposite. It does not guarantee the same book as odd_id
 */
export async function getOpposite2(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                WITH target AS (
                    SELECT mko.market_id, mto.match_id, o.name
                    FROM odds o
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                    WHERE o.odd_id = $1
                    LIMIT 1
                ),
                opposite AS (
                    SELECT o.*
                    FROM odds o 
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                    WHERE
                        mko.market_id = (SELECT market_id FROM target) AND
                        mto.match_id = (SELECT match_id FROM target) AND
                        o.name != (SELECT name FROM target)
                    LIMIT 1
                )
                SELECT * FROM opposite
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows[0];
}

/**
 * 
 * Care that it @returns any odd that belongs to the opposite. It does not guarantee the same book as odd_id
 */
export async function getOppositeOU(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                WITH target AS (
                    SELECT
                        mko.market_id,
                        o.name AS oddname,
                        mt.teamhome,
                        mt.teamaway,
                        mt.match_id,
                        CASE
                            WHEN o.name LIKE 'over' || '%' THEN 'under'
                            ELSE 'over'
                        END AS expected_opposite_team,
                        CAST(
                            SUBSTRING(
                                REGEXP_REPLACE(
                                    o.name,
                                    '^(over|under)',
                                    '',
                                    'i'
                                ) 
                                FROM '^[0-9]*[.]?[0-9]+$'
                            ) AS NUMERIC
                        ) AS ou
                    FROM odds o 
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                        JOIN matches mt ON mto.match_id = mt.match_id
                    WHERE
                        o.odd_id = $1
                    LIMIT 1
                ),
                opposite AS (
                    SELECT o.*
                    FROM odds o 
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                        CROSS JOIN target
                    WHERE
                        mko.market_id = target.market_id AND
                        mto.match_id = target.match_id AND
                        o.name LIKE target.expected_opposite_team || '%' AND
                        CAST(
                            SUBSTRING(
                                REGEXP_REPLACE(
                                    o.name,
                                    '^(over|under)',
                                    '',
                                    'i'
                                ) 
                                FROM '^[0-9]*[.]?[0-9]+$'
                            ) AS NUMERIC
                        ) = target.ou
                    LIMIT 1
                )
                SELECT * FROM opposite
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }

    if(ret){
        return ret.rows[0];
    } else{
        return ret;
    }
}

/**
 * 
 * Care that it @returns any odd that belongs to the opposite. It does not guarantee the same book as odd_id
 */
export async function getOppositeFTR(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                WITH target AS (
                    SELECT
                        mko.market_id,
                        o.name AS oddname,
                        mt.teamhome,
                        mt.teamaway,
                        mt.match_id,
                        CASE
                            WHEN o.name LIKE mt.teamhome || '%' THEN mt.teamaway
                            ELSE mt.teamhome
                        END AS expected_opposite_team,
                        CAST(
                            SUBSTRING(
                                REGEXP_REPLACE(
                                    o.name,
                                    '^(' || mt.teamhome || '|' || mt.teamaway || ')',
                                    '',
                                    'i'
                                ) 
                                FROM '^[0-9]+$'
                            ) AS NUMERIC
                        ) AS ftr
                    FROM odds o 
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                        JOIN matches mt ON mto.match_id = mt.match_id
                    WHERE
                        o.odd_id = $1
                    LIMIT 1
                ),
                opposite AS (
                    SELECT o.*
                    FROM odds o 
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                        CROSS JOIN target
                    WHERE
                        mko.market_id = target.market_id AND
                        mto.match_id = target.match_id AND
                        o.name LIKE target.expected_opposite_team || '%' AND
                        CAST(
                            SUBSTRING(
                                REGEXP_REPLACE(
                                    o.name,
                                    '^(' || target.teamhome || '|' || target.teamaway || ')',
                                    '',
                                    'i'
                                ) 
                                FROM '^[0-9]+$'
                            ) AS NUMERIC
                        ) = target.ftr
                    LIMIT 1
                )
                SELECT * FROM opposite
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }

    if(ret){
        return ret.rows[0];
    } else{
        return ret;
    }
}

/**
 * 
 * Care that it @returns any odd that belongs to the opposite. It does not guarantee the same book as odd_id
 */
export async function getOppositeHdp(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                WITH target AS (
                    SELECT
                        mko.market_id,
                        o.name AS oddname,
                        mt.teamhome,
                        mt.teamaway,
                        mt.match_id,
                        CASE
                            WHEN o.name LIKE mt.teamhome || '%' THEN mt.teamaway
                            ELSE mt.teamhome
                        END AS expected_opposite_team,
                        CAST(
                            SUBSTRING(
                                REGEXP_REPLACE(
                                    o.name,
                                    '^(' || mt.teamhome || '|' || mt.teamaway || ')',
                                    '',
                                    'i'
                                ) 
                                FROM '^[-+]?[0-9]*[.]?[0-9]+$'
                            ) AS NUMERIC
                        ) AS hdp
                    FROM odds o 
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                        JOIN matches mt ON mto.match_id = mt.match_id
                    WHERE
                        o.odd_id = $1
                    LIMIT 1
                ),
                opposite AS (
                    SELECT o.*
                    FROM odds o 
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                        CROSS JOIN target
                    WHERE
                        mko.market_id = target.market_id AND
                        mto.match_id = target.match_id AND
                        o.name LIKE target.expected_opposite_team || '%' AND
                        CAST( 
                            SUBSTRING(
                                REGEXP_REPLACE(
                                    o.name,
                                    '^(' || target.teamhome || '|' || target.teamaway || ')',
                                    '',
                                    'i'
                                )
                                FROM '^[-+]?[0-9]*[.]?[0-9]+$'
                            ) AS NUMERIC
                        ) = target.hdp * -1
                    LIMIT 1
                )
                SELECT * FROM opposite
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }

    if(ret){
        return ret.rows[0];
    } else{
        return ret;
    }
}

/**
 * 
 * Care that it @returns any odds that belongs to the opposite (matching) odds. It does not guarantee the same book as odd_id
 */
export async function getMatching4CS(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                WITH target AS (
                    SELECT mko.market_id, mto.match_id
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                    WHERE o.odd_id = $1
                    LIMIT 1
                ),
                matching AS (
                    SELECT
                        MIN(o.odd_id) AS odd_id
                    FROM odds o 
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                    WHERE
                        mko.market_id = (SELECT market_id FROM target) AND
                        mto.match_id = (SELECT match_id FROM target)
                    GROUP BY o.name
                    LIMIT 4
                ),
                opposite AS (
                    SELECT o.*
                    FROM odds o
                        JOIN matching m ON m.odd_id = o.odd_id 
                    LIMIT 4
                )
                SELECT * FROM opposite
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows;
}

export async function getMarketName(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                SELECT m.name AS marketname
                FROM markets_odds_link mo
                    JOIN markets m ON m.market_id = mo.market_id
                WHERE
                    mo.odd_id = $1
                ORDER BY m.name ASC
                LIMIT 1
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows[0].marketname;
}

export async function getNumberBooks(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                SELECT u.book
                FROM odds o
                    JOIN matches_odds_link mo ON o.odd_id = mo.odd_id
                    JOIN matches_urls_link mu ON mu.match_id = mo.match_id
                    JOIN urls u ON mu.url_id = u.url_id
                WHERE
                    o.odd_id = $1
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rowCount;
}

export async function getOdd(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                SELECT 
                    *,
                    mk.name as marketname,
                    o.name as oddname
                FROM matches mt 
                    JOIN matches_urls_link mtul ON mt.match_id = mtul.match_id
                    JOIN urls u                 ON mtul.url_id = u.url_id
                    JOIN matches_odds_link mtol ON mt.match_id = mtol.match_id
                    JOIN odds o                 ON mtol.odd_id = o.odd_id
                    JOIN markets_odds_link mkol ON mkol.odd_id = o.odd_id
                    JOIN markets mk             ON mkol.market_id = mk.market_id
                WHERE
                    u.book = o.book AND
                    o.odd_id = $1
                ORDER BY o.timestamp ASC
                LIMIT 1 
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows[0];
}

export async function getMarketId(marketName){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                SELECT market_id
                FROM markets
                WHERE name = $1
                LIMIT 1 
            `,
            values: [marketName],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows[0].market_id;
}

export async function getTeamnames(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                SELECT 
                    mt.teamhome,
                    mt.teamaway
                FROM odds o
                    JOIN matches_odds_link mtol ON o.odd_id = mtol.odd_id
                    JOIN matches mt ON mtol.match_id = mt.match_id
                WHERE
                    o.odd_id = $1
                LIMIT 1 
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows[0];
}

/**
 * 
 * @param {from:ISOString, to:ISOString} timeframe f.e. {from:2026-04-22 10:00:00.000, to:2026-12-24 20:00:00.000}
 * @param {String} book f.e. 'Esportsbet'
 */
export async function getToScrapeUrls(timeframe, book){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                SELECT t.url
                FROM toscrapeurl t
                WHERE
                    t.book = $3 AND
                    t.datetime >= $1::timestamp AND
                    t.datetime <= $2::timestamp
                ORDER BY t.datetime ASC
            `,
            values: [timeframe.from, timeframe.to, book],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows;
}