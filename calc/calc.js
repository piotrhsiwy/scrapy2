import { createWriteStream, existsSync, readFileSync, writeFileSync } from "fs"
import { promisify } from "util";
import { prettyToDate, prettyEarliestFrom } from "../data/util/prettify.js";
import { insertArb2, insertArb4, insertEv2 } from "./inserter.js";

export let log;
let consideredArbCount;
let consideredEvCount;

function isMultiSelfArb(arr){
    const books = [arr[0]];
    for(let i = 1; i < arr.length; i++){
        if(books.some( b => b.book === arr[i].book )){
            return true;
        }
        books.push(arr[i]);
    }
    return false;
}

function arb4(arbs, cutoff, sport, match, market, oddA, oddB, oddC, oddD){
    for(const A of oddA.coefs){
        for(const B of oddB.coefs){
            for(const C of oddC.coefs){
                for(const D of oddD.coefs){
                    // TODO checking it h ere is not efficient. You can check it on the way when entering loops
                    if( isMultiSelfArb([A, B, C, D]) ){ // exclude self-arb from the consideration
                        continue;
                    }
                    const arb = 1.0 - (1/A.value + 1/B.value + 1/C.value + 1/D.value);
                    if(arb > cutoff){
                        let newArb = {
                            "timestamp":prettyEarliestFrom([A.timestamp, B.timestamp, C.timestamp, D.timestamp]),
                            "value":arb,
                            "sport":sport.name,
                            // "tournament":tournament.name,
                            "teamHome":match.teamHome,
                            "teamAway":match.teamAway,
                            "datetime":match.datetime,
                            "market":market.name,
                            "oddA":{
                                "oddName":oddA.name,
                                "oddValue":A.value,
                                "book":A.book,
                                "url":match.urls.find( item => item.book === A.book )?.url,
                            },
                            "oddB":{
                                "oddName":oddB.name,
                                "oddValue":B.value,
                                "book":B.book,
                                "url":match.urls.find( item => item.book === B.book )?.url,
                            },
                            "oddC":{
                                "oddName":oddC.name,
                                "oddValue":C.value,
                                "book":C.book,
                                "url":match.urls.find( item => item.book === C.book )?.url,
                            },
                            "oddD":{
                                "oddName":oddD.name,
                                "oddValue":D.value,
                                "book":D.book,
                                "url":match.urls.find( item => item.book === D.book )?.url,
                            },
                        };
                        const arbReport = insertArb4(arbs, newArb);
                        log.write(arbReport);
                    }
                    consideredArbCount++;
                }
            }
        }
    }
}

function arb2(arbs, cutoff, sport, match, market, oddHome, oddAway){
    for(const coefHome of oddHome.coefs){
        for(const coefAway of oddAway.coefs){
            if(coefAway.book === coefHome.book){ // excludes self-arbs from the consideration
                continue;
            }
            const arb = 1.0 - (1/coefHome.value + 1/coefAway.value);
            if(arb > cutoff){
                let newArb = {
                    "timestamp":prettyEarliestFrom([coefHome.timestamp, coefAway.timestamp]),
                    "value":arb,
                    "sport":sport.name,
                    // "tournament":tournament.name,
                    "teamHome":match.teamHome,
                    "teamAway":match.teamAway,
                    "datetime":match.datetime,
                    "market":market.name,
                    "Home":{
                        "oddName":oddHome.name,
                        "oddValue":coefHome.value,
                        "book":coefHome.book,
                        "url":match.urls.find( item => item.book === coefHome.book )?.url,
                    },
                    "Away":{
                        "oddName":oddAway.name,
                        "oddValue":coefAway.value,
                        "book":coefAway.book,
                        "url":match.urls.find( item => item.book === coefAway.book )?.url,
                    }
                };
                const arbReport = insertArb2(arbs, newArb);
                log.write(arbReport);
            }
            consideredArbCount++;
        }
    }
}

function meanArrayExcluding(arr, value){
    let acc = 0.0;
    arr.forEach( v => { acc+=v; });
    return (acc-value)/(arr.length-1);
}

function meanArray(arr){
    let acc = 0.0;
    arr.forEach( v => acc+=v );
    return acc/arr.length;
}

function stdDevArrayExcluding(arr, value){
    const index = arr.findIndex((v) => v === value);
    const mean = meanArrayExcluding(arr, value);
    const dev = arr.map( v => Math.pow(v-mean, 2));
    let devSum = 0.0;
    dev.forEach( (v, i) => {
        if( i !== index){
            devSum += v;
        }
    });
    const stdDev = Math.sqrt( ( 1/( arr.length-1 ) ) * devSum );
    return stdDev;
}

