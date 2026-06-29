/**
 * brand.js  Procedural per-product branding for Startup Panic.
 *
 * Every product you ship gets a deterministic identity derived from its name +
 * industry: a colour pair, a monogram, a logo mark, a 3D shape and a slogan.
 * Same name always yields the same brand, so a product looks consistent in the
 * develop preview, the launch reactions, the office shelf and the share card.
 *
 * Pure helpers (productBrand / brandLogoSVG / shareURL / shareText) are
 * dependency-free and unit-tested in Node. drawProductCard() touches the DOM and
 * is guarded so it no-ops headlessly.
 */

const hasDOM = typeof document !== 'undefined';

/* The game will be playable on the Sandscape platform; this is the play link. */
export const SANDSCAPE_URL = 'https://sandscape.app/play/startup-panic';

/* deterministic FNV-1a hash so a name maps to a stable brand */
function hashStr(s) {
  let h = 2166136261 >>> 0; s = String(s || '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); return Math.round(255 * c).toString(16).padStart(2, '0'); };
  return '#' + f(0) + f(8) + f(4);
}

export const BRAND_SHAPES = ['box', 'sphere', 'cone', 'cylinder', 'octahedron', 'icosahedron', 'torus', 'dodecahedron'];

const SLOGANS = [
  'Disrupting the undisrupted.', 'Now with more synergy.', 'It just works (mostly).',
  'The future, slightly early.', 'Move fast, apologize later.', 'AI-powered, obviously.',
  'Your data, our problem.', 'Frictionless, until billing.', 'We raised on this slogan.',
  'Built different. Priced worse.', 'Ship it and see.', 'Vibes as a service.',
  'Ethically ambiguous since today.', 'Ten-x or zero-x.', 'Trust the process (TM).',
];

/**
 * Deterministic brand for a product.
 * @returns {{hue:number,color:string,color2:string,ink:string,monogram:string,shape:string,mark:number,slogan:string,hash:number}}
 */
export function productBrand(name, industry) {
  const h = hashStr((name || 'Untitled') + '|' + (industry || ''));
  const hue = h % 360;
  const hue2 = (hue + 24 + ((h >>> 3) % 70)) % 360;
  const clean = String(name || 'X').replace(/[^A-Za-z0-9 ]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const a = (words[0] || 'X')[0] || 'X';
  const b = words[1] ? words[1][0] : ((words[0] || 'X')[1] || a);
  return {
    hue,
    color: hslHex(hue, 72, 54),
    color2: hslHex(hue2, 74, 46),
    ink: '#0B1020',
    monogram: (a + b).toUpperCase(),
    shape: BRAND_SHAPES[h % BRAND_SHAPES.length],
    mark: (h >>> 5) % 6,
    slogan: SLOGANS[(h >>> 7) % SLOGANS.length],
    hash: h,
  };
}

/* the geometric mark behind the monogram, varied per brand */
function markSVG(mark, c) {
  switch (mark) {
    case 0: return `<circle cx="32" cy="32" r="20" fill="none" stroke="${c}" stroke-width="3"/>`;
    case 1: return `<path d="M24 20 L46 32 L24 44 Z" fill="${c}"/>`;
    case 2: return `<circle cx="32" cy="32" r="20" fill="none" stroke="${c}" stroke-width="3"/><circle cx="32" cy="32" r="11" fill="none" stroke="${c}" stroke-width="3"/>`;
    case 3: return `<rect x="18" y="34" width="7" height="12" rx="2" fill="${c}"/><rect x="28" y="26" width="7" height="20" rx="2" fill="${c}"/><rect x="38" y="18" width="7" height="28" rx="2" fill="${c}"/>`;
    case 4: return `<path d="M32 14 L50 32 L32 50 L14 32 Z" fill="none" stroke="${c}" stroke-width="3"/>`;
    default: return `<path d="M32 13 L49 23 L49 41 L32 51 L15 41 L15 23 Z" fill="none" stroke="${c}" stroke-width="3"/>`;
  }
}

/** Inline SVG logo tile (gradient + mark + monogram). Deterministic for a brand. */
export function brandLogoSVG(brand, size = 56) {
  const b = brand || productBrand('X', '');
  const gid = 'bg' + b.hash.toString(36);
  const markTint = 'rgba(255,255,255,0.30)';
  return `<svg class="brand-logo" viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${b.monogram} logo">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${b.color}"/><stop offset="1" stop-color="${b.color2}"/>
  </linearGradient></defs>
  <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#${gid})"/>
  ${markSVG(b.mark, markTint)}
  <text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="26" font-weight="800" fill="#fff">${b.monogram}</text>
</svg>`;
}

/** A play link for the Sandscape platform, tagged with the run for fun referral. */
export function shareURL(state, product) {
  const q = [];
  const add = (k, v) => { if (v) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); };
  add('utm_source', 'ingame');
  add('co', state && state.companyName);
  add('p', product && product.idea && product.idea.name);
  return SANDSCAPE_URL + (q.length ? '?' + q.join('&') : '');
}

/** A share caption that reacts to how the product did. */
export function shareText(state, product) {
  const name = (product && product.idea && product.idea.name) || 'my startup';
  const co = (state && state.companyName) || 'my company';
  const users = product ? Math.round((product.userBase || 1) * 8200) : 0;
  let vibe;
  if (product && product.flopped) vibe = `just face-planted ${name} in spectacular fashion`;
  else if (product && product.reviewScore >= 0.7) vibe = `shipped ${name} and the critics are obsessed`;
  else vibe = `shipped ${name} and somehow it's still up`;
  return `${co} ${vibe} (${users.toLocaleString()} users and counting). Think you can run a startup without panicking? Play Startup Panic on Sandscape.`;
}

function stars(score) { const n = Math.max(0, Math.min(5, Math.round((score || 0) * 5))); return '★'.repeat(n) + '☆'.repeat(5 - n); }

/**
 * Draws a 1200x675 branded share card to a canvas and returns it (or null headless).
 * Mirrors viral.js's card style but uses the product's own brand colours + logo mark.
 */
export function drawProductCard(state, product) {
  if (!hasDOM) return null;
  const b = product.brand || productBrand(product.idea.name, product.idea.industry);
  const W = 1200, H = 675;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');

  // background gradient from the brand colours, darkened
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, b.color); g.addColorStop(1, b.color2);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(8,12,24,0.78)'; x.fillRect(0, 0, W, H);
  // accent bar
  x.fillStyle = b.color; x.fillRect(0, 0, W, 10);

  // logo tile
  const lx = 80, ly = 80, ls = 150;
  const lg = x.createLinearGradient(lx, ly, lx + ls, ly + ls);
  lg.addColorStop(0, b.color); lg.addColorStop(1, b.color2);
  roundRect(x, lx, ly, ls, ls, 34); x.fillStyle = lg; x.fill();
  x.fillStyle = '#fff'; x.font = '800 78px Inter, Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(b.monogram, lx + ls / 2, ly + ls / 2 + 4);

  // name + tagline
  x.textAlign = 'left';
  x.fillStyle = '#fff'; x.font = '800 64px Inter, Arial, sans-serif';
  x.fillText(clip(product.idea.name, 18), lx + ls + 40, ly + 50);
  x.fillStyle = 'rgba(255,255,255,0.72)'; x.font = '400 30px Inter, Arial, sans-serif';
  x.fillText(clip(product.idea.tagline || b.slogan, 40), lx + ls + 40, ly + 100);
  x.fillStyle = b.color; x.font = '700 26px Inter, Arial, sans-serif';
  x.fillText((state.companyName || 'Startup') + (product.flopped ? '  -  rough launch' : ''), lx + ls + 40, ly + 138);

  // stat tiles
  const mrr = (product.idea.mrr || 0);
  const users = Math.round((product.userBase || 1) * 8200);
  const tiles = [
    ['MRR', '$' + mrr.toLocaleString()],
    ['USERS', users.toLocaleString()],
    ['QUALITY', Math.round(product.quality || 0) + ''],
    ['CRITICS', stars(product.reviewScore)],
  ];
  const tw = 250, th = 150, ty = 330, gap = 26;
  tiles.forEach(([k, v], i) => {
    const txx = 80 + i * (tw + gap);
    roundRect(x, txx, ty, tw, th, 20); x.fillStyle = 'rgba(255,255,255,0.07)'; x.fill();
    x.fillStyle = b.color; x.font = '700 24px Inter, Arial, sans-serif'; x.textAlign = 'left';
    x.fillText(k, txx + 22, ty + 42);
    x.fillStyle = '#fff'; x.font = '800 ' + (k === 'CRITICS' ? 34 : 44) + 'px Inter, Arial, sans-serif';
    x.fillText(v, txx + 22, ty + 100);
  });

  // footer call to action
  x.fillStyle = 'rgba(255,255,255,0.92)'; x.font = '800 34px Inter, Arial, sans-serif';
  x.fillText('Play Startup Panic on Sandscape', 80, 600);
  x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = '400 26px Inter, Arial, sans-serif';
  x.fillText('sandscape.app', 80, 638);
  return cv;
}

function roundRect(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
