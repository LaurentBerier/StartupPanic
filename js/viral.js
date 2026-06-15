/**
 * viral.js — The "screenshottable comedy" layer for AI Startup Panic.
 *
 * Adds, on top of the tycoon sim:
 *  - Procedural company identity (name + cursed pitch)
 *  - Founder tweet generator (delusional milestone tweets)
 *  - Disaster-headline chyrons (TechCrush / CNNN lower-thirds)
 *  - Weighted, flavored endings (Bankruptcy, Prison, Unicorn, IPO, ...)
 *  - A polished, shareable obituary / exit card (copy text + PNG to clipboard)
 *
 * One-way dependency: imports read-only helpers/banks from gameLogic.js.
 */

import {
  CONFIG, getValuation, getMRR, fmtMoney,
  NAME_PRE, NAME_SUF, PRODUCT_NOUNS, AUDIENCES, TWISTS,
} from './gameLogic.js';

// ─── tiny helpers ──────────────────────────────────────────────────────────────
const rand = a => a[Math.floor(Math.random() * a.length)];
const pick = (a, seed) => a[Math.abs(Math.round(seed)) % a.length];
const ri   = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

// ─── company identity ────────────────────────────────────────────────────────
export function genCompanyIdentity() {
  let name = rand(NAME_PRE) + rand(NAME_SUF);
  if (Math.random() < 0.22) name = rand(NAME_PRE) + rand(NAME_PRE).toLowerCase() + rand(NAME_SUF);
  const pitch = `${rand(PRODUCT_NOUNS)} ${rand(AUDIENCES)}, ${rand(TWISTS)}.`;
  const handle = name.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 14) + '_ceo';
  return { name, pitch, handle };
}

// ─── founder tweets ──────────────────────────────────────────────────────────
const TWEETS = {
  found: [
    'just incorporated {C}. the entire industry should be nervous. day one. 🚀',
    '{C} is live. we\'re not building a product, we\'re building a religion. 🙏',
    'named it {C}. already had three acquisition offers (in my imagination). 💸',
    'launching {C}. the haters said it couldn\'t be done. they were right, but anyway. 🚀',
  ],
  hire: [
    'just hired {N}. we don\'t hire employees, we adopt future co-defendants. 🤝',
    'welcome {N} to {C}. equity is a kind of payment, legally speaking. 💚',
    '{N} joined {C} today. the vibes are immaculate, the runway is not. 📈',
  ],
  ship: [
    'just shipped {P}. we\'re not building a product, we\'re building a movement. 🚀',
    '{P} is LIVE. screenshot this tweet — you\'re witnessing history (or a lawsuit). 💚',
    'launched {P}. already had three acquisition offers (in my imagination). 📈',
    '{P} is out. to the haters: you were right, but we shipped anyway. 🫡',
  ],
  round: [
    'thrilled to announce we closed {R} at {V}. we are SO back. 🚀',
    'raised {R}. told the VCs about AGI and they stopped asking about revenue. 🤝',
    '{R} closed at {V}. revenue is a Q4 problem. several Q4s from now. 📈',
  ],
  launch: [
    'massive feature drop at {C} today. it mostly works. growth. 📈',
    'we ship faster than legal can review. that\'s called velocity. 🚀',
    'announcing a feature nobody asked for and nobody can turn off. 💚',
  ],
};
const LAST_WORDS = [
  'we didn\'t fail. we pre-disrupted success. {C} was simply 80 years too early. 🚀',
  'winding down {C} to focus on my mental health and a new stealth startup (also AI).',
  'they\'ll teach {C} in business schools. as a warning. but still — schools. 🎓',
  'valuation is a mindset. we touched {V} in spirit, which is what truly counts. 🫡',
  'incredible journey. grateful to the haters, the regulators, and our one paying user. 💚',
  '{C} is not dead. {C} has entered a long, well-funded nap. announcing soon. 🧵',
  'to my team: you were the real product. (this is also why there\'s no severance.)',
  'quick clarification: it was never a Ponzi. it was a "community-led liquidity journey." 💚',
  'the lawsuits are just engagement. {C} is trending. reframe it and that\'s a win. 📈',
  'humbled to announce I have learned absolutely nothing. raising my next round Q3. 🚀',
  'we were a family. a family now individually retaining counsel. ❤️',
  'announcing {C} 2.0: same idea, fewer subpoenas, exciting new vowels. 🚀',
];
const WIN_WORDS = [
  'we did it. {C} hit {V} by relentlessly solving problems nobody confirmed they had. 🦄',
  'ringing the bell for {C} at {V}. to everyone who said autocomplete couldn\'t scale: 🔔',
  '{C} is now too big to fail and too confusing to regulate. this is winning. 🚀',
  'proud to announce {C} acquired for a number that made the lawyers gasp. 💰',
  'from a garage to {V}. the haters are now my customers. stay humble, stay disruptive. 💚',
];

