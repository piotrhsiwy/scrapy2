import { createWriteStream, readFileSync, writeFileSync } from "fs"
import { promisify } from "util";
import { dateISO8601Prettify } from "../data/util/prettify.js";

let log;
let consideredArbCount;
let positiveArbCount;
let consideredEvCount;
let positiveEvCount;

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

function arb4(arbs, sport, match, market, oddA, oddB, oddC, oddD){
    for(const A of oddA.coefs){
        for(const B of oddB.coefs){
            for(const C of oddC.coefs){
                for(const D of oddD.coefs){
                    // TODO checking it h ere is not efficient. You can check it on the way when entering loops
                    if( isMultiSelfArb([A, B, C, D]) ){ // exclude self-arb from the consideration
                        continue;
                    }
                    const arb = 1.0 - (1/A.value + 1/B.value + 1/C.value + 1/D.value);
                    if(arb > 0.0){
                        let newArb = {
                            "timestamp (calculated)":dateISO8601Prettify(new Date().toISOString()),
                            "value":arb,
                            "sport":sport.name,
                            // "tournament":tournament.name,
                            "teamHome":match.teamHome,
                            "teamAway":match.teamAway,
                            "datetime":dateISO8601Prettify(match.datetime),
                            "market":market.name,
                            "oddA":{
                                "oddName":oddA.name,
                                "oddValue":A.value,
                                "book":A.book,
                                "url":match.urls.find( item => item.book === A.book ).url,
                            },
                            "oddB":{
                                "oddName":oddB.name,
                                "oddValue":B.value,
                                "book":B.book,
                                "url":match.urls.find( item => item.book === B.book ).url,
                            },
                            "oddC":{
                                "oddName":oddC.name,
                                "oddValue":C.value,
                                "book":C.book,
                                "url":match.urls.find( item => item.book === C.book ).url,
                            },
                            "oddD":{
                                "oddName":oddD.name,
                                "oddValue":D.value,
                                "book":D.book,
                                "url":match.urls.find( item => item.book === D.book ).url,
                            },
                        };
                        if(!arbs.some( a => 
                           a.value         === newArb.value         &&
                           a.sport         === newArb.sport         &&
                           a.teamHome      === newArb.teamHome      &&
                           a.teamAway      === newArb.teamAway      &&
                           a.datetime      === newArb.datetime      &&
                           a.market        === newArb.market        &&
                           a.oddA.oddName  === newArb.oddA.oddName  &&
                           a.oddA.oddValue === newArb.oddA.oddValue &&
                           a.oddA.book     === newArb.oddA.book     &&
                           a.oddA.url      === newArb.oddA.url      &&
                           a.oddB.oddName  === newArb.oddB.oddName  &&
                           a.oddB.oddValue === newArb.oddB.oddValue &&
                           a.oddB.book     === newArb.oddB.book     &&
                           a.oddB.url      === newArb.oddB.url      &&
                           a.oddC.oddName  === newArb.oddC.oddName  &&
                           a.oddC.oddValue === newArb.oddC.oddValue &&
                           a.oddC.book     === newArb.oddC.book     &&
                           a.oddC.url      === newArb.oddC.url      &&
                           a.oddD.oddName  === newArb.oddD.oddName  &&
                           a.oddD.oddValue === newArb.oddD.oddValue &&
                           a.oddD.book     === newArb.oddD.book     &&
                           a.oddD.url      === newArb.oddD.url
                        ) && !newArb.datetime.includes('live')){
                        /* only if the arb is fresh, to give meaning to timestamps */
                            positiveArbCount++;
                            arbs.push(newArb);
                        }
                        const arbReport =  
                            `${oddA.name.padEnd(20,' ')}@${A.value} on ${A.book.padEnd(20,' ')} - ${oddB.name.padEnd(20,' ')}@${B.value} on ${B.book.padEnd(20,' ')} - ${oddC.name.padEnd(20,' ')}@${C.value} on ${C.book.padEnd(20,' ')} -  ${oddD.name.padEnd(20,' ')}@${D.value} on ${D.book.padEnd(20,' ')}, ${arb} arb.\n`;
                        log.write(arbReport);
                    }
                    consideredArbCount++;
                }
            }
        }
    }
}

