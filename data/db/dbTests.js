import { insertArb, insertEv, insertMarket, insertMatch, insertOdd, insertUrl } from "./inserter.js";
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
    const strength = -0.051234

    // Arb
    const valueArb = 0.021234
        // Correct Score sample market to test arb4 entry
        const CSmarketName = 'Correct Score';
        const CSodds = [
            {
                name: '2:0',
                book: 'Thunderpick',
                value: 4.0
            },
            {
                name: '2:1',
                book: 'GGBet',
                value: 4.1
            },
            {
                name: '1:2',
                book: 'Esportsbet',
                value: 4.2
            },
            {
                name: '0:2',
                book: 'Betninja',
                value: 4.3
            },
        ]

    try{
        let is, should;

        // INSERT insert a new Match
        is = await insertMatch(log, sportName, teamHome, teamAway, datetime);
        should = {match_id:1, is_new:true};
        if(is.match_id !== should.match_id || is.is_new !== should.is_new){
            console.log(`insertMatch(${sportName}, ${teamHome}, ${teamAway}, ${datetime}) returned 
                \tis:{ match_id:${is.match_id}, is_new:${is.is_new} }
                \tshould:{ match_id:${should.match_id}, is_new:${should.is_new} }
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
                \tshould:{ match_id:${should.match_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // UPDATE insert the same Match again with datetime 3h apart
        is = await insertMatch(log, sportName, teamHome, teamAway, datetime3h);
        should = {match_id:1, is_new:false};
        if(is.match_id !== should.match_id || is.is_new !== should.is_new){
            console.log(`insertMatch(${sportName}, ${teamHome}, ${teamAway}, ${datetime3h}) returned 
                \tis:{ match_id:${is.match_id}, is_new:${is.is_new} }
                \tshould:{ match_id:${should.match_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // INSERT insert the same Match again with datetime 4h apart (this should be classified as a separate Match entry)
        is = await insertMatch(log, sportName, teamHome, teamAway, datetime4h);
        should = {match_id:2, is_new:true};
        if(is.match_id !== should.match_id || is.is_new !== should.is_new){
            console.log(`insertMatch(${sportName}, ${teamHome}, ${teamAway}, ${datetime4h}) returned 
                \tis:{ match_id:${is.match_id}, is_new:${is.is_new} }
                \tshould:{ match_id:${should.match_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Url
        is = await insertUrl(log, match_id, book, url);
        should = {url_id:1, is_new:true};
        if(is.url_id !== should.url_id || is.is_new !== should.is_new){
            console.log(`insertUrl(${match_id}, ${book}, ${url}) returned 
                \tis:{ url_id:${is.url_id}, is_new:${is.is_new} }
                \tshould:{ url_id:${should.url_id}, is_new:${should.is_new} }
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
                \tshould:{ url_id:${should.url_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Market
        is = await insertMarket(log, match_id, marketName);
        should = {market_id:1, is_new:true};
        if(is.market_id !== should.market_id || is.is_new !== should.is_new){
            console.log(`insertMarket(${match_id}, ${marketName})returned 
                \tis:{ market_id:${is.market_id}, is_new:${is.is_new} }
                \tshould:{ market_id:${should.market_id}, is_new:${should.is_new} }
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
                \tshould:{ market_id:${should.market_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert CoefHome
        is = await insertOdd(log, market_id, oddNameHome, book, valueHome);
        should = {odd_id:1, is_new:true};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertOdd(${market_id}, ${oddNameHome}, ${book}, ${valueHome}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.is_new} }
            `)
            return -1;
        }
        const odd_idHome = is.odd_id;

        // insert CoefHome again
        // TODO here I check the value if it stayed the same - this is the difference between this and the next textcase
        is = await insertOdd(log, market_id, oddNameHome, book, valueHome);
        should = {odd_id:1, is_new:false};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertOdd(${market_id}, ${oddNameHome}, ${book}, ${valueHome}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.is_new} }
            `)
            return -1;
        }
        
        // insert CoefHome with value + 0.1
        is = await insertOdd(log, market_id, oddNameHome, book, valueHome + 0.1);
        should = {odd_id:1, is_new:false};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertOdd(${market_id}, ${oddNameHome}, ${book}, ${valueHome + 0.1}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert CoefAway
        is = await insertOdd(log, market_id, oddNameAway, book, valueAway);
        should = {odd_id:2, is_new:true};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertOdd(${market_id}, ${oddNameAway}, ${book}, ${valueAway}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.is_new} }
            `)
            return -1;
        }
        const odd_idAway = is.odd_id;

        // insert CoefAway with invalid value - the error message in log
        is = await insertOdd(log, market_id, oddNameAway, book, -1.0);
        should = {odd_id:undefined, is_new:undefined};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertOdd(${market_id}, ${oddNameAway}, ${book}, ${-1.0}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////
        // insert Ev
        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////

        is = await insertEv(log, odd_idHome, strength);
        should = {ev_id:1, is_new:true};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idHome}, ${strength}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert the same Ev again
        is = await insertEv(log, odd_idHome, strength);
        should = {ev_id:1, is_new:false};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idHome}, ${strength}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert the same Ev again with strength -0.01
        // this should INSERT a new entry with a new timestamp and new ev_id, because the strength changed
        // TODO with this setup it's impossible to distinguish on the app level between a new ev and a ev with an updated strength!
        is = await insertEv(log, odd_idHome, strength - 0.01);
        should = {ev_id:2, is_new:true};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idHome}, ${strength - 0.01}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Away Ev
        is = await insertEv(log, odd_idAway, strength);
        should = {ev_id:3, is_new:true};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idAway}, ${strength}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Away Ev again
        is = await insertEv(log, odd_idAway, strength);
        should = {ev_id:3, is_new:false};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idAway}, ${strength}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Away Ev again with strength +0.01
        is = await insertEv(log, odd_idAway, strength + 0.01);
        should = {ev_id:4, is_new:true};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idAway}, ${strength + 0.01}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Away Ev again with invalid strength - error message in log
        is = await insertEv(log, odd_idAway, 0.01);
        should = {ev_id:undefined, is_new:undefined};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idAway}, ${0.01}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////
        // insert Arb
        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////

        // insert Arb2
        is = await insertArb(log, [odd_idHome, odd_idAway], valueArb);
        should = {arb_id:1, is_new:true};
        if(is.arb_id !== should.arb_id || is.is_new !== should.is_new){
            console.log(`insertArb([${odd_idHome}, ${odd_idAway}], ${valueArb}) returned 
                \tis:{ arb_id:${is.arb_id}, is_new:${is.is_new} }
                \tshould:{ arb_id:${should.arb_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Arb2 again
        is = await insertArb(log, [odd_idHome, odd_idAway], valueArb);
        should = {arb_id:1, is_new:false};
        if(is.arb_id !== should.arb_id || is.is_new !== should.is_new){
            console.log(`insertArb([${odd_idHome}, ${odd_idAway}], ${valueArb}) returned 
                \tis:{ arb_id:${is.arb_id}, is_new:${is.is_new} }
                \tshould:{ arb_id:${should.arb_id}, is_new:${should.is_new} }
            `)
            return -1;
        }
        
        // insert Arb2 again with value + 0.01
        is = await insertArb(log, [odd_idHome, odd_idAway], valueArb + 0.01);
        should = {arb_id:2, is_new:true};
        if(is.arb_id !== should.arb_id || is.is_new !== should.is_new){
            console.log(`insertArb([${odd_idHome}, ${odd_idAway}], ${valueArb + 0.01}) returned 
                \tis:{ arb_id:${is.arb_id}, is_new:${is.is_new} }
                \tshould:{ arb_id:${should.arb_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Arb2 with incorrect value
        is = await insertArb(log, [odd_idHome, odd_idAway], -0.1);
        should = {arb_id:undefined, is_new:undefined};
        if(is.arb_id !== should.arb_id || is.is_new !== should.is_new){
            console.log(`insertArb([${odd_idHome}, ${odd_idAway}], ${-0.1}) returned 
                \tis:{ arb_id:${is.arb_id}, is_new:${is.is_new} }
                \tshould:{ arb_id:${should.arb_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

            //insert matches and markets for Arb4
            const {CSmarket_id, _} = await insertMarket(log, match_id, CSmarketName);
            const CSodd_ids = [];
            for(const odd of CSodds){
                const {odd_id, _} = await insertOdd(log, CSmarket_id, odd.name, odd.book, odd.value );
                CSodd_ids.push(odd_id);
            }
        // insert Arb4
        // we jump over serial number here becuase the previous insert failed
        is = await insertArb(log, CSodd_ids, valueArb);
        should = {arb_id:4, is_new:true};
        if(is.arb_id !== should.arb_id || is.is_new !== should.is_new){
            console.log(`insertArb([${CSodd_ids[0]}, ${CSodd_ids[1]}, ${CSodd_ids[2]}, ${CSodd_ids[3]}], ${valueArb}) returned 
                \tis:{ arb_id:${is.arb_id}, is_new:${is.is_new} }
                \tshould:{ arb_id:${should.arb_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Arb4 again
        is = await insertArb(log, CSodd_ids, valueArb);
        should = {arb_id:4, is_new:false};
        if(is.arb_id !== should.arb_id || is.is_new !== should.is_new){
            console.log(`insertArb([${CSodd_ids[0]}, ${CSodd_ids[1]}, ${CSodd_ids[2]}, ${CSodd_ids[3]}], ${valueArb}) returned 
                \tis:{ arb_id:${is.arb_id}, is_new:${is.is_new} }
                \tshould:{ arb_id:${should.arb_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Arb4 again with value + 0.01
        is = await insertArb(log, CSodd_ids, valueArb + 0.01);
        should = {arb_id:5, is_new:true};
        if(is.arb_id !== should.arb_id || is.is_new !== should.is_new){
            console.log(`insertArb([${CSodd_ids[0]}, ${CSodd_ids[1]}, ${CSodd_ids[2]}, ${CSodd_ids[3]}], ${valueArb+0.01}) returned 
                \tis:{ arb_id:${is.arb_id}, is_new:${is.is_new} }
                \tshould:{ arb_id:${should.arb_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Arb4 with incorrect value
        is = await insertArb(log, CSodd_ids, -1.0);
        should = {arb_id:undefined, is_new:undefined};
        if(is.arb_id !== should.arb_id || is.is_new !== should.is_new){
            console.log(`insertArb([${CSodd_ids[0]}, ${CSodd_ids[1]}, ${CSodd_ids[2]}, ${CSodd_ids[3]}], ${-1.0}) returned 
                \tis:{ arb_id:${is.arb_id}, is_new:${is.is_new} }
                \tshould:{ arb_id:${should.arb_id}, is_new:${should.is_new} }
            `)
            return -1;
        }


    } catch{
        console.log('Inserting test failed')
        return -1;
    }

    await pool.end();
    console.log('Inserting test passed')
}

await initDb();
await testDbInserting();