import puppeteer from "puppeteer";

export async function handleURL_tp(data, url){
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ["--disable-web-security"]
  });  
  
  try{
//    console.log('data: ');
//    console.log(JSON.stringify(data, null, 2));
    const page = await browser.newPage();    
    page.setViewport({width:1000, height:30000})
    await page.goto(url);
  
    let selector, el;
    // get sport
    selector = "#breadcrumbs > div:nth-child(2) > a";
    el = await page.waitForSelector(selector);
    const sportName = await page.evaluate( e => e.textContent.trim().replace(/\u00a0/g, '\u0020'), el);
//    console.log('>>>>>>>>>>>>>>> scraped sportName: ' + sportName);
    let sport = data.sports.findLast(s => s.name === sportName);
//    console.log('sport: ');
//    console.log(JSON.stringify(sport, null, 2));
    if(!sport){
      /* sport is new */
      data.sports.push({ name: sportName, tournaments: [] });
      sport = data.sports.findLast(s => s.name === sportName);
    }
//    console.log('sport: ');
//    console.log(JSON.stringify(sport, null, 2));

    // get tournament
    selector = "#breadcrumbs > div:nth-child(3) > a";
    el = await page.waitForSelector(selector);
    const tournamentName = await page.evaluate( e => e.textContent.trim().replace(/\u00a0/g, '\u0020'), el);
//    console.log('>>>>>>>>>>>>>>> scraped tournamentname: ' + tournamentName);
    let tournament = sport.tournaments.findLast(t => t.name === tournamentName );
    if(!tournament){
      /* tournament is new */
      sport.tournaments.push({ name: tournamentName, matches: [] });
      tournament = sport.tournaments.findLast(t => t.name === tournamentName);
    }
//    console.log('tournament: ');
//    console.log(JSON.stringify(tournament, null, 2));

    // get teamHome, teamAway, datetime, mode
    selector = "div.main-market__home-team > div";
    el = await page.waitForSelector(selector);
    const teamHome = await page.evaluate( e => e.textContent.trim().replace(/\u00a0/g, '\u0020'), el);
//    console.log('>>>>>>>>>>>>>>> scraped teamHome: ' + teamHome);
    selector = "div.main-market__away-team > div";
    el = await page.waitForSelector(selector);
    const teamAway = await page.evaluate( e => e.textContent.trim().replace(/\u00a0/g, '\u0020'), el);
//    console.log('>>>>>>>>>>>>>>> scraped teamAway: ' + teamAway);
    selector = "div.match-header__date";
    el = await page.waitForSelector(selector);
    const datetime = await page.evaluate( e => e.textContent.trim().replace(/\u00a0/g, '\u0020'), el);
//    console.log('>>>>>>>>>>>>>>> scraped datetime: ' + datetime);
    // selector = "div.match-header__bo";
    // el = await page.waitForSelector(selector);
    // const mode = await page.evaluate( e => e.textContent.trim().replace(/\u00a0/g, '\u0020'), el);
//    console.log('>>>>>>>>>>>>>>> scraped mode: ' + mode);
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
    match.urls.push({book: 'Thunderpick', url: url});
//    console.log('match: ');
//    console.log(JSON.stringify(match, null, 2));

    // GET ALL THE MARKETS > ODDS > COEFS FOR THIS MATCH
      // get the Match Winner market
        // get the coefHome
    let marketName = 'Match Winner';
    selector = 'button.main-market__left-odds > span';
    el = await page.waitForSelector(selector);
    const coefHome = await page.evaluate(e => parseFloat(e.textContent), el);
//    console.log('>>>>>>>>>>>>>>> scraped coefHome: ' + coefHome);
    let market = match.markets.findLast(m => m.name === marketName);
    if(!market){
      match.markets.push({name: marketName, odds: []});
      market = match.markets.findLast(m => m.name === marketName);
    }
//    console.log('market: ');
//    console.log(JSON.stringify(market, null, 2));
    let odd = market.odds.findLast(o => o.name === 'home');
    if(!odd){
      market.odds.push({name: 'home', coefs: []});
      odd = market.odds.findLast(o => o.name === 'home');
    }
//    console.log('odd: ');
//    console.log(JSON.stringify(odd, null, 2));
    let coef = odd.coefs.findLast(c => c.book === 'Thunderpick');
    if(!coef){
      odd.coefs.push({book: 'Thunderpick', value: coefHome});
    } else{
      coef.coef = coefHome;
    }
//    console.log('coef: ');
//    console.log(JSON.stringify(coef, null, 2));
        // get the coefAway
    selector = 'button.main-market__right-odds > span';
    el = await page.waitForSelector(selector);
    const coefAway = await page.evaluate(e => parseFloat(e.textContent), el);
//    console.log('>>>>>>>>>>>>>>> scraped coefAway: ' + coefAway);
    odd = market.odds.findLast(o => o.name === 'away');
    if(!odd){
      market.odds.push({name: 'away', coefs: []});
      odd = market.odds.findLast(o => o.name === 'away');
    }
//    console.log('odd: ');
//    console.log(JSON.stringify(odd, null, 2));
    coef = odd.coefs.findLast(c => c.book === 'Thunderpick');
    if(!coef){
      odd.coefs.push({book: 'Thunderpick', value: coefAway});
    } else{
      coef.coef = coefAway;
    }
//    console.log('coef: ');
//    console.log(JSON.stringify(coef, null, 2));
      // get all the other markets
    // TODO i need scrolling here
    selector = 'div.market-accordion';
    await page.waitForSelector(selector);
    const marketHandles = await page.$$(selector);
    for(const marketHandle of marketHandles){

      selector = 'div.market-accordion__market-name';
      marketName = await marketHandle.$eval(selector, e => e.textContent);
//      console.log('>>>>>>>>>>>>>>> scraped marketName: ' + marketName);
      market = match.markets.findLast(m => m.name === marketName);
      if(!market){
        match.markets.push({name: marketName, odds: []});
        market = match.markets.findLast(m => m.name === marketName);
      }
//      console.log('market: ');
//      console.log(JSON.stringify(market, null, 2));

      selector = 'div.market-row';
      const oddHandles = await marketHandle.$$(selector);
//      console.log(`$$${selector} length: ${oddHandles.length}`);
      if(oddHandles.length >= 2){
        selector = 'div.market-row__team-name';
        const teamPrefix = await oddHandles[0].$$eval(selector, es => (es.map(e => e.textContent)));
//        console.log(`$$eval${selector} length: ${teamPrefix.length}`);
//        console.log('>>>>>>>>>>>>>>> scraped teamPrefix[0]: ' + teamPrefix[0]);
//        console.log('>>>>>>>>>>>>>>> scraped teamPrefix[1]: ' + teamPrefix[1]);
        selector = 'button.odds-button';
        for(let i = 1; i < oddHandles.length; i++){
          const buttonHandles = await oddHandles[i].$$(selector);
//          console.log(`$$eval${selector} length: ${buttonHandles.length}`);
          for(let j = 0; j < buttonHandles.length; j++){
            const teamSufix = await buttonHandles[j].$eval('div.odds-button__name', e => e.textContent);
            const oddName = teamPrefix[j] ? `${teamPrefix[j]} ${teamSufix}` : teamSufix;
            odd = market.odds.findLast(o => o.name === oddName);
//            console.log('>>>>>>>>>>>>>>> scraped oddName: ' + oddName);
            if(!odd){
              market.odds.push({name: oddName, coefs: []})
              odd = market.odds.findLast(o => o.name === oddName);
            }
            let value;
            try{
              value = await buttonHandles[j].$eval('span.odds-button__odds', e => parseFloat(e.textContent));
            } catch(error){
//              console.log('This odd has no value (the market could be locked)');
              value = undefined;
            }
//            console.log('>>>>>>>>>>>>>>> scraped value: ' + value);
            coef = odd.coefs.findLast(c => c.book === 'Thunderpick');
            if(!coef){
              odd.coefs.push({book: 'Thunderpick', value: value});
            }
//            console.log('market: ');
//            console.log(JSON.stringify(market, null, 2));
          }
        }
      } else{
        console.error(`I have less than 2 odds for market ${marketName}`);
        throw error(`I have less than 2 odds for market ${marketName}`);
      }
    }

//    console.log(`Success! scraping a TP match from ${url}`);
    return;    

  } catch (error){
    console.error(`Failure! scraping a TP match from ${url}`);
    return -1;
  } finally{
    await browser?.close();
  }
  
}