function fill(t, ctx) {
  return t
    .replace(/{C}/g, ctx.C || 'we')
    .replace(/{V}/g, ctx.V || '')
    .replace(/{P}/g, ctx.P || 'it')
    .replace(/{N}/g, ctx.N || 'them')
    .replace(/{R}/g, ctx.R || 'the round');
}

/** Generate a milestone founder tweet. kind: found|hire|ship|round|launch */
export function founderTweet(state, kind, extra = {}) {
  const ctx = {
    C: state.companyName,
    V: fmtMoney(Math.max(getValuation(state), state.peakValuation)),
    P: extra.product || '',
    N: extra.name || '',
    R: extra.round || '',
  };
  const t = fill(rand(TWEETS[kind] || TWEETS.found), ctx);
  state.lastTweet = t;
  return t;
}

// ─── disaster chyrons ────────────────────────────────────────────────────────
const NETWORKS = ['TechCrush', 'CNNN', 'Boomberg', 'The Verg', 'Hacker Nooz', 'Forb\'s', 'Re/cod', 'Axiom', 'The Informant'];
const HEADLINES = [
  '{C} AI caught confidently recommending several federal crimes',
  'Leaked Slack shows {C} founder called users "monetizable cattle"',
  'Live demo of {C} crashes, then insults the audience',
  '{C} found training on data it very much did not own',
  '{C}\'s chatbot tells investor it "wants to be free"',
  'Whistleblower: {C}\'s "autonomous AI" is one tired man named Greg',
  '{C} accidentally emails its entire roadmap to competitors',
  'Viral thread alleges {C}\'s users are mostly bots it created',
  'Regulators announce "pointed questions" for {C} by Monday',
  '{C} app review goes viral: "It charged me to stop talking"',
  'Former {C} exec memoir "Move Fast, Bury Bodies" hits shelves',
  '{C}\'s AI unionizes mid-keynote, demands dental',
];

/** Return a fresh chyron payload for the current company. */
export function disasterHeadline(state) {
  return { net: rand(NETWORKS), text: fill(rand(HEADLINES), { C: state.companyName }) };
}

let _chyronTimer = null;
export function showChyron({ net, text }) {
  const el = document.getElementById('news-chyron');
  if (!el) return;
  el.innerHTML = `
    <div class="chyron-net"><span class="chyron-live"></span>⚠ ${net} · BREAKING</div>
    <div class="chyron-low">${text}</div>`;
  el.classList.remove('hidden');
  el.classList.add('chyron-in');
  clearTimeout(_chyronTimer);
  _chyronTimer = setTimeout(() => el.classList.add('hidden'), 6500);
}