function arb2(arbs, sport, match, market, oddHome, oddAway){
    for(const coefHome of oddHome.coefs){
        for(const coefAway of oddAway.coefs){
            if(coefAway.book === coefHome.book){ // excludes self-arbs from the consideration
                continue;
            }
            const arb = 1.0 - (1/coefHome.value + 1/coefAway.value);
            if(arb > 0.0){
                let newArb = {
                    "timestamp (calculated)":dateISO8601Prettify(new Date().toISOString()),
                    "value":arb,
                    "sport":sport.name,
                    // "tournament":tournament.name,
                    "teamHome":match.teamHome,
                    "teamAway":match.teamAway,
                    "datetime":dateISO8601Prettify(match.datetime),
                    "market":market.name,
                    "Home":{
                        "oddName":oddHome.name,
                        "oddValue":coefHome.value,
                        "book":coefHome.book,
                        "url":match.urls.find( item => item.book === coefHome.book ).url,
                    },
                    "Away":{
                        "oddName":oddAway.name,
                        "oddValue":coefAway.value,
                        "book":coefAway.book,
                        "url":match.urls.find( item => item.book === coefAway.book ).url,
                    }
                };
                if(!arbs.some( a => 
                    a.value         === newArb.value        &&
                    a.sport         === newArb.sport        &&
                    a.teamHome      === newArb.teamHome     &&
                    a.teamAway      === newArb.teamAway     &&
                    a.datetime      === newArb.datetime     &&
                    a.market        === newArb.market       &&
                    a.Home.oddName  === newArb.Home.oddName &&
                    a.Home.oddValue === newArb.Home.oddValue&&
                    a.Home.book     === newArb.Home.book    &&
                    a.Home.url      === newArb.Home.url     &&
                    a.Away.oddName  === newArb.Away.oddName &&
                    a.Away.oddValue === newArb.Away.oddValue&&
                    a.Away.book     === newArb.Away.book    &&
                    a.Away.url      === newArb.Away.url
                ) && !newArb.datetime.includes('live')){ // arbs.push() only prematch arbs
                    /* only if the arb is fresh, to give meaning to timestamps */
                    arbs.push(newArb);
                    positiveArbCount++;
                }
                const arbReport =  
                    `${oddHome.name.padEnd(20,' ')}@${coefHome.value} on ${coefHome.book.padEnd(20,' ')} - ${oddAway.name.padEnd(20,' ')}@${coefAway.value} on ${coefAway.book.padEnd(20,' ')}, ${arb} arb.\n`;
                log.write(arbReport);
            }
            consideredArbCount++;
        }
    }
}

function meanArray(arr){
    let acc = 0.0;
    arr.forEach( v => { acc+=v; });
    return acc/arr.length;
}

function meanArrayExcluding(arr, value){
    let acc = 0.0;
    arr.forEach( v => { acc+=v; });
    return (acc-value)/(arr.length-1);
}

function stdDevArray(values){
    const mean = meanArray(values);
    const dev = values.map( v => Math.pow(v-mean, 2));
    let devSum = 0.0;
    dev.map( d => devSum += d );
    const stdDev = Math.sqrt( ( 1/( values.length-1 ) ) * devSum );
    return stdDev;
}

function evStrength(a, b){
    return (1/a - 1/b);
}

function ev2(evs, sport, match, market, odd){
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
            const cutoff = -0.07;
            if(strength < cutoff){
                const book = odd.coefs.find(c => c.value = v).book;
                const url = match.urls.find( u => u.book === book ).url;
                let newEv = {
                    "timestamp (calculated)":dateISO8601Prettify(new Date().toISOString()),
                    "value":v,
                    "values":valuesNoNull,
                    "mean":mean,
                    "stdDev":stdDevArray(valuesNoNull),
                    "deviationInTermsOfStdDev":Math.abs((v-mean)/stdDevArray(valuesNoNull)),
                    "strength":strength,
                    "sport":sport.name,
                    // "tournament":tournament.name,
                    "teamHome":match.teamHome,
                    "teamAway":match.teamAway,
                    "datetime":dateISO8601Prettify(match.datetime),
                    "market":market.name,
                    "odd":{
                        "oddName":odd.name,
                        "oddValue":v,
                        "book":book,
                        "url":url,
                    },
                };
                if(!evs.some( e => 
                    e.value                     === newEv.value                    && 
                    e.mean                      === newEv.mean                     && 
                    e.stdDev                    === newEv.stdDev                   && 
                    e.deviationInTermsOfStdDev  === newEv.deviationInTermsOfStdDev && 
                    e.strength                  === newEv.strength                 && 
                    e.sport                     === newEv.sport                    && 
                    e.teamHome                  === newEv.teamHome                 && 
                    e.teamAway                  === newEv.teamAway                 && 
                    e.datetime                  === newEv.datetime                 && 
                    e.market                    === newEv.market                   && 
                    e.odd.oddName               === newEv.odd.oddName              && 
                    e.odd.oddValue              === newEv.odd.oddValue             && 
                    e.odd.book                  === newEv.odd.book                 && 
                    e.odd.url                   === newEv.odd.url
                ) && !newEv.datetime.includes('live')){
                    /* ev is fresh */
                    evs.push(newEv);
                    positiveEvCount++;
                }
            }
            consideredEvCount++;
        }
    }
    // log.write(`potentialArbWithMean: ${potentialArbWithMean}\n`);
}

