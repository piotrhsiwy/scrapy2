function filterReq(request, blockRequestURLs){
    // request.continue();
    // if (request.isInterceptResolutionHandled()) return;
    // const regex = /iconatwitch|thp|hotjar|casino|chat|translations|survey|mobile/;
    const regex = new RegExp(blockRequestURLs, 'i');
    const url = request.url();
    const type = request.resourceType();
    const block = 
        type === 'image' ||
        type === 'font' ||
        type === 'ping' ||
        type === 'media' ||
        // the commented filters break the required functionality of the page
        // type === 'stylesheet' ||
        url.endsWith('.png')      ||
        url.endsWith('.jpg')      ||
        url.endsWith('.svg')      ||
        url.endsWith('.ico')      ||
        regex.test(url)
    if(block){
        // console.log(`Blocking ${type} ${url}`);
        request.abort();
    } else {
        // console.log(`Allowing ${type} ${url}`);
        request.continue();
    }
}

// this function is suposed to decreasing loading times by limiting the number of requests for media, tracking, etc.
// note that this might/does change the structure of the DOM, which interfers with scraping
export async function prepPage(browser, book){
    const page = await browser.newPage();
    await page.setViewport(book.viewport);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setRequestInterception(true);
    page.on('request', (request) => filterReq(request, book.blockRequestURLs));
    // page.on('console', msg => {
    //   // Log all console messages -> used to be able to better debug from inside of the browser context
    //   console.log(`[Browser Console]: ${msg.type().toUpperCase()} ${msg.text()}`);
    // });
    // page.on('error', (error) => {
    //   // Log all error messages on page crash -> used to be able to better debug from inside of the browser context
    //   console.error(`[Page Crash Error] ${error.message}`);
    // });
    return page;
}

    // anti-fingerprinting by https://chatgpt.com/g/g-p-68de5b89bdd08191b2ed9ed5ade0b716-scrapy2/c/68deac7e-85c0-8321-8cd3-4e55bf5ee4c2
// Requires: puppeteer-extra + puppeteer-extra-plugin-stealth
// npm i puppeteer-extra puppeteer-extra-plugin-stealth puppeteer

export async function applyPatches(page, opts = {}) {
  
  // sensible defaults you can override via opts
  const {
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36',
    languages = ['en-US', 'en'],
    pluginsLength = 3,
    webdriver = false,
    hardwareConcurrency = 8,
    deviceMemory = 8,
    fakePlatform = 'Win32',
    timezone = 'America/Los_Angeles',
    screen = { width: 1366, height: 768, availWidth: 1366, availHeight: 728, colorDepth: 24, pixelDepth: 24 }
  } = opts;

  // run these before any script on the page
  await page.evaluateOnNewDocument((opts) => {
    // ---- navigator basic spoofing ----
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => opts.webdriver });
    } catch (e) {}

    try {
      Object.defineProperty(navigator, 'platform', { get: () => opts.fakePlatform });
    } catch (e) {}

    try {
      Object.defineProperty(navigator, 'languages', { get: () => opts.languages });
    } catch (e) {}

    try {
      Object.defineProperty(navigator, 'deviceMemory', { get: () => opts.deviceMemory });
    } catch (e) {}

    try {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => opts.hardwareConcurrency });
    } catch (e) {}

    // pseudo plugins (non-empty)
    try {
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          // minimal fake PluginArray-like object
          const fake = new Array(opts.pluginsLength).fill({ name: 'Chrome PDF Plugin' });
          Object.defineProperty(fake, 'length', { value: opts.pluginsLength });
          return fake;
        }
      });
    } catch (e) {}

    // ---- timezone spoofing via Intl.resolvedOptions ----
    try {
      const realResolved = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = function() {
        const r = realResolved.call(this);
        r.timeZone = opts.timezone;
        return r;
      };
    } catch (e) {}

    // ---- screen properties ----
    try {
      if (window.screen) {
        try { Object.defineProperty(window.screen, 'width', { get: () => opts.screen.width }); } catch {}
        try { Object.defineProperty(window.screen, 'height', { get: () => opts.screen.height }); } catch {}
        try { Object.defineProperty(window.screen, 'availWidth', { get: () => opts.screen.availWidth }); } catch {}
        try { Object.defineProperty(window.screen, 'availHeight', { get: () => opts.screen.availHeight }); } catch {}
        try { Object.defineProperty(window.screen, 'colorDepth', { get: () => opts.screen.colorDepth }); } catch {}
        try { Object.defineProperty(window.screen, 'pixelDepth', { get: () => opts.screen.pixelDepth }); } catch {}
      }
    } catch (e) {}

    // ---- permissions API fix for notifications and other checks ----
    try {
      const originalQuery = navigator.permissions && navigator.permissions.query;
      if (originalQuery) {
        navigator.permissions.query = (parameters) => {
          // spoof notifications check
          if (parameters && parameters.name === 'notifications') {
            return Promise.resolve({ state: Notification.permission });
          }
          return originalQuery(parameters);
        };
      }
    } catch (e) {}

    // ---- mediaDevices / enumerateDevices spoof ----
    try {
      if (!navigator.mediaDevices) navigator.mediaDevices = {};
      navigator.mediaDevices.enumerateDevices = navigator.mediaDevices.enumerateDevices || function() {
        // return a small, realistic set of devices
        return Promise.resolve([
          { kind: 'audioinput', deviceId: 'default', label: 'Microphone (Realtek)', groupId: '1' },
          { kind: 'videoinput', deviceId: 'default', label: 'Integrated Webcam', groupId: '1' }
        ]);
      };
    } catch (e) {}

    // ---- AudioContext fingerprint mitigation ----
    try {
      const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
      if (OrigAudioContext) {
        const origCreateAnalyser = OrigAudioContext.prototype.createAnalyser;
        OrigAudioContext.prototype.createAnalyser = function() {
          const analyser = origCreateAnalyser.apply(this, arguments);
          // if sites inspect analyser.getFloatFrequencyData, we could patch, but simplest: return analyser
          return analyser;
        };
      }
    } catch (e) {}

    // ---- WebGL vendor/renderer spoofing ----
    try {
      const getParameter = WebGLRenderingContext && WebGLRenderingContext.prototype.getParameter;
      if (getParameter) {
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          // UNMASKED_VENDOR_WEBGL = 37445, UNMASKED_RENDERER_WEBGL = 37446
          if (parameter === 37445) return 'Intel Inc.';
          if (parameter === 37446) return 'Intel Iris OpenGL Engine';
          return getParameter.call(this, parameter);
        };
      }
    } catch (e) {}

    // ---- Canvas fingerprint mitigation: add a tiny deterministic noise to toDataURL/ getImageData ----
    try {
      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        // Optionally: leave it identical or add slight consistent noise by drawing a tiny transparent pixel
        // Keep it simple: return original result (stealth does this often already)
        return toDataURL.apply(this, arguments);
      };

      // Also patch getImageData if sites use it heavily:
      const getImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
        const data = getImageData.apply(this, arguments);
        // subtle deterministic modification could be applied here if needed; keep unchanged by default
        return data;
      };
    } catch (e) {}
  }, {
    // pass options to the page context
    webdriver,
    languages,
    pluginsLength,
    deviceMemory,
    hardwareConcurrency,
    fakePlatform,
    timezone,
    screen
  });

  // Set UA here (after evaluateOnNewDocument so scripts using UA on load also see it)
  await page.setUserAgent(userAgent);
}