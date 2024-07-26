export function stripTeamName(str){
    return str.toLowerCase()
        .replace(/\b(\w+)\s+clan\b/g, '$1') // Replace * clan with *
        .replace(/\b(\w+)\s+esports\b/g, '$1') // Replace * esports with *
        .replace(/\bteam\s+(\w+)\b/g, '$1'); // Replace team * with *
}