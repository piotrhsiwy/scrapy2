import puppeteer from "puppeteer";

/*
 * available bookies
 */
const bookies = [
  {
    name:"mystake",
    baseURL:"https://mystake.com",
    parallel_URLHandler: handleURL_ms_p,
  },
  {
    name:"thunderpick",
    baseURL:"https://thunderpick.io",
    parallel_URLHandler: handleURL_tp_p,
  },
  {
    name:"esportsbet",
    baseURL:"https://esportsbet.io",
    parallel_URLHandler: handleURL_esb_p,
  },
]

const urls_ms = [
  "https://mystake.com/en/sportsbook/prematch#/prematch?match=32010441",
  "https://mystake.com/en/sportsbook/prematch#/prematch?match=32010442",
  "https://mystake.com/en/sportsbook/prematch#/prematch?match=32010443",
  "https://mystake.com/en/sportsbook/prematch#/prematch?match=32010449",
  "https://mystake.com/en/sportsbook/prematch#/prematch?match=32010444",
]

const urls_tp = [
  "https://thunderpick.io/esports/cs2-betting/skyesports-masters-2024/4988/big-vs-betboom-team/751882",
  "https://thunderpick.io/esports/cs2-betting/skyesports-masters-2024/4988/ninjas-in-pyjamas-vs-gods-reign/753921",
  "https://thunderpick.io/esports/cs2-betting/thunderpick-world-championship-eu-q1/4975/amkal-esports-vs-guild-eagles/754418",
]

const urls_esb = [
  // "https://esbseamlessx02.kzonlinegame.com/esportsite/index.html#/OddsPage/27710580/47",
  "https://esbseamlessx02.kzonlinegame.com/esportsite/index.html#/OddsPage/27830638/45",
]

// handleURL_ms_p(urls_ms);
// handleURL_tp_p(urls_tp);
handleURL_esb_p(urls_esb);

export async function handleURL_ms_p(urls){
  let browser;
  // adapted from https://stackoverflow.com/questions/46293216/crawling-multiple-urls-in-a-loop-using-puppeteer/65000065#65000065 
  (async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: ["--disable-web-security"]
    });

    const matches = (await Promise.allSettled(
      urls.map(async (url) => {
        const page = await browser.newPage();

        await page.goto(url);

        const iFrameHandle = await page.waitForSelector('iframe', {timeout:10000});
        const frame = await iFrameHandle.contentFrame();

        const sel = 'div[class="m-col"] > div';
        const marketHandles = await frame.$$(sel);
        const marketArray = [];
        // console.log(marketHandles);
        for(const marketHandle of marketHandles){
            const market = {};
            market.name = await marketHandle.$eval('span', el => el.textContent);
            const oddHandles = await marketHandle.$$('.odd-rect-wide');
            // console.log(oddHandles);
            market.odds = [];
            for(const oddHandle of oddHandles){
                market.odds.push({
                  name:await oddHandle.$eval('p', el => el.textContent),
                  odd: {
                    book: 'ms',
                    coef:await oddHandle.$eval('span', el => el.textContent)
                  }
                });
            }
            marketArray.push(market);
        }
        
        // for(const market of marketArray){
        //     console.log(market.name);
        //     for(const odd of market.odds){
        //         console.log(odd);
        //     }
        // }

        await page.close();
        return marketArray;
      })))
      .filter(e => e.status === "fulfilled")
      .map(e => e.value);
    console.log(matches);
  })()
    .catch(err => console.error(err))
    .finally(() => browser?.close());
}