function stdDevArray(values){
    const mean = meanArray(values);
    const dev = values.map( v => Math.pow(v-mean, 2));
    let devSum = 0.0;
    dev.forEach( d => devSum += d );
    const stdDev = Math.sqrt( ( 1/( values.length ) ) * devSum );
    return stdDev;
}

function evStrength(a, b){
    return (1/a - 1/b);
}

function evKelly(value, mean){
    const BooksEdge = 0.08; 
    const p = 1/mean - BooksEdge/2;
    const b = value - 1;
    return p - (1-p)/b;
}

function ev2(evs, cutoff, sport, match, market, odd, oddOriginal){
    const valuesNoNull = [];
    odd.coefs.forEach(c => { if(c.value) {valuesNoNull.push(c.value);} }); // remove null values
    // log.write(`values: ${values}\n`);
    /* evStrength only meaningful when more than 3 coefs are available */
    if(valuesNoNull.length >= 3){
        for(const v of valuesNoNull){
            const mean = meanArrayExcluding(valuesNoNull, v);
            /* note that cutoff is negative, f.e. -0.1
            cutoff corresponds to how much commision is place on the odds:
            -0.1 cutoff corresponds to 10%. If strength is below cutoff (stronger)
            then v could potentially be an arb aginast the mean_Excluded(v).
            I define this as a potential positive EV bet. */
            const strength = evStrength(v, mean);
            if(strength < -cutoff){
                const book = odd.coefs.find(c => c.value === v).book;
                const vOriginal = oddOriginal.coefs.find(c => c.book === book).value;
                const url = match.urls.find( u => u.book === book )?.url;
                // calculate standard deviation of the corresponding probabilities
                const stdDev = stdDevArrayExcluding(valuesNoNull.map(o => 1/o), 1/v);
                let newEv = {
                    "timestamp":prettyEarliestFrom(odd.coefs.map( (coef) => coef.timestamp )),
                    "valueOriginal":vOriginal,
                    "value":v,
                    "values":valuesNoNull,
                    "mean":mean,
                    "probStdDev":stdDev,
                    "probDeviationInTermsOfStdDev":Math.abs((1/v-1/mean)/stdDev),
                    "strength":strength,
                    "kellyFraction":evKelly(v, mean),
                    "sport":sport.name,
                    // "tournament":tournament.name,
                    "teamHome":match.teamHome,
                    "teamAway":match.teamAway,
                    "datetime":match.datetime,
                    "market":market.name,
                    "odd":{
                        "oddName":odd.name,
                        "oddValue":v,
                        "book":book,
                        "url":url,
                    },
                };
                const evReport = insertEv2(evs, newEv);
                log.write(evReport);
            }
        }
        consideredEvCount++;
    }
}

/**
 * This function removes the books's edges from each of the coefficients, according the coefficients of the two opposing 
 * (as in Match Winner A, Match Winner B) odds of a particular book. This way value of 1.85 could be devigged to 2.0, 
 * depending to how big the book's edge is in this market. It assumes that there is at least one corresponding odd for 
 * each book and it will take the first one. If the corresponding coef has no, or invalid value: {null ,undefined, 0} (this 
 * can occur if the book has odds locked for this event for example), the value is set to null on *both* sides. Example:
 * a book has values: 11.0 and 0 (invalid) for a market, then *both* 11.0 and 0 are set to null. This prevents from using not-devigged 
 * values when calculating value bets.
 * @return It returns a pair of those same exact odds, but with modified 
 * values, to be used when calculating value bets. If at least one of the corresponsing values is invalid or 0, both values are 
 * set to null in the returned object.
 * @param oddHome 
 * @param oddAway is an odd Object representing an odd opposed to oddHome of the following structure:
 *              {
 *                "name": "kuusamo.gg",
                  "coefs": [
                    {
                      "timestamp": "April 11, 2026 at 02:23:38 PM UTC",
                      "book": "GGbet",
                      "value": 2.52
                    },
                    {
                      "timestamp": "April 11, 2026 at 02:24:09 PM UTC",
                      "book": "Thunderpick",
                      "value": 2.12
                    }
                  ]
                }
 */
