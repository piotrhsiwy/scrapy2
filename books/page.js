function filterReq(request, blockRequestURLs){
    // request.continue();
    // if (request.isInterceptResolutionHandled()) return;
    // const regex = /iconatwitch|thp|hotjar|casino|chat|translations|survey|mobile/;
    const regex = new RegExp(blockRequestURLs);
    const url = request.url();
    const type = request.resourceType();
    const block = 
        url.endsWith('.png')      ||
        url.endsWith('.jpg')      ||
        url.endsWith('.svg')      ||
        url.endsWith('.ico')      ||
        regex.test(url)           ||
        type.includes('image');
    if(block){
        // console.log(`Blocking`);
        // console.log(type);
        // console.log(url);
        request.abort();
    } else {
        // console.log(`Allowing`);
        // console.log(type);
        // console.log(url);
        request.continue();
    }
}

export async function prepPage(browser, book){
    const page = await browser.newPage();
    await page.setViewport(book.viewport);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setRequestInterception(true);
    page.on('request', (request) => filterReq(request, book.blockRequestURLs));
    return page;
}