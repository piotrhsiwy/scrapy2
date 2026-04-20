import { insertEv, insertMarket, insertMatch, insertOdd, insertUrl } from "./inserter.js";
import { createWriteStream } from 'fs';
import { initDb, pool } from "./db.js";

async function testDbInserting(){

    let log;
    const logFilePath = './data/log.txt';
    try{
        log = createWriteStream(logFilePath, {flags: 'a'});
    } catch(error){
        console.error(`Failure! Cannot open file under ${logFilePath}`);
    }
    
    let data = []

    // Match
    const sportName = 'Counter-Strike 2';
    const teamHome = 'vitality';
    const teamAway = 'g2';
    // TODO what if the datetime is 'live'? disallow it on the scraper level
    const datetime = 'October 6, 2025 at 07:00:00 PM GMT+2';
    const datetime3h = 'October 6, 2025 at 10:00:00 PM GMT+2';
    const datetime4h = 'October 6, 2025 at 11:00:00 PM GMT+2';

    // Url + match_id
    const book = 'Esportsbet';
    const url = 'https://esportsbet.io/esportsbull/OddsPage/39513322/47/CS2Betting-1W-TEAM-NUCLEAR-TIGERES';

    // Market + match_id
    const marketName = 'Match Winner';

    // Odd + market_id
    // book is reused
    const oddNameHome = 'vitality';
    const valueHome = 1.88;
    const oddNameAway = 'g2';
    const valueAway = 1.92;

    // Ev
    const 

    try{
        let is, should;

        // INSERT insert a new Match
        is = await insertMatch(log, sportName, teamHome, teamAway, datetime);
        should = {match_id:1, is_new:true};
        if(is.match_id !== should.match_id || is.is_new !== should.is_new){
            console.log(`insertMatch(${sportName}, ${teamHome}, ${teamAway}, ${datetime}) returned 
                \tis:{ match_id:${is.match_id}, is_new:${is.is_new} }
                \tshould:{ match_id:${should.match_id}, is_new:${should.match_id} }
            `)
            return -1;
        }
        const match_id = is.match_id;

        // UPDATE insert the same Match again
        is = await insertMatch(log, sportName, teamHome, teamAway, datetime);
        should = {match_id:1, is_new:false};
        if(is.match_id !== should.match_id || is.is_new !== should.is_new){
            console.log(`insertMatch(${sportName}, ${teamHome}, ${teamAway}, ${datetime}) returned 
                \tis:{ match_id:${is.match_id}, is_new:${is.is_new} }
                \tshould:{ match_id:${should.match_id}, is_new:${should.match_id} }
            `)
            return -1;
        }

        // UPDATE insert the same Match again with datetime 3h apart
        is = await insertMatch(log, sportName, teamHome, teamAway, datetime3h);
        should = {match_id:1, is_new:false};
        if(is.match_id !== should.match_id || is.is_new !== should.is_new){
            console.log(`insertMatch(${sportName}, ${teamHome}, ${teamAway}, ${datetime3h}) returned 
                \tis:{ match_id:${is.match_id}, is_new:${is.is_new} }
                \tshould:{ match_id:${should.match_id}, is_new:${should.match_id} }
            `)
            return -1;
        }

        // INSERT insert the same Match again with datetime 4h apart (this should be classified as a separate Match entry)
        is = await insertMatch(log, sportName, teamHome, teamAway, datetime4h);
        should = {match_id:2, is_new:true};
        if(is.match_id !== should.match_id || is.is_new !== should.is_new){
            console.log(`insertMatch(${sportName}, ${teamHome}, ${teamAway}, ${datetime4h}) returned 
                \tis:{ match_id:${is.match_id}, is_new:${is.is_new} }
                \tshould:{ match_id:${should.match_id}, is_new:${should.match_id} }
            `)
            return -1;
        }

        // insert Url
        is = await insertUrl(log, match_id, book, url);
        should = {url_id:1, is_new:true};
        if(is.url_id !== should.url_id || is.is_new !== should.is_new){
            console.log(`insertUrl(${match_id}, ${book}, ${url}) returned 
                \tis:{ url_id:${is.url_id}, is_new:${is.is_new} }
                \tshould:{ url_id:${should.url_id}, is_new:${should.url_id} }
            `)
            return -1;
        }
        const url_id = is.url_id;

        // insert the same Url again
        is = await insertUrl(log, match_id, book, url);
        should = {url_id:1, is_new:false};
        if(is.url_id !== should.url_id || is.is_new !== should.is_new){
            console.log(`insertUrl(${match_id}, ${book}, ${url}) returned 
                \tis:{ url_id:${is.url_id}, is_new:${is.is_new} }
                \tshould:{ url_id:${should.url_id}, is_new:${should.url_id} }
            `)
            return -1;
        }

        // insert Market
        is = await insertMarket(log, match_id, marketName);
        should = {market_id:1, is_new:true};
        if(is.market_id !== should.market_id || is.is_new !== should.is_new){
            console.log(`insertMarket(${match_id}, ${marketName})returned 
                \tis:{ market_id:${is.market_id}, is_new:${is.is_new} }
                \tshould:{ market_id:${should.market_id}, is_new:${should.market_id} }
            `)
            return -1;
        }
        const market_id = is.market_id;

        // insert the same Market again
        is = await insertMarket(log, match_id, marketName);
        should = {market_id:1, is_new:false};
        if(is.market_id !== should.market_id || is.is_new !== should.is_new){
            console.log(`insertMarket(${match_id}, ${marketName}) returned 
                \tis:{ market_id:${is.market_id}, is_new:${is.is_new} }
                \tshould:{ market_id:${should.market_id}, is_new:${should.market_id} }
            `)
            return -1;
        }

        // insert CoefHome
        is = await insertOdd(log, market_id, oddNameHome, book, valueHome);
        should = {odd_id:1, is_new:true};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertMarket(${market_id}, ${oddNameHome}, ${book}, ${valueHome}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.odd_id} }
            `)
            return -1;
        }
        const odd_idHome = is.odd_id;

        // insert CoefHome again
        // TODO here I check the value if it stayed the same - this is the difference between this and the next textcase
        is = await insertOdd(log, market_id, oddNameHome, book, valueHome);
        should = {odd_id:1, is_new:false};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertMarket(${market_id}, ${oddNameHome}, ${book}, ${valueHome}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.odd_id} }
            `)
            return -1;
        }
        
        // insert CoefHome with value + 0.1
        is = await insertOdd(log, market_id, oddNameHome, book, valueHome + 0.1);
        should = {odd_id:1, is_new:false};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertMarket(${market_id}, ${oddNameHome}, ${book}, ${valueHome + 0.1}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.odd_id} }
            `)
            return -1;
        }

        // insert CoefAway
        is = await insertOdd(log, market_id, oddNameAway, book, valueAway);
        should = {odd_id:2, is_new:true};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertMarket(${market_id}, ${oddNameAway}, ${book}, ${valueAway}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.odd_id} }
            `)
            return -1;
        }
        const odd_idAway = is.odd_id;

        // insert Ev
        is = await insertEv(log, )

    } catch{
        console.log('Inserting test failed')
        return -1;
    }

    await pool.end();
    console.log('Inserting test passed')
}

await initDb();
await testDbInserting();