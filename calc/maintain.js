import { prettyToDate, ISO8601ToDate } from "../data/util/prettify.js";

/**
 * this function slices out the matches (items that have a singly nested datetime field)
 * that are in the past by more than 1 hour.
 * @param {*} data 
 */
export function cleanupData(data){
    let count = 0;
    const now = new Date(); 
    for(let i = 0; i < data.sports.length; i++){
        for(let j = 0; j < data.sports[i].matches.length; j++){
            const match = data.sports[i].matches[j]
            const date = prettyToDate(match.datetime);
            const dategT = date.getTime();
            const nowgT = now.getTime();
            if( dategT <= nowgT - 60*60*1000 ){
                /* is outdated */
                data.sports[i].matches.splice(j, 1);
                j--;
                count++;
            }
        }
    }
    return count;
}

/**
 * this fuction slices out the arbs/evs (items that have a datetime field) that are in the past
 * @param {*} items 
 */
export function cleanupOnDatetime(items){
    let count = 0;
    const now = new Date();
    for(let i = 0; i < items.length; i++){
        const date = prettyToDate(items[i].datetime);
        const dategT = date.getTime();
        const nowgT = now.getTime();
        if( 
          dategT <= nowgT
        ){
            /* is outdated */
            items.splice(i, 1);
            i--;
            count++;
        }
    }
    return count;
}
