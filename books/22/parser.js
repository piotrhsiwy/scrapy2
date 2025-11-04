
export function datestringToISO(dateStr){

    if(!dateStr){
        throw new Error('date is undefined');
    } else if(dateStr === ''){
        throw new Error('date is empty');
    }

    const [datePart, timePart] = dateStr.split(' ');
    const [day, month] = datePart.split('.');
    const [hours, minutes] = timePart.split(':');

    const currentYear = new Date().getFullYear();

    // Create a new Date object with the parsed values
    const date = new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), 0, 0);

    // Format the date as ISO 8601
    return date.toISOString();
}
