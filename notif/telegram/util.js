import { readFileSync, writeFileSync } from "fs"

export function tupleFrom(from){
    return `(${from.first_name}, ${from.id}, ${from.is_bot}, ${from.is_premium}, ${from.language_code}, ${from.last_name},${from.username})`;
}

export function authenticateEmail(clientsPath, email, id){
    const clients = JSON.parse(readFileSync(clientsPath));
    const clientPresent = clients.find( client => client.email === email)
    if(clientPresent){
        const newClient = !clientPresent.boundToID;
        if(newClient){
            clientPresent.boundToID = id;
            writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
            return clientPresent;
        } else{
            return 'oldClient';
        }
    } else{
        return null;
    }
}

export function authorize(clientsPath, command, id){
    const clients = JSON.parse(readFileSync(clientsPath));
    const clientLoggedIn = clients.find( client => client.boundToID === id);
    if(clientLoggedIn){
        if(clientLoggedIn.privilege.includes(command)){
            return true;
        }
    }
    return false;
}

export function unbindID(clientsPath, id){
    const clients = JSON.parse(readFileSync(clientsPath));
    const clientLoggedIn = clients.find( client => client.boundToID === id);
    clientLoggedIn.boundToID = null;
    writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
}