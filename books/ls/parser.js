export function datestringToISO(dateStr){
  
  const parseDateStr = (dateStr) => {
    if(!dateStr || dateStr === ''){
      throw new Error('ParserError: undefined or empty String');
      return undefined;
    }

    // "25/10 • 10:00"
    let date;
    let split;
    const today = new Date();

    split = dateStr.split(' • ');
    if(split.length !== 2){
      throw new Error(`ParserError: length of the first split (on  • ) is not 2. dateStr= ${dateStr}`);
      return undefined;
    }
    const [dayMonth, hoursMinutes] = split;
    
    let day, month;
    if(dayMonth === 'Today'){
      day = today.getDate();
      month = today.getMonth();
    } else if (dayMonth === 'Tomorrow'){
      day = today.getDate() + 1;
      month = today.getMonth();
    } else {
      split = dayMonth.split('/');
      if(split.length !== 2 || !Number.isInteger(parseInt(split[0])) || !Number.isInteger(parseInt(split[1]))){
        throw new Error(`ParserError: length of the second split (on /) is not 2. dateStr= ${dateStr}`);
        return undefined;
      }
      [day, month] = split;
    }

    split = hoursMinutes.split(':');
    if(split.length !== 2 || !Number.isInteger(parseInt(split[0])) || !Number.isInteger(parseInt(split[1]))){
      throw new Error(`ParserError: length of the second split (on :) is not 2. dateStr= ${dateStr}`);
      return undefined;
    }
    const [hours, minutes] = hoursMinutes.split(':');

    const currentYear = new Date().getFullYear();
    const monthIndex = new Date(`${month} 1, ${currentYear}`).getMonth();

    date = new Date(currentYear, monthIndex, parseInt(day), parseInt(hours), parseInt(minutes), 0, 0);
    date.setSeconds(0);
    date.setMilliseconds(0);
  
    return date;
  };
  
  const date = parseDateStr(dateStr);
  // Format the date as ISO 8601
  return date?.toISOString();
}
