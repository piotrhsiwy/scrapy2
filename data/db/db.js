import { Pool } from 'pg'

export const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'scrapy2',
  password: 'local_password',
  port: 5432,
});

export async function initDb(){
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