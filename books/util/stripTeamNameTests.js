const testcases = 
[
    {
        name:'g2 gaming',
        desiredResult:'g2'
    },
    {
        name:'vitality esports',
        desiredResult:'vitality'
    },
    {
        name:'faze clan',
        desiredResult:'faze'
    },
    {
        name:'FAZE ESPORTS',
        desiredResult:'faze'
    },
    {
        name:'natus vincere',
        desiredResult:'navi'
    },
    {
        name:'Ninjas in Pyjamas',
        desiredResult:'nip'
    },
    {
        name:'team Liquid',
        desiredResult:'liquid'
    },
]

import { stripTeamName } from "./stripTeamName.js";

console.log('Testing...');
let total = 0;
let positive = 0;
for(const tc of testcases){
    if(stripTeamName(tc.name) !== tc.desiredResult){
        console.log(`'${tc.name}' was incorrectly stripped to '${stripTeamName(tc.name)}' instead of '${tc.desiredResult}'`);
    } else{
        positive++;
    }
    total++;
}
console.log(`Finished. ${positive}/${total} passed.`);