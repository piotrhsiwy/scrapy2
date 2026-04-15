import { Pool } from 'pg'

export const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'scrapy2',
  password: 'local_password',
  port: 5432,
});

try{

    const client = await pool.connect();

    ///////////
    // FLUSH
    // ignore Errors thrown during flush, as per normal practice according to postres docs
    ///////////
    try{
        await client.query({text: 'DROP TABLE Urls      CASCADE;'})
        await client.query({text: 'DROP TABLE Matches   CASCADE;'})
        await client.query({text: 'DROP TABLE Markets   CASCADE;'})
        await client.query({text: 'DROP TABLE Coefs     CASCADE;'})
        await client.query({text: 'DROP TABLE matches_markets_link      CASCADE;'})
        await client.query({text: 'DROP TABLE matches_urls_link         CASCADE;'})
        await client.query({text: 'DROP TABLE markets_coefs_link        CASCADE;'})
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
            datetime TIMESTAMP
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
            name TEXT NOT NULL,
            oddName TEXT NOT NULL
        )` 
    })

    await client.query({ text: 
        `CREATE TABLE Coefs(
            coef_id SERIAL PRIMARY KEY,
            book text NOT NULL,
            value NUMERIC DEFAULT 0.0,
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
            PRIMARY KEY (match_id, url_id)
        )`
    })

    await client.query({text:`
        CREATE TABLE matches_markets_link(
            match_id INTEGER REFERENCES Matches(match_id),
            market_id INTEGER REFERENCES Markets(market_id),
            PRIMARY KEY (match_id, market_id)
        )`
    })

    await client.query({text:`
        CREATE TABLE markets_coefs_link(
            market_id INTEGER REFERENCES Markets(market_id),
            coef_id INTEGER REFERENCES Coefs(coef_id),
            PRIMARY KEY (market_id, coef_id)
        )`
    })

    client.release()
    await pool.end()
    console.log('Database initialized successfully');
} catch(e){
    console.log(`Critical Failure! Error thrown: ${e}\n`);
}