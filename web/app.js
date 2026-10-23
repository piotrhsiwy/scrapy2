// ════════════════════════════════════════════════════════
//  Auth
// ════════════════════════════════════════════════════════
function showLogin(msg = '') {
    document.getElementById('login-screen').classList.add('visible');
    document.getElementById('app').classList.remove('visible');
    document.getElementById('login-error').textContent = msg;
    document.title = 'Scrapy';
}

function showApp() {
    document.getElementById('login-screen').classList.remove('visible');
    document.getElementById('app').classList.add('visible');
    document.getElementById('user-label').innerHTML = localStorage.getItem('username');
}

async function doLogin() {
    const btn = document.getElementById('login-btn');
    const username = document.getElementById('username').value.trim();
    localStorage.setItem('username',username);
    const password = document.getElementById('password').value;
    if (!username || !password) return;

    btn.disabled = true;
    btn.textContent = 'Signing in…';
    document.getElementById('login-error').textContent = '';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (res.ok) {
            showApp();
            switchTab('evs', 'btn-evs');
        } else {
            showLogin('Invalid username or password.');
        }
    } catch {
        showLogin('Connection error. Try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
}

document.getElementById('password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
});

async function doLogout() {
    await fetch('/api/logout', { method: 'POST' });
    showLogin();
}

// ════════════════════════════════════════════════════════
//  State
// ════════════════════════════════════════════════════════
let currentTab = 'evs';
let currentData = [];
let currentHeaders = [];
let activeBooks = new Set();
let sortColumn = null;
let sortAscending = true;
let knownEntryIds = new Set();

let maxStrength = -0.05;
let minStdDev = 3.0;
let minArbValue = 0.02;
let minDatetimeFilter = new Date();

const REFRESH_SECONDS = 15;
let timeRemainingSeconds = REFRESH_SECONDS;
let doneItems = JSON.parse(localStorage.getItem('doneGames') || '[]');

// ════════════════════════════════════════════════════════
//  API helpers
// ════════════════════════════════════════════════════════

// Transform flat DB rows into the nested shape the rest of the UI expects,
// keeping field names compatible with the original JSON files.
function normalizeEvRows(rows) {
    // Group rows by ev_id (one ev can have multiple URL rows for the same odd)
    const map = new Map();
    for (const r of rows) {
        if (!map.has(r.ev_id)) {
            map.set(r.ev_id, {
                odd_id: r.odd_id,
                ev_id: r.ev_id,
                timestamp: r.timestamp,
                sport: r.sport,
                datetime: r.datetime,
                teamHome: r.teamhome,
                teamAway: r.teamaway,
                strength: r.strength,
                probdeviationintermsofstddev: r.probdeviationintermsofstddev,
                market: r.market,
                oddName: r.odd_name,
                value: r.odd_value,
                book: r.book,
                url: r.url,
            });
        }
    }
    return Array.from(map.values());
}

function normalizeBetRows(rows) {
    // Group rows by ev_id (one ev can have multiple URL rows for the same odd)
    const map = new Map();
    for (const r of rows) {
        if (!map.has(r.bet_id)) {
            map.set(r.bet_id, {
                bet_id: r.bet_id,
                ev_id: r.ev_id,
                user_id: r.user_id,
                coupon: r.coupon,
                result: r.result,
                actual_value: r.actual_value,
                timestamp: r.timestamp
            });
        }
    }
    return Array.from(map.values());
}

function normalizeArbRows(rows) {
    // Group by arb_id – collect all odds into Home / Away fields
    const map = new Map();
    for (const r of rows) {
        if (!map.has(r.arb_id)) {
            map.set(r.arb_id, {
                'timestamp (calculated)': r.timestamp,
                value: r.value,
                sport: r.sport,
                teamHome: r.teamhome ?? r.teamHome,
                teamAway: r.teamaway ?? r.teamAway,
                datetime: r.datetime,
                market: r.market,
                _legs: []
            });
        }
        map.get(r.arb_id)._legs.push({ oddName: r.odd_name, book: r.book, oddValue: r.odd_value, url: r.url });
    }
    // Flatten legs into Home / Away (and optionally OddC / OddD for 4-way)
    const labels = ['Home', 'Away', 'OddC', 'OddD'];
    return Array.from(map.values()).map(entry => {
        const out = { ...entry };
        delete out._legs;
        entry._legs.forEach((leg, i) => {
            const label = labels[i] ?? `Odd${i}`;
            out[label] = { 'oddName:': leg.oddName, book: leg.book, 'oddValue:': leg.oddValue, url: leg.url };
        });
        return out;
    });
}

