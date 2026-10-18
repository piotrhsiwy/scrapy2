import { Pool } from 'pg'

export const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'scrapy2',
  password: 'local_password',
  port: 5432,
});

export async function initDb(){
    await initDbHunt();
    await initDbData();
    await initDbCalc();
    await initDbUser();
}

export async function initDbResult(){
    let client;
    try{

        client = await pool.connect();

        ///////////
        // FLUSH
        // ignore Errors thrown during flush, as per normal practice according to postres docs
        ///////////
        try{
            await client.query({text: 'DROP TABLE results      CASCADE;'})
            await client.query({text: 'DROP TABLE toresulturl  CASCADE;'})
        } catch{}
        ///////////
        // TABLES
        ///////////
        await client.query({ text: 
            `CREATE TABLE results(
                result_id SERIAL PRIMARY KEY,
                match_id INTEGER REFERENCES matches(match_id),
                market_id INTEGER REFERENCES markets(market_id),
                winners TEXT[] NOT NULL,
                UNIQUE(match_id, market_id)
            );` 
            // winners is an array of oddNames that won in this market
        })
        await client.query({ text: 
            `CREATE TABLE toresulturl(
                toresulturl_id SERIAL PRIMARY KEY,
                url TEXT NOT NULL UNIQUE
            );` 
        })
        console.log('Result Tables initialized successfully');
    } catch(e){
        console.log(`Critical Failure! Error thrown: ${e}\n`);
    } finally{
        if(client) client.release()
    }
}

export async function initDbHunt(){
    let client;
    try{

        client = await pool.connect();

        ///////////
        // FLUSH
        // ignore Errors thrown during flush, as per normal practice according to postres docs
        ///////////
        try{
            await client.query({text: 'DROP TABLE toscrapeurl      CASCADE;'})
        } catch{}
        ///////////
        // TABLES
        ///////////
        await client.query({ text: 
            `CREATE TABLE toscrapeurl(
                toscrapeurl_id SERIAL PRIMARY KEY,
                book TEXT NOT NULL,
                url TEXT NOT NULL,
                datetime TIMESTAMP NOT NULL
            );` 
        })
        console.log('Hunt Tables initialized successfully');

    } catch(e){
        console.log(`Critical Failure! Error thrown: ${e}\n`);
    } finally{
        if(client) client.release()
    }
}

export async function initDbUser(){
    let client;
    try{

        client = await pool.connect();

        ///////////
        // FLUSH
        // ignore Errors thrown during flush, as per normal practice according to postres docs
        ///////////
        try{
            await client.query({text: 'DROP TABLE Users      CASCADE;'})
            await client.query({text: 'DROP TABLE Bets       CASCADE;'})
        } catch{}
        ///////////
        // TABLES
        ///////////
        await client.query({ text: 
            `CREATE TABLE users(
                user_id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            );` 
        })
        // hash is the book-specific identifier of the coupon
        await client.query({ text:
            `CREATE TABLE bets(
                bet_id SERIAL PRIMARY KEY,
                ev_id INTEGER REFERENCES evs(ev_id),
                user_id INTEGER REFERENCES users(user_id),
                coupon TEXT,
                result INTEGER DEFAULT NULL,
                actual_value NUMERIC DEFAULT 1.0 NOT NULL CONSTRAINT actual_value_positive CHECK(actual_value > 0.0),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );` 
        })
        console.log('User Tables initialized successfully');

    } catch(e){
        console.log(`Critical Failure! Error thrown: ${e}\n`);
    } finally{
        if(client) client.release()
    }
}

export async function initDbCalc(){
    let client;
    try{

        client = await pool.connect();

        ///////////
        // FLUSH
        // ignore Errors thrown during flush, as per normal practice according to postres docs
        ///////////
        try{
            await client.query({text: 'DROP TABLE evs      CASCADE;'})
            await client.query({text: 'DROP TABLE arbs     CASCADE;'})
            await client.query({text: 'DROP TABLE reports  CASCADE;'})
            await client.query({text: 'DROP TABLE evs_odds_link         CASCADE;'})
            await client.query({text: 'DROP TABLE arbs_odds_link        CASCADE;'})
        } catch{}
        ///////////
        // TABLES
        ///////////
        await client.query({ text: 
            `CREATE TABLE evs(
                ev_id SERIAL PRIMARY KEY,
                strength NUMERIC NOT NULL CONSTRAINT ev_strength_negative CHECK (strength < 0.0),
                probDeviationInTermsOfStdDev NUMERIC NOT NULL CONSTRAINT ev_probDeviationInTermsOfStdDev_positive CHECK (probDeviationInTermsOfStdDev > 0.0),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );` 
        })

        await client.query({ text: 
            `CREATE TABLE arbs(
                arb_id SERIAL PRIMARY KEY,
                value NUMERIC NOT NULL CONSTRAINT arb_value_positive CHECK (value > 0.0),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );` 
        })

        await client.query({ text: 
            `CREATE TABLE reports(
                report_id SERIAL PRIMARY KEY,
                arbsCount INTEGER,
                evsCount INTEGER,
                oddsCount INTEGER,
                durationinms NUMERIC NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );` 
        })

        ///////////
        // LINKS
        ///////////
        await client.query({text:`
            CREATE TABLE evs_odds_link(
                ev_id INTEGER REFERENCES evs(ev_id),
                odd_id INTEGER REFERENCES odds(odd_id),
                PRIMARY KEY (ev_id, odd_id),
                CONSTRAINT ev_odd_link_unique UNIQUE (ev_id, odd_id)
            )`
            // 1to1 mapping in case of evs
        })

        await client.query({text:`
            CREATE TABLE arbs_odds_link(
                arb_id INTEGER REFERENCES arbs(arb_id),
                odd_id INTEGER REFERENCES odds(odd_id),
                PRIMARY KEY (arb_id, odd_id)
            )`
            // Nto1 mapping in case of arbs (f.e. 2to1 or 4to1)
        })

        console.log('Calc Tables initialized successfully');

    } catch(e){
        console.log(`Critical Failure! Error thrown: ${e}\n`);
    } finally{
        if(client) client.release()
    }
}

export async function initDbData(){
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
            await client.query({text: 'DROP TABLE matches_urls_link         CASCADE;'})
            await client.query({text: 'DROP TABLE matches_odds_link         CASCADE;'})
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

        // this index is used to grab youngest odd efficiently.
        // previous attempts: using DISTINCT ON (book, name) ORDER BY book, name, timestamp DESC was massively (20x) slower, making calc on the next 24h practically unusable
        await client.query({text: `
            CREATE INDEX idx_name_book_timestamp
            ON odds (name, book, timestamp DESC)
            `
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
            CREATE TABLE matches_odds_link(
                match_id INTEGER REFERENCES Matches(match_id),
                odd_id INTEGER REFERENCES Odds(odd_id),
                PRIMARY KEY (match_id, odd_id),
                CONSTRAINT match_odd_link_unique UNIQUE (match_id, odd_id)
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

        console.log('Data Tables initialized successfully');

    } catch(e){
        console.log(`Critical Failure! Error thrown: ${e}\n`);
    } finally{
        if(client) client.release()
    }
}