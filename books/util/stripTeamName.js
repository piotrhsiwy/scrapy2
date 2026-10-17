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
        globalName:'dplus',
        specificNames:['damwonkia', 'dpluskia']
    },
    {
        globalName:'dplusacademy',
        specificNames:['dpluskiacademy']
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
    {
        globalName:'1w',
        specificNames:['1win']
    },
    {
        globalName:'evilgeniuses',
        specificNames:['evilgeniusespa']
    },
    {
        globalName:'mvk',
        specificNames:['mgnvikings']
    },
    {
        globalName:'bylasiluzja',
        specificNames:['byłaśiluzja']
    },
    {
        globalName:'fb',
        specificNames:['favbet', 'fav']
    },
    {
        globalName:'bigetronmybyvit',
        specificNames:['bigetronmybyvitality']
    },
    {
        globalName:'southamericarejects',
        specificNames:['southamericanrejects']
    },
    {
        globalName:'geekfam',
        specificNames:['geekfamid']
    },
    {
        globalName:'ascend',
        specificNames:['acend']
    },
    {
        globalName:'espiritshonen',
        specificNames:['espritshōnen']
    },
    {
        globalName:'proycon',
        specificNames:['procyon']
    },
    {
        globalName:'chiefs',
        specificNames:['helfiechiefs']
    },
    {
        globalName:'kingzone',
        specificNames:['king-zone', 'kingzero']
    },
    {
        globalName:'passionuaac',
        specificNames:['passionacademy']
    },
    {
        globalName:'rrq',
        specificNames:['rexregumqeon', 'rrqhoshi']
    },
    {
        globalName:'fukokasbhawks',
        specificNames:['fukokasoftbankhawks']
    },
    {
        globalName:'secret',
        specificNames:['secretwhales']
    },
    {
        globalName:'onicph',
        specificNames:['onicph', 'onicphilippines']
    },
    {
        globalName:'ou',
        specificNames:['oug']
    },
    {
        globalName:'liquid',
        specificNames:['liquidid']
    },
    {
        globalName:'geekfam',
        specificNames:['geekfamid']
    },
    {
        globalName:'ag',
        specificNames:['allgamers']
    },
    {
        globalName:'breekicheeki',
        specificNames:['cheekibreeki']
    },
    {
        globalName:'powerranger',
        specificNames:['powerrangers']
    },
    {
        globalName:'koi',
        specificNames:['movistarkoi', 'movistarriders']
    },
    {
        globalName:'besiktas',
        specificNames:['beşiktaş']
    },
    {
        globalName:'kuusamo',
        specificNames:['kuusamo.gg']
    },
    {
        globalName:'ktrolsteracademy',
        specificNames:['ktrolsterch']
    },
    {
        globalName:'fcbarcelona',
        specificNames:['barca', 'barça']
    },
    {
        globalName:'quintessencia',
        specificNames:['quintessência']
    },
    {
        globalName:'1of30',
        specificNames:['1/30']
    },
    {
        globalName:'sangalacademy',
        specificNames:['sangalalters']
    },
    {
        globalName:'clutchain',
        specificNames:['clutchainfe']
    },
    {
        globalName:'evelone',
        specificNames:['evelone192']
    },
    {
        globalName:'barczaca',
        specificNames:['barcząca']
    },
    {
        globalName:'supernova',
        specificNames:['supernovacomets', 'sksupernova']
    },
    {
        globalName:'apexmissionimpossible',
        specificNames:['apexmissionimposible']
    },
    {
        globalName:'karminecorpacademy',
        specificNames:['karminecorpblue']
    },
    {
        globalName:'eko',
        specificNames:['ekoacademy']
    },
    {
        globalName:'guara',
        specificNames:['guará']
    },
    {
        globalName:'mokrivsky',
        specificNames:['mokrivskiy']
    },
])

export function stripTeamName(str){
    // THIS FUNCTION IS ALSO CALLED on oddName of the form (Vitality-1.5)
    // it MUST NOT destroy f.e. the handicap value
    if(!str) return str;
    str = str.toLowerCase()
        .replace(/\.ch$/g, 'academy')
        .replace(/club|clan|esports|e-sports|-esports|esport|team|the|gaming|mannschaft|sports|\s+|oksavingsbank|fredit|bnk|.vietnam|\([^)]*\)|^csgo|cs$|og$|gc$|superplay|grandes|w7m|^vivo|trainee$|global/g, '')
        .replace(/\+showtime|\+r8|\+gabe|chongqing|^kiwoom|^hanjin|^minus|instreamly$/g, '')
        .replace(/espor$|wolves$/g, '')
        .replace(/\'|\_/g, '')
        .replace(/\{|\}|\(|\)\[|\]|\||\\|\?|\+|\*|\$|\^/g, '') // regex special characters to ensure correct processing with regex in the db
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