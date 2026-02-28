import {calcSports} from './calc/calc.js'

(async function main(){
    while(true){
        await calcSports(0.01, 0.05);
        await new Promise(resolve => setTimeout(resolve, 10 * 1000));
    }
})()

