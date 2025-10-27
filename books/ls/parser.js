export function datestringToISO(dateStr){
  
  const parseDateStr = (dateStr) => {
    let date;
    const [rest, dayOrKeyword] = dateStr.split(', ', 2);
    
    if (dayOrKeyword.toLowerCase() === "today") {
      date = new Date();
    } else if (dayOrKeyword.toLowerCase() === "tomorrow") {
      date = new Date();
      date.setDate(date.getDate() + 1);
    } else {
      // Split the string further for day, month, and time
      const [day, month, time] = dateStr.split(/[\s:]+/);
      const [hours, minutes] = rest.split(':');
  
      const currentYear = new Date().getFullYear();
      const monthIndex = new Date(`${month} 1, ${currentYear}`).getMonth();
  
      date = new Date(currentYear, monthIndex, parseInt(day), parseInt(hours), parseInt(minutes), 0, 0);
      return date;
    }
  
    const [hours, minutes] = rest.split(':');
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
