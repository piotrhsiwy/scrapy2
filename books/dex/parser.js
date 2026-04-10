export function datestringToISO(dateStr){

  function parseHourMinute(date, hmString){
    const hmSplit = hmString.split(':')
    const h = parseInt(hmSplit[0])
    if(!Number.isInteger(h)){
      throw new Error(`hour is not an integer, ${h}`);
    }
    date.setHours(h);
    const m = parseInt(hmSplit[1])
    if(!Number.isInteger(m)){
      throw new Error(`minutes is not an integer, ${m}`);
    }
    date.setMinutes(m);
  }

  if(!dateStr){
    throw new Error('date is undefined');
  } else if(dateStr === ''){
    throw new Error('date is empty');
  }

  // Parse the date string and create a Date object
    const date = new Date();
    const [datePart, timePart] = dateStr.split(', ');
    const today = new Date();
    if(datePart.includes(' • ')){
      // that means timePart does not exist and the datestring is of format: 'Apr 10 • 18:15' (all in datePart)
      const dateTimeSplit = datePart.split(' • ')
      if(dateTimeSplit.length < 2){
        throw new Error(`unrecognized datestring: ${datePart} `);
      } else{
        // year is already current
        const [month, day] = dateTimeSplit[0].trim().split(' ');
        const monthIndex = new Date(`${month} 1, ${today.getFullYear()}`).getMonth();
        date.setMonth(monthIndex);
        date.setDate(parseInt(day));
        parseHourMinute(date, dateTimeSplit[1]);
      }
    } else if(datePart.includes('TODAY')){
      date.setDate(today.getDate());
      if(timePart.includes('COMMON')){
        const CleantimePart = timePart.replace(/COMMON\.WILL_BE_LIVE:/, '').trim()
        const hmSplit = CleantimePart.split(' ');
        if(hmSplit.length > 1){
          const inHourString = hmSplit[0].replace(/ES\.COMMON\.TIME\.H/, '');
          const inHour = parseInt(inHourString);
          date.setHours(today.getHours() + inHour);
          const inMinString = hmSplit[1].replace(/ES\.COMMON\.TIME\.M/, '');
          const inMin = parseInt(inMinString);
          date.setMinutes(today.getMinutes() + inMin);
        } else{
          const inMinString = hmSplit[0].replace(/ES\.(.)*/, '');
          const inMin = parseInt(inMinString);
          date.setHours(today.getHours());
          date.setMinutes(today.getMinutes() + inMin);
        }
      } else{
        parseHourMinute(date, timePart)
      }
    } else if(datePart.includes('TOMORROW')){
      date.setDate(today.getDate() + 1);
      const dateTimeSplit = timePart.split(' • ')
      if(dateTimeSplit.length < 2){
        throw new Error(`Separator \' • \' is not presend in the TimePart: ${timePart} `);
      } else{
        parseHourMinute(date, dateTimeSplit[1]);
      }
    } else if(datePart.includes('COMMON')){
      const dayMonthYearSplit = datePart.replace(/COMMON\.PREMATCH_CAPITALIZE /, '').split('.');
      if(dayMonthYearSplit.length < 3){
        throw new Error(`unrecognized dateMonthYear format (trim COMMON..., split on \'.\'): ${datePart}`);
      } else{
        const dd = parseInt(dayMonthYearSplit[0])
        if(!Number.isInteger(dd)){
          throw new Error(`day is not an integer, ${dd}`);
        }
        date.setDate(dd);
        const mm = parseInt(dayMonthYearSplit[1])
        if(!Number.isInteger(mm)){
          throw new Error(`month is not an integer, ${mm}`);
        }
        date.setMonth(mm - 1); // month number is 0-based
        const yyyy = parseInt(dayMonthYearSplit[2])
        if(!Number.isInteger(yyyy)){
          throw new Error(`year is not an integer, ${yyyy}`);
        }
        date.setFullYear(yyyy);
      }
      const dateTimeSplit = timePart.split(' • ')
      if(dateTimeSplit.length < 2){
        throw new Error(`Separator \' • \' is not presend in the TimePart: ${timePart} `);
      } else{
        parseHourMinute(date, dateTimeSplit[1]);
      }
    } else{
      throw new Error(`unrecognized datePart: ${datePart}`);
    }
    
    date.setSeconds(0);
    date.setMilliseconds(0);
  
  // Format the date as ISO 8601
  return date.toISOString();
}
