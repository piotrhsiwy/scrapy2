import { Pool } from 'pg'

export const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'scrapy2',
  password: 'local_password',
  port: 5432,
});

import { createWriteStream } from 'fs';
import { insertOdd, insertMarket, insertMatch, insertUrl } from './inserter.js';

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

    } catch{
        console.log('Inserting test failed')
        return -1;
    }


    await pool.end()
    console.log('Inserting test passed')
}

async function initDb(){
    let client;
    try{

        client = await pool.connect();

        ///////////
        // FLUSH
        // ignore Errors thrown during flush, as per normal practice according to postres docs
        ///////////
        try{
            await client.query({text: 'DROP TABLE Urls      CASCADE;'})
            await client.query({text: 'DROP TABLE Matches   CASCADE;'})
            await client.query({text: 'DROP TABLE Markets   CASCADE;'})
            await client.query({text: 'DROP TABLE Odds      CASCADE;'})
            await client.query({text: 'DROP TABLE matches_markets_link      CASCADE;'})
            await client.query({text: 'DROP TABLE matches_urls_link         CASCADE;'})
            await client.query({text: 'DROP TABLE markets_odds_link         CASCADE;'})
        } catch{}
        ///////////
        // TABLES
        ///////////
        await client.query({ text: 
            `CREATE TABLE Matches(
                match_id SERIAL PRIMARY KEY,
                sport TEXT NOT NULL,
                teamHome TEXT NOT NULL,
                teamAway TEXT NOT NULL,
                datetime TIMESTAMP,
                CONSTRAINT match_unique UNIQUE (sport, teamHome, teamAway, datetime)
            );` 
        })

        await client.query({ text: 
            `CREATE TABLE Urls(
                url_id SERIAL PRIMARY KEY,
                book TEXT NOT NULL,
                url TEXT NOT NULL
            )` 
        })

        await client.query({ text: 
            `CREATE TABLE Markets(
                market_id SERIAL PRIMARY KEY,
                name TEXT NOT NULL
            )` 
        })

        await client.query({ text: 
            `CREATE TABLE Odds(
                odd_id SERIAL PRIMARY KEY,
                name text NOT NULL,
                book text NOT NULL,
                value NUMERIC DEFAULT 0.0 CONSTRAINT value_positive CHECK (value > 0.0),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )` 
        })

        ///////////
        // LINKS
        ///////////
        await client.query({text:`
            CREATE TABLE matches_urls_link(
                match_id INTEGER REFERENCES Matches(match_id),
                url_id INTEGER REFERENCES Urls(url_id),
                PRIMARY KEY (match_id, url_id),
                CONSTRAINT match_url_link_unique UNIQUE (match_id, url_id)
            )`
        })

        await client.query({text:`
            CREATE TABLE matches_markets_link(
                match_id INTEGER REFERENCES Matches(match_id),
                market_id INTEGER REFERENCES Markets(market_id),
                PRIMARY KEY (match_id, market_id),
                CONSTRAINT match_market_link_unique UNIQUE (match_id, market_id)
            )`
        })

        await client.query({text:`
            CREATE TABLE markets_odds_link(
                market_id INTEGER REFERENCES Markets(market_id),
                odd_id INTEGER REFERENCES Odds(odd_id),
                PRIMARY KEY (market_id, odd_id),
                CONSTRAINT market_odd_link_unique UNIQUE (market_id, odd_id)
            )`
        })

        console.log('Database initialized successfully');

    } catch(e){
        console.log(`Critical Failure! Error thrown: ${e}\n`);
    } finally{
        if(client) client.release()
    }
}

await initDb();
await testDbInserting();