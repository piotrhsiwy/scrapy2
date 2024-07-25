export function calcMarket(stream, market, books){

    // how many odds are in this market?
    let arb = null;
    let marketReport, arbReport;
    let consideredArbCount = 0;
    let positiveArbCount = 0;
    stream.write(`Processing market: ${market.name}\n`)
    switch(market.odds.length){
        case 2:
            for(const coefHome of market.odds[0].coefs.filter(c => !books.includes(c.name))){
                for(const coefAway of market.odds[1].coefs.filter(c => !books.includes(c.name))){
                    arb = 1.0 - (1/coefHome.value + 1/coefAway.value);
                    consideredArbCount++;
                    if(arb > 0.0){ positiveArbCount++; }
                    arbReport =  
                        `${market.odds[0].name.padEnd(20,' ')}@${coefHome.value} on ${coefHome.book.padEnd(20,' ')} - ${market.odds[1].name.padEnd(20,' ')}@${coefAway.value} on ${coefAway.book.padEnd(20,' ')}, ${arb} arb.\n`;
                    stream.write(arbReport);
                }
            }
            // formulate a report string
            marketReport = positiveArbCount > 0 ?
                `Considered ${consideredArbCount} Arbs, ${positiveArbCount} of them were positive\n`
                : `Considered ${consideredArbCount} Arbs, none of them were profitable\n`
            break;
        default:
            marketReport= `calcMarket cannot handle the following market: '${market.name}'. Incorrect number of odds.\n`;
    }
    stream.write(marketReport);
}