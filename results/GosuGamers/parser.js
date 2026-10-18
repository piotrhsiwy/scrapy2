export function datestringToISO(dateStr){
  
  const parseDateStr = (dateStr) => {
    let date;
    const [data, time] = dateStr.split(', ', 2);
    
    // 19 Dec 2025, 16:00
    // Split the string further for day, month, and time
    const [day, month, year] = data.split(' ');
    const [hours, minutes] = time.split(':');

    const currentYear = new Date().getFullYear();
    const monthIndex = new Date(`${month} 1, ${currentYear}`).getMonth();

    date = new Date(parseInt(year), monthIndex, parseInt(day), parseInt(hours), parseInt(minutes), 0, 0);
    return date;
  };
  
  const date = parseDateStr(dateStr);
  // Format the date as ISO 8601
  return date.toISOString();
}
