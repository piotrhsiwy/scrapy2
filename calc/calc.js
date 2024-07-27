import { createWriteStream, readFileSync, writeFileSync } from "fs"
import { dateISO8601Prettify } from "../books/util/datetimeISO8601Prettify.js";

let log;
let consideredArbCount = 0;
let positiveArbCount = 0;
let arbs = [];

function arb2(sport, tournament, match, market, oddHome, oddAway, books){
    for(const coefHome of oddHome.coefs.filter(c => books.includes(c.book))){
        for(const coefAway of oddAway.coefs.filter(c => books.includes(c.book))){
            if(coefAway.book === coefHome.book){ continue; } // excludes self-arbs from the consideration
            const arb = 1.0 - (1/coefHome.value + 1/coefAway.value);
            if(arb > 0.0){
                let newArb = {
                    "timestamp (calculated)":dateISO8601Prettify(new Date().toISOString()),
                    "value":arb,
                    "sport":sport.name,
                    "tournament":tournament.name,
                    "teamHome":match.teamHome,
                    "teamAway":match.teamAway,
                    "datetime":dateISO8601Prettify(match.datetime),
                    "market":market.name,
                    "Home":{
                        "oddName:":oddHome.name,
                        "book":coefHome.book,
                        "url":match.urls.find( item => item.book === coefHome.book ),
                    },
                    "Away":{
                        "oddName:":oddAway.name,
                        "book":coefAway.book,
                        "url":match.urls.find( item => item.book === coefAway.book ),
                    }
                };
                positiveArbCount++;
                arbs.push(newArb);
            }
            consideredArbCount++;
            const arbReport =  
                `${oddHome.name.padEnd(20,' ')}@${coefHome.value} on ${coefHome.book.padEnd(20,' ')} - ${oddAway.name.padEnd(20,' ')}@${coefAway.value} on ${coefAway.book.padEnd(20,' ')}, ${arb} arb.\n`;
            log.write(arbReport);
        }
    }
}

function calcMarket(sport, tournament, match, market, books){

    let marketReport;

    log.write(`Processing market: ${market.name}\n`)
    let odds = market.odds;
    if(odds.length <= 1){
        marketReport = `Failure! calcMarket cannot handle the following market: '${market.name}'. Incorrect number of odds: ${odds.length}.\n`;
    } else if   (odds.length == 2){
        /* normal binary market */
        let oddHome = market.odds[0];
        let oddAway = market.odds[1];
        if(oddHome && oddAway){
            arb2(sport, tournament, match, market, oddHome, oddAway, books);
        } else{
            log.write(`Failure! oddHome is ${oddHome}. oddAway is ${oddAway} Probably could not find a pair in a normal binary market.`);
        }
        marketReport = positiveArbCount > 0 ?
            `Considered ${consideredArbCount} Arbs, ${positiveArbCount} of them were positive\n`
            : `Considered ${consideredArbCount} Arbs, none of them were profitable\n`
    } else{//    odds.length >= 3
        if(market.name.includes('Handicap')){
            /* handicap market with oddNames of the format: "Virtus.pro -2.5" */
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
                    if(
                        oddHome.name.split(' ')[0] !== odds[i].name.split(' ')[0] &&
                        parseFloat(oddHome.name.split(' ')[1]) === -1.0 * parseFloat(odds[i].name.split(' ')[1]) &&
                        !processed.includes(odds[i])
                    ){
                        oddAway = odds[i];
                        break;
                    }
                }
                if(oddHome && oddAway){
                    arb2(sport, tournament, match, market, oddHome, oddAway, books);
                } else{
                    log.write(`Failure! oddHome is ${oddHome}. oddAway is ${oddAway} Probably could not find a pair in a handicap market.`);
                }
                processed.push(oddHome);
                processed.push(oddAway);
            }
            marketReport = positiveArbCount > 0 ?
                `Considered ${consideredArbCount} Arbs, ${positiveArbCount} of them were positive\n`
                : `Considered ${consideredArbCount} Arbs, none of them were profitable\n`
        } else if(market.name.includes('First to reach')){
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
                    if(
                        oddHome.name.split(' ')[0] !== odds[i].name.split(' ')[0] &&
                        parseInt(oddHome.name.split(' ')[1]) === parseInt(odds[i].name.split(' ')[1]) &&
                        !processed.includes(odds[i])
                    ){
                        oddAway = odds[i];
                        break;
                    }
                }
                if(oddHome && oddAway){
                    arb2(sport, tournament, match, market, oddHome, oddAway, books);
                } else{
                    log.write(`Failure! oddHome is ${oddHome}. oddAway is ${oddAway} Probably could not find a pair in a first-to-reach market.`);
                }
                processed.push(oddHome);
                processed.push(oddAway);
            }
            marketReport = positiveArbCount > 0 ?
                `Considered ${consideredArbCount} Arbs, ${positiveArbCount} of them were positive\n`
                : `Considered ${consideredArbCount} Arbs, none of them were profitable\n`
        } else{
            marketReport = `Failure! calcMarket cannot handle the following market: '${market.name}'. Incorrect number of odds: ${odds.length}.\n`;
        }
    }
    log.write(marketReport);
}

export function arbSports(books){

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

    for(const sport of data.sports){
        log.write(`Processing sport: ${sport.name}\n`);
        for(const tournament of sport.tournaments){
            log.write(`Processing tournament: ${tournament.name}\n`);
                for(const match of tournament.matches){
                    log.write(`Processing match: ${match.teamHome} vs ${match.teamAway}, ${match.datetime}\n`);
                    for(const market of match.markets){
                        calcMarket(sport, tournament, match, market, books);
                    }
                    log.write(`Done processing match: ${match.teamHome} vs ${match.teamAway}, ${match.datetime}\n`);
                }
            log.write(`Done processing tournament: ${tournament.name}\n`);
        }
        log.write(`Done processing sport: ${sport.name}\n`);
    }
    log.write(`Finished. ${consideredArbCount} arbs considered. ${arbs.length} positive.\n`)

    const arbFilePath = './data/arbs.json';
    log.write(`Writing the results to ${arbFilePath}\n`);
    writeFileSync(arbFilePath, JSON.stringify(arbs, null, 2));
    return arbs;
}
