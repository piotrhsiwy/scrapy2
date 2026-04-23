import { calcAll } from './calc/calc.js'
import { initDbCalc } from './data/db/db.js';

// await initDbCalc();
while(true){
    console.log('Calculating...')
    const start = performance.now();
    const report_id = await calcAll();
    const end = performance.now();
    const INTERVAL_SECONDS = 60;
    // if the last calc lasted less than INTERVAL_SECONDS seconds, wait INTERVAL_SECONDS
    if(end - start < 1000 * INTERVAL_SECONDS){
        await new Promise(resolve => setTimeout(resolve, 1000 * INTERVAL_SECONDS));
    }
    console.log(`Returned ${report_id}.`);
}
