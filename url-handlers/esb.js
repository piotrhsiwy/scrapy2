import puppeteer from 'puppeteer';

export async function handleURL_esb(data, url){
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--disable-web-security']
  });  
  
  try{
//console.log('data: ');
//console.log(JSON.stringify(data, null, 2));
    let page = await browser.newPage();    
    page.setViewport({width:1000, height:1000})
    await page.goto(url);
  
    let selector, el;
    // get sport
    selector = 'div.oPInfo';
    const infoHandle = await page.waitForSelector(selector);
    const sportName = await infoHandle.$eval('img', e => e.getAttribute('src').split('/').pop().split('.')[0]);
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
    selector = 'div.leagueName';
    const tournamentName = await infoHandle.$eval(selector, e => e.textContent.trim().replace(/\u00a0/, '\u0020'));
//console.log('>>>>>>>>>>>>>>> scraped tournamentname: ' + tournamentName);
    let tournament = sport.tournaments.findLast(t => t.name === tournamentName );
    if(!tournament){
      /* tournament is new */
      sport.tournaments.push({ name: tournamentName, matches: [] });
      tournament = sport.tournaments.findLast(t => t.name === tournamentName);
    }
//console.log('tournament: ');
//console.log(JSON.stringify(tournament, null, 2));

    // get teamHome, teamAway
    selector = 'div.lDTeamName';
    const teams = await page.$$eval(selector, elements => elements.map( e => e.textContent.trim() ));
    const teamHome = teams[0];
    const teamAway = teams[1];
//console.log('>>>>>>>>>>>>>>> scraped teamHome: ' + teamHome);
//console.log('>>>>>>>>>>>>>>> scraped teamAway: ' + teamAway);
    
    // get datetime, mode
    selector = 'div.matchStatus';
    el = await infoHandle.$eval(selector, e => e.textContent.trim().replace(/\u00a0/, '\u0020'));
    const datetime = el.split('B')[0];
//console.log('>>>>>>>>>>>>>>> scraped datetime: ' + datetime);
    let mode = el.split('B')[1];
    mode = 'B' + mode;    
//console.log('>>>>>>>>>>>>>>> scraped mode: ' + mode);

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
    match.urls.push({book: 'Esportsbet', url: url});
//console.log('match: ');
//console.log(JSON.stringify(match, null, 2));

    // GET ALL THE MARKETS > ODDS > COEFS FOR THIS MATCH
    let market, odd, coef;
    selector = 'div.matchWrp';
    let marketHandles = await page.$$(selector);
//console.log(`$$${selector} length: ${marketHandles.length}`);
    // scroll until no more elements are loaded
    let old_size, new_size;
    do{
      old_size =  marketHandles.length;
      await marketHandles[marketHandles.length-1].scrollIntoView();
      await page.waitForNetworkIdle({idleTime: 500});
      marketHandles = await page.$$(selector);
//      console.log(`$$${selector} length: ${marketHandles.length}`);
      new_size =  marketHandles.length;
    } while( old_size !== new_size );
    for(const marketHandle of marketHandles){
      // get marketName
      selector = 'div.matchInfoLeft';
      const marketName = await marketHandle.$eval(selector, e => e.textContent.trim());
//console.log('>>>>>>>>>>>>>>> scraped marketName: ' + marketName);
      market = match.markets.findLast(m => m.name === marketName);
      if(!market){
        match.markets.push({name: marketName, odds: []});
        market = match.markets.findLast(m => m.name === marketName);
      }
//console.log('market: ');
//console.log(JSON.stringify(market, null, 2));
      // get odds
      selector = 'div.oddsWrp';
      const oddsHandles = await marketHandle.$$(selector);
//console.log(`$$${selector} length: ${oddsHandles.length}`);
      for(const oddHandle of oddsHandles){ 
        let oddName;
        const has_label = await oddHandle.$('label');
        if(has_label){
          oddName = await page.evaluate(e => e.textContent ,has_label);
        } else{
          // if no_label that means append its content at the end of oddName
          const sufix = await oddHandle.$eval('div.odds', e => e.textContent.trim())
          market.name = market.name + sufix;
          continue;
        }
//console.log('>>>>>>>>>>>>>>> scraped oddName: ' + oddName);
        odd = market.odds.findLast(o => o.name === oddName);
        if(!odd){
          market.odds.push({name: oddName, coefs: []})
          odd = market.odds.findLast(o => o.name === oddName);
        }
        // value = null if an odd is locked
        const is_unlocked = await oddHandle.$eval('div.odds', e => e.textContent.match(/[\d.]+/));
        const value = is_unlocked ? parseFloat(is_unlocked[0]) : null;
//console.log('>>>>>>>>>>>>>>> scraped value: ' + value);
        coef = odd.coefs.findLast(c => c.book === 'Esportsbet');
        if(!coef){
          odd.coefs.push({book: 'Esportsbet', value: value});
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