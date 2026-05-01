import { createWriteStream, existsSync, readFileSync, writeFileSync } from "fs"
import { promisify } from "util";
import { getMarketName, getMarketType, getOddWithBrothers, getOdds, getOpposite2, getMatching4CS, getOppositeHdp, getOddsTimeframe, getOppositeFTR, getOppositeOU, getNumberBooks } from "../data/db/getter.js";
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
                        if(log) log.write(arbReport);
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

export async function calcTimeframe(timeframe){

    function opposite2(odd, marketType){
        return marketType.find(v => v.name != odd.name);
    }

    function oppositeHdp(odd, marketType){
        ;
    }

    function oppositeFTR(odd, marketType){
        ;
    }
    
    async function handleBinary(getOppositeFunc, marketType){
        while(marketType.length > 0){
            const odd = marketType.pop();
            const odd_id = odd.odd_id;
            const opposite = await getOppositeFunc(odd_id);
            if(opposite == undefined) continue;
            marketType.splice(marketType.findIndex(v => v.name == opposite.name), 1);
            const oppositeWithBrothers = await getOddWithBrothers(opposite.odd_id);
            const withBrothers = await getOddWithBrothers(odd_id);

            // only markets that have 2 or more entries for each odd can be arbed arbs
            if(withBrothers.length >= 2 && oppositeWithBrothers.length >= 2){
                const arbs = arbArray2(withBrothers, oppositeWithBrothers);
                for(const arb of arbs){
                    const {arb_id:arb_id, is_new:arb_is_new} = await insertArb(log, arb.odd_idsArray, arb.value);
                }
                arbsCount += arbs.length;
            }

            // only markets that have 3 or more entries for each odd are relevant for evs
            if(withBrothers.length >= 3 && oppositeWithBrothers.length >= 3){
                const evs = evArray2(withBrothers, oppositeWithBrothers);
                for(const ev of evs){
                    const {ev_id:ev_id, is_new:ev_is_new} = await insertEv(log, ev.odd_id, ev.strength, ev.probDeviationInTermsOfStdDev);
                }
                evsCount += evs.length;
            }
        }
    }

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
    if(log) log.write(`Fetched ${odds.length} entries from odds\n`);
    let dirtyOdds = new Set();
    for(let i = 0; i < odds.length; i++){
        const odd = odds[i];
        const odd_id = odd.odd_id;
        if(dirtyOdds.has(odd_id)){
            continue;
        }

        const marketTypeUngrouped = await getMarketType(odd_id);
        for(const odd_id of marketTypeUngrouped.map(v => v.odd_id)){
            dirtyOdds.add(odd_id);
        }
        const marketType = [];
        marketTypeUngrouped.forEach((u) => {
            if(!marketType.find(v => v.name == u.name)){
                marketType.push(u);
            }
        });
        const marketName = await getMarketName(odd_id);

        const numberBooks = await getNumberBooks(odd_id);
        if(numberBooks < 2){
            continue;
        }
        
        if (
            (
                marketName.includes('Winner') ||
                (marketName.includes('First') && !marketName.includes('First to Reach')) ||
                marketName.includes('More') ||
                // -- yes/no markets
                marketName.includes('Yes/No') ||
                marketName.includes('Both Teams to') ||
                marketName.includes('Overtime') ||
                marketName.includes('Ace') ||
                marketName.includes('to win at least One Map') ||
                // -- odd/even markets
                marketName.includes('Odd/Even')
            )
            && marketType.length === 2 // -- so that the 'incl. Draw' markets do not fall here
        ) {
            // single binary (2-way) market, like 'Match Winner'
            // oddNames of the format: <teamHome> - <teamAway>
            // for the odd/even markets: odd - even             -- this works because the getOpposite function looks for different entry
            // for the yes/no markets: yes - no             -- this works because the getOpposite function looks for different entry
            await handleBinary(getOpposite2, marketType);

        } else if( marketName.includes('Handicap')) {
            // multiple binary (2-way) market, like 'Kills Handicap Map 1'
            // oddNames of the format: '<teamHome><integer>.<integer>' - '<teamAway>-<integer>.<integer>'
            // for example: g21.5 - vitality-1.5
            await handleBinary(getOppositeHdp, marketType);

        } else if ( marketName.includes('First to Reach')) {
            // multiple binary (2-way) market, like 'First to Reach Kills Map 1'
            // oddNames of the format: '<teamHome><integer>' - '<teamAway><integer>'
            // for example: g210 - vitality10
            await handleBinary(getOppositeFTR, marketType);

        } else if ( 
            (marketName.includes('Total') && !marketName.includes('Odd/Even') && !marketName.includes('Handicap')) ||
            marketName.includes('Map Duration')
        ) {
            // multiple binary (2-way) market, like 'Total Kills'
            // oddNames of the format: 'over<integer>.<integer>' - 'under<integer>.<integer>'
            // for example: over10.5 - under10.5
            await handleBinary(getOppositeOU, marketType);

        } else if ( marketName.includes('Winner') && marketName.includes('incl. Draw') && marketType.length === 3) {
            // single 3-way market
            // oddNames of the format: '<teamHome>', '<teamAway>', 'draw'
            // for example: g2, vitality, draw

            //TODO
            console.log(`Handling of market: marketName:${marketName} with markeType.length:${marketType.length} not defined`)

        } else if ( marketName.includes('Correct Score') && marketType.length === 4){
            /* 
                single 4-way market with oddNames of the format: "0:2", "1:2", "2:1", "2:0"
            */
            const matching = await getMatching4CS(odd_id);
            const matchingWithBrothers = await Promise.all(matching.map(async o => await getOddWithBrothers(o.odd_id)));
            const arbs = arbArray4(matchingWithBrothers);
            for(const arb of arbs){
                const {arb_id:arb_id, is_new:arb_is_new} = await insertArb(log, arb.odd_idsArray, arb.value);
            }

            // TODO ev

        } else if ( marketName.includes('Kill Maker') ) {
            // multiple not-arbable market (no defined opposite event) like 'Kill Maker Map 1
            // oddNames of the format: '<teamHome><integer>' - '<teamAway><integer>'
            // for example: g215, g210, vitality15 or vitality10

            //TODO
            console.log(`Handling of market: marketName:${marketName} with markeType.length:${marketType.length} not defined.`)

        } else{
            console.log(`Handling of market: marketName:${marketName} with markeType.length:${marketType.length} not defined`)
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

    if(log) await promisify(log.end).bind(log);
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
    if(log) log.write(`Fetched ${odds.length} entries from odds\n`);
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

    if(log) await promisify(log.end).bind(log);
    return report_id;
}