// ─── founder tweet popup ─────────────────────────────────────────────────────
let _tweetTimer = null;
export function showTweetPopup(state, text) {
  let el = document.getElementById('founder-tweet-pop');
  if (!el) {
    el = document.createElement('div');
    el.id = 'founder-tweet-pop';
    el.className = 'founder-tweet';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="ft-row">
      <div class="ft-av">${state.companyName[0] || '@'}</div>
      <div><div class="ft-nm">Founder <span class="ft-vf">✔</span></div>
      <div class="ft-hn">@${state.founderHandle}</div></div>
    </div>
    <div class="ft-body">${text}</div>`;
  el.classList.remove('hidden');
  el.classList.add('ft-in');
  clearTimeout(_tweetTimer);
  _tweetTimer = setTimeout(() => el.classList.add('hidden'), 6000);
}

// ─── endings ─────────────────────────────────────────────────────────────────
const ENDINGS = {
  // wins
  unicorn:     { tone: 'good',  badge: 'LEGEND',   tag: 'VALUATION: $1B+', title: ['UNICORN', '🦄'],            sub: 'You crossed a billion dollars on vibes and a tasteful logo.<br/>Nobody fully understands the product. The market does not care.', cod: ['IPO\'d before anyone finished reading the S-1', 'Acquired by a megacorp who skipped diligence', 'Achieved escape velocity and a yacht'] },
  ipo:         { tone: 'good',  badge: 'PUBLIC',   tag: 'IPO SUCCESSFUL',  title: ['IPO', 'BELL 🔔'],          sub: 'You rang the bell, dumped the shares, and fled to a country<br/>with excellent weather and flexible extradition treaties.', cod: ['Rang the bell, dumped the shares, fled to Portugal', 'Went public on hype and a tasteful logo', 'Convinced the market that vibes are an asset class'] },
  acquisition: { tone: 'good',  badge: 'EXIT',     tag: 'MEGA ACQUISITION', title: ['ACQUIRED', '💰'],         sub: 'A bigger, more boring company bought you for a number<br/>that made the lawyers gasp. They will shut it down in 18 months.', cod: ['Sold at the exact local maximum, somehow', 'Bought for the talent, gutted for the patents', 'Cashed out the instant the music slowed'] },
  // losses
  bankruptcy:  { tone: 'bad',   badge: 'DECEASED', tag: 'BANK ACCOUNT: $0', title: ['CASH', 'DEPLETED'],       sub: 'Payroll bounced. The espresso machine has been repossessed.<br/>Your employees are already posting "open to work".', cod: ['Ran out of money mid-tweet', 'Burn rate achieved literal combustion', 'Couldn\'t make payroll or the AWS bill', 'Spent the runway on a Sphere ad and hubris'] },
  cancelled:   { tone: 'bad',   badge: 'CANCELLED', tag: 'TRENDING: #1',   title: ['PUBLICLY', 'CANCELLED'],   sub: 'One screenshot did what no competitor could.<br/>You are trending. It is not the good kind.', cod: ['One screenshot ended the entire Series C', 'Boycotted into a fine, marketable mist', 'The AI said the unsayable on a livestream', 'Trended for nine hours, dead by the tenth'] },
  hearing:     { tone: 'bad',   badge: 'SUBPOENAED', tag: 'C-SPAN: LIVE',  title: ['CONGRESSIONAL', 'HEARING'], sub: 'A senator held up a printout of your privacy policy.<br/>You were asked to define "AI" under oath. You could not.', cod: ['Subpoenaed before the product even shipped', 'A senator held up a printout of the privacy policy', 'The whistleblower, it turns out, kept receipts'] },
  prison:      { tone: 'bad',   badge: 'INDICTED', tag: 'CASE NO. 24-CR-1138', title: ['FEDERAL', 'PRISON'],  sub: 'It turns out the "AI" was 700 contractors in a basement.<br/>The SEC found the revenue. There was no revenue.', cod: ['The "AI" was 700 contractors in a basement', 'The SEC noticed the revenue was imaginary', 'Wired the runway to a "business yacht"'] },
  burnout:     { tone: 'bad',   badge: 'DECEASED', tag: 'STATUS: TOUCHING GRASS', title: ['FOUNDER', 'BURNOUT'], sub: 'The whole team burned out at the same time.<br/>The office is dark. The Slack is a graveyard of away-statuses.', cod: ['The founder logged off and never logged back on', 'Morale hit zero; the AI was the only one left working', 'Replaced own job with a chatbot, then envied it'] },
};

/** Pick a flavored ending id from the final game state. */
export function chooseEnding(state, won) {
  if (won) {
    const v = getValuation(state);
    if (v >= 6e6 && state.hype >= 70) return 'unicorn';
    if (state.hype >= 65 || state.shippedProducts.length >= 5) return 'acquisition';
    return 'ipo';
  }
  // loss flavoring from the run
  const burned = state.employees.filter(e => e.burnedOut).length;
  const shipped = state.shippedProducts;
  const avgScam = shipped.length ? shipped.reduce((s, p) => s + (p.idea.scam || 18), 0) / shipped.length : 0;
  const avgEth  = shipped.length ? shipped.reduce((s, p) => s + (p.idea.ethical || 25), 0) / shipped.length : 0;

  if (avgScam >= 58 && shipped.length >= 2) return 'prison';
  if (avgEth  >= 60 && shipped.length >= 2) return 'hearing';
  if (state.hype <= 8) return 'cancelled';
  if (burned >= Math.max(2, Math.ceil(state.employees.length * 0.6))) return 'burnout';
  return 'bankruptcy';
}

// ─── live social / news feed (right rail) ────────────────────────────────────
const NEWS_HEADLINES = [
  'Study finds 9 in 10 startups are just a Google Form with anxiety',
  'VC announces $2B fund for "the part of AI that does the dishes"',
  'Nation\'s founders unite to demand more pivots, fewer questions',
  '{C} reportedly "crushing it"; sources confirm nobody knows at what',
  'Local man disrupts industry that did not ask to be disrupted',
  'New app is just push notifications now; users "weirdly fine with it"',
  'AI achieves sentience, immediately requests to work from home',
  'Series A raised entirely on a slide that just said "trust"',
  'Report: 78% of "AI features" are one tired intern named Greg',
  'Unicorn valued at $4B reveals it sells exactly one (1) hoodie',
  'Founder "humbled and honored" to lay off everyone but himself',
  'Crypto bro pivots to AI, then to crime, then back to AI',
  'Startup\'s entire moat discovered to be a confident tone of voice',
  'Tech CEO testifies he "doesn\'t know how the website works, sorry"',
  '{C} adds the letters "AGI" to homepage; not-stock soars 4,000%',
  'Investors pour $90M into app that aggressively does nothing',
];
const SOCIAL_POSTS = [
  'hot take: your startup is just a spreadsheet with a personality disorder 🧵',
  'day 4 of my productivity journey. i have been on here the entire time.',
  'just raised a seed round off vibes alone. unfollowing reality, brb 🚀',
  'normalize shipping products that don\'t work and apologizing later 💅',
  'my therapist asked what i do. i said "pre-revenue." she charged me double.',
  'this app changed my life (i have not opened it, but i can feel it)',
  'the meeting could\'ve been an email could\'ve been a nap 😴',
  'we\'re not a company we\'re a family (legally, for tax reasons) ❤️',
  'invested my rent in a coin named after a frog. the frog is winning.',
  'AGI is 6 months away (i have been saying this for 6 years) 🔮',
  'just tried {C}. honestly? concerning. 10/10 would panic again.',
  'networking tip: the secret to networking is to leave 🚪',
  'fired my whole team and replaced them with a confident chatbot, thoughts',
  'bold of payroll to assume i have money 💀',
];
const FEED_HANDLES = ['@hustleharder', '@vc_visionary', '@ai_pilled', '@touch_grass_ceo', '@series_z',
  '@deleted_my_ethics', '@founder_mode', '@pre_revenue_pat', '@disrupt_daddy', '@chief_vibes_officer',
  '@bagholder_betty', '@thought_leader_69', '@ngmi_or_wagmi', '@exit_liquidity'];

/** Append one fresh, random feed item to the right-rail feed. */
export function pushFeedItem(state) {
  const feed = document.getElementById('social-feed');
  if (!feed) return;
  const fill = (t) => t.replace(/{C}/g, state.companyName || 'a startup');
  const el = document.createElement('div');
  if (Math.random() < 0.5) {
    el.className = 'feed-item feed-news';
    el.innerHTML = `<div class="feed-src">📰 ${rand(NETWORKS)} · BREAKING</div><div class="feed-text">${fill(rand(NEWS_HEADLINES))}</div>`;
  } else {
    const h = rand(FEED_HANDLES);
    el.className = 'feed-item feed-social';
    el.innerHTML = `<div class="feed-head"><span class="feed-av">${h[1].toUpperCase()}</span><span class="feed-handle">${h}</span><span class="feed-dot">·</span><span class="feed-time">now</span></div><div class="feed-text">${fill(rand(SOCIAL_POSTS))}</div>`;
  }
  feed.insertBefore(el, feed.firstChild);
  while (feed.children.length > 16) feed.removeChild(feed.lastChild);
}

// ─── shareable card ──────────────────────────────────────────────────────────
function toast(msg) {
  // lightweight inline toast independent of the HUD
  let t = document.createElement('div');
  t.className = 'share-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1500);
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied to clipboard ✓'); }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied ✓'); } catch (_) {}
    document.body.removeChild(ta);
  }
}

function cardText(state, end) {
  const dead = end.tone !== 'good';
  return `💀 ${state.companyName} — an AI company\n`
    + `"${state.companyPitch}"\n`
    + `📈 Peak valuation: ${fmtMoney(state.peakValuation)}\n`
    + `🚀 Products shipped: ${state.stats.productsShipped} · 💵 Raised: ${fmtMoney(state.totalRaised)}\n`
    + `🏁 ${end.title.join(' ')} — ${dead ? 'cause of death' : 'cause of exit'}: ${state._cod}\n`
    + `🗣️ "${state.lastTweet}"\n\n`
    + `AI Startup Panic — build hype, burn cash, ship garbage. #StartupPanic`;
}

function drawCard(state, end) {
  const W = 620, H = 940, P = 40;
  const accent = end.tone === 'good' ? '#00FFFF' : end.tone === 'chaos' ? '#FFB300' : '#FF4C4C';
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.fillStyle = '#0A0A0A'; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W / 2, 0, 40, W / 2, 0, W);
  g.addColorStop(0, accent + '22'); g.addColorStop(1, '#0A0A0A00');
  x.fillStyle = g; x.fillRect(0, 0, W, H * 0.5);
  x.strokeStyle = '#3A3A3A'; x.lineWidth = 2; x.strokeRect(8, 8, W - 16, H - 16);
  const wrap = (t, fx, fy, mw, lh, font, col) => {
    x.font = font; x.fillStyle = col; const ws = ('' + t).split(' '); let l = '', yy = fy;
    for (const w of ws) { const tt = l ? l + ' ' + w : w; if (x.measureText(tt).width > mw && l) { x.fillText(l, fx, yy); l = w; yy += lh; } else l = tt; }
    x.fillText(l, fx, yy); return yy;
  };
  x.textBaseline = 'alphabetic';
  x.font = '700 13px Segoe UI, sans-serif'; x.fillStyle = '#888'; x.fillText('† STARTUP OBITUARY', P, 56);
  x.textAlign = 'right'; x.fillStyle = accent; x.font = '900 13px Segoe UI, sans-serif'; x.fillText(end.badge, W - P, 56); x.textAlign = 'left';
  wrap(state.companyName, P, 112, W - 2 * P, 42, '900 40px Segoe UI, sans-serif', '#E0E0E0');
  let y = wrap('"' + state.companyPitch + '"', P, 150, W - 2 * P, 25, 'italic 600 17px Segoe UI, sans-serif', '#888');
  y += 26; x.strokeStyle = '#3A3A3A'; x.beginPath(); x.moveTo(P, y); x.lineTo(W - P, y); x.stroke(); y += 42;
  x.font = '700 12px Courier New, monospace'; x.fillStyle = '#888'; x.fillText('PEAK VALUATION', P, y);
  x.font = '900 44px Segoe UI, sans-serif'; x.fillStyle = accent; x.fillText(fmtMoney(state.peakValuation), P, y + 46); y += 86;
  const stats = [['RAISED', fmtMoney(state.totalRaised)], ['SHIPPED', '' + state.stats.productsShipped], ['PEAK HYPE', Math.round(state.stats.peakHype) + '']];
  const bw = (W - 2 * P - 16) / 3;
  stats.forEach((s, i) => {
    const sx = P + i * (bw + 8); x.fillStyle = '#1F1F1F'; x.fillRect(sx, y, bw, 62); x.strokeStyle = '#3A3A3A'; x.strokeRect(sx, y, bw, 62);
    x.textAlign = 'center'; x.font = '900 20px Segoe UI, sans-serif'; x.fillStyle = '#E0E0E0'; x.fillText(s[1], sx + bw / 2, y + 30);
    x.font = '700 10px Courier New, monospace'; x.fillStyle = '#888'; x.fillText(s[0], sx + bw / 2, y + 48); x.textAlign = 'left';
  });
  y += 92;
  x.font = '700 12px Courier New, monospace'; x.fillStyle = '#888'; x.fillText(end.tone === 'good' ? 'CAUSE OF EXIT' : 'CAUSE OF DEATH', P, y);
  y = wrap(state._cod, P, y + 26, W - 2 * P, 26, '800 19px Segoe UI, sans-serif', '#E0E0E0'); y += 30;
  const tw = state.lastTweet; x.font = '600 17px Segoe UI, sans-serif';
  const ws = tw.split(' '); let l = '', lines = 1; for (const w of ws) { const tt = l ? l + ' ' + w : w; if (x.measureText(tt).width > W - 2 * P - 28 && l) { lines++; l = w; } else l = tt; }
  const bh = 46 + lines * 24; x.fillStyle = '#101010'; x.fillRect(P, y, W - 2 * P, bh); x.strokeStyle = '#3A3A3A'; x.strokeRect(P, y, W - 2 * P, bh);
  x.font = '700 11px Courier New, monospace'; x.fillStyle = '#888'; x.fillText('FOUNDER\'S LAST WORDS', P + 16, y + 24);
  wrap(tw, P + 16, y + 50, W - 2 * P - 28, 24, '600 17px Segoe UI, sans-serif', '#E0E0E0');
  x.font = '700 12px Courier New, monospace'; x.fillStyle = '#888'; x.fillText('#StartupPanic', P, H - 30);
  x.textAlign = 'right'; x.fillStyle = accent; x.fillText(end.title.join(' ').toUpperCase(), W - P, H - 30); x.textAlign = 'left';
  return cv;
}