async function apiFetch(tab, from = null) {
    from = from === 'null' ? null : from === 'undefined' ? undefined : from;
    const username = localStorage.getItem('username');
    const res = await fetch(`/api/${tab}?username=${username}&from=${from}`);
    if (res.status === 401) { showLogin('Session expired. Please sign in again.'); return null; }
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const rows = await res.json();
    if(tab === 'evs'){
        return normalizeEvRows(rows);
    } else if(tab === 'arbs'){
        return normalizeArbRows(rows);
    } else if(tab === 'bets'){
        return normalizeBetRows(rows);
    } else if(tab.includes('brothers')){
        return rows;
    } else{
        throw new Error(`Unrecognized API tab: ${tab}`);
    }
}

async function fetchFileMetadata() {
    try {
        const res = await fetch('/api/meta');
        if (res.status === 401) return;
        const meta = await res.json();
        let html = '';
        for (const [label, info] of Object.entries(meta)) {
            html += `<div class="metadata-item">
                <span class="metadata-label">${label}</span>
                <span>${info}</span>
            </div>`;
        }
        document.getElementById('file-metadata').innerHTML = html || 'No metadata available.';
    } catch { /* non-critical */ }
}

// ════════════════════════════════════════════════════════
//  Sound
// ════════════════════════════════════════════════════════
function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
    } catch { /* browser may block before first interaction */ }
}

// ════════════════════════════════════════════════════════
//  Data flattening (same as before)
// ════════════════════════════════════════════════════════
function flattenObject(obj, prefix = '') {
    let result = {};
    for (const key in obj) {
        if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            result = { ...result, ...flattenObject(obj[key], `${prefix}${key} `) };
        } else {
            let val = obj[key];
            if (typeof val === 'number') val = Number.isInteger(val) ? val : parseFloat(val).toFixed(4);
            if (key.toLowerCase().includes('url') && typeof val === 'string' && val.startsWith('http'))
                val = `<a href="${val}" target="_blank">Link ↗</a>`;
            result[`${prefix}${key}`] = val;
        }
    }
    return result;
}

function getRowId(row) {
    return btoa(unescape(encodeURIComponent(
        `${row.datetime}|${row.sport}|${row.teamHome}|${row.teamAway}|${row.market}|${row['book'] || row['Home book'] || ''}`
    )));
}
function getGameId(row) {
    return btoa(unescape(encodeURIComponent(`${row.sport}|${row.teamHome}|${row.teamAway}|${row.datetime}`)));
}

// ════════════════════════════════════════════════════════
//  Slider UI
// ════════════════════════════════════════════════════════
function updateSlidersUI() {
    const container = document.getElementById('slider-container');
    if (currentTab === 'evs') {
        container.innerHTML = `
            <label>Max Strength:</label>
            <input type="range" min="-0.10" max="0.0" step="0.01" value="${maxStrength}"
                   oninput="document.getElementById('sv').innerText=this.value;"
                   onchange="maxStrength=this.value; extractAndRenderBooks(false); renderTable();">
            <span class="slider-value" id="sv">${maxStrength}</span>
            <label style="margin-left:20px;">Min StdDev:</label>
            <input type="range" min="0" max="10" step="0.5" value="${minStdDev}"
                   oninput="document.getElementById('sv2').innerText=this.value;"
                   onchange="minStdDev=this.value; extractAndRenderBooks(false); renderTable();">
            <span class="slider-value" id="sv2">${minStdDev}</span>
        `;
    } else if (currentTab === 'arbs'){
        container.innerHTML = `
            <label>Min Value:</label>
            <input type="range" min="0.00" max="0.10" step="0.001" value="${minArbValue}"
                   oninput="document.getElementById('sv').innerText=this.value;"
                   onchange="minArbValue=this.value; extractAndRenderBooks(false); renderTable();">
            <span class="slider-value" id="sv">${minArbValue}</span>
        `;
    } else {
        container.innerHTML = '';
    }

}

