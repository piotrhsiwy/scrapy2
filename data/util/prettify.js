export function unprettifyISO8601(dateString){
  // Split the date and time parts
  if(!dateString) return dateString;
  const [datePart, timePart] = dateString.split(' at ');

  // Extract date components
  const [month, daycomma, year] = datePart.split(' ');
  const day = daycomma.split(',')[0];
  const monthIndex = new Date(`${month} 1`).getMonth(); // Convert month name to month index

  // Extract time and time zone components
  const [time, period, timeZone] = timePart.split(' ');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const offsetSign = timeZone.charAt(3);
  const offsetHours = parseInt(timeZone.substr(4));

  // Convert to 24-hour format if PM
  let adjustedHours = hours;
  if (period === 'PM' && hours !== 12) {
      adjustedHours += 12;
  } else if (period === 'AM' && hours === 12) {
      adjustedHours = 0;
  }

  // Create the Date object in UTC
  const utcDate = new Date(Date.UTC(year, monthIndex, day, adjustedHours - (offsetSign === '+' ? offsetHours : -offsetHours), minutes, seconds));

  return utcDate;
}

export function ISO8601Prettify(isoDatetime){
    if(isoDatetime.includes('live')){
        return 'live';
    }

    const date = new Date(isoDatetime);
    
    // Define options for formatting
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    };
    
    // Format the date
    const prettyDate = date.toLocaleString('en-US', options);
    
    return prettyDate;
}

export function arbPrettifyToPercent(f){
    return (f*100.0).toFixed(2);
}