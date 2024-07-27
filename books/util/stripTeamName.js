const teamNameMap = Object.freeze([
    {
        globalName:'nip',
        specificNames:['ninjas in pyjamas']
    },
    {
        globalName:'navi',
        specificNames:['natus vincere']
    },
])

export function stripTeamName(str){
    str = str.toLowerCase()
        .replace(/\b(\w+)\s+clan\b/g, '$1')
        .replace(/\b(\w+)\s+esports\b/g, '$1')
        .replace(/\b(\w+)\s+e-sports\b/g, '$1')
        .replace(/\bteam\s+(\w+)\b/g, '$1')
        .replace(/\b(\w+)\s+gaming\b/g, '$1');

    for(const mapping of teamNameMap){
        for(const specificName of mapping.specificNames){
            str = str.replace(specificName, mapping.globalName);
        }
    }

    return str;
}