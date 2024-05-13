import puppeteer from "puppeteer";

export async function handleURL_esb(url){
  let browser;
  // adapted from https://stackoverflow.com/questions/46293216/crawling-multiple-urls-in-a-loop-using-puppeteer/65000065#65000065 
  (async () => {
    browser = await puppeteer.launch({
      headless:  "new",
      args: ["--disable-web-security"]
    });

    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForSelector('div.games_inner');

    // console.log(await page.$eval('span', el=>el.textContent));

    const marketArray = [];

    const sel = 'div.PrematchMarket_eachItem';
    const SCROLL_TIMEOUT = 2000;
    let oddHandles = await page.$$(sel);
    console.log('oddHandles: (' + oddHandles.length + ') ' + oddHandles);
    await page.evaluate(async () => {console.log(document.body.scrollHeight)});
    await oddHandles[oddHandles.length-1].scrollIntoView();
    await new Promise((resolve) => setTimeout(resolve, SCROLL_TIMEOUT));

    let oddHandlesMore = await page.$$(sel);
    console.log('oddHandlesMore: (' + oddHandlesMore.length + ') ' + oddHandlesMore);
    await page.evaluate(async () => {console.log(document.body.scrollHeight)});

    while(oddHandlesMore.length !== oddHandles.length){
        oddHandles = oddHandlesMore;
        await oddHandles[oddHandles.length-1].scrollIntoView();
        await new Promise((resolve) => setTimeout(resolve, SCROLL_TIMEOUT));
        oddHandlesMore = await page.$$(sel);
        console.log('oddHandlesMore: (' + oddHandlesMore.length + ') ' + oddHandlesMore);
        await page.evaluate(async () => {console.log(document.body.scrollHeight)});
    }

    for(const oddHandle of oddHandlesMore){

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

    
    // for(const market of marketArray){
    //     console.log(market.name);
    //     for(const odd of market.odds){
    //         console.log(odd);
    //     }
    // }

    await page.close();
    console.log(marketArray);
    return marketArray;
  })()
    .catch(err => console.error(err))
    .finally(() => browser?.close());
}