export async function handleURL_tp_p(urls){
  let browser;
  // adapted from https://stackoverflow.com/questions/46293216/crawling-multiple-urls-in-a-loop-using-puppeteer/65000065#65000065 
  (async () => {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--disable-web-security"]
    });


    const matches = (await Promise.allSettled(
      urls.map(async (url) => {
        const page = await browser.newPage();
        page.setViewport({width:1000, height:30000})

        await page.goto(url);

        const marketArray = [];

        { 
          // scrape the main-market
          const odds = [];
          const sel = 'div.main-market > button';
          await page.waitForSelector(sel);
          const oddHandles = await page.$$(sel);
          // console.log('oddHandles: ' + oddHandles);
          for(let i = 0; i < oddHandles.length; i++){
              const coefHandle = await oddHandles[i].$('span', el => el.textContent);
              const coef = coefHandle ? coefHandle.evaluate(el => el.textContent) : '0';
              odds.push({
                name: (i+1).toString(),
                odd: {
                  book: 'tp',
                  coef: coef
                }
              });
          }
          marketArray.push({name:'Match winner', odds: odds});
        }
        {
          // scrape all the other markets
          const sel = '.market-accordion';
          const marketHandles = await page.$$(sel);
          // console.log('marketHandles: (' + marketHandles.length + ') ' + marketHandles);
          for(const marketHandle of marketHandles){
            const name = await marketHandle.$eval('div.market-accordion__market-name', el => el.textContent);
            const odds = [];
            const oddHandles = await marketHandle.$$('button.odds-button');
            // console.log('oddHandles: (' + oddHandles.length + ') ' + oddHandles);
            for(const oddHandle of oddHandles){
              const coefHandle = await oddHandle.$('span.odds-button__odds');
              const coef = coefHandle ? await coefHandle.evaluate(el => el.textContent) : '0'
              odds.push({
                name: await oddHandle.$eval('div.odds-button__name', el => el.textContent),
                odd: {
                  book: 'tp',
                  coef: coef,
                }
              })
            }
            marketArray.push({name:name, odds:odds});
          }
        }
        
        // for(const market of marketArray){
        //     console.log(market.name);
        //     for(const odd of market.odds){
        //         console.log(odd);
        //     }
        // }

        await page.close();
        return marketArray;
      })))
      .filter(e => e.status === "fulfilled")
      .map(e => e.value);
    console.log(matches);
  })()
    .catch(err => console.error(err))
    .finally(() => browser?.close());
}

export async function handleURL_esb_p(urls){
  let browser;
  // adapted from https://stackoverflow.com/questions/46293216/crawling-multiple-urls-in-a-loop-using-puppeteer/65000065#65000065 
  (async () => {
    browser = await puppeteer.launch({
      headless:  false,
      args: ["--disable-web-security"]
    });

    const matches = (await Promise.allSettled(
      urls.map(async (url) => {
        const page = await browser.newPage();
        await page.goto(url);
  await page.waitForSelector('div.games_inner');

        // console.log(await page.$eval('span', el=>el.textContent));

        const marketArray = [];
        const sel = 'div.PrematchMarket_eachItem';
        const oddHandles = await page.$$(sel);
        console.log('oddHandles: (' + oddHandles.length + ') ' + oddHandles);
        const tail = await page.$('div.Prematrket_eachItem:last-of-type');
        console.log(tail);
        await tail.scrollIntoView();

          const firstEl = await page.$('div.gamesListins_content.el_pg > div > a:first-of-type');
          const lastEl = await page.$('div.gamesListins_content.el_pg > div > a:last-of-type');
          await lastEl.scrollIntoView();
          matchHandles = await page.$$(matchHandlesSelector);
          noUpcoming = matchHandles.length;
          await firstEl.scrollIntoView();

        for(const oddHandle of oddHandles){

          const odds = [];
          const coefClasses = ['.blueTeam', '.redTeam'];
          for(const whichCoef of coefClasses){
            // scrape coef for blueTeam and redTeam (always exactly 2 coefs)
            const coefHandle = await oddHandle.waitForSelector(whichCoef);
            const titleHandle = await coefHandle.$('div.title');
            const name = titleHandle ?
              await titleHandle.evaluate(el => el.textContent)
              : await coefHandle.$eval('div.teamName', el => el.textContent);
            odds.push({
              name: name,
              odd: {
                book: 'esb',
                coef: await coefHandle.$eval('span', el => el.textContent)
              }
            });
          }

          marketArray.push({
            name: await oddHandle.$eval('span.resultDescription', el => el.textContent),
            odds: odds
          });
        }

        
        for(const market of marketArray){
            console.log(market.name);
            for(const odd of market.odds){
                console.log(odd);
            }
        }

        await page.close();
        return marketArray;
      })))
      .filter(e => e.status === "fulfilled")
      .map(e => e.value);
    console.log(matches);
  })()
    .catch(err => console.error(err))
    .finally(() => browser?.close());
}