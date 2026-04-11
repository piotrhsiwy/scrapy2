
export function datestringToISO(dateStr){
  if(!dateStr){
    throw new Error('date is undefined');
  } else if(dateStr === ''){
    throw new Error('date is empty');
  }

  // Parse the date string and create a Date object
    const date = new Date();
    const [datePart, timePart] = dateStr.split(' ');
    const today = new Date();
    const mDsplit = datePart.split('/');
    if(mDsplit.length <= 1){
      if(datePart === 'Today'){
        date.setDate(today.getDate());
      } else if(datePart === 'Tomorrow'){
        date.setDate(today.getDate() + 1);
      } else{
        throw new Error('invalid one-word date');
      }
    } else{
      const [month, day] = mDsplit;
      const monthNum = parseInt(month);
      if(Number.isNaN(monthNum)){
        throw new Error('month is not a number');
      } else{
        date.setMonth(monthNum - 1);
      }
      const dayNum = parseInt(day);
      if(Number.isNaN(dayNum)){
        throw new Error('day is not a number');
      } else{
        date.setDate(dayNum);
      }
    }

    const hMsplit = timePart.split(':');
    if(hMsplit.length <= 1){
      const hours = hMsplit[0];
      const hoursNum = parseInt(hours);
      if(Number.isNaN(hoursNum)){
        throw new Error('hours is not a number');
      } else{
        date.setHours(hoursNum);
      }
    } else{
      const [hours, minutes] = hMsplit;
      const hoursNum = parseInt(hours);
      if(Number.isNaN(hoursNum)){
        throw new Error('hours is not a number');
      } else{
        date.setHours(hoursNum);
      }
      const minutesNum = parseInt(minutes);
      if(Number.isNaN(minutesNum)){
        throw new Error('minutes is not a number');
      } else{
        date.setMinutes(minutesNum);
      }
    }
    
    date.setSeconds(0);
    date.setMilliseconds(0);
  
  // Format the date as ISO 8601
  return date.toISOString();
}
