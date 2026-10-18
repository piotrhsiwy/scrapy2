import { createWriteStream, readFileSync } from "fs"
import { promisify } from "util";

import { openBrowser } from '../../util.js';
import { datestringToISO } from '../GosuGamers/parser.js';
import { parseMatches } from "./util.js";

async function fetchLiquidpedia(log){
    
    console.log('Fetching liquidpedia...')

    const BASE = 'https://liquipedia.net/counterstrike/api.php';

    let baseParams = {
        format: 'json',
        action: 'query',
        list: 'categorymembers',
        cmtitle: 'Category:CS2_Tournaments',
        cmstart: '2026-04-01T00:00:01Z',
        cmsort: 'timestamp',
        cmdir: 'asc',
        cmlimit: '500',
        origin: '*',
    };

    const tournaments = [];
    let cont = {};
    
    // fetch all the tournaments
    do{
        const params = new URLSearchParams({ ...baseParams, ...cont});
        const res = await fetch(`${BASE}?${params}`, {
            headers: {
                'User-Agent': 'scrapy2/1.0 (xpiteqx@gmail.com)',
                'Accept-Encoding': 'gzip',
            },
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error.info);

        tournaments.push(...data.query.categorymembers);
        cont = data.continue ?? null;   // null when there are no more pages
        console.log(data.query.categorymembers); // array of {pageid, ns, title}
        console.log(data.continue);              // present only if there are more results

        await new Promise( resolve => setTimeout(resolve, 2000));

    } while(cont);

    // for each tournament get all the matches
    for(const tour of tournaments){

        if(!tour.pageid){
            log.write(`Error! This Tournament does not have pageid property (skipping): ${tour.title}\n`);
            continue;
        }
        const pageidString = tour.pageid.toString();
        baseParams = {
            origin: '*',
            format: 'json',
            action: 'query',
            prop: 'revisions',
            rvprop: 'content',
            pageids: tour.pageid,
            rvslots: 'main',
            rvlimit: '1'
        };

        const params = new URLSearchParams({ ...baseParams});
        const res = await fetch(`${BASE}?${params}`, {
            headers: {
                'User-Agent': 'scrapy2/1.0 (xpiteqx@gmail.com)',
                'Accept-Encoding': 'gzip',
            },
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error.info);

        let wikitext = data;
        const contentNestPath = ['query', 'pages', pageidString, 'revisions', '0', 'slots', 'main', '*'];
        for(const key of contentNestPath){
            wikitext = wikitext?.[key];
        }
        const matches = parseMatches(wikitext);
        tour.matches = matches;
        cont = data.continue ?? null;   // null when there are no more pages
        console.log(data.query.categorymembers);
        console.log(data.continue);

        await new Promise( resolve => setTimeout(resolve, 2000));
    }
    
}

while(true){
    // open a file for logging
    const logFilePath = `./log.txt`
    const log = createWriteStream(logFilePath, {flags: 'a'});

    // await initDbResult();
    try{
        await fetchLiquidpedia(log);
    } finally{
        await promisify(log.end).bind(log)();
    }
}