// ════════════════════════════════════════════════════════
//  Threshold filter
// ════════════════════════════════════════════════════════
function passesThresholds(row) {
    // 1. Check DateTime Filter
    if (minDatetimeFilter !== null && row.datetime) {
        // Parse date the exact same way your table sorter does
        const rowTime = Date.parse(String(row.datetime).replace(' at ', ' '));
        if (!isNaN(rowTime) && rowTime < minDatetimeFilter) {
            return false;
        }
    }

    // 2. Check Value Sliders
    if (currentTab === 'evs') {
        return parseFloat(row.strength || 0) <= parseFloat(maxStrength)
            && parseFloat(row.probdeviationintermsofstddev || 0) >= parseFloat(minStdDev);
    }
    return parseFloat(row.value || 0) >= parseFloat(minArbValue);
}

// ════════════════════════════════════════════════════════
//  DateTime Filter Logic
// ════════════════════════════════════════════════════════
function updateMinDatetime() {
    const inputVal = document.getElementById('min-datetime').value;
    if (inputVal) {
        minDatetimeFilter = new Date(inputVal);
    } else {
        minDatetimeFilter = null;
    }
    // Re-render book counts and table to apply filter
    extractAndRenderBooks(false);
    renderTable();
}

function setMinDatetimeNow() {
    const now = new Date();
    // Truncate to the current exact hour to match the "step=3600"
    now.setMinutes(0, 0, 0); 
    
    // Convert to local YYYY-MM-DDThh:mm format for the HTML5 input
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - tzoffset)).toISOString().slice(0, 16);

    document.getElementById('min-datetime').value = localISOTime;
    updateMinDatetime();
}

function clearMinDatetime() {
    document.getElementById('min-datetime').value = '';
    updateMinDatetime();
}

// ════════════════════════════════════════════════════════
//  Tab switch + silent refresh
// ════════════════════════════════════════════════════════
async function switchTab(tab, btnId) {
    currentTab = tab;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(btnId).classList.add('active');
    updateSlidersUI();
    timeRemainingSeconds = REFRESH_SECONDS;

    document.getElementById('table-container').innerHTML = '<div style="padding:20px;">Loading data…</div>';
    await fetchFileMetadata();

    const from = minDatetimeFilter ? minDatetimeFilter.toISOString() : null;
    const data = await apiFetch(tab, from);
    if (!data) return;

    currentData = data.map(item => flattenObject(item));
    currentHeaders = Array.from(new Set(currentData.flatMap(Object.keys)));
    knownEntryIds = new Set(currentData.map(getRowId));

    if(currentTab === 'evs' || currentTab === 'arbs'){
        extractAndRenderBooks(true);
    }
    renderTable();
}

async function fetchSilent() {
    await fetchFileMetadata();
    const from = minDatetimeFilter ? minDatetimeFilter.toISOString() : null;
    const data = await apiFetch(currentTab, from);
    if (!data) return;

    currentData = data.map(item => flattenObject(item));

    let triggerSound = false;
    currentData.forEach(row => {
        const rId = getRowId(row);
        if (!knownEntryIds.has(rId)) {
            knownEntryIds.add(rId);
            if (passesThresholds(row) && !doneItems.includes(getRowId(row))) triggerSound = true;
        }
    });
    if (triggerSound) playNotificationSound();

    extractAndRenderBooks(false);
    renderTable();
}

// ════════════════════════════════════════════════════════
//  Book filter
// ════════════════════════════════════════════════════════
function extractAndRenderBooks(resetActive = true) {
    const books = new Set();
    currentData.forEach(r => {
        if (r['book']) books.add(r['book']);
        if (r['Home book']) books.add(r['Home book']);
        if (r['Away book']) books.add(r['Away book']);
    });
    if (resetActive) activeBooks = new Set();

    const filterContainer = document.getElementById('book-filters');
    if(currentTab === 'evs' || currentTab === 'arbs'){
        if (!books.size) { filterContainer.innerHTML = '<span>No books found.</span>'; return; }

        const bookCounts = {};
        books.forEach(b => {
            bookCounts[b] = currentData.filter(row => {
                const belongs = row['book'] === b || row['Home book'] === b || row['Away book'] === b;
                return belongs && passesThresholds(row) && !doneItems.includes(getGameId(row));
            }).length;
        });

        filterContainer.innerHTML = Array.from(books).sort().map(b => {
            const checked = activeBooks.has(b) ? 'checked' : '';
            return `<label class="checkbox-label">
                <input type="checkbox" value="${b}" ${checked} onchange="toggleBook(this)">
                ${b} <span class="book-count">(${bookCounts[b]})</span>
            </label>`;
        }).join('');
    } else{
        filterContainer.innerHTML = '';
    }
}

