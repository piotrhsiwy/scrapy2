import { insertArb, insertEv, insertMarket, insertMatch, insertOdd, insertToScrapeUrl, insertUrl } from "./inserter.js";
import { createWriteStream } from 'fs';
import { initDb, pool } from "./db.js";
import { readFileSync, existsSync } from "fs";
import { getOdd, getOdds, getOddWithBrothers, getOpposite2, getToScrapeUrls } from "./getter.js";
import { insertUser } from "../../auth/seed.js";

async function testDbJsonInserting(log){
    log.write('Opening files...\n');
    const dataFilePath = './data/data_out.json'
    let data = JSON.parse(readFileSync(dataFilePath));
    log.write(`Loaded data from ${dataFilePath}\n`);

    const arbsFilePath = './data/arbs.json';
    let arbs = [];
    if(existsSync(arbsFilePath)) {
        arbs = JSON.parse(readFileSync(arbsFilePath));
        log.write(`Loaded data from ${arbsFilePath}\n`);
    } else {
        log.write(`File does not exist ${arbsFilePath}. Starting with empty\n`);
    }
    const evsFilePath = './data/evs.json';
    let evs = [];
    if(existsSync(evsFilePath)) {
        evs = JSON.parse(readFileSync(evsFilePath));
        log.write(`Loaded data from ${evsFilePath}\n`);
    } else {
        log.write(`File does not exist ${evsFilePath}. Starting with empty\n`);
    }

    for(const sport of data.sports){
        for(const match of sport.matches){
            const {match_id:match_id} = await insertMatch(log, sport.name, match.teamHome, match.teamAway, match.datetime);
            for(const url of match.urls){
                await insertUrl(log, match_id, url.book, url.url);
            }
            for(const market of match.markets){
                const {market_id:market_id} = await insertMarket(log, market.name);
                for(const odd of market.odds){
                    for(const coef of odd.coefs){
                        await insertOdd(log, match_id, market_id, odd.name, coef.book, coef.value);
                    }
                }
            }
        }
    }

    console.log('Json inserting test passed');
    
}

