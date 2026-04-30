import { existsSync, truncateSync } from 'fs'
import { calcTimeframe } from './calc/calc.js'
import { initDbCalc } from './data/db/db.js';
import { timeframeNowHours, timeframeNowMinutes } from './util.js';

// await initDbCalc();
while(true){
    const path = './calc/log.txt';
    if(existsSync(path)){ truncateSync(path, 0); }
    console.log(`Cleared file ${path}`);
    console.log('Calculating...')
    const start = performance.now();
    const report_id = await calcTimeframe(timeframeNowHours(24));
    const end = performance.now();
    const INTERVAL_SECONDS = 60;
    console.log(`Returned ${report_id}.`);
    // if the last calc lasted less than INTERVAL_SECONDS seconds, wait INTERVAL_SECONDS
    if(end - start < 1000 * INTERVAL_SECONDS){
        await new Promise(resolve => setTimeout(resolve, 1000 * INTERVAL_SECONDS));
    }
}
