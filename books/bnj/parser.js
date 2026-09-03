export function datestringToISO(dateStr){

  function parseHourMinute(date, hmString){
    const hmSplit = hmString.split(':')
    const h = parseInt(hmSplit[0])
    if(!Number.isInteger(h)){
      throw new Error(`hour is not an integer, ${h}`);
    }
    date.setHours(h);
    const m = parseInt(hmSplit[1])
    if(!Number.isInteger(m)){
      throw new Error(`minutes is not an integer, ${m}`);
    }
    date.setMinutes(m);
  }

  // datestrings have the following format
  // 'Sun 12 Apr 06:00'
  // 'Mon 13 Apr 09:00'
  if(!dateStr){
    throw new Error('date is undefined');
  } else if(dateStr === ''){
    throw new Error('date is empty');
  }

  // Parse the date string and create a Date object
    const date = new Date();
    const spaceSplit = dateStr.split(' ');
    if(spaceSplit.length != 4){
      throw new Error('spaceSplit does not have 4 elements! unrecognized format')
    }
    const timePart = spaceSplit[spaceSplit.length-1];
    const today = new Date();

    const month = spaceSplit[spaceSplit.length-2];
    const monthIndex = new Date(`${month} 1, ${today.getFullYear()}`).getMonth();
    date.setMonth(monthIndex);

    const day = spaceSplit[spaceSplit.length-3];
    date.setDate(parseInt(day));

    parseHourMinute(date, timePart)
    
    date.setSeconds(0);
    date.setMilliseconds(0);
  
  // Format the date as ISO 8601
  return date.toISOString();
}
