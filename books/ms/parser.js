
export function datestringToISO(dateStr){

  const parseDateStr = (dateStr) => {
    const [day, month, time] = dateStr.match(/(\d+)\s+(\w+)\s+(\d{2}:\d{2})/).slice(1);
    const [hours, minutes] = time.split(':');
  
    const currentYear = new Date().getFullYear();
    const monthIndex = new Date(`${month} 1, ${currentYear}`).getMonth(); // Get the month index
  
    const date = new Date(currentYear, monthIndex, day, hours, minutes, 0, 0);
    return date;
  };
  
  const date = parseDateStr(dateStr);
  
  // Format the date as ISO 8601
  return date.toISOString();
}
