import { createWriteStream, existsSync, readFileSync, writeFileSync } from "fs"
import { promisify } from "util";
import { getMarketName, getMarketType, getOddWithBrothers, getOdds, getOpposite2, getMatching4CS, getOppositeHdp, getOddsTimeframe } from "../data/db/getter.js";
import { insertArb, insertEv, insertReport } from "../data/db/inserter.js";

let log;
let consideredArbCount;
let consideredEvCount;

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

function arbArray4(withBrothers){

    function arb4(A, B, C, D){
        const value = 1.0 - (1/A.value + 1/B.value + 1/C.value + 1/D.value);
        if(value > 0.0){
            return {odd_idsArray:[A.odd_id, B.odd_id, C.odd_id, D.odd_id], value: value};
        } else{
            return undefined;
        }
    }
    
    const ret = [];
    for(const A of withBrothers[0]){
        for(const B of withBrothers[1]){
            for(const C of withBrothers[2]){
                for(const D of withBrothers[3]){
                    const arb = arb4(A, B, C, D);
                    if(arb){
                        ret.push(arb);
                    }
                }
            }
        }
    }
    return ret;
}

function arbArray2(withBrothers, oppositeBrothers){

    function arb2(a, b){
        const value = 1.0 - (1/a.value + 1/b.value);
        if(value > 0.0){
            return {odd_idsArray:[a.odd_id, b.odd_id], value: value};
        } else{
            return undefined;
        }
    }

    const ret = [];
    for(const a of withBrothers){
        for(const b of oppositeBrothers){
            const arb = arb2(a, b);
            if(arb){
                ret.push(arb);
            }
        }
    }
    return ret;
}

