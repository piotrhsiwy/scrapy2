export function datestringListToISO(day, time){
  if(!day || !time){
    throw new Error('either day or time is undefined/null');
  }

  let date;

  const today = new Date();
  if(day === 'Today'){
    date = today;
  } else{
    const dayMonthSplit = day.split('/');
    if(dayMonthSplit.length === 2){
      const [month, day] = dayMonthSplit;
      date = new Date(today.getFullYear(), month-1, day);
    } else{
      throw new Error('dayMonthSplit does not have 2 elements');
    }
  }

  const hourMinuteSplit = time.split(':');
  if(hourMinuteSplit.length === 2){
    const [hour, minute] = hourMinuteSplit;
    date.setHours(hour);
    date.setMinutes(minute);
    date.setSeconds(0);
    date.setMilliseconds(0);
  } else{
    throw new Error('hourMinuteSplit does not have 2 elements');
  }

  return date;
}


export function datestringToISO(dateStr){
  if(!dateStr){
    throw new Error('dateStr is undefined or null');
  }

  const [day, month, time] = dateStr.match(/(\d+)\s+(\w+)\s+(\d{2}:\d{2})/).slice(1);
  const [hours, minutes] = time.split(':');

  const currentYear = new Date().getFullYear();
  const monthIndex = new Date(`${month} 1, ${currentYear}`).getMonth(); // Get the month index

  const date = new Date(currentYear, monthIndex, day, hours, minutes, 0, 0);
  
  // Format the date as ISO 8601
  return date.toISOString();
}
