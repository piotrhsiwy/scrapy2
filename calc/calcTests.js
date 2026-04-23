import { createWriteStream } from 'fs'
import { insertReport } from "../data/db/inserter.js";
import { calcAll } from "./calc.js";

let log;
const logFilePath = './calc/log.txt';
try{
    log = createWriteStream(logFilePath, {flags: 'a'});
} catch(error){
    console.error(`Failure! Cannot open file under ${logFilePath}`);
}

const ret = await calcAll();
const report_id = await insertReport(log, ret);