function toggleBook(checkbox) {
    if (checkbox.checked) activeBooks.add(checkbox.value);
    else activeBooks.delete(checkbox.value);
    renderTable();
}

// ════════════════════════════════════════════════════════
//  Render table
// ════════════════════════════════════════════════════════
function renderTable() {
    let html;
    if(currentTab === 'evs' || currentTab === 'arbs'){
        // Apply books filter
        let filtered = currentData.filter(row => {
            const bookPass = !row['book'] && !row['Home book'] && !row['Away book']
                || activeBooks.has(row['book'])
                || (activeBooks.has(row['Home book']) && activeBooks.has(row['Away book']));
            return bookPass && passesThresholds(row) && !doneItems.includes(getGameId(row));
        });

        // Group by game
        const groups = {};
        filtered.forEach(row => {
            const gId = getGameId(row);
            if (!groups[gId]) groups[gId] = { id: gId, entries: [] };
            groups[gId].entries.push(row);
        });
        let groupedArray = Object.values(groups);

        document.title = groupedArray.length > 0 ? `${groupedArray.length} - Scrapy` : 'Scrapy';

        // Sorting
        const isDateCol = sortColumn === 'timestamp (calculated)' || sortColumn === 'datetime';
        function getSortValue(entry) {
            let val = entry[sortColumn] !== undefined ? entry[sortColumn] : '';
            if (typeof val === 'string') val = val.replace(/<[^>]*>?/gm, '');
            return val;
        }
        function parseDate(val) {
            const parsed = Date.parse(String(val).replace(' at ', ' '));
            return isNaN(parsed) ? NaN : parsed;
        }

        if (sortColumn) {
            groupedArray.sort((gA, gB) => {
                const vA = gA.entries.map(getSortValue);
                const vB = gB.entries.map(getSortValue);
                if (isDateCol) {
                    const dA = vA.map(parseDate).filter(n => !isNaN(n));
                    const dB = vB.map(parseDate).filter(n => !isNaN(n));
                    if (dA.length && dB.length) {
                        const a = sortAscending ? Math.min(...dA) : Math.max(...dA);
                        const b = sortAscending ? Math.min(...dB) : Math.max(...dB);
                        return sortAscending ? a - b : b - a;
                    }
                }
                const nA = vA.map(parseFloat).filter(n => !isNaN(n));
                const nB = vB.map(parseFloat).filter(n => !isNaN(n));
                if (nA.length && nB.length) {
                    const a = sortAscending ? Math.min(...nA) : Math.max(...nA);
                    const b = sortAscending ? Math.min(...nB) : Math.max(...nB);
                    return sortAscending ? a - b : b - a;
                }
                const sa = String(vA[0] ?? '').toLowerCase();
                const sb = String(vB[0] ?? '').toLowerCase();
                return sortAscending ? sa.localeCompare(sb) : sb.localeCompare(sa);
            });
            groupedArray.forEach(g => g.entries.sort((a, b) => {
                let va = getSortValue(a), vb = getSortValue(b);
                if (isDateCol) {
                    const da = parseDate(va), db = parseDate(vb);
                    if (!isNaN(da) && !isNaN(db)) return sortAscending ? da - db : db - da;
                }
                const na = parseFloat(va), nb = parseFloat(vb);
                if (!isNaN(na) && !isNaN(nb)) return sortAscending ? na - nb : nb - na;
                return sortAscending ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
            }));
        }

        // Build HTML
        html = `<table><thead><tr>
            ${currentHeaders.map(h => {
                const arrow = sortColumn === h ? (sortAscending ? ' ▲' : ' ▼') : '';
                return `<th onclick="sortAscending=sortColumn==='${h}'?!sortAscending:true; sortColumn='${h}'; renderTable();">${h}${arrow}</th>`;
            }).join('')}
            <th> Double Check </th>
            <th> Post Bet </th>
        </tr></thead>`;

        if (!groupedArray.length) {
            html += `<tbody><tr><td colspan="${currentHeaders.length }" style="text-align:center;padding:30px;">No active entries match your filters.</td></tr></tbody>`;
        } else {
            groupedArray.forEach(g => {
                html += `<tbody class="game-group">`;
                g.entries.forEach(row => {
                    const rId = getRowId(row);
                    const gId = getGameId(row);
                    const username = localStorage.getItem('username');
                    html += `<tr id="${rId}" class="game-row-${gId}" 
                        onclick="if(event.target.tagName!='A'){markDone('${gId}')}"
                        onmouseenter="handleRowHover('${row.odd_id}',this)" >`;
                    currentHeaders.forEach(h => html += `<td>${row[h] ?? ''}</td>`);
                    html += `<td> 
                        <button class="btn-doublecheck" onclick="event.stopPropagation(); doubleCheckMatch('${rId}')" >CHECK</button> 
                    </td>`;
                    html += `<td> 
                        <button class="btn-doublecheck" onclick="event.stopPropagation(); postBet(${row.ev_id}, '${username}')" >BET</button> 
                    </td>`;
                    html += `</tr>`;
                });
                html += `</tbody>`;
            });
        }
    } else{
        document.title = currentData.length > 0 ? `${currentData.length} - Scrapy` : 'Scrapy';

        // Build HTML
        html = `<table><thead><tr>
            ${currentHeaders.map(h => {
                return `<th>${h}</th>`;
            }).join('')}
        </tr></thead>`;

        if (!currentData.length) {
            html += `<tbody><tr><td colspan="${currentHeaders.length }" style="text-align:center;padding:30px;">No entries.</td></tr></tbody>`;
        } else {
            html += `<tbody class="game-group">`;
            currentData.forEach(row => {
                html += `<tr id="${row.bet_id}">`;
                currentHeaders.forEach(h => html += `<td>${row[h] ?? ''}</td>`);
                html += `</tr>`;
            });
            html += `</tbody>`;
        }
    }

    document.getElementById('table-container').innerHTML = html + '</table>';
}
 
