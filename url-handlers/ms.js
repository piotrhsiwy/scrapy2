import puppeteer from "puppeteer";

export async function handleURL_ms(data, url){
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--disable-web-security"]
  });  
  
  try{
//console.log('data: ');
//console.log(JSON.stringify(data, null, 2));
    let page = await browser.newPage();    
    page.setViewport({width:1000, height:2000})
    await page.goto(url);
  
    let selector, el;
    // get sport
    selector = 'iframe';
    el = await page.waitForSelector(selector);
    const iframeHandle = await page.$(selector);
    page = await iframeHandle.contentFrame();

    selector = 'div.match-title';
    el = await page.waitForSelector(selector);
    const breadcrumbs = await page.evaluate( e => e.textContent.trim().replace(/\u00a0/g, '\u0020').split(' keyboard_arrow_right'), el);
    const sportName = breadcrumbs[0];
//console.log('>>>>>>>>>>>>>>> scraped sportName: ' + sportName);
    let sport = data.sports.findLast(s => s.name === sportName);
    if(!sport){
      /* sport is new */
      data.sports.push({ name: sportName, tournaments: [] });
      sport = data.sports.findLast(s => s.name === sportName);
    }
//console.log('sport: ');
//console.log(JSON.stringify(sport, null, 2));

    // get tournament
    const tournamentName = breadcrumbs[2];
//console.log('>>>>>>>>>>>>>>> scraped tournamentname: ' + tournamentName);
    let tournament = sport.tournaments.findLast(t => t.name === tournamentName );
    if(!tournament){
      /* tournament is new */
      sport.tournaments.push({ name: tournamentName, matches: [] });
      tournament = sport.tournaments.findLast(t => t.name === tournamentName);
    }
//console.log('tournament: ');
//console.log(JSON.stringify(tournament, null, 2));

    // get teamHome, teamAway, datetime, mode
    const teams = breadcrumbs[3].split(' - ');
    const teamHome = teams[0].trim();
    const teamAway = teams[1].replace(/\s+Hide All/, '').trim();
//console.log('>>>>>>>>>>>>>>> scraped teamHome: ' + teamHome);
//console.log('>>>>>>>>>>>>>>> scraped teamAway: ' + teamAway);
    selector = 'div.match-info > p:nth-child(3)';
    el = await page.waitForSelector(selector);
    const datetime = await page.evaluate( e => e.textContent.trim().replace(/\u00a0/g, '\u0020').split(', ')[1].trim(), el);
//console.log('>>>>>>>>>>>>>>> scraped datetime: ' + datetime);
//     selector = "div.match-header__bo";
//     el = await page.waitForSelector(selector);
//     const mode = await page.evaluate( e => e.textContent.trim().replace(/\u00a0/g, '\u0020'), el);
//// console.log('>>>>>>>>>>>>>>> scraped mode: ' + mode);
    let match = tournament.matches.findLast(m =>
        m.teamHome === teamHome &&
        m.teamAway === teamAway &&
        m.datetime === datetime
    )
    if(!match){
      /* tournament is new */
      tournament.matches.push({ 
        teamHome: teamHome,
        teamAway: teamAway,
        datetime: datetime,
        urls: [],
        markets: []
      });
      match = tournament.matches.findLast(m =>
          m.teamHome === teamHome &&
          m.teamAway === teamAway &&
          m.datetime === datetime
      );
    }
    match.urls.push({book: 'Mystake', url: url});
//console.log('match: ');
//console.log(JSON.stringify(match, null, 2));

    // GET ALL THE MARKETS > ODDS > COEFS FOR THIS MATCH
    let market, odd, coef;
    selector = 'div.m-col > div';
    const marketHandles = await page.$$(selector);
//    console.log(`$$${selector} length: ${marketHandles.length}`);
    for(const marketHandle of marketHandles){

      selector = 'div.title > span';
      const marketName = await marketHandle.$eval(selector, e => e.textContent);
//console.log('>>>>>>>>>>>>>>> scraped marketName: ' + marketName);
      market = match.markets.findLast(m => m.name === marketName);
      if(!market){
        match.markets.push({name: marketName, odds: []});
        market = match.markets.findLast(m => m.name === marketName);
      }
//console.log('market: ');
//console.log(JSON.stringify(market, null, 2));

      selector = 'div.market-odds > div';
      const oddsHandles = await marketHandle.$$(selector);
//      console.log(`$$${selector} length: ${oddsHandles.length}`);
      for(const oddHandle of oddsHandles){
        let oddName = await oddHandle.$eval('p.odd-name', e => e.textContent);
//console.log('>>>>>>>>>>>>>>> scraped oddName: ' + oddName);
        odd = market.odds.findLast(o => o.name === oddName);
        if(!odd){
          market.odds.push({name: oddName, coefs: []})
          odd = market.odds.findLast(o => o.name === oddName);
        }
        const value = await oddHandle.$eval('span.coef', e => parseFloat(e.textContent));
//console.log('>>>>>>>>>>>>>>> scraped value: ' + value);
        coef = odd.coefs.findLast(c => c.book === 'Mystake');
        if(!coef){
          odd.coefs.push({book: 'Mystake', value: value});
        }
//console.log('market: ');
//console.log(JSON.stringify(market, null, 2));
      }
    }

//console.log(`Success! scraping a TP match from ${url}`);
  return;    

  } catch (error){
    console.error(`Failure! scraping a TP match from ${url}`);
    return -1;
  } finally{
    await browser?.close();
  }
  
}