import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { pool } from './db/db.js';
import { getOddWithBrothers } from './db/getter.js';

const app = express();
app.use(express.json());
app.use(express.static('.')); // serves index.html

app.use(session({
  secret: process.env.SESSION_SECRET || 'a-temporary-secret-for-development',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 86400000 }
}));

function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
  if (!rows[0] || !await bcrypt.compare(password, rows[0].password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });
  req.session.userId = rows[0].user_id;
  res.json({ ok: true });
});

app.post('/bet', async (req, res) => {
  const { ev_id, username } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE username=$1 LIMIT 1', [username]);
  if (!rows[0]){
    return res.status(401).json({ error: 'User with this username not found.' });
  }
  const user_id = rows[0].user_id;
  pool.query({
    text:`
      INSERT INTO bets (ev_id, user_id)
      SELECT $1, $2
      RETURNING bet_id
    `,
    values:[ev_id, user_id]
  });
  req.session.userId = rows[0].user_id;
  res.json({ ok: true });
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/evs', requireAuth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT 
      e.ev_id, e.strength, e.probdeviationintermsofstddev, e.timestamp,
      o.odd_id, o.name AS odd_name, o.book, o.value AS odd_value,
      mk.name AS market,
      m.sport, m.teamhome, m.teamaway, m.datetime,
      u.url
    FROM evs e
    JOIN evs_odds_link el ON e.ev_id = el.ev_id
    JOIN odds o ON el.odd_id = o.odd_id
    JOIN markets_odds_link ml ON o.odd_id = ml.odd_id
    JOIN markets mk ON ml.market_id = mk.market_id
    JOIN matches_odds_link mml ON o.odd_id = mml.odd_id
    JOIN matches m ON mml.match_id = m.match_id
    JOIN matches_urls_link mul ON m.match_id = mul.match_id
    JOIN urls u ON mul.url_id = u.url_id AND u.book = o.book
    ORDER BY mk.name, m.datetime ASC
  `);
  res.json(rows);
});

app.get('/arbs', requireAuth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT 
      a.arb_id, a.value, a.timestamp,
      o.name AS odd_name, o.book, o.value AS odd_value,
      mk.name AS market,
      m.sport, m.teamhome, m.teamaway, m.datetime,
      u.url
    FROM arbs a
    JOIN arbs_odds_link al ON a.arb_id = al.arb_id
    JOIN odds o ON al.odd_id = o.odd_id
    JOIN markets_odds_link ml ON o.odd_id = ml.odd_id
    JOIN markets mk ON ml.market_id = mk.market_id
    JOIN matches_odds_link mml ON o.odd_id = mml.odd_id
    JOIN matches m ON mml.match_id = m.match_id
    JOIN matches_urls_link mul ON m.match_id = mul.match_id
    JOIN urls u ON mul.url_id = u.url_id AND u.book = o.book
    ORDER BY mk.name ASC
  `);
  res.json(rows);
});

app.get('/meta', requireAuth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT *
    FROM reports
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  res.json(rows[0]);
});

app.get('/brothers', requireAuth, async (req, res) => {
  const odd_id = req.query.odd_id;
  const ret = await getOddWithBrothers(odd_id)
  res.json(ret.map( r => r.value));
});


app.listen(3001);