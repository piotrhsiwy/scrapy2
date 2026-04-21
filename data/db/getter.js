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
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows;
}

/**
 * the lenght of Array in @return is the number of unique OddNames present in this market.
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
                        COUNT(*) as count 
                    FROM odds o
                        JOIN markets_odds_link mko ON o.odd_id = mko.odd_id
                        JOIN matches_odds_link mto ON o.odd_id = mto.odd_id
                    WHERE
                        mko.market_id = (SELECT market_id FROM target) AND
                        mto.match_id = (SELECT match_id FROM target)
                    GROUP BY (o.name)
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

export async function getOddWithBrothers(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                WITH target AS (
                    SELECT mo.market_id, o.name
                    FROM odds o JOIN markets_odds_link mo ON o.odd_id = mo.odd_id
                    WHERE o.odd_id = $1
                    LIMIT 1
                ),
                brothers AS (
                    SELECT o.*
                    FROM odds o JOIN markets_odds_link mo ON o.odd_id = mo.odd_id
                    WHERE
                        mo.market_id = (SELECT market_id FROM target) AND
                        o.name = (SELECT name FROM target)
                )
                SELECT * FROM brothers
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows;
}

export async function getOddBrothers(odd_id){
    let client;
    let ret;
    try{
        client = await pool.connect();
        ret = await client.query({
            text:`
                WITH target AS (
                    SELECT mo.market_id, o.name
                    FROM odds o JOIN markets_odds_link mo ON o.odd_id = mo.odd_id
                    WHERE o.odd_id = $1
                    LIMIT 1
                ),
                brothers AS (
                    SELECT o.*
                    FROM odds o JOIN markets_odds_link mo ON o.odd_id = mo.odd_id
                    WHERE
                        mo.market_id = (SELECT market_id FROM target) AND
                        o.name = (SELECT name FROM target) AND
                        o.odd_id != $1
                )
                SELECT * FROM brothers
            `,
            values: [odd_id],
        }); 
    } catch(e){

    } finally{
        if(client) client.release();
    }
    return ret.rows;
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
                            REGEXP_REPLACE(
                                o.name,
                                '^(' || mt.teamhome || '|' || mt.teamaway || ')\s*',
                                ''
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
                            REGEXP_REPLACE(
                                o.name,
                                '^(' || target.teamhome || '|' || target.teamaway || ')\s*',
                                ''
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
    return ret.rows[0];
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
                    FROM odds o 
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