// ════════════════════════════════════════════════════════
// ON HOVER
// ════════════════════════════════════════════════════════

const brothersCache = new Map();
async function handleRowHover(oddId, rowElement) {
    // 1. If we already fetched it, just show it and exit
    if (brothersCache.has(oddId) && brothersCache.get(oddId) != [] && brothersCache.get(oddId) !== '...') {
        displayBrothers(brothersCache.get(oddId), rowElement);
        return;
    }

    // 2. Mark as '...' to prevent spamming the server if the user jiggles their mouse
    brothersCache.set(oddId, '...');
    displayBrothers(brothersCache.get(oddId), rowElement);

    if(brothersCache.get(oddId) === '...'){
        try {
            const res = await fetch(`/api/brothers?odd_id=${oddId}`);
            if (res.ok) {
                const values = await res.json();
                brothersCache.set(oddId, values); // Save to cache
                displayBrothers(values, rowElement);
            } else {
                brothersCache.set(oddId, []); 
            }
        } catch (err) {
            console.error("Failed to fetch brothers:", err);
            brothersCache.set(oddId, []);
        }
    }
}

// Helper function to actually show the data on the screen
function displayBrothers(values, rowElement) {
    if (values === '...' || !values || values.length === 0) return;

    // OPTION A: Show as a native browser tooltip (easiest)
    rowElement.title = `Brothers: ${values.join(', ')}`;

    /* OPTION B: If you have a specific cell for this, you can target it like this:
    const cell = rowElement.querySelector('.brothers-cell');
    if (cell) {
        cell.innerText = values.join(', ');
    }
    */
}

