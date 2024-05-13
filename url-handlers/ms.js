import puppeteer from "puppeteer";

export async function handleURL_ms_parallel(urls){
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