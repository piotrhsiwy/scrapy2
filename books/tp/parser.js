/**
 * 
 * @param {*} dateStr
 * @throws 
 */
export function datestringToISO(dateStr){
  if(!dateStr){
    return undefined;
  }
  var split = dateStr.split(', ');
  let month, day, hours, minutes;
  if(split.length >= 2){
    const monthDay = split[0];
    const mDsplit = monthDay.split(' ');
    if(mDsplit.length === 1){
      if(mDsplit[0] === 'Upcoming'){
        const today = new Date();
        month = today.getMonth();
        day = today.getDate();
      } else{
        throw new Error('undefined one-word date');
      }
    } else if(mDsplit.length >= 2){
      month = mDsplit[0];
      const dayNum = parseInt(mDsplit[1]);
      if(!Number.isNaN(dayNum)){
        day = dayNum;
      } else{
        throw new Error('day is not a number');
      }
    }

    const hMsplit = split[1].split(':');
    if(hMsplit.length === 1){
      const num = parseInt(hMsplit[0]);
      if(!Number.isNaN(num)){
        hours = num;
        minutes = 0;
      } else{
        throw new Error('hour is not a number');
      }
    } else if(hMsplit.length >= 2){
      const num = parseInt(hMsplit[0]);
      const minNum = parseInt(hMsplit[1]);
      if(!Number.isNaN(num)){
        hours = num;
        if(!Number.isNaN(minNum)){
          minutes = minNum;
        } else{
          throw new Error('monutes is not a number');
        }
      } else{
        throw new Error('hour is not a number');
      }
    }
  } else if(split.length === 1){
    if(split[0] === ''){
      throw new Error('empty');
    } else{
      return 'live';
    }
  }

  const date = new Date();
  if(Number.isNaN(parseInt(month))){
    // month in text
    try{
      date.setMonth(new Date(`${month} 1`).getMonth()); // Get the month index
    } catch(error){
      throw new Error('error when setting month in text');
    }
  } else{
    try{
      date.setMonth(month); // Get the month index
    } catch(error){
      throw new Error('error when setting month');
    }
  }

  try{
    date.setDate(day);
  } catch(error){
    throw new Error('error when setting day');
  }
  try{
    date.setHours(hours);
  } catch(error){
    throw new Error('error when setting hours');
  }
  try{
    date.setMinutes(minutes);
  } catch(error){
    throw new Error('error when setting minutes');
  }
  date.setSeconds(0);
  date.setMilliseconds(0);

  return date.toISOString();
}
