import bcrypt from 'bcrypt';
import { pool } from '../data/db/db.js';

export async function insertUser(username, passplain){
    const hash = await bcrypt.hash(passplain, 12);
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
        console.log(`Error when trying to inser user ${username}, ${hash}`);
    } finally{
        if(client) client.release();
        console.log(`Inserted user #${user_id} ${username}, ${hash}`);
        return user_id;
    }
}