function calcMarket(arbs, evs, sport, match, market){

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
            arb2(arbs, sport, match, market, oddHome, oddAway);
            ev2(evs, sport, match, market, oddHome);
            ev2(evs, sport, match, market, oddAway);
        } else{
            // log.write(`Failure! oddHome is ${oddHome}. oddAway is ${oddAway} Probably could not find a pair in a normal binary market.`);
        }
        marketReport = positiveArbCount > 0 ?
            `Considered ${consideredArbCount} Arbs, ${positiveArbCount} of them were positive\n`
            : `Considered ${consideredArbCount} Arbs, none of them were profitable\n`
    } else{//    odds.length >= 3
        if(market.name.includes('Handicap')){
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
                    arb2(arbs, sport, match, market, oddHome, oddAway);
                    ev2(evs, sport, match, market, oddHome);
                    ev2(evs, sport, match, market, oddAway);
                } else{
                    // log.write(`Failure! oddHome is ${oddHome}. oddAway is ${oddAway} Probably could not find a pair in a handicap market.`);
                }
                if(oddHome){ processed.push(oddHome); }
                if(oddAway){ processed.push(oddAway); }
            }
            marketReport = positiveArbCount > 0 ?
                `Considered ${consideredArbCount} Arbs, ${positiveArbCount} of them were positive\n`
                : `Considered ${consideredArbCount} Arbs, none of them were profitable\n`
        } else if(market.name.includes('First to Reach')){
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
                    arb2(arbs, sport, match, market, oddHome, oddAway);
                    ev2(evs, sport, match, market, oddHome);
                    ev2(evs, sport, match, market, oddAway);
                } else{
                    // log.write(`Failure! oddHome is ${oddHome}. oddAway is ${oddAway} Probably could not find a pair in a handicap market.`);
                }
                if(oddHome){ processed.push(oddHome); }
                if(oddAway){ processed.push(oddAway); }
            }
            marketReport = positiveArbCount > 0 ?
                `Considered ${consideredArbCount} Arbs, ${positiveArbCount} of them were positive\n`
                : `Considered ${consideredArbCount} Arbs, none of them were profitable\n`
        } else if(market.name.includes('Total') || market.name.includes('Map Duration')){
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
                    arb2(arbs, sport, match, market, oddHome, oddAway);
                    ev2(evs, sport, match, market, oddHome);
                    ev2(evs, sport, match, market, oddAway);
                } else{
                    // log.write(`Failure! oddHome is ${oddHome}. oddAway is ${oddAway} Probably could not find a pair in a handicap market.`);
                }
                if(oddHome){ processed.push(oddHome); }
                if(oddAway){ processed.push(oddAway); }
            }
            marketReport = positiveArbCount > 0 ?
                `Considered ${consideredArbCount} Arbs, ${positiveArbCount} of them were positive\n`
                : `Considered ${consideredArbCount} Arbs, none of them were profitable\n`
        } else if(market.name.includes('Correct Score')){
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
                arb4(arbs, sport, match, market, odds[0], odds[1], odds[2], odds[3]);
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
    // log.write(marketReport);
}

export async function calcSports(arbs, evs){
    
    const logFilePath = './calc/log.txt';
    try{
        log = createWriteStream(logFilePath, {flags: 'a'});
    } catch(error){
        console.error(`Failure! Cannot open file under ${logFilePath}`);
    }
    
    log.write('Opening files...\n');
    const dataFilePath = './data/data_out.json'
    const data = JSON.parse(readFileSync(dataFilePath));
    log.write(`Loaded data from ${dataFilePath}\n`);
    
    
    consideredArbCount = 0;
    positiveArbCount = 0;
    consideredEvCount = 0;
    positiveEvCount = 0;
    for(const sport of data.sports){
        log.write(`Processing sport: ${sport.name}\n`);
            for(const match of sport.matches){
                log.write(`Processing match: ${match.teamHome} vs ${match.teamAway}, ${match.datetime}\n`);
                for(const market of match.markets){
                    calcMarket(arbs, evs, sport, match, market);
                }
            }
        }
    log.write(`Finished. ${consideredArbCount} arbs considered. ${arbs.length} positive.\n`)
    log.write(`Finished. ${consideredEvCount} evs considered. ${evs.length} stronger than cutoff.\n`)

    arbs.sort((a, b) => b.value - a.value);
    evs.sort((a, b) => a.strength - b.strength);

    const arbFilePath = './data/arbs.json';
    log.write(`Writing the results to ${arbFilePath}\n`);
    writeFileSync(arbFilePath, JSON.stringify(arbs, null, 2));
    const evsFilePath = './data/evs.json';
    log.write(`Writing the results to ${evsFilePath}\n`);
    writeFileSync(evsFilePath, JSON.stringify(evs, null, 2));

    await promisify(log.end).bind(log);
    return `consideredArbs=${consideredArbCount}, *new*positiveArbs=${positiveArbCount}\nconsideredEvs=${consideredEvCount}, *new*positiveEvs=${positiveEvCount}`;
}