function evArray2(A, B){

    function devigVal(a, b){
        const edgeOneside = (1/a + 1/b - 1)/2
        const retA = 1/(1/a - edgeOneside);
        const retB = 1/(1/b - edgeOneside);
        return {retA, retB};
    }

    function devigBothSides(A, B){
        let devigA = structuredClone(A);
        let devigB = structuredClone(B);
        const dirtyBindices = new Set();
        for(let i = 0; i < A.length; i++){
            const a = A[i];
            const j = B.findIndex( e => e.book === a.book);
            const b = B[j];
            if(j != -1 && !dirtyBindices.has(j)){
                // TODO do this on insert in db
                dirtyBindices.add(j);
                const {retA:adevigged, retB:bdevigged} = devigVal(a.value, b.value);
                devigA[i].value = adevigged;
                devigB[j].value = bdevigged;
            }
        }
        return {devigA, devigB};
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

    function stdDevArray(values){
        const mean = meanArray(values);
        const dev = values.map( v => Math.pow(v-mean, 2));
        let devSum = 0.0;
        dev.forEach( d => devSum += d );
        const stdDev = Math.sqrt( ( 1/( values.length ) ) * devSum );
        return stdDev;
    }

    function stdDevArrayExcluding(arr, val){
        const index = arr.findIndex(e => e === val); 
        arr.splice(index, 1);
        const mean = meanArray(arr);
        const dev = arr.map( v => Math.pow(v-mean, 2));
        let devSum = 0.0;
        dev.forEach( d => devSum += d );
        const stdDev = Math.sqrt( ( 1/( arr.length ) ) * devSum );
        return stdDev;
    }

    function evStrength(a, b){
        return (1/a - 1/b);
    }

    const ret = []; 
    const {devigA, devigB} = devigBothSides(A, B);
    for(let i = 0; i < devigA.length; i++){
        // TODO can offload some of those to db
        const values = devigA.map(e => e.value)
        const v = devigA[i].value;
        const mean = meanArrayExcluding(values, v)
        const strength = evStrength(v, mean)
        if(strength < 0.0){
            const odd_id = A[i].odd_id;
            const stdDev = stdDevArrayExcluding(values.map(v => 1/v), 1/v);
            const probDeviationInTermsOfStdDev = Math.abs((1/v-1/mean)/stdDev);
            ret.push({
                odd_id: odd_id,
                strength: strength,
                probDeviationInTermsOfStdDev: probDeviationInTermsOfStdDev,
            });
        }
    }
    for(let i = 0; i < devigB.length; i++){
        // TODO can offload some of those to db
        const values = devigB.map(e => e.value)
        const v = devigB[i].value;
        const mean = meanArrayExcluding(values, v)
        const strength = evStrength(v, mean)
        if(strength < 0.0){
            const odd_id = B[i].odd_id;
            const stdDev = stdDevArrayExcluding(values.map(v => 1/v), 1/v);
            const probDeviationInTermsOfStdDev = Math.abs((1/v-1/mean)/stdDev);
            ret.push({
                odd_id: odd_id,
                strength: strength,
                probDeviationInTermsOfStdDev: probDeviationInTermsOfStdDev,
            });
        }
    }
    return ret;
    
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

export async function calcTimeframe(timeframe){
    const logFilePath = './calc/log.txt';
    try{
        log = createWriteStream(logFilePath, {flags: 'a'});
    } catch(error){
        console.error(`Failure! Cannot open file under ${logFilePath}`);
    }
    
    let arbsCount = 0;
    let evsCount = 0;
    let start = performance.now();

    const odds = await getOddsTimeframe(timeframe);
    log.write(`Fetched ${odds.length} entries from odds\n`);
    let dirtyOdds = new Set();
    for(let i = 0; i < odds.length; i++){
        const odd = odds[i];
        const odd_id = odd.odd_id;
        if(dirtyOdds.has(odd_id)){
            continue;
        }
        const marketType = await getMarketType(odd_id);
        
        if(marketType.length === 2){
            // binary (2-way) market, like 'Match Winner'
            const opposite = await getOpposite2(odd_id);
            const oppositeWithBrothers = await getOddWithBrothers(opposite.odd_id);
            const withBrothers = await getOddWithBrothers(odd_id);

            const arbs = arbArray2(withBrothers, oppositeWithBrothers);
            for(const arb of arbs){
                const {arb_id:arb_id, is_new:arb_is_new} = await insertArb(log, arb.odd_idsArray, arb.value);
            }
            arbsCount += arbs.length;

           // only markets that have 3 or more entries for each odd are relevant for evs
            if(withBrothers.length >= 3 && oppositeWithBrothers.length >= 3){
                const evs = evArray2(withBrothers, oppositeWithBrothers);
                for(const ev of evs){
                    const {ev_id:ev_id, is_new:ev_is_new} = await insertEv(log, ev.odd_id, ev.strength, ev.probDeviationInTermsOfStdDev);
                }
                evsCount += evs.length;
            }

            for(const odd_id of withBrothers.concat(oppositeWithBrothers).map(e => e.odd_id)){
                dirtyOdds.add(odd_id);
            }

        } else if(marketType.length === 4){
            // 4-way market, like 'Correct Score' on a BO3 game
            const marketName = await getMarketName(odd_id);
            if(marketName.includes('Handicap')){
                /* 
                    handicap market with oddNames of the format: "vitality-2.5", "g22.5"
                    CARE: teamName can end with a number like in "g21.5"
                    this is to be evaluated like a binary market after the opposites are found
                */
                const opposite = await getOppositeHdp(odd_id);
                if(!opposite){ // safeguard added to prevent crashing when opposite fails (it failed on incorrect oddNames, because they contained REGEX special chars)
                    dirtyOdds.add(odd_id);
                    continue;
                }
                const oppositeWithBrothers = await getOddWithBrothers(opposite.odd_id);
                const withBrothers = await getOddWithBrothers(odd_id);

                const arbs = arbArray2(withBrothers, oppositeWithBrothers);
                for(const arb of arbs){
                    const {arb_id:arb_id, is_new:arb_is_new} = await insertArb(log, arb.odd_idsArray, arb.value);
                }

                const evs = evArray2(withBrothers, oppositeWithBrothers);
                for(const ev of evs){
                    const {ev_id:ev_id, is_new:ev_is_new} = await insertEv(log, ev.odd_id, ev.strength, ev.probDeviationInTermsOfStdDev);
                }

                for(const odd_id of withBrothers.concat(oppositeWithBrothers).map(e => e.odd_id)){
                    dirtyOdds.add(odd_id);
                }

            } else if(marketName.includes('Correct Score')){
                /* 
                    4-way correct score market with oddNames of the format: "0:2", "1:2", "2:1", "2:0"
                */
                const matching = await getMatching4CS(odd_id);
                const matchingWithBrothers = await Promise.all(matching.map(async o => await getOddWithBrothers(o.odd_id)));
                const arbs = arbArray4(matchingWithBrothers);
                for(const arb of arbs){
                    const {arb_id:arb_id, is_new:arb_is_new} = await insertArb(log, arb.odd_idsArray, arb.value);
                }

                for(const odd_id of matchingWithBrothers.flat().map(e => e.odd_id)){
                    dirtyOdds.add(odd_id);
                }

                // TODO ev
            } else{
                dirtyOdds.add(odd_id);
            }


        // } else if(market.name?.includes('First to Reach')){
                /* first-to-reach market with oddNames of the format: "Virtus.pro 5" */

        // } else if(market.name?.includes('Total') || market.name?.includes('Map Duration')){
            /* total/duration type market with oddNames of the format: 'over14.5', 'under14.5', 'over33', etc. */
            /* note that markets with the name 'Total Rounds Odd/Even' should already be caught ealier because they are supposed to only have 2 odds */


        } else{
            // TODO more than 4-way markets
            dirtyOdds.add(odd_id);
        }
    }

    let end = performance.now();

    const report_id = await insertReport(
        log,
        {
            arbsCount: arbsCount, 
            evsCount: evsCount, 
            oddsCount: odds.length,
            durationinms: end - start
        }
    );

    await promisify(log.end).bind(log);
    return report_id;
}

export async function calcAll(){

    const logFilePath = './calc/log.txt';
    try{
        log = createWriteStream(logFilePath, {flags: 'a'});
    } catch(error){
        console.error(`Failure! Cannot open file under ${logFilePath}`);
    }
    
    let arbsCount = 0;
    let evsCount = 0;
    let start = performance.now();

    const odds = await getOdds();
    log.write(`Fetched ${odds.length} entries from odds\n`);
    let dirtyOdds = new Set();
    for(let i = 0; i < odds.length; i++){
        const odd = odds[i];
        const odd_id = i;
        if(dirtyOdds.has(odd_id)){
            continue;
        }
        const marketType = await getMarketType(odd_id);

        
        if(marketType.length === 2){
            // binary (2-way) market, like 'Match Winner'
            const opposite = await getOpposite2(odd_id);
            const oppositeWithBrothers = await getOddWithBrothers(opposite.odd_id);
            const withBrothers = await getOddWithBrothers(odd_id);

            const arbs = arbArray2(withBrothers, oppositeWithBrothers);
            for(const arb of arbs){
                const {arb_id:arb_id, is_new:arb_is_new} = await insertArb(log, arb.odd_idsArray, arb.value);
            }
            arbsCount += arbs.length;

            const evs = evArray2(withBrothers, oppositeWithBrothers);
            for(const ev of evs){
                const {ev_id:ev_id, is_new:ev_is_new} = await insertEv(log, ev.odd_id, ev.strength, ev.probDeviationInTermsOfStdDev);
            }
            evsCount += evs.length;

            for(const odd_id of withBrothers.concat(oppositeWithBrothers).map(e => e.odd_id)){
                dirtyOdds.add(odd_id);
            }

        } else if(marketType.length === 4){
            // 4-way market, like 'Correct Score' on a BO3 game
            const marketName = await getMarketName(odd_id);
            if(marketName.includes('Handicap')){
                /* 
                    handicap market with oddNames of the format: "vitality-2.5", "g22.5"
                    CARE: teamName can end with a number like in "g21.5"
                    this is to be evaluated like a binary market after the opposites are found
                */
                const opposite = await getOppositeHdp(odd_id);
                if(!opposite){ // safeguard added to prevent crashing when opposite fails (it failed on incorrect oddNames, because they contained REGEX special chars)
                    dirtyOdds.add(odd_id);
                    continue;
                }
                const oppositeWithBrothers = await getOddWithBrothers(opposite.odd_id);
                const withBrothers = await getOddWithBrothers(odd_id);

                const arbs = arbArray2(withBrothers, oppositeWithBrothers);
                for(const arb of arbs){
                    const {arb_id:arb_id, is_new:arb_is_new} = await insertArb(log, arb.odd_idsArray, arb.value);
                }

                const evs = evArray2(withBrothers, oppositeWithBrothers);
                for(const ev of evs){
                    const {ev_id:ev_id, is_new:ev_is_new} = await insertEv(log, ev.odd_id, ev.strength, ev.probDeviationInTermsOfStdDev);
                }

                for(const odd_id of withBrothers.concat(oppositeWithBrothers).map(e => e.odd_id)){
                    dirtyOdds.add(odd_id);
                }

            } else if(marketName.includes('Correct Score')){
                /* 
                    4-way correct score market with oddNames of the format: "0:2", "1:2", "2:1", "2:0"
                */
                const matching = await getMatching4CS(odd_id);
                const matchingWithBrothers = await Promise.all(matching.map(async o => await getOddWithBrothers(o.odd_id)));
                const arbs = arbArray4(matchingWithBrothers);
                for(const arb of arbs){
                    const {arb_id:arb_id, is_new:arb_is_new} = await insertArb(log, arb.odd_idsArray, arb.value);
                }

                for(const odd_id of matchingWithBrothers.flat().map(e => e.odd_id)){
                    dirtyOdds.add(odd_id);
                }

                // TODO ev
            } else{
                dirtyOdds.add(odd_id);
            }


        // } else if(market.name?.includes('First to Reach')){
                /* first-to-reach market with oddNames of the format: "Virtus.pro 5" */

        // } else if(market.name?.includes('Total') || market.name?.includes('Map Duration')){
            /* total/duration type market with oddNames of the format: 'over14.5', 'under14.5', 'over33', etc. */
            /* note that markets with the name 'Total Rounds Odd/Even' should already be caught ealier because they are supposed to only have 2 odds */


        } else{
            // TODO more than 4-way markets
            dirtyOdds.add(odd_id);
        }
    }

    let end = performance.now();

    const report_id = await insertReport(
        log,
        {
            arbsCount: arbsCount, 
            evsCount: evsCount, 
            oddsCount: odds.length,
            durationinms: end - start
        }
    );

    await promisify(log.end).bind(log);
    return report_id;
}