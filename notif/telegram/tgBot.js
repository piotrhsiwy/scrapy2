import { Telegraf } from 'telegraf'
import { message } from 'telegraf/filters'
import { readFileSync, createWriteStream} from 'fs'
import { promisify } from "util";

import { sortArbs, pickArbTop, pickArbRandom } from '../../data/util/pickArb.js'
import { pickEvRandom } from '../../data/util/pickEv.js';

import { tupleFrom, authenticateEmail, authorize, unbindID } from './util.js'


console.log(process.env['TGBOT_LOG_PATH']);
console.log(process.env['ARBS_PATH']);
console.log(process.env['EVS_PATH']);
console.log(process.env['CLIENTS_PATH']);
console.log(process.env['TOKEN']);
if(process.env['TOKEN']){
    ;
} else {
    const tokenPath = `../../auth/tgBotToken.txt`;
    const tokenValue = readFileSync(tokenPath).toString();
    process.env['TOKEN'] = tokenValue;
}

// prepare paths
let logFilePath = './log.txt';
if(process.env['TGBOT_LOG_PATH']){
    logFilePath = process.env['TGBOT_LOG_PATH'];
}
let arbsPath = '../../data/arbs.json';
if(process.env['ARBS_PATH']){
    arbsPath = process.env['ARBS_PATH'];
}
let evsPath = '../../data/evs.json';
if(process.env['EVS_PATH']){
    evsPath = process.env['EVS_PATH'];
}
let clientsPath = '../../auth/clientData/clients.json';
if(process.env['CLIENTS_PATH']){
    clientsPath = process.env['CLIENTS_PATH'];
}

// create a stream to log file
const log = createWriteStream(logFilePath, {flags: 'a'});
const log2 = async (msg) => {
    const timestamp = Date().toString();
    console.log(`${timestamp}: ${msg}`);
    log.write(`${timestamp}: ${msg}`);
}

// launch the bot
const bot = new Telegraf(process.env['TOKEN'])
bot.launch()

bot.command('ev', async (ctx) => {
    /* do user authentication */
    const isAuthorized = authorize(clientsPath, 'ev', ctx.from.id);
    if(isAuthorized){
        ctx.reply(pickEvRandom(evsPath));
        log2(`Sent random ev to ${tupleFrom(ctx.from)}`);
    } else{
        ctx.reply("You don't have permission to use this command.");
        log2(`Rejected random ev request from ${tupleFrom(ctx.from)}`)
    }
})

bot.command('arb', async (ctx) => {
    /* do user authentication */
    const isAuthorized = authorize(clientsPath, 'arb', ctx.from.id);
    if(isAuthorized){
        ctx.reply(pickArbRandom(arbsPath));
        log2(`Sent random arb to ${tupleFrom(ctx.from)}`);
    } else{
        ctx.reply("You don't have permission to use this command.");
        log2(`Rejected random arb request from ${tupleFrom(ctx.from)}`)
    }
})

bot.command('top', async (ctx) => {
    /* do user authentication */
    const isAuthorized = authorize(clientsPath, 'top', ctx.from.id);
    if(isAuthorized){
        sortArbs(arbsPath);
        ctx.reply(pickArbTop(arbsPath));
        log2(`Sent top arb to ${tupleFrom(ctx.from)}`);
    } else{
        ctx.reply("You don't have permission to use this command.");
        log2(`Rejected top arb request from ${tupleFrom(ctx.from)}`)
    }
})

bot.command('logout', async (ctx) => {
    /* do user authentication */
    const isAuthorized = authorize(clientsPath, 'logout', ctx.from.id);
    if(isAuthorized){
        unbindID(clientsPath, ctx.from.id);
        ctx.reply(`Logout successful.`);
        log2(`Logged out ${tupleFrom(ctx.from)}`);
    } else{
        ctx.reply("You don't have permission to use this command.");
        log2(`Logout failed ${tupleFrom(ctx.from)}`)
    }
})

bot.start((ctx) => {
    ctx.reply('Login with your email address:');
});

bot.on(message('text'), (ctx) => {
    const text = ctx.message.text;
    if(text.includes('@')){
        const client = authenticateEmail(clientsPath, text, ctx.from.id);
        if(client){
            if(client === 'oldClient'){
                ctx.reply(`This email is already logged in.`);
                log2(`Tried to relog ${tupleFrom(ctx.from)}`);
                return;
            }
            ctx.reply(`Login successfull. You can now use the following commands: {${client.privilege.toString()}}.`);
            log2(`Logged in ${tupleFrom(ctx.from)}`);
            return;
        } else{
            ctx.reply(`Login failed. This email address is not registered.`);
            log2(`Failed login attempt from ${tupleFrom(ctx.from)} with ${text}`);
            return;
        }
    }
});

// Enable graceful stop
process.once('SIGINT', async () => {
    bot.stop('SIGINT')
    await promisify(log.end).bind(log);
});
process.once('SIGTERM', async () => {
    bot.stop('SIGTERM')
    await promisify(log.end).bind(log);
});