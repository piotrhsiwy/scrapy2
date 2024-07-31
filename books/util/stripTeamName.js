const teamNameMap = Object.freeze([
    {
        globalName:'nip',
        specificNames:['ninjasinpyjamas']
    },
    {
        globalName:'bb',
        specificNames:['betboom']
    },
    {
        globalName:'kru',
        specificNames:['krü']
    },
    {
        globalName:'cphwolves',
        specificNames:['copenhagenwolves']
    },
    {
        globalName:'boom',
        specificNames:['boomid']
    },
    {
        globalName:'lvlup',
        specificNames:['levelup']
    },
    {
        globalName:'lgd',
        specificNames:['psg.lgd']
    },
    {
        globalName:'dpluskia',
        specificNames:['damwonkia']
    },
    {
        globalName:'nsredforce',
        specificNames:['nongshimredforce', 'nongshim']
    },
    {
        globalName:'tt',
        specificNames:['thundertalk']
    },
    {
        globalName:'omg',
        specificNames:['ohmygod']
    },
    {
        globalName:'academy',
        specificNames:['challengers']
    },
    {
        globalName:'liberty',
        specificNames:['havanliberty']
    },
    {
        globalName:'uol',
        specificNames:['unicornsoflove']
    },
    {
        globalName:'se',
        specificNames:['sexyedition']
    },
    {
        globalName:'shalke04',
        specificNames:['fcshalke04']
    },
    {
        globalName:'westpoint',
        specificNames:['westpointph']
    },
    {
        globalName:'fm',
        specificNames:['focusme']
    },
    {
        globalName:'mgnblue',
        specificNames:['mgnbox']
    },
    {
        globalName:'zerotenacity',
        specificNames:['z10eshark']
    },
    {
        globalName:'leviatan',
        specificNames:['leviatán']
    },
    {
        globalName:'zen',
        specificNames:['zengc']
    },
    {
        globalName:'lgd',
        specificNames:['lgdnbw']
    },
    {
        globalName:'platinumhereoesr8',
        specificNames:['platinumheroes']
    },
    {
        globalName:'uu',
        specificNames:['undefeatedunited']
    },
])

export function stripTeamName(str){
    str = str.toLowerCase()
        .replace(/club|clan|esports|e-sports|-esports|esport|team|the|gaming|mannschaft|sports|\s+|oksavingsbank|bnk|.vietnam|\(women\)/g, '')
        .replace(/\+showtime|\+r8|\+gabe|chongqing/g, '')
        // .replace(/\b(\w+)clan\b/g, '$1')
        // .replace(/\b(\w+)esports\b/g, '$1')
        // .replace(/\b(\w+)esport\b/g, '$1')
        // .replace(/\b(\w+)e-sports\b/g, '$1')
        // .replace(/\bteam(\w+)\b/g, '$1')
        // .replace(/\b(\w+)team\b/g, '$1')
        // .replace(/\bthe(\w+)\b/g, '$1')
        // .replace(/\b(\w+)gaming\b/g, '$1');

    for(const mapping of teamNameMap){
        for(const specificName of mapping.specificNames){
            str = str.replace(specificName, mapping.globalName);
        }
    }

    return str;
}