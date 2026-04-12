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
        desiredResult:'natusvincere'
    },
    {
        name:'Ninjas in Pyjamas',
        desiredResult:'nip'
    },
    {
        name:'team Liquid',
        desiredResult:'liquid'
    },
    {
        name:'theMongolz',
        desiredResult:'mongolz'
    },
    {
        name:'9z team',
        desiredResult:'9z'
    },
    {
        name:'BetBoomTeam',
        desiredResult:'bb'
    },
    {
        name:'bb team',
        desiredResult:'bb'
    },
    {
        name:'BOOM ID',
        desiredResult:'boom'
    },
    {
        name:'BOOM Esports',
        desiredResult:'boom'
    },
    {
        name:'Level UP',
        desiredResult:'lvlup'
    },
    {
        name:'PSG.LGD',
        desiredResult:'lgd'
    },
    {
        name:'OKSavingsBank BRION',
        desiredResult:'brion'
    },
    {
        name:'DAMWON KIA Gaming',
        desiredResult:'dpluskia'
    },
    {
        name:'BNK FearX',
        desiredResult:'fearx'
    },
    {
        name:'Nongshim RedForce',
        desiredResult:'nsredforce'
    },
    {
        name:'ThunderTalk Gaming',
        desiredResult:'tt'
    },
    {
        name:'Oh My God',
        desiredResult:'omg'
    },
    {
        name:'T1 Esports Challengers',
        desiredResult:'t1academy'
    },
    {
        name:'OKSavingsBank BRION Challengers',
        desiredResult:'brionacademy'
    },
    {
        name:'Nongshim Esports Academy',
        desiredResult:'nsredforceacademy'
    },
    {
        name:'Havan Liberty Academy',
        desiredResult:'libertyacademy'
    },
    {
        name:'Unicorns Of Love Sexy Edition',
        desiredResult:'uolse'
    },
    {
        name:'West Point Esports PH',
        desiredResult:'westpoint'
    },
    {
        name:'DetonatioN FocusMe',
        desiredResult:'detonationfm'
    },
    {
        name:'Team Flash.Vietnam',
        desiredResult:'flash'
    },
    {
        name:'Leviatán',
        desiredResult:'leviatan'
    },
    {
        name:'Zen Esports',
        desiredResult:'zen'
    },
    {
        name:'Basilisk + ShoWTimE',
        desiredResult:'basilisk'
    },
    {
        name:'OFFSYDE Esports + gabe (Women)',
        desiredResult:'offsyde'
    },
    {
        name:'Evil Geniuses Pa',
        desiredResult:'evilgeniuses'
    },
    {
        name: undefined,
        desiredResult:undefined
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