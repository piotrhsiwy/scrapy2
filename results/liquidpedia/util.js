// ---------- small helpers ----------

// Split "a=1|b={{X|y}}|c=3" on the | characters that are NOT inside {{ }} or [[ ]]
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; current += two; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; current += two; i++; continue; }
    if (text[i] === '|' && depth === 0) { parts.push(current); current = ''; continue; }
    current += text[i];
  }
  parts.push(current);
  return parts;
}

// Find every {{name ...}} in the text. Returns [{ start, body }]
// body is everything between "{{" and the matching "}}"
function findTemplates(text, name) {
  const found = [];
  let pos = 0;
  while ((pos = text.indexOf('{{' + name, pos)) !== -1) {
    const after = text[pos + 2 + name.length];
    // make sure "{{Match" doesn't also match "{{Matchlist"
    if (after !== '|' && after !== '\n' && after !== ' ') { pos++; continue; }

    let depth = 0;
    let i = pos;
    for (; i < text.length; i++) {
      if (text.startsWith('{{', i)) { depth++; i++; }
      else if (text.startsWith('}}', i)) { depth--; i++; if (depth === 0) break; }
    }
    found.push({ start: pos, body: text.slice(pos + 2, i - 1) });
    pos = i;
  }
  return found;
}

// "a=1|b=2" -> { a: '1', b: '2' }   (parts without "=" are ignored)
function toKeyValues(parts) {
  const obj = {};
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    obj[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return obj;
}

const num = v => (v === undefined || v === '' ? null : Number(v));

// ---------- parsing the pieces ----------

// {{TeamOpponent|drama esports}} -> { team: 'drama esports' }
function parseOpponent(text) {
  const t = findTemplates(text, 'TeamOpponent')[0];
  if (!t) return { team: text.trim() };
  const parts = splitTopLevel(t.body); // parts[0] is "TeamOpponent"
  return { team: parts[1].trim(), ...toKeyValues(parts.slice(2)) };
}

// {{Map|map=Mirage|finished=true|t1firstside=ct|t1t=5|t1ct=8|t2t=4|t2ct=3|stats=225433}}
function parseMap(text) {
  const t = findTemplates(text, 'Map')[0];
  const p = toKeyValues(splitTopLevel(t.body).slice(1));

  const played = p.finished === 'true';
  const sum = (regex) => Object.keys(p)
    .filter(k => regex.test(k))
    .reduce((acc, k) => acc + (Number(p[k]) || 0), 0);

  // regulation rounds + overtime keys like o1t1t, o1t1ct, o2t2t ...
  const team1Rounds = sum(/^t1(t|ct)$/) + sum(/^o\d+t1(t|ct)$/);
  const team2Rounds = sum(/^t2(t|ct)$/) + sum(/^o\d+t2(t|ct)$/);

  return {
    map: p.map,
    played,                                   // false when finished=skip or empty
    firstSide: p.t1firstside || null,         // side team 1 started on
    team1: { score: played ? team1Rounds : null, tRounds: num(p.t1t), ctRounds: num(p.t1ct) },
    team2: { score: played ? team2Rounds : null, tRounds: num(p.t2t), ctRounds: num(p.t2ct) },
    overtime: Object.keys(p).some(k => /^o\d+/.test(k)),
    statsId: p.stats || null,
    raw: p,                                   // every original parameter, just in case
  };
}

// "April 3, 2026 - 9:00 {{Abbr/CEST}}" -> "2026-04-03T09:00:00+02:00"  (CEST = UTC+2)
function parseDate(text) {
  const clean = text.replace(/\{\{.*?\}\}/g, '').trim();
  const m = clean.match(/(\w+) (\d+), (\d+) - (\d+):(\d+)/);
  if (!m) return null;
  const months = ['January','February','March','April','May','June','July',
                  'August','September','October','November','December'];
  const pad = n => String(n).padStart(2, '0');
  return `${m[3]}-${pad(months.indexOf(m[1]) + 1)}-${pad(m[2])}T${pad(m[4])}:${m[5]}:00+02:00`;
}

// ---------- main function ----------

export function parseMatches(wikitext) {
  return findTemplates(wikitext, 'Match').map(({ start, body }) => {
    const parts = splitTopLevel(body).slice(1);      // drop the "Match" name
    const p = toKeyValues(parts);

    const opponent1 = parseOpponent(p.opponent1);
    const opponent2 = parseOpponent(p.opponent2);

    // every parameter named map1, map2, map3 ...
    const maps = Object.keys(p)
      .filter(k => /^map\d+$/.test(k))
      .sort()
      .map(k => parseMap(p[k]));

    // series score = maps won by each team
    let wins1 = 0, wins2 = 0;
    for (const m of maps.filter(m => m.played)) {
      if (m.team1.score > m.team2.score) wins1++;
      else if (m.team2.score > m.team1.score) wins2++;
    }

    // Where in the page is this match? Look at the text before it.
    const before = wikitext.slice(0, start);
    const headings = [...before.matchAll(/^===\s*([^=\n]+?)\s*===$/gm)];
    const stage = headings.length ? headings[headings.length - 1][1] : null; // "Group Stage" / "Playoffs"
    const groupTitles = [...before.matchAll(/title=([^|\n]+?) Matches/g)];
    const group = stage === 'Group Stage' && groupTitles.length
      ? groupTitles[groupTitles.length - 1][1] : null;                        // "Group A"
    const bracketSlot = (/\|\s*(R\w+)\s*=\s*$/.exec(before) || [])[1] || null; // "R1M1", "R3M1", "RxMTP"

    return {
      stage,
      group,
      bracketSlot,
      team1: opponent1.team,
      team2: opponent2.team,
      opponent1,
      opponent2,
      dateRaw: p.date,
      datetime: parseDate(p.date),
      finished: p.finished === 'true',
      stream: p.kick || null,
      hltvId: p.hltv || null,
      seriesScore: { team1: wins1, team2: wins2 },
      maps,
      raw: p, // all original parameters, in case something is missing above
    };
  });
}