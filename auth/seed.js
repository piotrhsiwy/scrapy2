import bcrypt from 'bcrypt';
import { pool } from '../data/db/db.js';

async function insertUser(log, username, passplain){
    const saltRounds = 12;
    const hash = await bcrypt.hash(passplain, saltRounds);
    let client;
    let user_id;
    try{
        client = await pool.connect();
        const ret = await client.query({
            text:`
                INSERT INTO users(username, password_hash)
                VALUES ($1, $2) 
                RETURNING user_id
            `,
            values:[username, hash]
        })
        if(ret && ret.rows[0]){
            user_id = ret.rows[0].user_id;
        }
    } catch(e){
        if(log) log.write(`Error when trying to inser user ${username}, ${hash}\n\t ${e.message}\n`);
    } finally{
        if(client) client.release();
        if(log) log.write(`Inserted user #${user_id} ${username}, ${hash}\n`);
        return user_id;
    }
}

const username = process.argv[2] // username
const password_plain = process.argv[3] // password_plain
if(username.length > 0 && password_plain.length > 0){
    insertUser(process.stdout, username, password_plain);
    return 0;
} else{
    return -1;
}