function devig(oddHome, oddAway){

    function devigVal(a, b){
        const edgeOneside = (1/a + 1/b - 1)/2
        const ret = 1/(1/a - edgeOneside);
        // log.write(`Devigged ${a} against ${b} to ${ret}. Vig: ${2*edgeOneside}\n`)
        return ret;
    }

    function devigOneside(oddHome, oddAway){
        let ret = structuredClone(oddHome);
        for(let i = 0; i < oddHome.coefs.length; i++){
            const coefHome = oddHome.coefs[i];
            const valueHome = coefHome?.value
            const coefAway = oddAway.coefs.find(e => e.book === coefHome.book);
            const valueAway = coefAway?.value;
            if(!valueAway || !valueHome){
                // log.write(`Warning! cannot devig, one of the corresponding coefs has no value: ${oddHome.name}:${valueHome} or ${valueAway}. Setting to null.\n`);
                ret.coefs[i].value = null;
                continue;
            }
            ret.coefs[i].value = devigVal(valueHome, valueAway);
        }
        return ret;
    }

    if(!oddHome || !oddAway){
        return {oddHome, oddAway}
    }
    let deviggedOddHome = devigOneside(oddHome, oddAway);
    let deviggedOddAway = devigOneside(oddAway, oddHome);

    return {deviggedOddHome, deviggedOddAway};
}

