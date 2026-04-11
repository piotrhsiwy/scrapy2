import { readFileSync, writeFileSync } from 'fs';

export function pickArbRandom(arbsFilePath){
    const arbs = JSON.parse(readFileSync(arbsFilePath));
    if(!arbs){
        return 'no arbs available';
    }

    const from = 0;
    const to = arbs.length; 
    const rand = Math.random();
    const index = from + rand*(to-from);
    return JSON.stringify( arbs[Math.floor(index)], null, 2 );
}

export function pickArbTop(arbsFilePath){
    const arbs = JSON.parse(readFileSync(arbsFilePath));
    if(!arbs){
        return 'no arbs available';
    }
    return JSON.stringify( arbs[0], null, 2 );
}

export function sortArbs(arbsFilePath){
    const arbs = JSON.parse(readFileSync(arbsFilePath));
    if(!arbs){
        return;
    }
    arbs.sort( (a, b) => b.value - a.value);
    writeFileSync(arbsFilePath, JSON.stringify(arbs, null, 2));
}