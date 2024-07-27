import { Telegraf } from 'telegraf'
import { message } from 'telegraf/filters'
import { readFileSync, createWriteStream} from 'fs'
import { promisify } from "util";

import { sortArbs, pickArbTop, pickArbRandom } from '../../data/util/pickArb.js'
import { tupleFrom, authenticateEmail, authorize, unbindID } from './util.js'

const tokenPath = `./auth/tgBotToken.txt`;
const tokenValue = readFileSync(tokenPath).toString();
process.env['TOKEN'] = tokenValue;

// open log stream
const logFilePath = './notif/telegram/log.txt';
const log = createWriteStream(logFilePath, {flags: 'a'});
const log2 = async (msg) => {
    const timestamp = Date().toString();
    console.log(`${timestamp}: ${msg}`);
    log.write(`${timestamp}: ${msg}`);
}

// launch the bot
sortArbs();
const bot = new Telegraf(process.env['TOKEN'])
bot.launch()

bot.command('arb', async (ctx) => {
    /* do user authentication */
    const isAuthorized = authorize('arb', ctx.from.id);
    if(isAuthorized){
        ctx.reply(pickArbRandom());
        log2(`Sent random arb to ${tupleFrom(ctx.from)}`);
    } else{
        ctx.reply("You don't have permission to use this command.");
        log2(`Rejected random arb request from ${tupleFrom(ctx.from)}`)
    }
})

bot.command('top', async (ctx) => {
    /* do user authentication */
    const isAuthorized = authorize('top', ctx.from.id);
    if(isAuthorized){
        ctx.reply(pickArbTop());
        log2(`Sent top arb to ${tupleFrom(ctx.from)}`);
    } else{
        ctx.reply("You don't have permission to use this command.");
        log2(`Rejected top arb request from ${tupleFrom(ctx.from)}`)
    }
})

bot.command('logout', async (ctx) => {
    /* do user authentication */
    const isAuthorized = authorize('logout', ctx.from.id);
    if(isAuthorized){
        unbindID(ctx.from.id);
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
        const client = authenticateEmail(text, ctx.from.id);
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