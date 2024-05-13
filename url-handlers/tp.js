import puppeteer from "puppeteer";

export async function handleURL_tp_parallel(urls){
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