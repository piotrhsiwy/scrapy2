/**
 *                      Pretty format: October 6, 2025 at 07:00:00 PM GMT+2 
 *                      ISO8601 format: 2025-10-06T13:39:32.517Z
 *                      Date Object
 * the @function ISO8601ToPretty is  ONLY to present the date in a human-friendlier format
 * the @function prettyToDate is used to translate it into Date object for comparisons, etc.
 * the @function ISO8601ToDate accordingly
 */

/**
 * this function takes a pretty datestring, like: October 6, 2025 at 07:00:00 PM GMT+2
 * and returns a Date object.
 * 
 * @param datestring - pretty datestring in this format: October 6, 2025 at 07:00:00 PM GMT+2
 * @return Date object
 */
export function prettyToDate(dateString){
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

/**
 * this function takes an ISO8601 datestring and returns a pretty version 
 * of it, like this: October 6, 2025 at 07:00:00 PM GMT+2
 * 
 * @param isoDatetime - ISO8601 datestring in this format: 2025-10-06T13:39:32.517Z
 * @return pretty datetime string in this format: October 6, 2025 at 07:00:00 PM GMT+2
 */
export function ISO8601ToPretty(isoDatetime){
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

/**
 * this function takes an ISO8601 datestring, like: 2025-10-06T13:39:32.517Z
 * and returns a standard JavaScript Date object.
 * * @param isoDatetime - ISO8601 datestring in this format: 2025-10-06T13:39:32.517Z
 * @return Date object
 */
export function ISO8601ToDate(isoDatetime){
    if (!isoDatetime) {
        return isoDatetime;
    } else if(isoDatetime === 'live'){
        return new Date();
    } else{
        // The Date constructor handles valid ISO 8601 strings by default.
        return new Date(isoDatetime);
    }
}

function ISO8601isBefore(isoDatetime1, isoDatetime2){
    const gT1 = ISO8601ToDate(isoDatetime1).getTime();
    const gT2 = ISO8601ToDate(isoDatetime2).getTime();
    return gT1<gT2;
}

export function ISO8601isPast(isoDatetime){
    return ISO8601isBefore(isoDatetime, new Date().toISOString);
}

export function ISO8601lastestFrom(timestamps){
    if(!timestamps){
        return timestamps;
    } else if(timestamps.length <= 1){
        return timestamps[0];
    } else{
        let latest = timestamps[0];
        for(let i = 0; i < timestamps.length; i++){
            if(ISO8601isBefore(latest, timestamps[i])){
                latest = timestamps[i];
            }
        }
        return latest;
    }
}

export function arbPrettifyToPercent(f){
    return (f*100.0).toFixed(2);
}