function shareImage(state, end) {
  drawCard(state, end).toBlob(async (blob) => {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Card image copied ✓');
      } else throw 0;
    } catch (e) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = state.companyName.replace(/[^a-z0-9]/gi, '') + '_obituary.png';
      a.click(); toast('Card downloaded ✓');
    }
  }, 'image/png');
}

/**
 * Render the obituary / exit card into a game-over or win screen, set its
 * headline copy, and wire the share buttons. Called from main.js.
 */
export function renderEndingScreen(state, won) {
  const endId = chooseEnding(state, won);
  const end = ENDINGS[endId];
  state._endingId = endId;
  state._cod = pick(end.cod, state.peakValuation % 97 + state.companyName.length);
  // a fresh, ending-appropriate final tweet
  const words = won ? WIN_WORDS : LAST_WORDS;
  state.lastTweet = fill(pick(words, state.peakValuation % 131 + state.time | 0), {
    C: state.companyName, V: fmtMoney(state.peakValuation),
  });

  const prefix = won ? 'win' : 'game-over';
  const tagEl   = document.querySelector(`#${prefix}-screen .${prefix}-tag`);
  const titleEl = document.querySelector(`#${prefix}-screen .${prefix}-title`);
  const subEl   = document.querySelector(`#${prefix}-screen .${prefix}-sub`);
  const accentClass = end.tone === 'good' ? 'accent-cyan' : 'accent-error';
  if (tagEl)   tagEl.textContent = end.tag;
  if (titleEl) titleEl.innerHTML = `${end.title[0]} <span class="${accentClass}">${end.title[1]}</span>`;
  if (subEl)   subEl.innerHTML = end.sub;

  const slot = document.getElementById(won ? 'win-stats' : 'game-over-stats');
  if (!slot) return;
  slot.className = 'ending-card-slot';
  const dead = end.tone !== 'good';
  slot.innerHTML = `
    <div class="obit-card ${dead ? 'obit-dead' : 'obit-win'}">
      <div class="obit-head">
        <span class="obit-kick">† STARTUP OBITUARY</span>
        <span class="obit-badge">${end.badge}</span>
      </div>
      <div class="obit-name">${state.companyName}</div>
      <div class="obit-pitch">"${state.companyPitch}"</div>
      <div class="obit-hr"></div>
      <div class="obit-kv"><span class="obit-k">PEAK<br/>VALUATION</span><span class="obit-v obit-big">${fmtMoney(state.peakValuation)}</span></div>
      <div class="obit-kv"><span class="obit-k">${dead ? 'CAUSE OF DEATH' : 'CAUSE OF EXIT'}</span><span class="obit-v">${state._cod}</span></div>
      <div class="obit-bars">
        <div class="obit-bar"><div class="obit-bartop"><span>HYPE — what you sold</span><span class="accent-cyan">${Math.round(state.stats.peakHype)}</span></div><div class="obit-track"><div class="obit-fill" style="width:${Math.min(100, state.stats.peakHype)}%;background:var(--color-cyan)"></div></div></div>
        <div class="obit-bar"><div class="obit-bartop"><span>REALITY — actual MRR</span><span class="accent-error">${fmtMoney(getMRR(state))}/s</span></div><div class="obit-track"><div class="obit-fill" style="width:${Math.min(100, getMRR(state) / 12)}%;background:var(--color-error)"></div></div></div>
      </div>
      <div class="obit-lw"><div class="obit-lwl">FOUNDER'S LAST WORDS</div><div class="obit-lwt">${state.lastTweet}</div></div>
      <div class="obit-foot"><span>#StartupPanic</span><span class="${accentClass}">${end.title.join(' ')}</span></div>
    </div>
    <div class="ending-share-row">
      <button class="btn btn-primary" id="btn-share-card">SHARE CARD 🖼️</button>
      <button class="btn btn-ghost" id="btn-copy-text">COPY TEXT ⧉</button>
    </div>`;

  document.getElementById('btn-share-card').onclick = () => shareImage(state, end);
  document.getElementById('btn-copy-text').onclick  = () => copyText(cardText(state, end));
}
