import { readFileSync } from "fs"

export function pickEvRandom(path){
    const evs = JSON.parse(readFileSync(path));
    if(!evs){
        return 'no evs available';
    }

    const from = 0;
    const to = evs.length; 
    const rand = Math.random();
    const index = from + rand*(to-from);
    return JSON.stringify( evs[Math.floor(index)], null, 2 );
}