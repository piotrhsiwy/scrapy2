export function insertArb4(arbs, newArb, positiveArbCount){
    let arbIndex = arbs.findIndex( a => 
        // a.value         === newArb.value         &&
        a.sport         === newArb.sport         &&
        a.teamHome      === newArb.teamHome      &&
        a.teamAway      === newArb.teamAway      &&
        a.datetime      === newArb.datetime      &&
        a.market        === newArb.market        &&
        a.oddA.oddName  === newArb.oddA.oddName  &&
        // a.oddA.oddValue === newArb.oddA.oddValue &&
        a.oddA.book     === newArb.oddA.book     &&
        a.oddA.url      === newArb.oddA.url      &&
        a.oddB.oddName  === newArb.oddB.oddName  &&
        // a.oddB.oddValue === newArb.oddB.oddValue &&
        a.oddB.book     === newArb.oddB.book     &&
        a.oddB.url      === newArb.oddB.url      &&
        a.oddC.oddName  === newArb.oddC.oddName  &&
        // a.oddC.oddValue === newArb.oddC.oddValue &&
        a.oddC.book     === newArb.oddC.book     &&
        a.oddC.url      === newArb.oddC.url      &&
        a.oddD.oddName  === newArb.oddD.oddName  &&
        // a.oddD.oddValue === newArb.oddD.oddValue &&
        a.oddD.book     === newArb.oddD.book     &&
        a.oddD.url      === newArb.oddD.url
    );
    let report = "invalid";
    if( arbIndex === -1){
        /* the arb is new */
        positiveArbCount++;
        arbs.push(newArb);
        report = `${newArb.oddA.oddName.padEnd(20,' ')}@${newArb.oddA.oddValue} on ${newArb.oddA.book.padEnd(20,' ')} - ${newArb.oddB.oddName.padEnd(20,' ')}@${newArb.oddB.oddValue} on ${newArb.oddB.book.padEnd(20,' ')} - ${newArb.oddC.oddName.padEnd(20,' ')}@${newArb.oddC.oddValue} on ${newArb.oddC.book.padEnd(20,' ')} -  ${newArb.oddD.oddName.padEnd(20,' ')}@${newArb.oddD.oddValue} on ${newArb.oddD.book.padEnd(20,' ')}, ${newArb.value} arb new.\n`;
    } else{
        /* the arb already exists (may have different odds)*/
        // update policy: always update
        positiveArbCount++;
        arbs[arbIndex] = newArb;
        report = `${newArb.oddA.oddName.padEnd(20,' ')}@${newArb.oddA.oddValue} on ${newArb.oddA.book.padEnd(20,' ')} - ${newArb.oddB.oddName.padEnd(20,' ')}@${newArb.oddB.oddValue} on ${newArb.oddB.book.padEnd(20,' ')} - ${newArb.oddC.oddName.padEnd(20,' ')}@${newArb.oddC.oddValue} on ${newArb.oddC.book.padEnd(20,' ')} -  ${newArb.oddD.oddName.padEnd(20,' ')}@${newArb.oddD.oddValue} on ${newArb.oddD.book.padEnd(20,' ')}, ${newArb.value} arb udpate.\n`;
    }
    return report;
}

export function insertArb2(arbs, newArb, positiveArbCount){
    let arbIndex = arbs.findIndex( a => 
        // a.value         === newArb.value        &&
        a.sport         === newArb.sport        &&
        a.teamHome      === newArb.teamHome     &&
        a.teamAway      === newArb.teamAway     &&
        a.datetime      === newArb.datetime     &&
        a.market        === newArb.market       &&
        a.Home.oddName  === newArb.Home.oddName &&
        // a.Home.oddValue === newArb.Home.oddValue&&
        a.Home.book     === newArb.Home.book    &&
        a.Home.url      === newArb.Home.url     &&
        a.Away.oddName  === newArb.Away.oddName &&
        // a.Away.oddValue === newArb.Away.oddValue&&
        a.Away.book     === newArb.Away.book    &&
        a.Away.url      === newArb.Away.url
    );
    let report = "invalid";
    if(arbIndex === -1){
        /* the arb is new */
        positiveArbCount++;
        arbs.push(newArb);
        report = `${newArb.Home.oddName.padEnd(20,' ')}@${newArb.Home.oddValue} on ${newArb.Home.book.padEnd(20,' ')} - ${newArb.Away.oddName.padEnd(20,' ')}@${newArb.Away.oddValue} on ${newArb.Away.book.padEnd(20,' ')}, ${newArb.value} arb new.\n`;
    } else{
        /* the arb already exists (may have different odds)*/
        // update policy: always update
        arbs[arbIndex] = newArb;
        positiveArbCount++;
        report = `${newArb.Home.oddName.padEnd(20,' ')}@${newArb.Home.oddValue} on ${newArb.Home.book.padEnd(20,' ')} - ${newArb.Away.oddName.padEnd(20,' ')}@${newArb.Away.oddValue} on ${newArb.Away.book.padEnd(20,' ')}, ${newArb.value} arb update.\n`;
    }
    return report;
}

export function insertEv2(evs, newEv, positiveEvCount){
    let evIndex = evs.findIndex( e => 
        // e.value                     === newEv.value                    && 
        // e.mean                      === newEv.mean                     && 
        // e.stdDev                    === newEv.stdDev                   && 
        // e.deviationInTermsOfStdDev  === newEv.deviationInTermsOfStdDev && 
        // e.strength                  === newEv.strength                 && 
        e.sport                     === newEv.sport                    && 
        e.teamHome                  === newEv.teamHome                 && 
        e.teamAway                  === newEv.teamAway                 && 
        e.datetime                  === newEv.datetime                 && 
        e.market                    === newEv.market                   && 
        e.odd.oddName               === newEv.odd.oddName              && 
        // e.odd.oddValue              === newEv.odd.oddValue             && 
        e.odd.book                  === newEv.odd.book                 && 
        e.odd.url                   === newEv.odd.url
    );
    let report = "invalid";
    if( evIndex === -1){
        /* the ev is new */
        positiveEvCount++;
        evs.push(newEv);
        report = `${newEv.odd.oddName.padEnd(20,' ')}@${newEv.odd.oddValue} \tstrength ${newEv.strength} \tamong ${newEv.values} \ton ${newEv.odd.book.padEnd(20,' ')} ev new\n`;
    } else{
        /* the ev already exists (may have different odds)*/
        // update policy: always update
        positiveEvCount++;
        evs[evIndex] = newEv;
        report = `${newEv.odd.oddName.padEnd(20,' ')}@${newEv.odd.oddValue} \tstrength ${newEv.strength} \tamong ${newEv.values} \ton ${newEv.odd.book.padEnd(20,' ')} ev update\n`;
    }
    return report;
}