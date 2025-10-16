
export function datestringToISO(dateStr){

  // Parse the date string and create a Date object
  const parseDateStr = (dateStr) => {
    const [datePart, timePart] = dateStr.split(' ');
    const [month, day] = datePart.split('/');
    const [hours, minutes] = timePart.split(':');
  
    const date = new Date();
    date.setMonth(parseInt(month) - 1); // Months are zero-based in JavaScript
    date.setDate(parseInt(day));
    date.setHours(parseInt(hours));
    date.setMinutes(parseInt(minutes));
    date.setSeconds(0);
    date.setMilliseconds(0);
  
    return date;
  };
  
  const date = parseDateStr(dateStr);
  
  // Format the date as ISO 8601
  return date.toISOString();
}