async function testDbInserting(log){
    
    // Match
    const sportName = 'Counter-Strike 2';
    const teamHome = 'vitality';
    const teamAway = 'g2';
    // Match2
    const sportName2 = 'Counter-Strike 2';
    const teamHome2 = 'heretics';
    const teamAway2 = 'schalke04';
    // TODO what if the datetime is 'live'? disallow it on the scraper level
    const datetime = 'October 6, 2025 at 07:00:00 PM GMT+2';
    const datetime3h = 'October 6, 2025 at 10:00:00 PM GMT+2';
    const datetime4h = 'October 6, 2025 at 11:00:00 PM GMT+2';

    // Url + match_id
    const book = 'Esportsbet';
    const url = 'https://esportsbet.io/esportsbull/OddsPage/39513322/47/CS2Betting-1W-TEAM-NUCLEAR-TIGERES';
    const book2 = 'Thunderpick';
    const url2 = 'https://thunderpick.io';
    const book3 = '22Bet';
    const url3 = 'https://bestwinzz.de';

    // Market + match_id
    const marketName = 'Match Winner';

    // Odd + market_id
    // book is reused
    const oddNameHome = 'vitality';
    const valueHome = 1.88;
    const oddNameAway = 'g2';
    const valueAway = 1.92;

    // Ev
    const strength = -0.051234;
    const pditosd = 0.1;

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
        const HDPmarketName = 'Match Handicap';
        const HDPodds = [
            {
                name: 'g2-1.5',
                book: 'Thunderpick',
                value: 3
            },
            {
                name: 'g21.5',
                book: 'Thunderpick',
                value: 1.2
            },
            {
                name: 'vitality-1.5',
                book: 'Thunderpick',
                value: 4
            },
            {
                name: 'g2-1.5',
                book: 'Esportsbet',
                value: 4
            },
            {
                name: 'vitality1.5',
                book: 'Esportsbet',
                value: 1.2
            },
            {
                name: 'g21.5',
                book: 'Esportsbet',
                value: 1.1
            },
            {
                name: 'vitality-1.5',
                book: 'Esportsbet',
                value: 9
            },
            {
                name: 'g2-1.5',
                book: '22Bet',
                value: 4.01
            },
            {
                name: 'vitality1.5',
                book: '22Bet',
                value: 1.21
            },
            {
                name: 'g21.5',
                book: '22Bet',
                value: 1.101
            },
            {
                name: 'vitality-1.5',
                book: '22Bet',
                value: 9.01
            },
            {
                name: 'vitality1.5',
                book: 'Thunderpick',
                value: 1.45
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
        is = await insertMarket(log, marketName);
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
        is = await insertMarket(log, marketName);
        should = {market_id:1, is_new:false};
        if(is.market_id !== should.market_id || is.is_new !== should.is_new){
            console.log(`insertMarket(${match_id}, ${marketName}) returned 
                \tis:{ market_id:${is.market_id}, is_new:${is.is_new} }
                \tshould:{ market_id:${should.market_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert CoefHome
        is = await insertOdd(log, match_id, market_id, oddNameHome, book, valueHome);
        should = {odd_id:1, is_new:true};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertOdd(${market_id}, ${oddNameHome}, ${book}, ${valueHome}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.is_new} }
            `)
            return -1;
        }
        const odd_idHome = is.odd_id;
        is = await getOdds();
        should = {length:1};
        if(is.length !== should.length){
            console.log(`incorrect number of odds in the db:
                \tis: ${is.length}
                \tshould: ${should.length}
            `)
            return -1;
        }

        // insert CoefHome again
        is = await insertOdd(log, match_id, market_id, oddNameHome, book, valueHome);
        should = {odd_id:2, is_new:true};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertOdd(${market_id}, ${oddNameHome}, ${book}, ${valueHome}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.is_new} }
            `)
            return -1;
        }
        is = await getOdds();
        should = {length:2};
        if(is.length !== should.length){
            console.log(`incorrect number of odds in the db:
                \tis: ${is.length}
                \tshould: ${should.length}
            `)
            return -1;
        }
        
        // insert CoefHome with value + 0.1
        is = await insertOdd(log, match_id, market_id, oddNameHome, book, valueHome + 0.1);
        should = {odd_id:3, is_new:true};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertOdd(${market_id}, ${oddNameHome}, ${book}, ${valueHome + 0.1}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.is_new} }
            `)
            return -1;
        }
        is = await getOdds();
        should = {length:3};
        if(is.length !== should.length){
            console.log(`incorrect number of odds in the db:
                \tis: ${is.length}
                \tshould: ${should.length}
            `)
            return -1;
        }

        // insert CoefAway
        is = await insertOdd(log, match_id, market_id, oddNameAway, book, valueAway);
        should = {odd_id:4, is_new:true};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertOdd(${market_id}, ${oddNameAway}, ${book}, ${valueAway}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.is_new} }
            `)
            return -1;
        }
        const odd_idAway = is.odd_id;
        is = await getOdds();
        should = {length:4};
        if(is.length !== should.length){
            console.log(`incorrect number of odds in the db:
                \tis: ${is.length}
                \tshould: ${should.length}
            `)
            return -1;
        }

        // insert CoefAway with invalid value - the error message in log
        is = await insertOdd(log, match_id, market_id, oddNameAway, book, -1.0);
        should = {odd_id:undefined, is_new:undefined};
        if(is.odd_id !== should.odd_id || is.is_new !== should.is_new){
            console.log(`insertOdd(${market_id}, ${oddNameAway}, ${book}, ${-1.0}) returned 
                \tis:{ odd_id:${is.odd_id}, is_new:${is.is_new} }
                \tshould:{ odd_id:${should.odd_id}, is_new:${should.is_new} }
            `)
            return -1;
        }
        is = await getOdds();
        should = {length:4};
        if(is.length !== should.length){
            console.log(`incorrect number of odds in the db:
                \tis: ${is.length}
                \tshould: ${should.length}
            `)
            return -1;
        }

        // insert CoefHome from book2
        await insertUrl(log, match_id, book2, url2);
        await insertOdd(log, match_id, market_id, oddNameHome, book2, valueHome + 0.5);
        await insertOdd(log, match_id, market_id, oddNameAway, book2, valueAway - 0.5);
        await insertUrl(log, match_id, book3, url3);
        await insertOdd(log, match_id, market_id, oddNameHome, book3, valueHome + 0.05);
        await insertOdd(log, match_id, market_id, oddNameAway, book3, valueAway - 0.05);
        is = await getOdds();
        should = {length:8};
        if(is.length !== should.length){
            console.log(`incorrect number of odds in the db:
                \tis: ${is.length}
                \tshould: ${should.length}
            `)
            return -1;
        }

        const retOddHome = await getOdd(odd_idHome);
        if(
            retOddHome.sport !== sportName ||
            retOddHome.book !== book ||
            retOddHome.teamhome !== teamHome ||
            retOddHome.teamaway !== teamAway ||
            // retOddHome.datetime !== datetime ||
            retOddHome.marketname !== marketName ||
            retOddHome.oddname !== oddNameHome ||
            parseFloat(retOddHome.value) !== valueHome
        ) {
            console.log(`Failure on comparing return value of getOdd(${odd_idHome})`);
            console.log(`is/should: \n\t${retOddHome.sport}                \n\t${sportName}`);
            console.log(`is/should: \n\t${retOddHome.book}                 \n\t${book}`);
            console.log(`is/should: \n\t${retOddHome.teamhome}             \n\t${teamHome}`);
            console.log(`is/should: \n\t${retOddHome.teamaway}             \n\t${teamAway}`);
            console.log(`is/should: \n\t${retOddHome.marketname}           \n\t${marketName}`);
            console.log(`is/should: \n\t${retOddHome.oddname}              \n\t${oddNameHome}`);
            console.log(`is/should: \n\t${parseFloat(retOddHome.value)}    \n\t${valueHome}`);
        }

        const retOddAway = await getOdd(odd_idAway);
        if(
            retOddAway.sport !== sportName ||
            retOddAway.book !== book ||
            retOddAway.teamhome !== teamHome ||
            retOddAway.teamaway !== teamAway ||
            // retOddAway.datetime !== datetime ||
            retOddAway.marketname !== marketName ||
            retOddAway.oddname !== oddNameAway ||
            parseFloat(retOddAway.value) !== valueAway
        ) {
            console.log(`Failure on comparing return value of getOdd(${odd_idAway})`);
            console.log(`is/should: \n\t${retOddAway.sport}                \n\t${sportName}`);
            console.log(`is/should: \n\t${retOddAway.book}                 \n\t${book}`);
            console.log(`is/should: \n\t${retOddAway.teamhome}             \n\t${teamHome}`);
            console.log(`is/should: \n\t${retOddAway.teamaway}             \n\t${teamAway}`);
            console.log(`is/should: \n\t${retOddAway.marketname}           \n\t${marketName}`);
            console.log(`is/should: \n\t${retOddAway.oddname}              \n\t${oddNameAway}`);
            console.log(`is/should: \n\t${parseFloat(retOddAway.value)}    \n\t${valueAway}`);
        }

        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////
        // insert Ev
        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////

        is = await insertEv(log, odd_idHome, strength, pditosd);
        should = {ev_id:1, is_new:true};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idHome}, ${strength}, ${pditosd}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert the same Ev again
        is = await insertEv(log, odd_idHome, strength, pditosd);
        should = {ev_id:1, is_new:false};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idHome}, ${strength}, ${pditosd}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert the same Ev again with strength -0.01
        // this should INSERT a new entry with a new timestamp and new ev_id, because the strength changed
        // TODO with this setup it's impossible to distinguish on the app level between a new ev and a ev with an updated strength!
        is = await insertEv(log, odd_idHome, strength - 0.01, pditosd);
        should = {ev_id:2, is_new:true};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idHome}, ${strength - 0.01}, ${pditosd}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Away Ev
        is = await insertEv(log, odd_idAway, strength, pditosd);
        should = {ev_id:3, is_new:true};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idAway}, ${strength}, ${pditosd}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Away Ev again
        is = await insertEv(log, odd_idAway, strength, pditosd);
        should = {ev_id:3, is_new:false};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idAway}, ${strength}, ${pditosd}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Away Ev again with strength +0.01
        is = await insertEv(log, odd_idAway, strength + 0.01, pditosd);
        should = {ev_id:4, is_new:true};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idAway}, ${strength + 0.01}, ${pditosd}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Away Ev again with invalid strength - error message in log
        is = await insertEv(log, odd_idAway, 0.01, pditosd);
        should = {ev_id:undefined, is_new:undefined};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idAway}, ${0.01}, ${pditosd}) returned 
                \tis:{ ev_id:${is.ev_id}, is_new:${is.is_new} }
                \tshould:{ ev_id:${should.ev_id}, is_new:${should.is_new} }
            `)
            return -1;
        }

        // insert Away Ev again with invalid pditosd - error message in log
        // strength has to be different, else we will skip inserting because this entry already exists
        is = await insertEv(log, odd_idAway, strength - 0.08, -0.1);
        should = {ev_id:undefined, is_new:undefined};
        if(is.ev_id !== should.ev_id || is.is_new !== should.is_new){
            console.log(`insertEv(${odd_idAway}, ${strength - 0.08}, ${-0.1}) returned 
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
            const { market_id:CSmarket_id } = await insertMarket(log, CSmarketName);
            const CSodd_ids = [];
            for(const odd of CSodds){
                const {odd_id, _} = await insertOdd(log, match_id, CSmarket_id, odd.name, odd.book, odd.value );
                CSodd_ids.push(odd_id);
            }
            const { market_id:HDPmarket_id } = await insertMarket(log, HDPmarketName);
            const HDPodd_ids = [];
            for(const odd of HDPodds){
                const {odd_id, _} = await insertOdd(log, match_id, HDPmarket_id, odd.name, odd.book, odd.value );
                HDPodd_ids.push(odd_id);
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

        is = await insertMatch(log, sportName2, teamHome2, teamAway2, datetime);
        const match_id2 = is.match_id;
        await insertOdd(log, match_id2, market_id, teamHome2, book, valueHome);
        await insertOdd(log, match_id2, market_id, teamAway2, book, valueAway);

    } catch(e){
        console.log(`Inserting test failed\n${e.message}\n${e.stack}`)
        return -1;
    }

    console.log('Inserting test passed')
}

async function testUserInserting(log){
    const user_id = await insertUser(log, 'username', 'password');
    if(!user_id){
        console.log(`Failure! user_id is ${user_id}`)
    }
    console.log(`User Interting test passed`)
}

async function testHuntInserting(log){
    let ret, is, should;
    const book = 'Esportsbet';
    const book2 = 'Thunderpick';
    const url = 'https://esportsbet.io';
    const url2 = 'https://thunderpick.io';
    const datetime = '2026-04-23 16:00:00.000';
    const datetime1h = '2026-04-23 17:00:00.000';
    const datetime25h = '2026-04-24 17:00:00.000';
    const datetime_25h = '2026-04-22 15:00:00.000';

    is = await insertToScrapeUrl(log, book, url, datetime);
    should = {toscrapeurl_id:1, is_new: true};
    if(is.toscrapeurl_id !== should.toscrapeurl_id || is.is_new !== should.is_new){
        console.log(`insertToScrapeUrl(${book}, ${url}, ${datetime}) returned 
            \tis:{ toscrapeurl_id:${is.toscrapeurl_id}, is_new:${is.is_new} }
            \tshould:{ toscrapeurl_id:${should.toscrapeurl_id}, is_new:${should.is_new} }
        `)
    }
    is = await insertToScrapeUrl(log, book, url, datetime);
    should = {toscrapeurl_id:1, is_new: false};
    if(is.toscrapeurl_id !== should.toscrapeurl_id || is.is_new !== should.is_new){
        console.log(`insertToScrapeUrl(${book}, ${url}, ${datetime}) returned 
            \tis:{ toscrapeurl_id:${is.toscrapeurl_id}, is_new:${is.is_new} }
            \tshould:{ toscrapeurl_id:${should.toscrapeurl_id}, is_new:${should.is_new} }
        `)
    }
    is = await insertToScrapeUrl(log, book, url, datetime1h);
    should = {toscrapeurl_id:1, is_new: false};
    if(is.toscrapeurl_id !== should.toscrapeurl_id || is.is_new !== should.is_new){
        console.log(`insertToScrapeUrl(${book}, ${url}, ${datetime1h}) returned 
            \tis:{ toscrapeurl_id:${is.toscrapeurl_id}, is_new:${is.is_new} }
            \tshould:{ toscrapeurl_id:${should.toscrapeurl_id}, is_new:${should.is_new} }
        `)
    }
    is = await insertToScrapeUrl(log, book, url, datetime25h);
    should = {toscrapeurl_id:2, is_new:true};
    if(is.toscrapeurl_id !== should.toscrapeurl_id || is.is_new !== should.is_new){
        console.log(`insertToScrapeUrl(${book}, ${url}, ${datetime25h}) returned 
            \tis:{ toscrapeurl_id:${is.toscrapeurl_id}, is_new:${is.is_new} }
            \tshould:{ toscrapeurl_id:${should.toscrapeurl_id}, is_new:${should.is_new} }
        `)
    }
    is = await insertToScrapeUrl(log, book, url, datetime_25h);
    should = {toscrapeurl_id:3, is_new:true};
    if(is.toscrapeurl_id !== should.toscrapeurl_id || is.is_new !== should.is_new){
        console.log(`insertToScrapeUrl(${book}, ${url}, ${datetime_25h}) returned 
            \tis:{ toscrapeurl_id:${is.toscrapeurl_id}, is_new:${is.is_new} }
            \tshould:{ toscrapeurl_id:${should.toscrapeurl_id}, is_new:${should.is_new} }
        `)
    }
    is = await insertToScrapeUrl(log, book, url2, datetime);
    should = {toscrapeurl_id:4, is_new: true};
    if(is.toscrapeurl_id !== should.toscrapeurl_id || is.is_new !== should.is_new){
        console.log(`insertToScrapeUrl(${book}, ${url2}, ${datetime}) returned 
            \tis:{ toscrapeurl_id:${is.toscrapeurl_id}, is_new:${is.is_new} }
            \tshould:{ toscrapeurl_id:${should.toscrapeurl_id}, is_new:${should.is_new} }
        `)
    }
    is = await insertToScrapeUrl(log, book2, url2, datetime);
    should = {toscrapeurl_id:5, is_new: true};
    if(is.toscrapeurl_id !== should.toscrapeurl_id || is.is_new !== should.is_new){
        console.log(`insertToScrapeUrl(${book}, ${url2}, ${datetime}) returned 
            \tis:{ toscrapeurl_id:${is.toscrapeurl_id}, is_new:${is.is_new} }
            \tshould:{ toscrapeurl_id:${should.toscrapeurl_id}, is_new:${should.is_new} }
        `)
    }

    function comp(a, b){
        for(let i = 0; i < a.length; i++){
            if(a[i] !== b[i]) return false;
        }
        return true;    
    }
    const timeframe = {from:'2026-04-22 10:00:00.000', to:'2026-12-24 20:00:00.000'};
    ret = await getToScrapeUrls(timeframe, book);
    is = ret.map(e => e.url);
    should = [url, url, url2, url];
    if(is.length !== should.length || !comp(is, should)){
        console.log(`incorrect entries in toscrapeurls db:
            \tis: ${is}
            \tshould: ${should}
        `)
        return -1;
    }
    ret = await getToScrapeUrls(timeframe, book2);
    is = ret.map(e => e.url);
    should = [url2];
    if(is.length !== should.length || !comp(is, should)){
        console.log(`incorrect entries in toscrapeurls db:
            \tis: ${is}
            \tshould: ${should}
        `)
        return -1;
    }
    console.log(`Hunt Interting test passed`)
}

async function testGetting(log){

    function comp(a, b){
        for(let i = 0; i < a.length; i++){
            if(a[i] !== b[i]) return false;
        }
        return true;    
    }

    try{

        const brother_ids = [3, 6, 8];
        const brothers_promises = brother_ids.map( v => getOdd(v));
        const brothers = await Promise.all(brothers_promises);
        const odd_id = 1;
        const owb = await getOddWithBrothers(odd_id);
        if(owb.length !== brothers.length || 
            comp(owb.map(v => v.odd_id), brothers.map(v => v.odd_id)) ||
            comp(owb.map(v => v.name), brothers.map(v => v.name)) ||
            comp(owb.map(v => v.book), brothers.map(v => v.book)) ||
            comp(owb.map(v => v.value), brothers.map(v => v.value)) ||
            comp(owb.map(v => v.timestamp), brothers.map(v => v.timestamp))
        ){
            console.log(`Error on comparing is:${owb} with should:${brothers} `)
        }

        const opposite_brother_ids = [4, 7, 9];
        const opposite_brothers_promises = brother_ids.map( v => getOdd(v));
        const opposite_brothers = await Promise.all(opposite_brothers_promises);
        const opposite = await getOpposite2(2);
        const opposite_id = opposite.odd_id;
        const opposite_owb = await getOddWithBrothers(opposite_id);
        if(opposite_owb.length !== opposite_brothers.length || 
            comp(opposite_owb.map(v => v.odd_id), opposite_brothers.map(v => v.odd_id)) ||
            comp(opposite_owb.map(v => v.name), opposite_brothers.map(v => v.name)) ||
            comp(opposite_owb.map(v => v.book), opposite_brothers.map(v => v.book)) ||
            comp(opposite_owb.map(v => v.value), opposite_brothers.map(v => v.value)) ||
            comp(opposite_owb.map(v => v.timestamp), opposite_brothers.map(v => v.timestamp))
        ){
            console.log(`Error on comparing is:${opposite_owb} with should:${brothers} `)
        }

    } catch(e){
        console.log(`Getting test failed\n${e.message}\n${e.stack}`)
        return -1;
    }
    console.log(`Getting test passed`)
    return 0;
}

let log;
const logFilePath = './data/log.txt';
try{
    log = createWriteStream(logFilePath, {flags: 'a'});
} catch(error){
    console.error(`Failure! Cannot open file under ${logFilePath}`);
}

await initDb();
await testDbInserting(log);
await testHuntInserting(log);
await testUserInserting(log);
await testGetting(log);
// await testDbJsonInserting(log);
pool.end();