function calcMarket({arbs, evs}, {arbCutoff, evCutoff}, sport, match, market){

    let marketReport;
    const teamHome = match.teamHome;
    const teamAway = match.teamAway;

    log.write(`Processing market: ${market.name}\n`)
    let odds = market.odds;
    if(odds.length <= 1){
        marketReport = `Failure! calcMarket cannot handle the following market: '${market.name}'. Incorrect number of odds: ${odds.length}.\n`;
    } else if   (odds.length == 2){
        /* normal binary market */
        let oddHome = market.odds[0];
        let oddAway = market.odds[1];
        if(oddHome && oddAway){
            arb2(arbs, arbCutoff, sport, match, market, oddHome, oddAway);
            const {deviggedOddHome, deviggedOddAway} = devig(oddHome, oddAway);
            ev2(evs, evCutoff, sport, match, market, deviggedOddHome, oddHome);
            ev2(evs, evCutoff, sport, match, market, deviggedOddAway, oddAway);
        } else{
            // log.write(`Failure! oddHome is ${oddHome}. oddAway is ${oddAway} Probably could not find a pair in a normal binary market.`);
        }
        marketReport = `Considered ${consideredArbCount} Arbs, ${arbs.length} of them were positive\n`
    } else{//    odds.length >= 3
        if(market.name?.includes('Handicap')){
            /* handicap market with oddNames of the format: "Virtus.pro-2.5" */
            let processed = [];
            while(odds.length !== processed.length){
                let oddHome;
                let oddAway;
                for(let i = 0; i < odds.length; i++){
                    if( !processed.includes(odds[i])){
                        oddHome = odds[i];
                        break;
                    }
                }
                for(let i = 1; i < odds.length; i++){
                    if(oddHome.name.includes(teamHome)){
                        const h1 = parseFloat(oddHome.name.replace(teamHome, '')); // the left handicap value h1
                        if(odds[i].name.includes(teamAway) && ( parseFloat(odds[i].name.replace(teamAway, '')) === -h1 )){
                            oddAway = odds[i];
                            break;
                        } else{
                            continue;
                        }
                    } else if(oddHome.name.includes(teamAway) ){
                        const h1 = parseFloat(oddHome.name.replace(teamAway, '')); // the left handicap value h1
                        if(odds[i].name.includes(teamHome) && ( parseFloat(odds[i].name.replace(teamHome, '')) === -h1 )){
                            oddAway = odds[i];
                            break;
                        } else{
                            continue;
                        }
                    } else{
                        /* invalid odd name */
                    }
                }
                if(oddHome && oddAway){
                    arb2(arbs, arbCutoff, sport, match, market, oddHome, oddAway);
                    const {deviggedOddHome, deviggedOddAway} = devig(oddHome, oddAway);
                    ev2(evs, evCutoff, sport, match, market, deviggedOddHome, oddHome);
                    ev2(evs, evCutoff, sport, match, market, deviggedOddAway, oddAway);
                } else{
                    // log.write(`Failure! oddHome is ${oddHome}. oddAway is ${oddAway} Probably could not find a pair in a handicap market.`);
                }
                if(oddHome){ processed.push(oddHome); }
                if(oddAway){ processed.push(oddAway); }
            }
            marketReport = `Considered ${consideredArbCount} Arbs, ${arbs.length} of them were positive\n`
        } else if(market.name?.includes('First to Reach')){
            /* first-to-reach market with oddNames of the format: "Virtus.pro 5" */
            let processed = [];
            while(odds.length !== processed.length){
                let oddHome;
                let oddAway;
                for(let i = 0; i < odds.length; i++){
                    if( !processed.includes(odds[i])){
                        oddHome = odds[i];
                        break;
                    }
                }
                for(let i = 1; i < odds.length; i++){
                    if(oddHome.name.includes(teamHome)){
                        const r1 = parseFloat(oddHome.name.replace(teamHome, '')); // the left ftr value r1
                        if(odds[i].name.includes(teamAway) && ( parseFloat(odds[i].name.replace(teamAway, '')) === r1 )){
                            oddAway = odds[i];
                            break;
                        } else{
                            continue;
                        }
                    } else if(oddHome.name.includes(teamAway) ){
                        const r1 = parseFloat(oddHome.name.replace(teamAway, '')); // the left ftr value r1
                        if(odds[i].name.includes(teamHome) && ( parseFloat(odds[i].name.replace(teamHome, '')) === r1 )){
                            oddAway = odds[i];
                            break;
                        } else{
                            continue;
                        }
                    } else{
                        /* invalid odd name */
                    }
                }
                if(oddHome && oddAway){
                    arb2(arbs, arbCutoff, sport, match, market, oddHome, oddAway);
                    const {deviggedOddHome, deviggedOddAway} = devig(oddHome, oddAway);
                    ev2(evs, evCutoff, sport, match, market, deviggedOddHome, oddHome);
                    ev2(evs, evCutoff, sport, match, market, deviggedOddAway, oddAway);
                } else{
                    // log.write(`Failure! oddHome is ${oddHome}. oddAway is ${oddAway} Probably could not find a pair in a handicap market.`);
                }
                if(oddHome){ processed.push(oddHome); }
                if(oddAway){ processed.push(oddAway); }
            }
            marketReport = `Considered ${consideredArbCount} Arbs, ${arbs.length} of them were positive\n`
        } else if(market.name?.includes('Total') || market.name?.includes('Map Duration')){
            /* total/duration type market with oddNames of the format: 'over14.5', 'under14.5', 'over33', etc. */
            /* note that markets with the name 'Total Rounds Odd/Even' should already be caught ealier because they are supposed to only have 2 odds */
            let processed = [];
            while(odds.length !== processed.length){
                let oddHome;
                let oddAway;
                for(let i = 0; i < odds.length; i++){
                    if( !processed.includes(odds[i])){
                        oddHome = odds[i];
                        break;
                    }
                }
                for(let i = 1; i < odds.length; i++){
                    if(oddHome.name.includes('over')){
                        const t1 = parseFloat(oddHome.name.replace('over', '')); // the left total value t1
                        if(odds[i].name.includes('under') && ( parseFloat(odds[i].name.replace('under', '')) === t1 )){
                            oddAway = odds[i];
                            break;
                        } else{
                            continue;
                        }
                    } else if(oddHome.name.includes('under') ){
                        const t1 = parseFloat(oddHome.name.replace('under', '')); // the left total value t1
                        if(odds[i].name.includes('over') && ( parseFloat(odds[i].name.replace('over', '')) === t1 )){
                            oddAway = odds[i];
                            break;
                        } else{
                            continue;
                        }
                    } else{
                        /* invalid odd name */
                    }
                }
                if(oddHome && oddAway){
                    arb2(arbs, arbCutoff, sport, match, market, oddHome, oddAway);
                    const {deviggedOddHome, deviggedOddAway} = devig(oddHome, oddAway);
                    ev2(evs, evCutoff, sport, match, market, deviggedOddHome, oddHome);
                    ev2(evs, evCutoff, sport, match, market, deviggedOddAway, oddAway);
                } else{
                    // log.write(`Failure! oddHome is ${oddHome}. oddAway is ${oddAway} Probably could not find a pair in a handicap market.`);
                }
                if(oddHome){ processed.push(oddHome); }
                if(oddAway){ processed.push(oddAway); }
            }
            marketReport = `Considered ${consideredArbCount} Arbs, ${arbs.length} of them were positive\n`
        } else if(market.name?.includes('Correct Score')){
            /* correct-score market can be a
            for a BO1 2-way(synonymous with Match Winner), 
            for a BO3 4-way
            for a BO5 6-way 
            ...
            however for now I assume that this market will only appear in a BO3 games
            TODO expand for different modes. It should not crash regardless of if other modes are supported yet.
            ...
            oddNames are of the following format: '2:0', '1:2', etc.
            */
            if(odds.length == 4){ // BO3 4-way marketa
                arb4(arbs, arbCutoff, sport, match, market, odds[0], odds[1], odds[2], odds[3]);
            } else{ // B05+ not supported yet
                marketReport = `Failure! calcMarket cannot handle this Correct Score market: '${market.name}'. Incorrect number of odds: ${odds.length}.
                Expected: supported={4}, not supported={6,8,10...}\n`;
            }
        } else{
            /* currently not supported/not-arbable market types include:
            - Kill Maker:   not-arbable
             */
            marketReport = `Failure! calcMarket cannot handle the following market: '${market.name}'. Incorrect number of odds: ${odds.length}.\n`;
        }
    }
    // console.log(marketReport);
}

