export function dateISO8601Prettify(isoDatetime){
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