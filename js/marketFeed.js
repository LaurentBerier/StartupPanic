/**
 * marketFeed.js  Pulls REAL market/tech headlines from public RSS feeds and
 * hands them to the story engine, which launders the brand names into parody
 * and twists them into jokes (see pushMarketItem in storyEngine.js).
 *
 * Design goals:
 *   - Zero hard dependency on the network. If every feed/CORS-proxy fails, we
 *     fall back to a built-in bank of evergreen headlines so the "real news,
 *     fake names" bit still lands offline. The game NEVER breaks on this.
 *   - Self-throttling: keeps a small pool of fresh headlines and drips one into
 *     the feed on an interval, refilling in the background.
 *
 * Public RSS is not CORS-enabled, so we go through a JSON proxy (rss2json).
 * Nothing about the run is ever sent out  we only GET public headlines.
 */

const PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';
const FEEDS = [
  'https://www.cnbc.com/id/100003114/device/rss/rss.html', // CNBC top news
  'https://www.cnbc.com/id/10000664/device/rss/rss.html',  // CNBC finance
  'https://www.cnbc.com/id/19854910/device/rss/rss.html',  // CNBC technology
  'https://www.cnbc.com/id/20910258/device/rss/rss.html',  // CNBC investing
  'https://hnrss.org/frontpage',                           // Hacker News front page
];

/* Evergreen fallbacks (real-flavored, brand-heavy so laundering has something to
   chew on). Used only when live fetches fail. */
const FALLBACK = [
  { title: 'Nvidia hits record high as investors pile into anything with "AI" in the name', source: 'MarketWatch-ish' },
  { title: 'Tesla recalls vehicles over software update that added a new bug', source: 'Reuters-ish' },
  { title: 'Apple unveils thinner device nobody asked for at higher price everyone will pay', source: 'The Verge-ish' },
  { title: 'Bitcoin surges, then plunges, then surges, all before lunch', source: 'CoinDesk-ish' },
  { title: 'Meta pours billions into the metaverse; analysts locate three (3) users', source: 'Boomberg' },
  { title: 'Amazon announces layoffs alongside record profits; stock climbs', source: 'CNBC-ish' },
  { title: 'Fed hints it may or may not do the thing markets wanted', source: 'WSJ-ish' },
  { title: 'Google rolls out AI feature that confidently invents your search results', source: 'Ars-ish' },
  { title: 'Microsoft adds Copilot to a button you cannot remove', source: 'The Register-ish' },
  { title: 'OpenAI raises another round at a valuation described as "a vibe"', source: 'The Information-ish' },
  { title: 'Robinhood users discover investing can, in fact, go down', source: 'MarketWatch-ish' },
  { title: 'Netflix cracks down on password sharing; grandma now a paying subscriber', source: 'Variety-ish' },
  { title: 'Spotify raises prices, pays artists in exposure and a firm handshake', source: 'Billboard-ish' },
  { title: 'S&P 500 hits all-time high for reasons nobody can fully explain', source: 'CNBC-ish' },
  { title: 'Coinbase says funds are safe in a tone that reassures no one', source: 'Decrypt-ish' },
  { title: 'Uber achieves profitability by redefining several words', source: 'FT-ish' },
  { title: 'Startup raises $200M Series B to disrupt an industry that was fine', source: 'TechCrunch-ish' },
  { title: 'Wall Street bets big on quantum, admits it does not know what quantum is', source: 'Boomberg' },
];

const rand = a => a[Math.floor(Math.random() * a.length)];

/** Fetch + normalize one RSS feed through the proxy. Returns [] on any failure. */
async function fetchFeed(url, timeoutMs = 6500) {
  if (typeof fetch === 'undefined') return [];
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(PROXY + encodeURIComponent(url), ctl ? { signal: ctl.signal } : {});
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || data.status !== 'ok' || !Array.isArray(data.items)) return [];
    const source = (data.feed && data.feed.title) || '';
    return data.items
      .map(it => ({ title: (it.title || '').trim(), source, link: it.link }))
      .filter(it => it.title && it.title.length > 12);
  } catch (_) {
    return [];
  } finally {
    if (t) clearTimeout(t);
  }
}

/**
 * Start dripping laundered market headlines into the feed.
 * @param {(raw:{title,source,link})=>void} onItem  where to send each headline
 * @param {object} [opts]
 * @param {()=>boolean} [opts.shouldEmit]  gate (e.g. game live & not paused)
 * @param {number} [opts.intervalMs]  ms between drips (default ~50s)
 * @returns {{stop:()=>void}}
 */
export function startMarketFeed(onItem, opts = {}) {
  const shouldEmit = opts.shouldEmit || (() => true);
  const intervalMs = opts.intervalMs || 80000;
  let pool = [];
  let live = false;        // did any real feed ever succeed?
  let stopped = false;
  let refreshing = false;
  const usedTitles = new Set();

  async function refresh() {
    if (refreshing || stopped) return;
    refreshing = true;
    try {
      // Try a couple of feeds  some (CORS/rate limit) fail intermittently.
      const order = [...FEEDS].sort(() => Math.random() - 0.5);
      for (const url of order.slice(0, 3)) {
        if (stopped) break;
        const items = await fetchFeed(url);
        if (items.length) { live = true; pool = pool.concat(items); break; }
      }
    } finally {
      refreshing = false;
    }
    if (pool.length > 60) pool = pool.slice(-60);
  }

  function nextItem() {
    // Prefer fresh live headlines; fall back to the evergreen bank.
    for (let i = 0; i < pool.length; i++) {
      const it = pool.shift();
      if (it && !usedTitles.has(it.title)) { usedTitles.add(it.title); return it; }
    }
    const fb = rand(FALLBACK);
    return fb;
  }

  function drip() {
    if (stopped) return;
    try {
      if (shouldEmit()) onItem(nextItem());
    } catch (_) { /* never let the feed timer die */ }
    if (pool.length < 6) refresh();
  }

  // Kick off: one background refresh, first drip shortly after so the feed shows
  // it early, then steady drips.
  refresh();
  const firstTimer = setTimeout(() => { if (!stopped) drip(); }, 12000);
  const timer = setInterval(drip, intervalMs);

  return {
    stop() { stopped = true; clearInterval(timer); clearTimeout(firstTimer); },
    isLive() { return live; },
  };
}