import { cleanupOnDatetime, cleanupData } from "./maintain.js";
export async function calcSports(arbCutoff = 0.0,  evCutoff = 0.0){
    
    const logFilePath = './calc/log.txt';
    try{
        log = createWriteStream(logFilePath, {flags: 'a'});
    } catch(error){
        console.error(`Failure! Cannot open file under ${logFilePath}`);
    }
    
    log.write('Opening files...\n');
    const dataFilePath = './data/data_out.json'
    let data = JSON.parse(readFileSync(dataFilePath));
    log.write(`Loaded data from ${dataFilePath}\n`);

    const arbsFilePath = './data/arbs.json';
    let arbs = [];
    if(existsSync(arbsFilePath)) {
        arbs = JSON.parse(readFileSync(arbsFilePath));
        log.write(`Loaded data from ${arbsFilePath}\n`);
    } else {
        log.write(`File does not exist ${arbsFilePath}. Starting with empty\n`);
    }
    const evsFilePath = './data/evs.json';
    let evs = [];
    if(existsSync(evsFilePath)) {
        evs = JSON.parse(readFileSync(evsFilePath));
        log.write(`Loaded data from ${evsFilePath}\n`);
    } else {
        log.write(`File does not exist ${evsFilePath}. Starting with empty\n`);
    }

    let ret;
    ret = cleanupOnDatetime(arbs);    
    log.write(`Maintaining the file ${arbsFilePath} finished. ${ret} entries sliced.\n`);
    ret = cleanupOnDatetime(evs);    
    log.write(`Maintaining the file ${evsFilePath} finished. ${ret} entries sliced.\n`);
    ret = cleanupData(data);
    log.write(`Maintaining the file ${dataFilePath} finished. ${ret} entries sliced.\n`);
    
    consideredArbCount = 0;
    consideredEvCount = 0;
    for(const sport of data.sports){
        log.write(`Processing sport: ${sport.name}\n`);
            for(const match of sport.matches){
                log.write(`Processing match: ${match.teamHome} vs ${match.teamAway}, ${match.datetime}\n`);
                for(const market of match.markets){
                    calcMarket({arbs, evs}, {arbCutoff, evCutoff}, sport, match, market);
                }
            }
        }
    log.write(`Finished. ${consideredArbCount} arbs considered. ${arbs.length} positive.\n`)
    log.write(`Finished. ${consideredEvCount} evs considered. ${evs.length} positive.\n`)

    if(arbs.length > 0){
        arbs.sort((a, b) => {
            const agT = prettyToDate(a.datetime)?.getTime();
            const bgT = prettyToDate(b.datetime)?.getTime();
            return agT - bgT;
        });
    }
    log.write(`Sorted arbs by datetime, ascending.\n`)
    if(evs.length > 0){
        evs.sort( (a, b) => {
            const agT = prettyToDate(a.datetime)?.getTime();
            const bgT = prettyToDate(b.datetime)?.getTime();
            return agT - bgT;
        });
    }
    log.write(`Sorted evs by datetime, ascending.\n`)

    log.write(`Writing the results to ${arbsFilePath}\n`);
    writeFileSync(arbsFilePath, JSON.stringify(arbs, null, 2));
    log.write(`Writing the results to ${evsFilePath}\n`);
    writeFileSync(evsFilePath, JSON.stringify(evs, null, 2));
    log.write(`Writing to file ${dataFilePath}\n`);
    writeFileSync(dataFilePath, JSON.stringify(data, null, 2));

    await promisify(log.end).bind(log);
    return `arbCutoff is ${arbCutoff}, evCutoff is ${evCutoff}\nconsideredArbs=${consideredArbCount} of which ${arbs.length} higher than cutoff\nconsideredEvs=${consideredEvCount}, of which ${evs.length} higher than cutoff\n`;
}
