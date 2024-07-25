export function calcMarket(stream, market, books){

    // how many odds are in this market?
    let marketReport, arbReport;

    let arb = null;
    let consideredArbCount = 0;
    let positiveArbCount = 0;

    function arb2(oddHome, oddAway){
        for(const coefHome of oddHome.coefs.filter(c => !books.includes(c.name))){
            for(const coefAway of oddAway.coefs.filter(c => !books.includes(c.name))){
                if(coefAway.book === coefHome.book){ break; } // excludes self-arbs from the consideration
                arb = 1.0 - (1/coefHome.value + 1/coefAway.value);
                consideredArbCount++;
                if(arb > 0.0){ positiveArbCount++; }
                arbReport =  
                    `${oddHome.name.padEnd(20,' ')}@${coefHome.value} on ${coefHome.book.padEnd(20,' ')} - ${oddAway.name.padEnd(20,' ')}@${coefAway.value} on ${coefAway.book.padEnd(20,' ')}, ${arb} arb.\n`;
                stream.write(arbReport);
            }
        }
    }

    stream.write(`Processing market: ${market.name}\n`)
    let odds = market.odds;
    if          (odds.length <= 1){
        marketReport = `calcMarket cannot handle the following market: '${market.name}'. Incorrect number of odds: ${odds.length}.\n`;
    } else if   (odds.length == 2){
            /* normal binary market */
            arb2(market.odds[0], market.odds[1]);
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
                arb2(oddHome, oddAway);
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
                arb2(oddHome, oddAway);
                processed.push(oddHome);
                processed.push(oddAway);
            }
            marketReport = positiveArbCount > 0 ?
                `Considered ${consideredArbCount} Arbs, ${positiveArbCount} of them were positive\n`
                : `Considered ${consideredArbCount} Arbs, none of them were profitable\n`
        } else{
            marketReport = `calcMarket cannot handle the following market: '${market.name}'. Incorrect number of odds: ${odds.length}.\n`;
        }
    }
    stream.write(marketReport);

}