// ════════════════════════════════════════════════════════
//  ON CLICK
// ════════════════════════════════════════════════════════
const betposted = new Set();
async function postBet(ev_id, username ){
    try {

        if(betposted.has(ev_id)){
            console.log(`Bet ${ev_id} has already been posted!`);
            alert(`Bet ${ev_id} has already been posted!`);
            return;
        }

        const coupon = window.prompt('Enter the book-specific hash/id of the coupon:');
        if(coupon == ''){
            console.log('Bet posting cancelled by user.');
            return;
        }
        const actual_value = window.prompt('Enter the actual_value (to track slippage):');
        if(actual_value == ''){
            console.log('No actual_value input. Assuming the original odd value on insert.');
            alert('No actual_value input. Assuming the original odd value on insert.');
        }

        const res = await fetch(`/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ev_id: ev_id, 
                username: username, 
                coupon: coupon.trim(),
                actual_value: actual_value
            })
        });
        betposted.add(ev_id);
    } catch {
        console.log('Connection error when posting bet. Try again.');
    } finally {
    }
}

// Add a Set to keep track of what is currently loading so users can't spam click it
const currentlyLoading = new Set();
const doublechecked = new Set();

async function doubleCheckMatch(rowId) {
    // 1. Prevent duplicate clicks if it's already loading or already verified
    if (currentlyLoading.has(rowId) || doublechecked.has(rowId)) {
        return; 
    }

    const element = document.getElementById(rowId);
    if (!element) return;

    // 2. Apply Loading State
    currentlyLoading.add(rowId);
    element.classList.add('LOADING_CLASS_GRAY');
    
    // NOTE: Do NOT call renderTable() here. It will wipe out the loading class you just applied!

    try {
        const odd_id = element.odd_id;
        const res = await fetch(`/api/doublecheck?odd_id=${odd_id}`);
        
        // 3. Remove Loading State
        element.classList.remove('LOADING_CLASS_GRAY');
        currentlyLoading.delete(rowId);

        if (res.ok) {
            // 4. Apply Success State
            doublechecked.add(rowId); // Actually add it to the Set so we know it's verified!
            element.classList.add('VERIFIED_CLASS_GREEN');
            
            // Give the user 1 second to actually see the green row before re-rendering
            setTimeout(() => { 
                extractAndRenderBooks(false); 
                renderTable(); 
            }, 1000); 

        } else {
            // 5. Apply Failure State
            element.classList.add('fade-out-row');
            
            setTimeout(() => { 
                extractAndRenderBooks(false); 
                renderTable(); 
            }, 500); // Wait for the 0.5s CSS fade animation to finish
        }

    } catch (err) {
        console.error("Failed to double check odd:", err);
        
        // Cleanup if the network request completely fails
        element.classList.remove('LOADING_CLASS_GRAY');
        currentlyLoading.delete(rowId);
        
        // Assuming you meant oddId here, not row.odd_id
        if (typeof brothersCache !== 'undefined') brothersCache.set(oddId, []);
    }
}

// ════════════════════════════════════════════════════════
//  Done / Reset
// ════════════════════════════════════════════════════════

function markDone(id) {
    if (!doneItems.includes(id)) {
        doneItems.push(id);
        localStorage.setItem('doneGames', JSON.stringify(doneItems));
    }
    document.querySelectorAll(CSS.escape(`tr.game-row-${id}`)).forEach( e => e.classList.add('fade-out-row'));
    setTimeout(() => { extractAndRenderBooks(false); renderTable(); }, 10);
}

function gobackDone() {
    if (doneItems){
        doneItems.pop()
        localStorage.setItem('doneGames', JSON.stringify(doneItems));
    }
    setTimeout(() => { extractAndRenderBooks(false); renderTable(); }, 10);
}

function resetDone() {
    doneItems = [];
    localStorage.setItem('doneGames', '[]');
    extractAndRenderBooks(false);
    renderTable();
}

// ════════════════════════════════════════════════════════
//  Timer
// ════════════════════════════════════════════════════════
setInterval(() => {
    // 1. Decrement the timer
    timeRemainingSeconds--;

    // 2. Update the DOM *before* resetting, so the user actually sees the empty state
    document.getElementById('ascii-timer').innerText =
        `[${'-'.repeat(Math.max(0, timeRemainingSeconds)).padEnd(REFRESH_SECONDS, ' ')}]`;

    // 3. Trigger the fetch if we hit 0 (or below)
    if (timeRemainingSeconds <= 0) {
        // Reset the timer for the next cycle immediately
        timeRemainingSeconds = REFRESH_SECONDS; 
        
        // Call the async function and catch any potential errors
        fetchSilent().catch(err => {
            console.error("Silent fetch failed:", err);
        });
    }
}, 1000);

// ════════════════════════════════════════════════════════
//  Boot: check if already logged in
// ════════════════════════════════════════════════════════
(async () => {
    const res = await fetch('/api/evs');
    if (res.status === 401) {
        showLogin();
    } else {
        showApp();
        const data = await res.json();
        currentTab = 'evs';
        updateSlidersUI();
        await fetchFileMetadata();
        currentData = normalizeEvRows(data).map(item => flattenObject(item));
        currentHeaders = Array.from(new Set(currentData.flatMap(Object.keys)));
        knownEntryIds = new Set(currentData.map(getRowId));
        extractAndRenderBooks(true);
        renderTable();
    }
})();