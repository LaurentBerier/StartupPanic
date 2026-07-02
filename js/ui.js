/**
 * ui.js  HUD management, toasts, modals (VC pitch, hire, build, develop),
 * screen transitions. All UI operates on DOM elements; no Three.js here.
 */

import { openTapGame, openClickRush } from './minigames.js';
import { productBrand, brandLogoSVG, shareURL, shareText, drawProductCard } from './brand.js';
import {
  CONFIG, ROLES, PERSONALITIES, FUNDING_ROUNDS, FACILITIES, RESEARCH, OFFICE_TIERS, LOANS,
  DEV_MODES, FEATURE_OPTIONS,
  getPitchBuzzwords, buildPitchSentence, estimatePitch,
  generateCandidates, generateProductChoices, getModifiers,
  getMRR, getBurnRate, getNetCashFlow, getRunwaySeconds, getValuation,
  getTeamDevPower, getGlitchLevel, fmtMoney, getAvgFreshness,
  computeInvestment, computeSuccessChance, computeLaunchPlanEffects,
  productCategory, productEffectiveMRR, getProductHealth, getFounderDesk,
  getActiveProducts, getDevelopmentLaneCount,
  getEmployeeMood, getEmployeeTitle, getTeamMoodSummary, traitById, bondMeta,
  getProductTier, getEra, getUnlockedEra, PRODUCT_ERAS,
} from './gameLogic.js';

const UI_ICONS = {
  office: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12"/><path d="M9 20v-6h6v6"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>',
  desk: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16v4H4z"/><path d="M7 13v7M17 13v7"/><path d="M9 6h6"/></svg>',
  computer: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="11" rx="2"/><path d="M9 20h6M12 16v4"/></svg>',
  server: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="6" rx="2"/><rect x="5" y="14" width="14" height="6" rx="2"/><path d="M8 7h.01M8 17h.01M11 7h5M11 17h5"/></svg>',
  tool: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l4 4-8 8H6v-4z"/><path d="M16 4l4 4"/></svg>',
  person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21c1.4-4 4-6 7-6s5.6 2 7 6"/></svg>',
  ai: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="4"/><path d="M9 9h.01M15 9h.01M9 15c2 1.2 4 1.2 6 0"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  crypto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 5v8l-8 5-8-5V8z"/><path d="M9 9h4a2 2 0 0 1 0 4H9z"/><path d="M9 13h5a2 2 0 0 1 0 4H9z"/></svg>',
  social: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10M7 12h6"/><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>',
  delivery: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10v9H4z"/><path d="M14 10h4l2 3v3h-6z"/><circle cx="8" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  subscription: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4-8 4z"/><path d="M4 8v8l8 4 8-4V8"/><path d="M12 12v8"/></svg>',
  wellness: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20c5-3 8-7 8-11a4 4 0 0 0-7-2 4 4 0 0 0-7 2c0 4 3 8 6 11z"/><path d="M9 12h6"/></svg>',
  product: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M7 9h10M7 13h6"/></svg>',
  cash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"/><path d="M17 7.5c-.8-1.2-2.3-2-4.4-2-2.4 0-4.1 1.1-4.1 2.8 0 4.2 9 1.8 9 6.6 0 2-1.9 3.1-4.8 3.1-2.3 0-4.1-.8-5.2-2.1"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/></svg>',
};

function icon(name, className = 'ui-icon') {
  return `<span class="${className}">${UI_ICONS[name] || UI_ICONS.product}</span>`;
}

// Emoji icon chip used on submenu cards (facilities, research, loans, features).
function emojiIcon(em, fallbackName = 'product') {
  if (!em) return `<div class="build-icon">${icon(fallbackName)}</div>`;
  return `<div class="build-icon build-icon-emoji">${em}</div>`;
}

function productIconName(idea) {
  const map = { ai: 'ai', crypto: 'crypto', social: 'social', delivery: 'delivery', subscription: 'subscription', wellness: 'wellness' };
  return map[productCategory(idea)] || 'product';
}

function productGraphic(idea) {
  return `<div class="product-graphic product-graphic-${productCategory(idea)}">
    ${icon(productIconName(idea), 'product-graphic-icon')}
    <div class="product-graphic-lines"><span></span><span></span><span></span></div>
  </div>`;
}

//  Screen Management 
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('active');
  }
}

export function hideScreen(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('active');
    el.classList.add('hidden');
  }
}

//  HUD 
const hud = {
  el:             null,
  cashValue:      null,
  netValue:       null,
  runwayDays:     null,
  hypeFill:       null,
  hypeValue:      null,
  hypeHelp:       null,
  usersValue:     null,
  burnoutValue:   null,
  trustValue:     null,
  valuationDisp:  null,
  roundDisplay:   null,
  eventQueue:     null,
  employeeBar:    null,
  toastContainer: null,
  glitchOverlay:  null,
  devCard:        null,
  devName:        null,
  devPct:         null,
  devFill:        null,
  devPower:       null,
  onboardingCard: null,
  onboardingTitle:null,
  onboardingNext: null,
  onboardingSteps:null,
  lastCash:       null,
  lastCashPulse:  null,
  lastCashTick:   0,
  cdLabels:       {},
};

export function initHUD() {
  hud.el             = document.getElementById('hud');
  hud.cashValue      = document.getElementById('cash-value');
  hud.netValue       = document.getElementById('net-value');
  hud.runwayDays     = document.getElementById('runway-days');
  hud.hypeFill       = document.getElementById('hype-fill');
  hud.hypeValue      = document.getElementById('hype-value');
  hud.hypeHelp       = document.getElementById('hype-help');
  hud.usersValue     = document.getElementById('users-value');
  hud.burnoutValue   = document.getElementById('burnout-value');
  hud.trustValue     = document.getElementById('trust-value');
  hud.valuationDisp  = document.getElementById('valuation-display');
  hud.roundDisplay   = document.getElementById('round-display');
  hud.eventQueue     = document.getElementById('event-queue');
  hud.employeeBar    = document.getElementById('employee-status');
  hud.toastContainer = document.getElementById('toast-container');
  hud.glitchOverlay  = document.getElementById('glitch-overlay');
  hud.devCard        = document.getElementById('dev-progress-card');
  hud.devName        = document.getElementById('dev-product-name');
  hud.devPct         = document.getElementById('dev-progress-pct');
  hud.devFill        = document.getElementById('dev-progress-fill');
  hud.devPower       = document.getElementById('dev-team-power');
  hud.onboardingCard = document.getElementById('onboarding-card');
  hud.onboardingTitle= document.getElementById('onboarding-title');
  hud.onboardingNext = document.getElementById('onboarding-next');
  hud.onboardingSteps= document.getElementById('onboarding-steps');

  hud.cdLabels = {
    pitch:    document.getElementById('cd-pitch'),
    caffeine: document.getElementById('cd-caffeine'),
    pivot:    document.getElementById('cd-pivot'),
    update:   document.getElementById('cd-update'),
    crunch:   document.getElementById('cd-crunch'),
    marketing: document.getElementById('cd-marketing'),
  };
  hud.launchReady = document.getElementById('cd-launch-product');
}

export function showHUD() {
  if (hud.el) hud.el.classList.remove('hidden');
  hud.lastCash = null;
  hud.lastCashPulse = null;
  hud.lastCashTick = 0;
  hud.lastHype = null;
}

export function hideHUD() {
  if (hud.el) hud.el.classList.add('hidden');
}

function fmtCashTicker(n) {
  const sign = n < 0 ? '-' : '';
  const whole = Math.round(Math.abs(n));
  return `${sign}$${whole.toLocaleString('en-US')}`;
}

//  Juice: animated count-up numbers + celebration moments
const _disp = {}, _dispT = {};
function fmtUsers(n) { n = Math.round(n); return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n); }
/** Count the displayed value UP toward target (snap on decrease), pop on a real jump. */
function animStat(el, key, target, fmt) {
  if (!el) return;
  let cur = _disp[key];
  if (cur == null || target <= cur) cur = target;                 // first paint or decrease: snap
  else { cur += (target - cur) * 0.16; if (target - cur < Math.max(1, target * 0.0015)) cur = target; }
  _disp[key] = cur;
  el.textContent = fmt(cur);
  const pt = _dispT[key];
  if (pt != null && target - pt > Math.max(3, pt * 0.02)) {       // notable up-jump -> pop
    el.classList.remove('stat-pop'); void el.offsetWidth; el.classList.add('stat-pop');
  }
  _dispT[key] = target;
}

/** A brief full-screen tint pulse. tone: good | bad | hype */
export function flashScreen(tone = 'good') {
  let f = document.getElementById('screen-flash');
  if (!f) { f = document.createElement('div'); f.id = 'screen-flash'; f.className = 'screen-flash'; document.body.appendChild(f); }
  f.className = `screen-flash flash-${tone}`;
  f.classList.remove('flash-on'); void f.offsetWidth; f.classList.add('flash-on');
}

/** A big celebratory banner for the moments that matter (launch, funding, viral). */
let _celebTimer = null;
export function celebrate(title, sub = '', tone = 'good') {
  let el = document.getElementById('celebration');
  if (!el) { el = document.createElement('div'); el.id = 'celebration'; el.className = 'celebration'; document.body.appendChild(el); }
  el.className = `celebration celeb-${tone}`;
  el.innerHTML = `<div class="celeb-card"><div class="celeb-title">${title}</div>${sub ? `<div class="celeb-sub">${sub}</div>` : ''}</div>`;
  el.classList.remove('celeb-show'); void el.offsetWidth; el.classList.add('celeb-show');
  flashScreen(tone);
  clearTimeout(_celebTimer); _celebTimer = setTimeout(() => el.classList.remove('celeb-show'), 1900);
}

/**
 * Update HUD meters and cooldown labels every frame.
 */
export function updateHUD(state) {
  if (!hud.el) return;

  // Cash + net flow
  const previousCash = hud.lastCash;
  const pulseBase = hud.lastCashPulse ?? state.cash;
  hud.cashValue.textContent = fmtCashTicker(state.cash);
  hud.cashValue.title = `Total cash: ${fmtCashTicker(state.cash)}`;
  hud.cashValue.classList.toggle('cash-negative', state.cash < 0);
  if (previousCash !== null && Math.abs(state.cash - pulseBase) >= 15 && state.time - hud.lastCashTick > 0.22) {
    hud.cashValue.classList.remove('cash-tick-up', 'cash-tick-down');
    void hud.cashValue.offsetWidth;
    hud.cashValue.classList.add(state.cash > pulseBase ? 'cash-tick-up' : 'cash-tick-down');
    hud.lastCashPulse = state.cash;
    hud.lastCashTick = state.time;
  }
  if (hud.lastCashPulse === null) hud.lastCashPulse = state.cash;
  hud.lastCash = state.cash;
  const net = getNetCashFlow(state);
  const mrr = getMRR(state);
  const burn = getBurnRate(state);
  hud.netValue.textContent = `${net >= 0 ? '+' : ''}${fmtMoney(net)}/s`;
  hud.netValue.className = net >= 0 ? 'net-positive' : 'net-negative';
  hud._cur = hud._cur || {}; hud._cur.cash = state.cash; hud._cur.net = net;
  hud.netValue.title = `MRR +${fmtMoney(mrr)}/s  Burn -${fmtMoney(burn)}/s`;

  // Runway
  const runwaySec = getRunwaySeconds(state);
  if (runwaySec === Infinity) {
    hud.runwayDays.textContent = '∞';
    hud.runwayDays.classList.remove('critical-text');
    hud.runwayDays.title = 'Company runway: infinity';
  } else {
    const days = Math.floor(runwaySec / 3); // scaled to feel like days
    hud.runwayDays.textContent = `${days}d`;
    hud.runwayDays.title = `Company runway: ${days} days`;
    hud.runwayDays.classList.toggle('critical-text', runwaySec < CONFIG.RUNWAY_GLITCH_SEC);
  }

  hud._cur = hud._cur || {}; hud._cur.runway = (runwaySec === Infinity ? null : Math.floor(runwaySec / 3));

  // Hype meter (flash on a real spike: launch, marketing, viral win)
  if (hud.lastHype != null && state.hype - hud.lastHype >= 3) {
    hud.hypeFill.classList.remove('hype-spike');
    void hud.hypeFill.offsetWidth;
    hud.hypeFill.classList.add('hype-spike');
  }
  hud.lastHype = state.hype;
  hud.hypeFill.style.width = `${(state.hype / CONFIG.HYPE_MAX) * 100}%`;
  hud.hypeValue.textContent = Math.round(state.hype);
  hud._cur = hud._cur || {}; hud._cur.hype = state.hype;
  if (hud.usersValue) {
    const users = Math.round(state.shippedProducts.reduce((sum, p) => {
      const health = getProductHealth(p) / 100;
      return sum + (p.userBase || 1) * Math.max(0.2, health) * Math.max(1, p.idea.mrr || 1) * 18;
    }, 0));
    animStat(hud.usersValue, 'users', users, fmtUsers);
    renderObjectives(state, users);
    hud._cur = hud._cur || {}; hud._cur.users = users;
  }
  if (hud.burnoutValue) {
    const burned = state.employees.filter(e => e.burnedOut).length;
    const tired = state.employees.reduce((sum, e) => sum + (e.burnedOut ? 1 : Math.max(0, 1 - e.energy)), 0);
    const risk = state.employees.length ? Math.round((tired / state.employees.length) * 100) : Math.max(0, Math.round(100 - (state.morale ?? CONFIG.MORALE_START)));
    hud._cur = hud._cur || {}; hud._cur.burnout = risk;
    hud.burnoutValue.textContent = state.employees.length ? `${risk}%` : `${risk}%`;
    hud.burnoutValue.title = `${burned} burned out, morale ${Math.round(state.morale ?? CONFIG.MORALE_START)}`;
    hud.burnoutValue.parentElement?.parentElement?.classList.toggle('resource-danger', risk >= 70);
  }
  if (hud.trustValue) {
    const flopPenalty = state.shippedProducts.filter(p => p.flopped).length * 9;
    const prPenalty = state.prDisasters.reduce((sum, pr) => sum + pr.severity * 14, 0);
    const outagePenalty = state.shippedProducts.filter(p => p.outageTimer > 0).length * 12;
    const hypeLift = Math.min(10, state.hype / 10);
    const trust = Math.max(0, Math.min(100, Math.round(76 + hypeLift - flopPenalty - prPenalty - outagePenalty)));
    hud._cur = hud._cur || {}; hud._cur.trust = trust; recordStats(state);
    hud.trustValue.textContent = `${trust}%`;
    hud.trustValue.title = 'Public confidence: drops from PR disasters, outages, and flops.';
    hud.trustValue.parentElement?.parentElement?.classList.toggle('resource-danger', trust < 35);
  }
  if (hud.hypeHelp) {
    const aura = getModifiers(state).hypeAura + state.employees.reduce((s, e) => {
      if (e.burnedOut) return s;
      return s + (ROLES[e.role].hypeAura ?? 0) + (PERSONALITIES[e.personality].hypeAura ?? 0);
    }, 0);
    const prDrain = state.prDisasters.reduce((s, pr) => s + CONFIG.PR_HYPE_DRAIN_PER_SEC * pr.severity, 0);
    const losses = `${CONFIG.HYPE_DECAY_PER_SEC.toFixed(1)}/s attention decay${prDrain ? ` + ${prDrain.toFixed(1)}/s PR damage` : ''}`;
    const hypeText = state.live
      ? `Hype ${aura >= CONFIG.HYPE_DECAY_PER_SEC + prDrain ? 'gaining' : 'draining'}: +${aura.toFixed(1)}/s from team/facilities, -${losses}. Gain Hype with Marketing posts, launches, updates, PR responses, growth hires and brand facilities. Lose it from time, PR disasters, burnout and bad launches.`
      : 'Hype is calm in stealth. Gain it with Marketing posts now, then bigger bursts from launches, updates, growth hires and brand facilities after launch.';
    hud.hypeHelp.textContent = hypeText;
    hud.hypeHelp.title = hypeText;
  }

  // Valuation + round badge
  animStat(hud.valuationDisp, 'val', getValuation(state), fmtMoney);
  const round = FUNDING_ROUNDS[state.roundIndex];
  hud.roundDisplay.textContent = !state.live ? 'STEALTH MODE' : round ? `NEXT: ${round.name}` : 'IPO READY';

  // Dev progress card
  const activeProducts = getActiveProducts(state);
  if (activeProducts.length) {
    const ap = activeProducts[0];
    const pct = Math.min(100, (ap.progress / ap.idea.devPoints) * 100);
    hud.devCard.classList.remove('hidden');
    hud.devName.textContent = activeProducts.length > 1 ? `${ap.idea.name} +${activeProducts.length - 1}` : ap.idea.name;
    hud.devPct.textContent = `${Math.floor(pct)}%`;
    hud.devFill.style.width = `${pct}%`;
    const mode = DEV_MODES[ap.devMode || 'balanced'] || DEV_MODES.balanced;
    const lanes = getDevelopmentLaneCount(state);
    const extras = activeProducts.slice(1).map(p => `${p.idea.name} ${Math.floor(Math.min(100, (p.progress / p.idea.devPoints) * 100))}%`).join(' | ');
    hud.devPower.textContent = `${activeProducts.length}/${lanes} lanes - ${mode.label} - speed ${getTeamDevPower(state).toFixed(1)}x - quality ${Math.round(ap.quality || 68)} - bugs ${Math.round(ap.bugs || 0)} - morale ${Math.round(state.morale ?? CONFIG.MORALE_START)}${extras ? ' | ' + extras : ''}`;
  } else {
    hud.devCard.classList.add('hidden');
  }

  // Cooldown labels
  updateCooldownLabel('pitch',    state.cooldowns.pitch);
  updateCooldownLabel('caffeine', state.cooldowns.caffeine);
  updateCooldownLabel('pivot',    state.cooldowns.pivot);
  updateCooldownLabel('update',   state.cooldowns.update);
  updateCooldownLabel('crunch',   state.cooldowns.crunch);
  updateCooldownLabel('marketing', state.cooldowns.marketing);

  // No VCs until you've shipped something  keep the pitch button dark in stealth
  if (!state.live) {
    const pitchBtn = document.getElementById('btn-vc-pitch');
    const pitchCd  = hud.cdLabels.pitch;
    if (pitchBtn) pitchBtn.disabled = true;
    if (pitchCd)  { pitchCd.textContent = 'LAUNCH 1ST'; pitchCd.classList.remove('ready'); pitchCd.classList.add('on-cooldown'); }
  }

  // Launch-product button shows how many products are ready to launch
  if (hud.launchReady) {
    const n = state.readyProducts.length;
    hud.launchReady.textContent = n > 0 ? `${n} READY` : 'NONE';
    hud.launchReady.classList.toggle('ready', n > 0);
    hud.launchReady.classList.toggle('on-cooldown', n === 0);
  }

  // Develop button shows whether you're seated at your desk
  const devCd = document.getElementById('cd-develop');
  if (devCd) {
    const founderDesk = getFounderDesk(state);
    const serversReady = (getModifiers(state).serverWorking || 0) > 0;
    const ready = !!founderDesk && founderDesk.hasComputer && serversReady && state.founderAtDesk;
    devCd.textContent = !founderDesk ? 'BUY DESK'
      : !founderDesk.hasComputer ? 'BUY PC'
      : !serversReady ? 'BUY SERVER'
      : state.founderAtDesk ? 'AT DESK'
      : 'GO TO DESK';
    devCd.classList.toggle('ready', ready);
    devCd.classList.toggle('on-cooldown', !ready);
  }

  // Glitch overlay
  updateGlitchOverlay(state);
  updateOnboarding(state);
}

function onboardingStepData(state) {
  const founderDesk = getFounderDesk(state);
  const serverReady = (getModifiers(state).serverWorking || 0) > 0;
  const startedProduct = getActiveProducts(state).length > 0 || state.readyProducts.length > 0 || state.shippedProducts.length > 0;
  return [
    {
      key: 'desk',
      done: !!founderDesk,
      label: 'Buy and place a founder desk',
      hint: 'Open BUY, choose DESK, then click the garage floor.',
    },
    {
      key: 'computer',
      done: !!founderDesk?.hasComputer,
      label: 'Add a computer',
      hint: 'The computer option unlocks after the desk exists.',
    },
    {
      key: 'server',
      done: serverReady,
      label: 'Buy and place a server',
      hint: 'A server unlocks product development.',
    },
    {
      key: 'sit',
      done: !!state.founderAtDesk,
      label: 'Sit at your desk',
      hint: 'Click near the founder workstation or press DEVELOP.',
    },
    {
      key: 'develop',
      done: startedProduct,
      label: 'Develop your first product',
      hint: 'Pick an idea, set ambition, and fund it.',
    },
  ];
}

// For each tutorial step, the HUD elements the player must press next.
// The glow follows the path: category button -> submenu action button.
const TUTO_TARGETS = {
  desk:     ['.cat-btn[data-cat="build"]', '#btn-build'],
  computer: ['.cat-btn[data-cat="build"]', '#btn-build'],
  server:   ['.cat-btn[data-cat="build"]', '#btn-build'],
  sit:      [],   // guided by the 3D desk marker arrow
  develop:  ['.cat-btn[data-cat="make"]', '#btn-develop'],
};
let _tutoStepKey = null;

function setTutorialFocus(stepKey) {
  if (stepKey === _tutoStepKey) return;
  _tutoStepKey = stepKey;
  document.querySelectorAll('.tuto-focus').forEach(el => el.classList.remove('tuto-focus'));
  if (!stepKey) return;
  for (const sel of TUTO_TARGETS[stepKey] || []) {
    const el = document.querySelector(sel);
    if (el) el.classList.add('tuto-focus');
  }
}

/** Glow applied inside the Buy modal so the tutorial points at the right card. */
export function applyBuildModalTutorialFocus(state) {
  if (_tutoStepKey === 'desk') {
    document.getElementById('btn-buy-desk')?.classList.add('tuto-focus');
  } else if (_tutoStepKey === 'computer') {
    document.getElementById('btn-buy-computer')?.classList.add('tuto-focus');
  } else if (_tutoStepKey === 'server') {
    document.querySelector('#build-options .srv-buy')?.classList.add('tuto-focus');
  }
}

function updateOnboarding(state) {
  if (!hud.onboardingCard || !hud.onboardingSteps) return;
  const steps = onboardingStepData(state);
  const complete = steps.every(s => s.done);
  const startedProduct = getActiveProducts(state).length > 0 || state.readyProducts.length > 0 || state.shippedProducts.length > 0;
  if (state.live || startedProduct || complete) {
    hud.onboardingCard.classList.add('hidden');
    setTutorialFocus(null);
    const obj = document.getElementById('objectives-panel');
    if (obj) obj.classList.add('show');   // tutorial done -> reveal objectives
    return;
  }

  const current = steps.find(s => !s.done) || steps[steps.length - 1];
  setTutorialFocus(current.key);
  hud.onboardingCard.classList.remove('hidden');
  if (hud.onboardingTitle) hud.onboardingTitle.textContent = 'Set up the empty garage';
  if (hud.onboardingNext) hud.onboardingNext.textContent = current.hint;
  hud.onboardingSteps.innerHTML = steps.map((step) => `
    <li class="${step.done ? 'done' : step.key === current.key ? 'current' : ''}">
      <span class="onboarding-dot">${step.done ? 'OK' : ''}</span>
      <span>${step.label}</span>
    </li>
  `).join('');
}

const CD_BUTTON_IDS = {
  pitch:    'btn-vc-pitch',
  caffeine: 'btn-caffeinate',
  pivot:    'btn-pivot',
  update:   'btn-ship-update',
  crunch:   'btn-crunch-sprint',
  marketing: 'btn-marketing',
};

function updateCooldownLabel(key, remaining) {
  const el  = hud.cdLabels[key];
  const btn = document.getElementById(CD_BUTTON_IDS[key]);
  if (!el) return;

  if (remaining > 0) {
    el.textContent = `${remaining.toFixed(1)}s`;
    el.classList.add('on-cooldown');
    el.classList.remove('ready');
    if (btn) btn.disabled = true;
  } else {
    el.textContent = key === 'marketing' ? fmtMoney(CONFIG.MARKETING_COST) : 'READY';
    el.classList.add('ready');
    el.classList.remove('on-cooldown');
    if (btn) btn.disabled = false;
  }
}

// Glitch intensity based on runway seconds remaining
const GLITCH_CLASSES = ['glitch-low', 'glitch-med', 'glitch-high'];
function updateGlitchOverlay(state) {
  const ov = hud.glitchOverlay;
  if (!ov) return;
  GLITCH_CLASSES.forEach(c => ov.classList.remove(c));

  const level = getGlitchLevel(state); // 0..1
  if (level <= 0) {
    ov.classList.remove('active');
    ov.style.opacity = 0;
    return;
  }

  ov.classList.add('active');
  ov.style.opacity = level * 0.7;

  if (level < 0.34)      ov.classList.add('glitch-low');
  else if (level < 0.67) ov.classList.add('glitch-med');
  else                   ov.classList.add('glitch-high');
}

//  Employee Bar 
let teamHandlers = {};
/** main.js wires { onOpen(empId), onPizza(), onPromote(empId) }. */
export function setTeamHandlers(h) { teamHandlers = h || {}; }

const EMP_COLORS = ['#4D6BFF', '#FF4D9D', '#FF9A1F', '#19C37D', '#9B5DE5', '#00B3C4'];
function empColor(emp) { return EMP_COLORS[(emp.colorIdx ?? 0) % EMP_COLORS.length]; }

function empCardHTML(emp) {
  const p = PERSONALITIES[emp.personality];
  const mood = getEmployeeMood(emp);
  const traits = (emp.traits || []).slice(0, 2).map(id => {
    const t = traitById(id); if (!t) return '';
    return `<span class="emp-trait ${t.good ? 'good' : 'bad'}" title="${t.label}: ${t.blurb}">${t.label}</span>`;
  }).join('');
  return `
    <button class="emp-card mood-${mood.tone}" data-emp-id="${emp.id}" title="${p.label}  tap for profile">
      <div class="emp-card-top">
        <span class="emp-ava" style="background:${empColor(emp)}">${p.icon}</span>
        <span class="emp-mood" title="${mood.label}">${mood.emoji}</span>
      </div>
      <div class="emp-name">${emp.name}</div>
      <div class="emp-title">${getEmployeeTitle(emp)}</div>
      <div class="emp-bars">
        <div class="emp-bar" title="Energy"><span class="emp-bar-fill energy" id="empbar-e-${emp.id}"></span></div>
        <div class="emp-bar" title="Happiness"><span class="emp-bar-fill happy" id="empbar-h-${emp.id}"></span></div>
      </div>
      <div class="emp-traits">${traits}</div>
    </button>`;
}

export function initEmployeeBar(state) {
  const bar = hud.employeeBar; if (!bar) return;
  const emps = (state && state.employees) || [];
  if (!emps.length) { bar.innerHTML = ''; return; }
  const tm = getTeamMoodSummary(state);
  bar.innerHTML = `
    <div class="team-head">
      <div class="team-mood" title="Average happiness ${tm.avgHappy}, stress ${tm.avgStress}">
        <span class="team-mood-emoji">${tm.emoji}</span>
        <span class="team-mood-txt"><b>${tm.label}</b><small>${emps.length} on the team</small></span>
      </div>
      <button id="btn-pizza" class="team-pizza" title="Company-wide pizza (${fmtMoney(CONFIG.PIZZA_COST)})  a morale band-aid that absurdly works">\u{1F355} Pizza</button>
    </div>
    <div class="emp-cards">${emps.map(empCardHTML).join('')}</div>`;
  const pz = bar.querySelector('#btn-pizza');
  if (pz) pz.addEventListener('click', () => teamHandlers.onPizza && teamHandlers.onPizza());
  bar.querySelectorAll('.emp-card').forEach(c =>
    c.addEventListener('click', () => teamHandlers.onOpen && teamHandlers.onOpen(+c.dataset.empId)));
  updateEmployeeBar(state);
}

export function updateEmployeeBar(state) {
  const emps = (state && state.employees) || [];
  for (const emp of emps) {
    const e = document.getElementById(`empbar-e-${emp.id}`);
    const h = document.getElementById(`empbar-h-${emp.id}`);
    if (e) { e.style.width = `${Math.round((emp.energy || 0) * 100)}%`; e.classList.toggle('low', emp.energy < 0.3 && !emp.burnedOut); }
    if (h) h.style.width = `${Math.round(emp.happiness ?? 0)}%`;
    const card = hud.employeeBar && hud.employeeBar.querySelector(`.emp-card[data-emp-id="${emp.id}"]`);
    if (card) {
      const mood = getEmployeeMood(emp);
      if (card.dataset.mood !== mood.id) {
        card.dataset.mood = mood.id;
        card.className = `emp-card mood-${mood.tone}`;
        const me = card.querySelector('.emp-mood'); if (me) { me.textContent = mood.emoji; me.title = mood.label; }
      }
    }
  }
  const chip = hud.employeeBar && hud.employeeBar.querySelector('.team-mood');
  if (chip) {
    const tm = getTeamMoodSummary(state);
    const em = chip.querySelector('.team-mood-emoji'); const tx = chip.querySelector('.team-mood-txt b');
    if (em) em.textContent = tm.emoji; if (tx) tx.textContent = tm.label;
  }
}

/** Full character sheet: stats, traits, relationships, and the Promote lever. */
export function openEmployeeModal(state, empId) {
  const modal = document.getElementById('employee-modal');
  const body  = document.getElementById('employee-modal-body');
  if (!modal || !body) return;
  const emp = ((state && state.employees) || []).find(x => x.id === empId);
  if (!emp) { modal.classList.add('hidden'); return; }
  const p = PERSONALITIES[emp.personality];
  const mood = getEmployeeMood(emp);
  const bars = [
    ['Energy', Math.round((emp.energy || 0) * 100), 'energy'],
    ['Happiness', Math.round(emp.happiness ?? 0), 'happy'],
    ['Stress', Math.round(emp.stress ?? 0), 'stress'],
    ['Loyalty', Math.round(emp.loyalty ?? 0), 'loyal'],
  ].map(([l, v, c]) => `<div class="emp-stat"><div class="emp-stat-top"><span>${l}</span><b>${v}</b></div><div class="emp-stat-track"><span class="emp-stat-fill ${c}" style="width:${Math.max(0, Math.min(100, v))}%"></span></div></div>`).join('');
  const traits = (emp.traits || []).map(id => {
    const t = traitById(id); if (!t) return '';
    return `<div class="emp-trait-row ${t.good ? 'good' : 'bad'}"><b>${t.label}</b><span>${t.blurb}</span></div>`;
  }).join('') || '<div class="emp-trait-row"><span>No notable quirks yet. Suspicious.</span></div>';
  const bonds = (emp.bonds || []).map(b => {
    const o = state.employees.find(x => x.id === b.withId); if (!o) return '';
    const m = bondMeta(b.type);
    return `<span class="emp-bond ${m.good ? 'good' : 'bad'}">${m.icon} ${m.verb} <b>${o.name}</b></span>`;
  }).filter(Boolean).join('') || '<span class="emp-bond none">keeps to themselves</span>';
  const promoteCost = Math.round(emp.salary * 6);
  const canPromote = (emp.rank ?? 0) < 5;
  body.innerHTML = `
    <div class="emp-modal-head">
      <span class="emp-modal-ava" style="background:${empColor(emp)}">${p.icon}</span>
      <div class="emp-modal-id">
        <div class="emp-modal-name">${emp.name} <span class="emp-modal-mood mood-${mood.tone}">${mood.emoji} ${mood.label}</span></div>
        <div class="emp-modal-title">${getEmployeeTitle(emp)}  ${fmtMoney(emp.salary)}/s</div>
        <div class="emp-modal-pers">${p.label}  ${p.desc}</div>
      </div>
    </div>
    <div class="emp-modal-xp">Level ${(emp.rank ?? 0) + 1}  ${Math.round(emp.experience || 0)} XP  ${emp.tenure ? Math.round(emp.tenure) + 's at the company' : 'just started'}</div>
    <div class="emp-stats">${bars}</div>
    <div class="emp-section-label">Traits</div>
    <div class="emp-traits-full">${traits}</div>
    <div class="emp-section-label">Relationships</div>
    <div class="emp-bonds">${bonds}</div>
    <div class="emp-modal-actions">
      <button id="btn-emp-promote" class="btn btn-primary btn-sm" ${canPromote ? '' : 'disabled'}>${canPromote ? `Promote (${fmtMoney(promoteCost)})` : 'Runs the place already'}</button>
      <button id="btn-emp-pizza" class="btn btn-ghost btn-sm">\u{1F355} Pizza the team (${fmtMoney(CONFIG.PIZZA_COST)})</button>
    </div>`;
  modal.classList.remove('hidden');
  const bp = body.querySelector('#btn-emp-promote');
  if (bp) bp.addEventListener('click', () => teamHandlers.onPromote && teamHandlers.onPromote(empId));
  const bz = body.querySelector('#btn-emp-pizza');
  if (bz) bz.addEventListener('click', () => teamHandlers.onPizza && teamHandlers.onPizza());
  const close = document.getElementById('btn-close-employee');
  if (close) close.onclick = () => modal.classList.add('hidden');
}

//  Event Queue 
const activeEventCards = new Map();

export function addEventCard(id, type, title, desc) {
  if (!hud.eventQueue || activeEventCards.has(id)) return;

  const card = document.createElement('div');
  card.className = `event-card event-${type}`;
  card.id        = `event-${id}`;
  card.innerHTML = `
    <div class="event-card-title">${title}</div>
    <div class="event-card-desc">${desc}</div>
    <div class="event-card-timer" id="event-timer-${id}"></div>
  `;
  hud.eventQueue.appendChild(card);
  activeEventCards.set(id, card);
}

export function updateEventTimer(id, remaining, max) {
  const timerEl = document.getElementById(`event-timer-${id}`);
  if (!timerEl) return;
  timerEl.textContent = `${remaining.toFixed(0)}s`;

  const ratio = remaining / max;
  if (ratio < 0.3) timerEl.style.color = '#FF4C4C';
  else if (ratio < 0.6) timerEl.style.color = '#FFB300';
  else timerEl.style.color = '#888888';
}

export function removeEventCard(id) {
  const card = activeEventCards.get(id);
  if (card) {
    card.style.animation = 'slide-in-right 0.3s ease reverse';
    setTimeout(() => { card.remove(); }, 300);
    activeEventCards.delete(id);
  }
}

export function clearAllEventCards() {
  activeEventCards.forEach((card) => card.remove());
  activeEventCards.clear();
}

//  Central Warning Alert (one elegant, animated, funny alert) 
const ALERT_HEADERS = [
  'MILD CATASTROPHE', 'DISRUPTION REQUIRED', "THAT'S NOT HOW MONEY WORKS",
  'HOUSTON, A PROBLEM', 'UNSCHEDULED CHAOS', "THE BOARD WON'T LIKE THIS",
  'SLIGHT EXISTENTIAL ISSUE', 'A LEARNING OPPORTUNITY',
];
function alertHint(msg) {
  const m = msg.toLowerCase();
  if (m.includes('sit')) return 'Walk over and sit at your desk.';
  if (m.includes('free desk') || m.includes('no free')) return 'Buy and place a desk, then hire.';
  if (m.includes('server')) return 'Buy and place a server before productivity tanks.';
  if (m.includes('locked') || m.includes('research') || m.includes('tier')) return 'Unlock it in RESEARCH first.';
  if (m.includes('cooldown')) return 'Patience - even disruption has a cooldown.';
  if (m.includes('ready') || m.includes('develop')) return 'Develop a product first (DEVELOP PRODUCT).';
  if (m.includes('desk')) return 'Buy and place a desk, or walk to yours.';
  if (m.includes('need') || m.includes('afford') || m.includes('cash') || m.includes('$')) return 'Launch a product for revenue. Or manifest it.';
  if (m.includes('hype')) return ' Launch a product to spike Hype.';
  return ' Have you tried turning the startup off and on again?';
}
let _alertTimer = null;
let _alertSticky = false;
export function showAlert(message, opts = {}) {
  const el = document.getElementById('central-alert');
  if (!el) return;
  if (_alertSticky && !opts.sticky) return; // a sticky (fire) alert owns the screen
  const header = opts.header || ALERT_HEADERS[Math.floor(Math.random() * ALERT_HEADERS.length)];
  const hint   = opts.hint != null ? opts.hint : alertHint(message);
  el.innerHTML = `
    <div class="ca-icon">${opts.icon || '!'}</div>
    <div class="ca-body">
      <div class="ca-header">${header}</div>
      <div class="ca-msg">${message}</div>
      ${hint ? `<div class="ca-hint">${hint}</div>` : ''}
    </div>`;
  el.classList.toggle('ca-sticky', !!opts.sticky);
  el.classList.remove('hidden', 'ca-in');
  void el.offsetWidth; // restart animation
  el.classList.add('ca-in');
  clearTimeout(_alertTimer);
  _alertSticky = !!opts.sticky;
  if (!opts.sticky) _alertTimer = setTimeout(() => el.classList.add('hidden'), 4200);
}

export function clearAlert() {
  _alertSticky = false;
  clearTimeout(_alertTimer);
  const el = document.getElementById('central-alert');
  if (el) el.classList.add('hidden');
}

//  Toast Notifications 
// Warnings/errors are funnelled into the single central alert; info/success
// stay as small toasts.
export function showToast(message, type = 'info', duration = 3000) {
  if (type === 'warning' || type === 'error') { showAlert(message); return; }
  if (!hud.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  hud.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

//  Hire Modal 
export function showCashHit(amount) {
  if (!amount || amount <= 0 || !hud.cashValue) return;
  hud.cashValue.classList.remove('cash-flash');
  void hud.cashValue.offsetWidth;
  hud.cashValue.classList.add('cash-flash');

  const hit = document.createElement('div');
  hit.className = 'cash-hit-float';
  hit.textContent = `-${fmtMoney(amount)}`;
  const rect = hud.cashValue.getBoundingClientRect();
  hit.style.left = `${rect.left + rect.width / 2}px`;
  hit.style.top = `${rect.top + rect.height + 8}px`;
  document.body.appendChild(hit);
  setTimeout(() => hit.remove(), 950);
}

/**
 * Floating positive "+$X" / "+N Hype" feedback for cash injections and Hype
 * gains - the upbeat mirror of showCashHit. kind: 'cash' | 'hype'.
 */
export function showGainFloat(amount, kind = 'cash') {
  if (!amount || amount <= 0) return;
  const anchor = kind === 'hype'
    ? document.getElementById('hype-value')
    : (hud.cashValue || document.getElementById('cash-value'));
  if (!anchor) return;
  const el = document.createElement('div');
  el.className = `gain-float gain-${kind === 'hype' ? 'hype' : 'cash'}`;
  el.textContent = kind === 'hype' ? `+${Math.round(amount)} Hype` : `+${fmtMoney(amount)}`;
  const rect = anchor.getBoundingClientRect();
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top - 6}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

export function openHireModal(state, onHire, onClose) {
  const modal = document.getElementById('hire-modal');
  const list  = document.getElementById('candidate-list');
  const note  = document.getElementById('hire-note');
  if (!modal || !list) return;

  const candidates = generateCandidates(state);
  const freeDesk   = state.desks.some(d => d.employeeId === null);
  const canAfford  = state.cash >= CONFIG.HIRE_SIGNING_BONUS;
  const founderDesk = getFounderDesk(state);

  if (!founderDesk) {
    note.textContent = 'Buy and place your founder desk first. Employees need their own extra desk.';
    note.classList.add('modal-note-warn');
  } else if (!freeDesk) {
    note.textContent = 'No free employee desk - buy and place another desk first.';
    note.classList.add('modal-note-warn');
  } else if (!canAfford) {
    note.textContent = `Need ${fmtMoney(CONFIG.HIRE_SIGNING_BONUS)} signing bonus.`;
    note.classList.add('modal-note-warn');
  } else {
    note.textContent = `Signing bonus ${fmtMoney(CONFIG.HIRE_SIGNING_BONUS)} - salary paid per second. Choose wisely.`;
    note.classList.remove('modal-note-warn');
  }

  list.innerHTML = '';
  for (const cand of candidates) {
    const role = ROLES[cand.role];
    const p    = PERSONALITIES[cand.personality];
    const codingStars = cand.role === 'eng' ? 5 : cand.role === 'design' ? 3 : 2;
    const marketingStars = cand.role === 'growth' ? 5 : cand.role === 'design' ? 3 : 2;
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.innerHTML = `
      <div class="candidate-header">
        <span class="candidate-icon candidate-icon-emoji">${{ eng: '👩‍💻', design: '🎨', growth: '📣' }[cand.role] || '🧑‍💼'}</span>
        <div>
          <div class="candidate-name">${cand.name}</div>
          <div class="candidate-role">${role.label}</div>
        </div>
        <div class="candidate-salary">${fmtMoney(cand.salary)}/s</div>
      </div>
      <div class="employee-stars">
        <span>Coding <b>${'★'.repeat(codingStars)}${'☆'.repeat(5 - codingStars)}</b></span>
        <span>Marketing <b>${'★'.repeat(marketingStars)}${'☆'.repeat(5 - marketingStars)}</b></span>
      </div>
      <div class="candidate-personality">Trait: ${p.label}</div>
      <div class="candidate-desc">${p.desc}</div>
      <button class="btn btn-primary btn-sm candidate-hire-btn" ${(!freeDesk || !canAfford) ? 'disabled' : ''}>HIRE</button>
    `;
    card.querySelector('.candidate-hire-btn').addEventListener('click', () => {
      modal.classList.add('hidden');
      onHire(cand);
    });
    list.appendChild(card);
  }

  document.getElementById('btn-close-hire').onclick = () => {
    modal.classList.add('hidden');
    onClose();
  };

  modal.classList.remove('hidden');
}

//  Buy Modal 
export function openBuildModal(state, onBuy, onClose) {
  const modal = document.getElementById('build-modal');
  const list  = document.getElementById('build-options');
  if (!modal || !list) return;

  const desksUsed     = state.desks.length;
  const desksMax      = state.deskSlots;
  const noComputer    = state.desks.filter(d => !d.hasComputer).length;
  const founderDesk   = getFounderDesk(state);
  const canBuyDesk    = desksUsed < desksMax && state.cash >= CONFIG.DESK_COST;
  const canBuyComp    = desksUsed > 0 && noComputer > 0 && state.cash >= CONFIG.COMPUTER_COST;
  const nextTier      = OFFICE_TIERS[state.officeTier + 1];
  const deskDesc      = !founderDesk
    ? `First desk becomes your founder workstation. ${desksUsed}/${desksMax} slots used.`
    : `One extra seat for one hire. ${desksUsed}/${desksMax} slots used.`;
  const computerDesc  = desksUsed === 0
    ? 'Buy and place a desk first, then add a computer.'
    : noComputer > 0
      ? `Buy, then click the exact desk to install it. ${noComputer} desk${noComputer === 1 ? '' : 's'} missing one.`
      : 'Every placed desk already has a computer.';
  const computerLabel = desksUsed === 0 ? 'BUY DESK' : noComputer === 0 ? 'ALL SET' : fmtMoney(CONFIG.COMPUTER_COST);

  list.innerHTML = `
    <div class="build-section-label">STARTUP ESSENTIALS</div>
    <div class="build-card">
      ${emojiIcon('🪑', 'desk')}
      <div class="build-info">
        <div class="build-name">DESK</div>
        <div class="build-desc">${deskDesc}</div>
      </div>
      <button id="btn-buy-desk" class="btn btn-primary btn-sm" ${canBuyDesk ? '' : 'disabled'}>
        ${desksUsed >= desksMax ? 'FULL' : fmtMoney(CONFIG.DESK_COST)}
      </button>
    </div>
    <div class="build-card ${desksUsed === 0 || noComputer === 0 ? 'build-locked' : ''}">
      ${emojiIcon('🖥️', 'computer')}
      <div class="build-info">
        <div class="build-name">COMPUTER</div>
        <div class="build-desc">${computerDesc}</div>
      </div>
      <button id="btn-buy-computer" class="btn btn-primary btn-sm" ${canBuyComp ? '' : 'disabled'}>
        ${computerLabel}
      </button>
    </div>
  `;

  //  Server status (replace racks destroyed by fire) 
  const down    = (state.rackDown || []).filter(d => d).length;
  const working = CONFIG.NUM_RACKS - down;
  const serverDesc = working === 0
    ? 'No server yet. Buy one before development can start.'
    : down > 0
      ? 'More servers boost dev speed & MRR. Replace offline racks when cash allows.'
      : 'All servers humming. Click fires fast to keep them alive.';
  const serverCard = document.createElement('div');
  serverCard.className = 'build-card' + (down > 0 && state.cash < CONFIG.SERVER_COST ? ' build-locked' : '') + (down === 0 ? ' build-owned' : '');
  serverCard.innerHTML = `
    ${emojiIcon('🗄️', 'server')}
    <div class="build-info">
      <div class="build-name">SERVERS  ${working}/${CONFIG.NUM_RACKS} ONLINE</div>
      <div class="build-desc">${down > 0
        ? 'A server burned down - dev speed & MRR are throttled until you replace it.'
        : 'All servers humming. Click fires fast to keep them alive.'}</div>
    </div>
    ${down > 0
      ? `<button class="btn btn-primary btn-sm srv-buy" ${state.cash >= CONFIG.SERVER_COST ? '' : 'disabled'}>${fmtMoney(CONFIG.SERVER_COST)}</button>`
      : '<button class="btn btn-ghost btn-sm" disabled>ONLINE</button>'}
  `;
  const serverDescEl = serverCard.querySelector('.build-desc');
  if (serverDescEl) serverDescEl.textContent = serverDesc;
  const srvBtn = serverCard.querySelector('.srv-buy');
  if (srvBtn) srvBtn.addEventListener('click', () => { modal.classList.add('hidden'); onBuy('server'); });
  list.appendChild(serverCard);

  document.getElementById('btn-buy-desk').onclick = () => {
    modal.classList.add('hidden');
    onBuy('desk');
  };
  document.getElementById('btn-buy-computer').onclick = () => {
    modal.classList.add('hidden');
    onBuy('computer');
  };

  //  Facilities: devices + rooms 
  const mods = getModifiers(state);
  const section = (label) => {
    const h = document.createElement('div');
    h.className = 'build-section-label';
    h.textContent = label;
    list.appendChild(h);
  };
  const addFacilityCards = (kind) => {
    for (const f of FACILITIES.filter(x => x.kind === kind)) {
      const owned  = state.facilities.includes(f.id);
      const locked = f.tier > mods.tierUnlocked;
      const lvl    = (state.facilityLevels && state.facilityLevels[f.id]) || 1;
      const card = document.createElement('div');
      card.className = 'build-card' + (owned ? ' build-owned' : '') + (locked ? ' build-locked' : '');
      let btn;
      if (owned) {
        if (lvl >= CONFIG.FACILITY_MAX_LEVEL) {
          btn = `<button class="btn btn-ghost btn-sm" disabled>Lv ${lvl}  MAX</button>`;
        } else {
          const upCost = Math.round(f.cost * lvl * 0.9);
          btn = `<button class="btn btn-primary btn-sm fac-up" ${state.cash >= upCost ? '' : 'disabled'}>Lv ${lvl} -> ${fmtMoney(upCost)}</button>`;
        }
      } else if (locked) {
        btn = `<button class="btn btn-ghost btn-sm" disabled> TIER ${f.tier}</button>`;
      } else {
        btn = `<button class="btn btn-primary btn-sm fac-buy" ${state.cash >= f.cost ? '' : 'disabled'}>${fmtMoney(f.cost)}</button>`;
      }
      card.innerHTML = `
        ${emojiIcon(f.emoji, f.kind === 'Room' ? 'office' : 'tool')}
        <div class="build-info">
          <div class="build-name">${f.name} ${owned ? `<span class="accent-cyan"> Lv ${lvl}</span>` : ''}</div>
          <div class="build-desc">${f.desc}${f.upkeep ? ` <span class="build-upkeep">(${fmtMoney(f.upkeep * lvl)}/s upkeep)</span>` : ''}</div>
        </div>
        ${btn}
      `;
      const buyBtn = card.querySelector('.fac-buy');
      if (buyBtn) buyBtn.addEventListener('click', () => { modal.classList.add('hidden'); onBuy(f.id); });
      const upBtn = card.querySelector('.fac-up');
      if (upBtn) upBtn.addEventListener('click', () => { modal.classList.add('hidden'); onBuy('upgrade:' + f.id); });
      list.appendChild(card);
    }
  };
  section('DEVICES');
  addFacilityCards('Device');
  section(mods.tierUnlocked >= 2 ? 'ROOMS' : 'ROOMS  research "Facilities Permit" to unlock');
  addFacilityCards('Room');
  section('GROW THE HQ  every upgrade you will unlock');
  const ladder = document.createElement('div');
  ladder.className = 'build-tier-ladder';
  ladder.innerHTML = OFFICE_TIERS.map((tier, i) => {
    const here  = i === state.officeTier;
    const owned = i < state.officeTier;
    const isNext= i === state.officeTier + 1;
    const cls = here ? 'is-here' : owned ? 'is-owned' : isNext ? 'is-next' : 'is-locked';
    const right = isNext
      ? `<button class="btn btn-primary btn-sm bt-buy" ${state.cash >= tier.cost ? '' : 'disabled'}>${fmtMoney(tier.cost)}</button>`
      : `<span class="bt-status">${here ? 'YOU ARE HERE' : owned ? 'OWNED' : 'LOCKED'}</span>`;
    return `<div class="build-tier ${cls}">
      <span class="bt-dot">${owned ? '\u2713' : here ? '\u25CF' : i + 1}</span>
      <div class="bt-info"><div class="bt-name">${tier.name}</div><div class="bt-sub">${tier.slots} desk slots${tier.cost ? ' \u00b7 ' + fmtMoney(tier.cost) : ' \u00b7 starter garage'}</div></div>
      ${right}
    </div>`;
  }).join('');
  list.appendChild(ladder);
  const expandBtn = ladder.querySelector('.bt-buy');
  if (expandBtn) expandBtn.onclick = () => { modal.classList.add('hidden'); onBuy('expand'); };

  document.getElementById('btn-close-build').onclick = () => {
    modal.classList.add('hidden');
    onClose();
  };

  applyBuildModalTutorialFocus(state);
  modal.classList.remove('hidden');
}

//  Bank Loan Modal 
export function openLoanModal(state, onTake, onClose) {
  const modal = document.getElementById('loan-modal');
  const list  = document.getElementById('loan-options');
  const note  = document.getElementById('loan-note');
  if (!modal || !list) return;

  note.innerHTML = `Cash: <b class="${state.cash < 0 ? 'accent-error' : 'accent-cyan'}">${fmtMoney(state.cash)}</b>  `
    + `Debt: <b class="accent-error">${fmtMoney(state.debt)}</b>  `
    + `Interest: <b class="accent-error">${fmtMoney(state.loanBurn)}/s</b>. `
    + `Bankrupt below <b class="accent-error">${fmtMoney(CONFIG.DEBT_LIMIT)}</b>.`;

  list.innerHTML = '';
  for (const loan of LOANS) {
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = `
      ${emojiIcon(loan.emoji, 'cash')}
      <div class="build-info">
        <div class="build-name">${loan.name} <span class="accent-cyan">+${fmtMoney(loan.cash)} now</span></div>
        <div class="build-desc">${loan.desc}</div>
      </div>
      <button class="btn btn-primary btn-sm loan-take">BORROW</button>
    `;
    card.querySelector('.loan-take').addEventListener('click', () => { modal.classList.add('hidden'); onTake(loan.id); });
    list.appendChild(card);
  }

  document.getElementById('btn-close-loan').onclick = () => { modal.classList.add('hidden'); onClose(); };
  modal.classList.remove('hidden');
}

//  Peddler Offer Modal 
export function openPeddlerModal(state, deal, onAccept, onDecline) {
  const modal = document.getElementById('peddler-modal');
  const body  = document.getElementById('peddler-body');
  if (!modal || !body) return;

  const strings = [];
  if (deal.cash) strings.push(`<span class="accent-cyan">+${fmtMoney(deal.cash)} cash</span>`);
  if (deal.debt) strings.push(`<span class="accent-error">+${fmtMoney(deal.debt)} debt</span>`);
  if (deal.hype) strings.push(`<span class="${deal.hype > 0 ? 'accent-magenta' : 'accent-error'}">${deal.hype > 0 ? '+' : ''}${deal.hype} Hype</span>`);

  body.innerHTML = `
    <div class="peddler-figure">DEAL</div>
    <div class="peddler-text">"${deal.text}"</div>
    <div class="peddler-terms">${strings.join('  ')}</div>
  `;

  document.getElementById('btn-peddler-accept').onclick = () => { modal.classList.add('hidden'); onAccept(deal); };
  document.getElementById('btn-peddler-decline').onclick = () => { modal.classList.add('hidden'); onDecline(); };
  modal.classList.remove('hidden');
}

//  Research / Tech Modal 
export function openResearchModal(state, onResearch, onClose) {
  const modal = document.getElementById('research-modal');
  const list  = document.getElementById('research-options');
  const note  = document.getElementById('research-note');
  if (!modal || !list) return;

  note.textContent = `Burn cash on deeply questionable R&D - each unlock makes your products weirder & more lucrative. War chest: ${fmtMoney(state.cash)}.`;
  list.innerHTML = '';

  const tiers = [...new Set(RESEARCH.map(r => r.tier))].sort();
  for (const tier of tiers) {
    const h = document.createElement('div');
    h.className = 'build-section-label';
    h.textContent = `TIER ${tier}`;
    list.appendChild(h);

    for (const node of RESEARCH.filter(r => r.tier === tier)) {
      const done   = state.research.includes(node.id);
      const locked = node.req.some(r => !state.research.includes(r));
      const canAfford = state.cash >= node.cost;
      const reqNames = node.req.map(r => (RESEARCH.find(n => n.id === r) || {}).name).filter(Boolean).join(', ');
      const card = document.createElement('div');
      card.className = 'build-card research-card' + (done ? ' build-owned' : '') + (locked ? ' build-locked' : '');
      let btn;
      if (done)        btn = '<button class="btn btn-ghost btn-sm" disabled>DONE</button>';
      else if (locked) btn = `<button class="btn btn-ghost btn-sm" disabled> LOCKED</button>`;
      else             btn = `<button class="btn btn-primary btn-sm res-buy" ${canAfford ? '' : 'disabled'}>${fmtMoney(node.cost)}</button>`;
      card.innerHTML = `
        ${emojiIcon(node.emoji, 'spark')}
        <div class="build-info">
          <div class="build-name">${node.name} ${done ? '<span class="accent-cyan"> researched</span>' : ''}</div>
          <div class="build-desc">${node.desc}${locked && reqNames ? ` <span class="build-upkeep">needs: ${reqNames}</span>` : ''}</div>
        </div>
        ${btn}
      `;
      const buyBtn = card.querySelector('.res-buy');
      if (buyBtn) buyBtn.addEventListener('click', () => { modal.classList.add('hidden'); onResearch(node.id); });
      list.appendChild(card);
    }
  }

  document.getElementById('btn-close-research').onclick = () => {
    modal.classList.add('hidden');
    onClose();
  };

  modal.classList.remove('hidden');
}

//  Develop Modal 
const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const DEV_EMOJI = [
  [/space|orbit|rocket|lunar|satellite|asteroid|cislunar|interplanetary/i, '🚀'],
  [/defense|aegis|war|nuclear|surveillance|drone|lethal|classified|military|agenc|coalition/i, '🎖️'],
  [/\bAI\b|AGI|model|neural|agent|prometheus|oracle|godmode|basilisk|singular/i, '🤖'],
  [/quantum|qubit|photonic/i, '⚛️'],
  [/game|gaming|play|pixel|loot|respawn/i, '🎮'],
  [/finance|fin|coin|bank|pay|ledger|crypto|token|onchain|yield|fomo/i, '💰'],
  [/health|med|bio|gene|crispr|cell|care|clin|neuro|longev|pharma/i, '🧬'],
  [/robot|servo|swarm|humanoid|atlas|grasp/i, '🦾'],
  [/social|clout|feed|creator|influencer|viral|brand|dance/i, '📣'],
  [/cyber|security|zero|sentinel|blackice|ghost/i, '🛡️'],
  [/saas|stack|ops|sync|platform|enterprise|developer/i, '🧱'],
  [/fusion|plasma|climate|carbon|energy|materials|graphene/i, '🔋'],
  [/metaverse|holo|lens|\bXR\b|\bAR\b|\bVR\b|phantom/i, '🥽'],
  [/invest|\bvc\b|capital|term sheet|billionaire|megacorp|nation|government|hyperscaler/i, '💼'],
  [/kid|toddler|student|pet|pup|\bcat\b|\bdog\b|colonist|humanity|boomer/i, '👥'],
  [/blockchain|web4|web5|\bdao\b/i, '⛓️'],
];
function emojiFor(label) { for (const [re, e] of DEV_EMOJI) if (re.test(label)) return e; return '✨'; }
const SLIDER_EMOJI = { engineering: '🔧', infrastructure: '🏗️', marketing: '📣', compliance: '⚖️', magic: '✨' };

// Extra app-defining choices. Each entry: display key, emoji, stat effects,
// and a `blurb` fragment used to assemble the app summary.
const MONETIZATION = [
  { key: 'Freemium',        emoji: '🧀', eff: { mrr: 0.85, hype: 6,  scam: 0   }, blurb: 'free until you accidentally love it' },
  { key: 'Subscriptions',   emoji: '🔁', eff: { mrr: 1.25, hype: 0,  scam: 4   }, blurb: 'billed monthly, cancellable via certified letter only' },
  { key: 'Ads Everywhere',  emoji: '📺', eff: { mrr: 1.1,  hype: -4, ethical: -10 }, blurb: 'ad-supported, including inside your dreams' },
  { key: 'Sell The Data',   emoji: '🕵️', eff: { mrr: 1.45, hype: -6, ethical: -22, scam: 14 }, blurb: 'monetized by selling telemetry to "a trusted partner"' },
  { key: 'Enterprise Deals',emoji: '📠', eff: { mrr: 1.5,  hype: -8, dev: 1.2  }, blurb: 'sold via 9-month procurement calls with someone named Chad' },
  { key: 'Tip Jar + Vibes', emoji: '🫙', eff: { mrr: 0.6,  hype: 12, absurdity: 0.3 }, blurb: 'funded entirely by guilt and a Ko-fi link' },
];
const PLATFORMS = [
  { key: 'Mobile App',      emoji: '📱', eff: { dev: 1.0,  hype: 4  }, blurb: 'lives on your phone' },
  { key: 'Browser Tab',     emoji: '🌐', eff: { dev: 0.85, hype: 0  }, blurb: 'lives in the 47th tab you never close' },
  { key: 'Smart Fridge',    emoji: '🧊', eff: { dev: 1.2,  hype: 10, absurdity: 0.4 }, blurb: 'runs exclusively on smart fridges' },
  { key: 'VR Headset',      emoji: '🥽', eff: { dev: 1.3,  hype: 14, mrr: 0.9 }, blurb: 'demands a headset and your dignity' },
  { key: 'Voice Assistant', emoji: '🗣️', eff: { dev: 1.1,  hype: 6,  absurdity: 0.2 }, blurb: 'only listens when you least want it to' },
  { key: 'Email, Somehow',  emoji: '📧', eff: { dev: 0.8,  hype: -4, mrr: 1.1 }, blurb: 'is technically just a very aggressive newsletter' },
];
const VIBES = [
  { key: 'Cheerful',           emoji: '😊', eff: { hype: 4 },                    blurb: 'and it is SO happy for you' },
  { key: 'Passive-Aggressive', emoji: '🙃', eff: { hype: 8, absurdity: 0.2 },    blurb: 'and it says "fine, whatever" when you log off' },
  { key: 'Menacing',           emoji: '😈', eff: { hype: 10, ethical: -8 },      blurb: 'and it knows what you did' },
  { key: 'Overly Apologetic',  emoji: '🙇', eff: { hype: 2, ethical: 6 },        blurb: 'and it apologizes before every notification' },
  { key: 'Corporate',          emoji: '👔', eff: { mrr: 1.1, hype: -6 },         blurb: 'and it circles back per its last email' },
  { key: 'Unhinged',           emoji: '🤪', eff: { hype: 14, scam: 8, absurdity: 0.5 }, blurb: 'and at 2am it starts posting on its own' },
];

// Assemble the satirical elevator pitch shown live on the generated card.
function appSummary(selection, monet, plat, vibe) {
  const ind = selection.industry;
  const aud = selection.audience.toLowerCase();
  return `${selection.name.trim() || 'This app'} is a ${selection.buzzword}-powered ${ind} product for ${aud}. `
    + `It ${plat.blurb}, is ${monet.blurb}, ${vibe.blurb}.`;
}

export function openDevelopModal(state, onPick, onClose) {
  const modal = document.getElementById('develop-modal');
  const list  = document.getElementById('product-choice-list');
  const note  = document.getElementById('develop-note');
  if (!modal || !list) return;

  const rerollBtn = document.getElementById('btn-reroll-products');
  const activeProducts = getActiveProducts(state);
  const lanes = getDevelopmentLaneCount(state);
  const building = activeProducts.length >= lanes;

  const eraIdx = getUnlockedEra(state);
  const era = PRODUCT_ERAS[eraIdx];
  const industries = era.industries;
  const buzzwords = era.buzzwords;
  const audiences = era.audiences;
  const nameFor = (indKey) => (industries.find(i => i.key === indKey) || industries[0]).names;
  const TAGLINES = [
    'The {buzz} layer for {aud}. Finally.',
    '{aud} deserve better {ind}. We are worse, but faster.',
    'Like {ind}, but it texts you at 3am.',
    'We bolted {buzz} onto {ind}. Nobody asked. Everybody clicked.',
    '{ind} for {aud}, minus the parts that worked.',
    'Uber, but for {ind}. For {aud}. We will explain in the Series A.',
    'The {buzz}-powered {ind} {aud} keep pretending to need.',
    'Your {ind}, now with mandatory {buzz} and no off switch.',
    'It is {ind}. It is {buzz}. It is, allegedly, a business.',
    'Finally, {ind} that reports {aud} to HR.',
  ];
  const TIER_NAMES = ['Garage App', 'Real Product', 'Scale-Up Tech', 'Deep Tech', 'Moonshot'];
  const tier = getProductTier ? getProductTier(state) : 0;

  const allocation = { engineering: 2, marketing: 2, magic: 2, compliance: 2, infrastructure: 2 };
  const selection = {
    industry: industries[0].key, buzzword: buzzwords[1], audience: audiences[3],
    monetize: MONETIZATION[0].key, platform: PLATFORMS[0].key, vibe: VIBES[0].key,
    name: '', tagline: '',
  };
  const pick = (arr, key) => arr.find(x => x.key === key) || arr[0];
  const powerSafe = Math.max(getTeamDevPower(state), 0.1);
  const allocationTotal = () => Object.values(allocation).reduce((s, v) => s + v, 0);

  const fillTpl = (t) => t.replace(/\{ind\}/g, selection.industry).replace(/\{buzz\}/g, selection.buzzword).replace(/\{aud\}/g, selection.audience.toLowerCase());
  const regenName = () => {
    const pool = nameFor(selection.industry);
    selection.name = pool[Math.floor(Math.random() * pool.length)];
    selection.tagline = fillTpl(TAGLINES[Math.floor(Math.random() * TAGLINES.length)]);
  };
  regenName();

  const estQuality = () => Math.max(30, Math.min(100, 50 + allocation.engineering * 4 + allocation.infrastructure * 2.5 + allocation.compliance * 2 - allocation.magic * 1.2));
  const buildIdea = () => {
    const total = allocationTotal() || 1;
    const eng = allocation.engineering / total, marketing = allocation.marketing / total;
    const magic = allocation.magic / total, compliance = allocation.compliance / total, infra = allocation.infrastructure / total;
    const bigBuyer = ['Investors', 'Governments', 'Militaries', 'Megacorps', 'Nations', 'Billionaires', 'Agencies', 'Coalitions', 'Pharma', 'Defense'].includes(selection.audience);
    const audienceMult = bigBuyer ? 1.25 : 1;
    const monet = pick(MONETIZATION, selection.monetize);
    const plat  = pick(PLATFORMS, selection.platform);
    const vibe  = pick(VIBES, selection.vibe);
    const mrrMult = (monet.eff.mrr ?? 1) * (plat.eff.mrr ?? 1) * (vibe.eff.mrr ?? 1);
    const devMult = (monet.eff.dev ?? 1) * (plat.eff.dev ?? 1) * (vibe.eff.dev ?? 1);
    const hypeAdd = (monet.eff.hype ?? 0) + (plat.eff.hype ?? 0) + (vibe.eff.hype ?? 0);
    const ethAdd  = (monet.eff.ethical ?? 0) + (plat.eff.ethical ?? 0) + (vibe.eff.ethical ?? 0);
    const scamAdd = (monet.eff.scam ?? 0) + (plat.eff.scam ?? 0) + (vibe.eff.scam ?? 0);
    const absAdd  = (monet.eff.absurdity ?? 0) + (plat.eff.absurdity ?? 0) + (vibe.eff.absurdity ?? 0);
    return {
      name: selection.name.trim() || 'Untitled',
      desc: selection.tagline,
      summary: appSummary(selection, monet, plat, vibe),
      industry: selection.industry,
      monetize: monet.key, platform: plat.key, vibe: vibe.key,
      era: era.id,
      tier,
      devPoints: Math.round((48 + eng * 38 + magic * 26 + infra * 18) * era.devMult * devMult),
      mrr: Math.round((210 + marketing * 240 + infra * 220 + magic * 120) * audienceMult * era.mrrMult * mrrMult),
      hype: Math.max(4, Math.round(12 + marketing * 30 + magic * 20 + hypeAdd)),
      absurdity: 1.15 + magic * 1.1 + marketing * 0.25 + absAdd,
      ethical: Math.round(35 + compliance * 45 - magic * 16 + ethAdd),
      scam: Math.max(0, Math.round(16 + magic * 42 - compliance * 24 + scamAdd)),
      ambition: 1,
      devAllocation: { ...allocation },
    };
  };

  const renderChoices = () => {
    list.innerHTML = '';
    if (building) {
      const laneSummary = activeProducts.map(ap => `${ap.idea.name} ${Math.floor(Math.min(100, (ap.progress / ap.idea.devPoints) * 100))}%`).join(' | ');
      note.textContent = `All ${lanes} development lane${lanes === 1 ? '' : 's'} busy: ${laneSummary}. Hire more people to run more products at once.`;
      if (rerollBtn) rerollBtn.style.display = 'none';
      return;
    }
    if (rerollBtn) rerollBtn.style.display = '';
    note.textContent = `${fmtMoney(state.cash)} cash. Pick a direction, name it, then split 10 build points - they decide quality, reviews and sales.`;
    list.classList.add('startup-lab');
    const idea = buildIdea();
    const invest = computeInvestment(idea);
    const chance = Math.round(computeSuccessChance(state, idea.ambition) * 100);
    const q = Math.round(estQuality());
    const broke = invest > state.cash;
    const ind = industries.find(i => i.key === selection.industry) || industries[0];

    const cardGroup = (title, items, value, key) => `
      <div class="lab-step">
        <div class="lab-step-title">${title}</div>
        <div class="lab-card-grid">
          ${items.map(item => {
            const label = typeof item === 'string' ? item : item.key;
            const color = (typeof item === 'object' && item.color) ? item.color : '#8B93A7';
            const em = (typeof item === 'object' && item.emoji) ? item.emoji : emojiFor(label);
            return `<button class="lab-choice ${value === label ? 'selected' : ''}" data-lab-key="${key}" data-lab-value="${escapeAttr(label)}" style="--lab-color:${color}">
              <span class="lab-emoji">${em}</span><strong>${label}</strong>
            </button>`;
          }).join('')}
        </div>
      </div>`;

    list.innerHTML = `
      ${cardGroup('1. 🏭 Industry', industries, selection.industry, 'industry')}
      ${cardGroup('2. 💬 Buzzword', buzzwords, selection.buzzword, 'buzzword')}
      ${cardGroup('3. 🎯 Audience', audiences, selection.audience, 'audience')}
      ${cardGroup('4. 💸 Monetization', MONETIZATION, selection.monetize, 'monetize')}
      ${cardGroup('5. 📦 Platform', PLATFORMS, selection.platform, 'platform')}
      ${cardGroup('6. 🎭 App Personality', VIBES, selection.vibe, 'vibe')}
      <div class="generated-product-card">
        <div class="gen-head">
          <span class="gen-brand">${brandLogoSVG(productBrand(selection.name, selection.industry), 52)}</span>
          <div class="gen-name-wrap">
            <input class="product-name-input" maxlength="26" value="${escapeAttr(selection.name)}" aria-label="Product name" />
            <div class="gen-tagline">${escapeAttr(idea.desc)}</div>
          </div>
          <button class="gen-dice" title="Suggest another name">&#9860;</button>
        </div>
        <div class="tier-badge">ERA: ${era.name}${PRODUCT_ERAS[eraIdx + 1] ? ` &middot; next: ${PRODUCT_ERAS[eraIdx + 1].name} at ${PRODUCT_ERAS[eraIdx + 1].reqProducts} shipped` : ' &middot; the final frontier'}</div>
        <div class="gen-summary">
          <span class="gen-summary-label">📋 THE PITCH, ALLEGEDLY</span>
          <div class="gen-summary-text">${escapeAttr(idea.summary)}</div>
        </div>
        <div class="allocation-budget">Build points <strong>${allocationTotal()}/10</strong></div>
        <div class="dev-slider-panel">
          ${[
            ['engineering', 'Engineering', 'quality + odds'],
            ['infrastructure', 'Infrastructure', 'fewer bugs, scale'],
            ['marketing', 'Marketing', 'hype + launch users'],
            ['compliance', 'Compliance', 'less scandal'],
            ['magic', 'AI Magic', 'big upside, risky'],
          ].map(([key, label, hint]) => `
            <label class="dev-allocation-row">
              <span class="alloc-label"><span class="alloc-name">${SLIDER_EMOJI[key] || ''} ${label}</span><small>${hint}</small></span>
              <input type="range" min="0" max="5" step="1" value="${allocation[key]}" data-allocation="${key}">
              <strong>${allocation[key]}</strong>
            </label>`).join('')}
        </div>
        <div class="gen-meters">
          <div class="gen-meter"><span>Projected quality</span><div class="qbar"><i style="width:${q}%;background:${q >= 75 ? '#19C37D' : q >= 55 ? '#FF9A1F' : '#FF4D5E'}"></i></div><b>${q}</b></div>
        </div>
        <div class="product-stats generated-stats">
          <span class="accent-cyan">💵 +${fmtMoney(idea.mrr)}/s</span>
          <span class="accent-magenta">🔥 +${idea.hype} Hype</span>
          <span>⏱️ ~${Math.ceil(idea.devPoints / powerSafe)}s</span>
          <span class="${chance >= 75 ? 'accent-cyan' : chance >= 55 ? 'accent-amber' : 'accent-error'}">🎯 ${chance}% to land</span>
        </div>
        <button class="btn btn-primary btn-large product-pick-btn" ${broke ? 'disabled' : ''}>${broke ? `NEED ${fmtMoney(invest)}` : `BUILD ${escapeAttr(selection.name.trim() || 'IT')} - ${fmtMoney(invest)}`}</button>
      </div>
    `;

    list.querySelectorAll('[data-lab-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        selection[btn.dataset.labKey] = btn.dataset.labValue;
        regenName();
        renderChoices();
      });
    });
    const nameInput = list.querySelector('.product-name-input');
    if (nameInput) nameInput.addEventListener('input', () => { selection.name = nameInput.value; const _bl = list.querySelector('.gen-brand'); if (_bl) _bl.innerHTML = brandLogoSVG(productBrand(selection.name, selection.industry), 52); });
    const dice = list.querySelector('.gen-dice');
    if (dice) dice.addEventListener('click', () => { regenName(); renderChoices(); });
    list.querySelectorAll('[data-allocation]').forEach(slider => {
      slider.addEventListener('input', () => {
        const changed = slider.dataset.allocation;
        allocation[changed] = Number(slider.value);
        let excess = allocationTotal() - 10;
        if (excess > 0) {
          for (const key of Object.keys(allocation).filter(k => k !== changed).sort((a, b) => allocation[b] - allocation[a])) {
            const take = Math.min(excess, allocation[key]); allocation[key] -= take; excess -= take;
            if (excess <= 0) break;
          }
        }
        renderChoices();
      });
    });
    list.querySelector('.product-pick-btn')?.addEventListener('click', () => {
      const finalIdea = buildIdea();
      if (computeInvestment(finalIdea) > state.cash) {
        note.textContent = `Can't afford ${fmtMoney(computeInvestment(finalIdea))}. Pull the sliders back or raise cash first.`;
        return;
      }
      modal.classList.add('hidden');
      list.classList.remove('startup-lab');
      onPick(finalIdea);
    });
  };

  if (rerollBtn) {
    rerollBtn.textContent = 'SURPRISE ME';
    rerollBtn.onclick = () => {
      selection.industry = industries[Math.floor(Math.random() * industries.length)].key;
      selection.buzzword = buzzwords[Math.floor(Math.random() * buzzwords.length)];
      selection.audience = audiences[Math.floor(Math.random() * audiences.length)];
      selection.monetize = MONETIZATION[Math.floor(Math.random() * MONETIZATION.length)].key;
      selection.platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)].key;
      selection.vibe     = VIBES[Math.floor(Math.random() * VIBES.length)].key;
      regenName();
      renderChoices();
    };
  }
  renderChoices();

  document.getElementById('btn-close-develop').onclick = () => {
    modal.classList.add('hidden');
    list.classList.remove('startup-lab');
    onClose();
  };

  modal.classList.remove('hidden');
}

//  Launch Product Modal 
export function openLaunchModal(state, onLaunch, onClose) {
  const modal = document.getElementById('launch-modal');
  const list  = document.getElementById('launch-options');
  const note  = document.getElementById('launch-note');
  if (!modal || !list) return;

  list.innerHTML = '';

  if (!state.readyProducts.length) {
    note.textContent = 'Nothing ready to launch. Develop a product first - once it finishes building, launch it here to go live.';
  } else {
    note.textContent = state.live
      ? `${state.readyProducts.length} product(s) ready. Launching earns MRR and spikes Hype - if it lands.`
      : `Your FIRST launch goes live now - it wakes up the press, the VCs and the chaos. Hire engineers first to boost the odds.`;
    state.readyProducts.forEach((p, i) => {
      const chance = Math.round(computeSuccessChance(state, p.idea.ambition ?? 1) * 100);
      const cls = chance >= 75 ? 'accent-cyan' : chance >= 55 ? 'accent-amber' : 'accent-error';
      const card = document.createElement('div');
      card.className = 'candidate-card product-card';
      card.innerHTML = `
        ${productGraphic(p.idea)}
        <div class="candidate-name">${p.idea.name}</div>
        <div class="product-tagline">${p.idea.desc}</div>
        ${p.idea.summary ? `<div class="product-summary">${escapeAttr(p.idea.summary)}</div>` : ''}
        <div class="product-stats">
          <span class="accent-cyan">+${fmtMoney(p.idea.mrr)}/s MRR</span> 
          <span class="accent-magenta">Hype burst</span> 
          <span class="${cls}"> ${chance}% to land</span>
        </div>
        <button class="btn btn-primary btn-sm product-launch-btn">LAUNCH</button>
      `;
      card.querySelector('.product-launch-btn').addEventListener('click', () => {
        modal.classList.add('hidden');
        onLaunch(i);
      });
      list.appendChild(card);
    });
  }

  document.getElementById('btn-close-launch').onclick = () => {
    modal.classList.add('hidden');
    onClose();
  };

  modal.classList.remove('hidden');
}

export function openProductModal(state, handlers, onClose) {
  const modal = document.getElementById('product-modal');
  const list = document.getElementById('product-ops-list');
  const note = document.getElementById('product-ops-note');
  if (!modal || !list) return;

  const render = () => {
    list.innerHTML = '';
    if (!state.shippedProducts.length) {
      note.textContent = 'No live products yet. Launch something first.';
      return;
    }
    note.textContent = `Portfolio MRR ${fmtMoney(getMRR(state))}/s - Morale ${Math.round(state.morale ?? CONFIG.MORALE_START)}. Tech debt and bugs now eat revenue if ignored.`;
    state.shippedProducts.forEach((p, i) => {
      const health = Math.round(getProductHealth(p));
      const mrr = Math.round(productEffectiveMRR(state, p));
      const queue = p.featureQueue || [];
      const activeFeature = queue[0];
      const debt = Math.round(p.techDebt || 0);
      const bugs = Math.round(p.bugs || 0);
      const card = document.createElement('div');
      card.className = 'product-ops-card';
      card.innerHTML = `
        <div class="product-ops-head">
          ${productGraphic(p.idea)}
          <div class="product-ops-title">
            <div class="candidate-name">${escapeAttr(p.idea.name)}</div>
            <div class="product-tagline">${escapeAttr(p.idea.desc || '')}</div>
          </div>
          <div class="product-health ${health < 40 ? 'bad' : health < 70 ? 'warn' : 'good'}">${health}</div>
        </div>
        <div class="product-ops-metrics">
          <span>MRR <b class="accent-cyan">${fmtMoney(mrr)}/s</b></span>
          <span>Debt <b class="${debt > 65 ? 'accent-error' : debt > 35 ? 'accent-amber' : 'accent-cyan'}">${debt}</b></span>
          <span>Bugs <b class="${bugs > 18 ? 'accent-error' : bugs > 8 ? 'accent-amber' : 'accent-cyan'}">${bugs}</b></span>
          <span>Users <b>${Math.round((p.userBase || 1) * 100)}%</b></span>
          <span>Quality <b>${Math.round(p.quality || 70)}</b></span>
          ${p.outageTimer > 0 ? `<span class="accent-error">OUTAGE ${Math.ceil(p.outageTimer)}s</span>` : ''}
        </div>
        <div class="pricing-row">
          <span>Pricing</span>
          <input type="range" min="0.7" max="1.55" step="0.05" value="${p.price || 1}" class="pricing-slider">
          <strong>${(p.price || 1).toFixed(2)}x</strong>
        </div>
        <div class="roadmap-row">
          <span>${activeFeature ? `${activeFeature.name}: ${Math.floor((activeFeature.progress || 0) / activeFeature.dev * 100)}%` : queue.length ? `${queue.length} queued` : 'Roadmap empty'}</span>
          <select class="feature-select">
            ${FEATURE_OPTIONS.map(f => `<option value="${f.id}">${f.emoji ? f.emoji + ' ' : ''}${f.name} - ${fmtMoney(f.cost)}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm queue-feature">Queue Feature</button>
        </div>
        <div class="product-ops-actions">
          <button class="btn btn-ghost btn-sm refactor-product">Refactor Sprint</button>
          <button class="btn btn-primary btn-sm version-push">Version Push</button>
        </div>
      `;
      const slider = card.querySelector('.pricing-slider');
      const priceLabel = card.querySelector('.pricing-row strong');
      slider.addEventListener('input', () => {
        priceLabel.textContent = `${Number(slider.value).toFixed(2)}x`;
        handlers.onPrice(i, Number(slider.value));
      });
      card.querySelector('.queue-feature').addEventListener('click', () => {
        const id = card.querySelector('.feature-select').value;
        handlers.onQueueFeature(i, id);
        render();
      });
      card.querySelector('.refactor-product').addEventListener('click', () => {
        handlers.onRefactor(i);
        render();
      });
      card.querySelector('.version-push').addEventListener('click', () => {
        handlers.onVersionPush(i);
        render();
      });
      list.appendChild(card);
    });
  };

  document.getElementById('btn-close-products').onclick = () => {
    modal.classList.add('hidden');
    if (onClose) onClose();
  };
  render();
  modal.classList.remove('hidden');
}

export function openCrunchSprintModal(state, onFinish, onCancel) {
  const modal = document.getElementById('decision-modal');
  const title = document.getElementById('decision-title');
  const text  = document.getElementById('decision-text');
  const list  = document.getElementById('decision-options');
  const footer = document.getElementById('decision-footer');
  if (!modal || !title || !text || !list) { onFinish(0.45); return; }

  // A punchy, funny command pool - 5 picked per sprint for run-to-run variety.
  const COMMAND_POOL = [
    'ship it', 'force push', 'merge main', 'deploy fri', 'rm bugs', 'npm vibes',
    'sudo money', 'blame qa', 'fix prod', 'clear todo', 'scale api', 'yeet cache',
    'git blame', 'revert hope', 'patch live', 'wing it',
  ];
  const commands = [...COMMAND_POOL].sort(() => Math.random() - 0.5).slice(0, 5);
  let clicks = 0;
  let completed = 0;
  let combo = 0, maxCombo = 0, momentum = 0;
  let active = commands[0];
  let done = false;
  let timeLeft = 8;

  const GRADES = [[0.9, 'S'], [0.74, 'A'], [0.55, 'B'], [0.34, 'C'], [0, 'D']];
  const gradeFor = (s) => (GRADES.find(g => s >= g[0]) || GRADES[GRADES.length - 1])[1];

  title.innerHTML = 'CRUNCH <span class="accent-amber">SPRINT</span>';
  text.textContent = 'SMASH the pad to build momentum, then type each shipped command. Keep the combo alive - the higher your grade, the bigger the burst.';
  list.innerHTML = `
    <div class="crunch-game">
      <div class="crunch-topline">
        <span>Clicks <b id="crunch-clicks">0</b></span>
        <span>Commits <b id="crunch-commands">0</b>/5</span>
        <span class="crunch-grade crunch-grade-d" id="crunch-grade">D</span>
        <span><b id="crunch-time">8.0</b>s</span>
      </div>
      <div class="crunch-meter"><div id="crunch-meter-fill"></div></div>
      <button id="crunch-click-pad" class="crunch-click-pad" type="button">
        <span class="crunch-pad-label">SMASH TO CODE</span>
        <span class="crunch-combo" id="crunch-combo"></span>
      </button>
      <div class="crunch-command" id="crunch-command">
        <span id="crunch-command-target">${active}</span>
        <input id="crunch-command-input" autocomplete="off" spellcheck="false" placeholder="type it, hit enter">
      </div>
      <button id="crunch-finish" class="btn btn-primary">SHIP THE SPRINT</button>
    </div>
  `;
  if (footer) footer.classList.add('hidden');
  modal.classList.remove('hidden');

  const clickEl = document.getElementById('crunch-clicks');
  const cmdEl = document.getElementById('crunch-commands');
  const timeEl = document.getElementById('crunch-time');
  const fillEl = document.getElementById('crunch-meter-fill');
  const gradeEl = document.getElementById('crunch-grade');
  const comboEl = document.getElementById('crunch-combo');
  const pad = document.getElementById('crunch-click-pad');
  const input = document.getElementById('crunch-command-input');
  const target = document.getElementById('crunch-command-target');
  const cmdBox = document.getElementById('crunch-command');
  const finishBtn = document.getElementById('crunch-finish');

  // Clicks + commits carry most of the score; momentum (frantic clicking) tops it off.
  const calcScore = () => Math.max(0, Math.min(1,
    (Math.min(clicks, 55) / 55) * 0.4 + (completed / commands.length) * 0.5 + momentum * 0.1));
  const normalizeCommand = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const render = () => {
    const score = calcScore();
    if (clickEl) clickEl.textContent = String(clicks);
    if (cmdEl) cmdEl.textContent = String(completed);
    if (timeEl) timeEl.textContent = Math.max(0, timeLeft).toFixed(1);
    if (fillEl) fillEl.style.width = `${Math.round(score * 100)}%`;
    if (gradeEl) {
      const g = gradeFor(score);
      gradeEl.textContent = g;
      gradeEl.className = `crunch-grade crunch-grade-${g.toLowerCase()}`;
    }
    if (comboEl) comboEl.textContent = combo >= 3 ? `x${combo} COMBO` : '';
  };
  const completeCommand = () => {
    completed++;
    combo += 2; maxCombo = Math.max(maxCombo, combo);
    momentum = Math.min(1, momentum + 0.18);
    active = commands[completed] || 'shipped!';
    if (input) { input.value = ''; input.classList.remove('command-partial', 'command-ready'); }
    if (target) target.textContent = active;
    if (cmdBox) { cmdBox.classList.remove('crunch-command-hit'); void cmdBox.offsetWidth; cmdBox.classList.add('crunch-command-hit'); }
    if (completed >= commands.length) finish();
    render();
  };
  const checkCommand = (force = false) => {
    if (!input || done) return;
    const typed = normalizeCommand(input.value);
    const expected = normalizeCommand(active);
    input.classList.toggle('command-partial', !!typed && expected.startsWith(typed) && typed !== expected);
    input.classList.toggle('command-ready', typed === expected);
    if (typed === expected || (force && typed && expected.startsWith(typed) && typed.length >= Math.ceil(expected.length * 0.7))) {
      completeCommand();
    }
  };
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    modal.classList.add('hidden');
    onFinish(calcScore());
  };

  pad?.addEventListener('click', () => {
    clicks++;
    combo++; maxCombo = Math.max(maxCombo, combo);
    momentum = Math.min(1, momentum + 0.13);
    pad.classList.remove('crunch-pop');
    void pad.offsetWidth;
    pad.classList.add('crunch-pop');
    render();
  });
  input?.addEventListener('input', () => checkCommand(false));
  input?.addEventListener('change', () => checkCommand(true));
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); checkCommand(true); }
  });
  finishBtn?.addEventListener('click', finish);
  input?.focus();

  const timer = setInterval(() => {
    timeLeft -= 0.1;
    // Momentum bleeds away if you stop hammering; let it cool the combo too.
    momentum = Math.max(0, momentum - 0.05);
    if (momentum <= 0) combo = 0;
    render();
    if (timeLeft <= 0) finish();
  }, 100);
  render();
}

export function openPRComposerModal(pr, onChoose) {
  openDecisionModal({
    title: 'DAMAGE CONTROL',
    text: `${pr.title}: ${pr.desc} Pick a public response before the narrative hardens.`,
    options: [
      { label: 'Apology Thread', desc: 'Reduce severity, small Hype recovery, morale improves.', primary: true },
      { label: 'Meme It', desc: 'Huge Hype gamble, but PR severity gets nastier.' },
      { label: 'Legalese', desc: 'Costs cash, heavily reduces severity, boring but effective.' },
    ],
  }, (_option, idx) => {
    onChoose(['apology', 'meme', 'lawyer'][idx] || 'apology');
  });
}

export function openFirefightModal(onFinish) {
  const modal = document.getElementById('firefight-modal');
  const arena = document.getElementById('firefight-arena');
  const poppedEl = document.getElementById('firefight-popped');
  const totalEl = document.getElementById('firefight-total');
  const bar = document.getElementById('firefight-timer-bar');
  if (!modal || !arena) { onFinish(0.5); return; }

  const total = 5;
  const fires = [];
  let cleared = 0;
  let streak = 0;
  let done = false;
  let spraying = false;
  let pointer = { x: -999, y: -999 };
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(tick);
    arena.onpointerdown = arena.onpointerup = arena.onpointerleave = arena.onpointermove = null;
    modal.classList.add('hidden');
    const remainingHeat = fires.reduce((sum, f) => sum + Math.max(0, f.heat), 0);
    onFinish(Math.max(0, Math.min(1, (total - remainingHeat) / total)));
  };

  arena.innerHTML = '';
  poppedEl.textContent = '0';
  totalEl.textContent = String(total);
  for (let i = 0; i < total; i++) {
    const flame = document.createElement('div');
    flame.className = 'fire-patch';
    flame.style.left = `${10 + Math.random() * 76}%`;
    flame.style.top = `${12 + Math.random() * 66}%`;
    flame.innerHTML = '<span></span>';
    arena.appendChild(flame);
    fires.push({ el: flame, heat: 1, cleared: false });
  }
  const stream = document.createElement('div');
  stream.className = 'water-stream hidden';
  arena.appendChild(stream);

  const updatePointer = (event) => {
    const rect = arena.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    stream.style.left = `${pointer.x}px`;
    stream.style.top = `${pointer.y}px`;
  };
  arena.onpointerdown = (event) => {
    spraying = true;
    arena.setPointerCapture?.(event.pointerId);
    stream.classList.remove('hidden');
    updatePointer(event);
  };
  arena.onpointerup = () => {
    spraying = false;
    stream.classList.add('hidden');
  };
  arena.onpointerleave = () => {
    spraying = false;
    stream.classList.add('hidden');
  };
  arena.onpointermove = updatePointer;

  // A satisfying "OUT!" pop with a rising streak count at each cleared flame.
  const spawnPop = (x, y) => {
    streak++;
    const pop = document.createElement('div');
    pop.className = 'fire-pop';
    pop.textContent = streak >= 2 ? `OUT! x${streak}` : 'OUT!';
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
    arena.appendChild(pop);
    setTimeout(() => pop.remove(), 650);
  };

  if (bar) {
    bar.style.transition = 'none';
    bar.style.width = '100%';
    requestAnimationFrame(() => {
      bar.style.transition = 'width 5.5s linear';
      bar.style.width = '0%';
    });
  }
  modal.classList.remove('hidden');
  const tick = setInterval(() => {
    if (spraying) {
      for (const f of fires) {
        if (f.cleared) continue;
        const r = f.el.getBoundingClientRect();
        const a = arena.getBoundingClientRect();
        const cx = r.left - a.left + r.width / 2;
        const cy = r.top - a.top + r.height / 2;
        const dist = Math.hypot(pointer.x - cx, pointer.y - cy);
        if (dist < 72) {
          f.heat = Math.max(0, f.heat - 0.085);
          f.el.style.setProperty('--heat', f.heat.toFixed(2));
          f.el.style.transform = `translate(-50%, -50%) scale(${0.75 + f.heat * 0.35})`;
          if (f.heat <= 0 && !f.cleared) {
            f.cleared = true;
            cleared++;
            f.el.classList.add('extinguished');
            poppedEl.textContent = String(cleared);
            spawnPop(cx, cy);
            if (cleared >= total) finish();
          }
        }
      }
    }
  }, 50);
  setTimeout(finish, 5500);
}

//  VC Pitch Modal 
export function openDecisionModal(config, onChoose, onCancel) {
  const modal = document.getElementById('decision-modal');
  const title = document.getElementById('decision-title');
  const text  = document.getElementById('decision-text');
  const list  = document.getElementById('decision-options');
  const footer = document.getElementById('decision-footer');
  const cancel = document.getElementById('btn-decision-cancel');
  if (!modal || !title || !text || !list) return;

  title.innerHTML = config.title || 'DECISION';
  text.textContent = config.text || '';
  list.innerHTML = '';

  (config.options || []).forEach((option, i) => {
    const btn = document.createElement('button');
    btn.className = `btn decision-option ${option.primary ? 'btn-primary' : 'btn-ghost'}`;
    btn.innerHTML = `
      <span class="decision-option-title">${escapeAttr(option.label || 'Choose')}</span>
      <span class="decision-option-desc">${escapeAttr(option.desc || '')}</span>
    `;
    btn.addEventListener('click', () => {
      modal.classList.add('hidden');
      if (onChoose) onChoose(option, i);
    });
    list.appendChild(btn);
  });

  if (footer && cancel) {
    footer.classList.toggle('hidden', !onCancel);
    cancel.onclick = () => {
      modal.classList.add('hidden');
      if (onCancel) onCancel();
    };
  }

  modal.classList.remove('hidden');
}

export function openLaunchDayModal(state, product, onLaunch, onCancel) {
  const modal = document.getElementById('decision-modal');
  const title = document.getElementById('decision-title');
  const text  = document.getElementById('decision-text');
  const list  = document.getElementById('decision-options');
  const footer = document.getElementById('decision-footer');
  const cancel = document.getElementById('btn-decision-cancel');
  if (!modal || !title || !text || !list) return;

  const plan = { reliability: 2, marketing: 2, legal: 1 };
  const baseChance = computeSuccessChance(state, product.idea.ambition ?? 1) + (state.launchBuff || 0);
  const rows = [
    { key: 'reliability', label: 'Engineering', desc: 'Demo stability and live-site survival.' },
    { key: 'marketing', label: 'Marketing', desc: 'Bigger Hype burst and louder launch.' },
    { key: 'legal', label: 'Compliance', desc: 'Softer flops and fewer scary letters.' },
  ];
  const remaining = () => CONFIG.LAUNCH_POLISH_POINTS - rows.reduce((sum, row) => sum + plan[row.key], 0);

  const render = () => {
    const effects = computeLaunchPlanEffects(plan);
    const chance = Math.round(Math.min(CONFIG.SUCCESS_MAX, Math.max(CONFIG.SUCCESS_MIN, baseChance + effects.successBonus)) * 100);
    title.innerHTML = 'LAUNCH <span class="accent-cyan">DAY</span>';
    text.textContent = '';
    modal.querySelector('.modal-content')?.classList.add('launch-spectacle-content');
    list.innerHTML = `
      <div class="launch-stage">
        <div class="launch-lights"></div>
        <div class="launch-stage-kicker">WORLD PREMIERE</div>
        <div class="launch-stage-title">${escapeAttr(product.idea.name)}</div>
        <div class="launch-stage-tagline">"${escapeAttr(product.idea.desc || 'Disrupting something through something else.')}"</div>
      </div>
      <div class="launch-day-summary">
        <span><strong>${chance}%</strong> to land</span>
        <span><strong>+${effects.hypeBonus}</strong> bonus Hype</span>
        <span><strong>${remaining()}</strong> points left</span>
      </div>
      <div class="launch-day-grid"></div>
      <button class="btn btn-primary launch-ship-btn">LAUNCH PRODUCT</button>
    `;
    const grid = list.querySelector('.launch-day-grid');
    rows.forEach(row => {
      const item = document.createElement('div');
      item.className = 'launch-day-row';
      item.innerHTML = `
        <div>
          <div class="launch-day-label">${row.label}</div>
          <div class="launch-day-desc">${row.desc}</div>
        </div>
        <div class="launch-day-stepper">
          <button class="btn btn-ghost btn-sm" data-dir="-1">-</button>
          <span>${plan[row.key]}</span>
          <button class="btn btn-ghost btn-sm" data-dir="1">+</button>
        </div>
      `;
      item.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = Number(btn.dataset.dir);
          if (dir < 0 && plan[row.key] > 0) plan[row.key]--;
          if (dir > 0 && remaining() > 0) plan[row.key]++;
          render();
        });
      });
      grid.appendChild(item);
    });
    list.querySelector('.launch-ship-btn').addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.querySelector('.modal-content')?.classList.remove('launch-spectacle-content');
      onLaunch({ ...plan });
    });
  };

  if (footer && cancel) {
    footer.classList.remove('hidden');
    cancel.onclick = () => {
      modal.classList.add('hidden');
      modal.querySelector('.modal-content')?.classList.remove('launch-spectacle-content');
      if (onCancel) onCancel();
    };
  }

  render();
  modal.classList.remove('hidden');
}

// Always-different, product-aware launch reactions driven by the actual build.
export function genLaunchReactions(result) {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const p = result.product || {};
  const idea = p.idea || {};
  const name = idea.name || 'it';
  const ind = idea.industry || 'tech';
  const q = p.quality != null ? p.quality : 70;
  const bugs = p.bugs != null ? p.bugs : 0;
  const plan = result.launchPlan || {};
  const mkt = plan.marketing || 0, legal = plan.legal || 0;
  const rs = result.reviewScore != null ? result.reviewScore : (result.reviewGood ? 0.78 : 0.3);
  const buggy = bugs >= 13, polished = q >= 80, hyped = mkt >= 2, scammy = (idea.scam || 0) >= 45;
  const fill = t => t.replace(/\{name\}/g, name).replace(/\{ind\}/g, String(ind).toLowerCase());
  const star = n => '★★★★★☆☆☆☆☆'.slice(5 - n, 10 - n);
  const sN = Math.max(1, Math.min(5, Math.round(1 + rs * 4)));
  const tone = rs >= 0.66 ? 'good' : rs <= 0.38 ? 'bad' : 'mid';
  const IND = {
    AI: 'it confidently hallucinated my tax advice', Social: 'the feed radicalized my aunt by Tuesday',
    Gaming: 'they paywalled the tutorial', Finance: 'it is definitely not a Ponzi (it is)',
    Health: 'it diagnosed me with a "vibes deficiency"', Robotics: 'the demo robot quietly unionized',
    Quantum: 'it is simultaneously working and not working', Biotech: 'it grew something it should not have',
    Cyber: 'it leaked itself, very efficiently', SaaS: 'onboarding is 14 steps and a hostage video',
  };
  const indLine = IND[ind] || 'nobody can explain what it does, including the founder';
  const G = [
    () => ({ src: 'TechCrunch', tone, score: star(sN), quote: fill(buggy ? '{name} crashed live on stage, then apologized in a tone we found threatening.' : polished ? '{name} is the most polished thing to happen to {ind} all year. Suspiciously so.' : tone === 'bad' ? '{name} is a slide deck cosplaying as software.' : 'We reviewed {name}. We have notes. So, apparently, do the regulators.') }),
    () => ({ src: 'App Store', tone, score: star(sN), quote: fill(buggy ? 'crashes if you breathe near it. {ind}, but make it anxiety.' : tone === 'good' ? 'genuinely good?? {name} did the exact thing it promised. unheard of.' : 'it charged my card to tell me it was loading. would panic again.') }),
    () => ({ src: 'r/' + String(ind).toLowerCase(), tone: scammy ? 'bad' : tone, score: '▲ ' + (1 + Math.floor(Math.random() * 40)) + 'k', quote: fill(scammy ? 'pretty sure {name} is a scam, but the onboarding is gorgeous. conflicted.' : buggy ? '{name} ate my data and burped. thread locked after legal showed up.' : tone === 'good' ? 'ok fine, {name} is actually good. i hate that i like it.' : 'anyone else feel like {name} is held together with hope and one intern named Greg?') }),
    () => ({ src: '@' + pick(['its_so_over_bro', 'we_are_so_back', 'reply_guy_rick', 'beta_tester_betty']), tone, score: '♥ ' + (1 + Math.floor(Math.random() * 90)) + 'k', quote: fill(hyped ? 'the {name} ad is on my fridge now. i did not consent to this funnel but here we are.' : tone === 'good' ? 'unwell about {name}. shipping it to the group chat immediately.' : 'tried {name}. ' + indLine + '. anyway, refunded.') }),
    () => ({ src: 'Investors', tone, score: tone === 'good' ? 'Interested' : 'Concerns', quote: tone === 'good' ? 'A partner meeting about ' + name + ' suddenly, mysteriously exists.' : 'An associate mutters "circle back" while deleting your email in real time.' }),
    () => ({ src: 'YouTube', tone, score: (2 + Math.floor(Math.random() * 40)) + 'M views', quote: fill('"I used {name} for 24 hours" ' + (tone === 'good' ? '(and I am changed)' : '(and it changed me, legally)') + '. ' + (buggy ? 'mostly footage of the crash screen.' : indLine + '.')) }),
    () => ({ src: ind + ' Weekly', tone, score: polished ? 'Top Pick' : 'Hmm', quote: fill('Industry verdict on {name}: ' + indLine + '. ' + (polished ? 'And yet, somehow, it works.' : 'And it shows.')) }),
    () => ({ src: 'Your Mom', tone: 'mid', score: '1 missed call', quote: fill('installed {name}, very proud, does not understand it, has several questions about the {ind}.') }),
  ];
  const order = G.map((g, i) => i).sort(() => Math.random() - 0.5).slice(0, 4);
  return order.map(i => G[i]());
}

export function openInternetReactionModal(result, onDone, state) {
  const modal = document.getElementById('decision-modal');
  const title = document.getElementById('decision-title');
  const text  = document.getElementById('decision-text');
  const list  = document.getElementById('decision-options');
  const footer = document.getElementById('decision-footer');
  if (!modal || !title || !text || !list) { if (onDone) onDone(); return; }

  const p = result.product;
  const good = !!result.reviewGood;
  const cards = genLaunchReactions(result);
  let revealed = 0;
  title.innerHTML = 'INTERNET <span class="accent-magenta">REACTION</span>';
  text.innerHTML = `<div class="launch-brandhead">${brandLogoSVG(p.brand || productBrand(p.idea.name, p.idea.industry), 46)}<div class="launch-brandline"><b>${escapeAttr(p.idea.name)}</b><span>is live  genius or cautionary tale?</span></div></div>`;
  if (footer) footer.classList.add('hidden');
  list.innerHTML = `<div class="reaction-stack"></div><button class="btn btn-primary btn-large reaction-next">REVEAL REVIEWS</button><button class="btn btn-ghost reaction-share">📣 Share ${escapeAttr(p.idea.name)}</button>`;
  const stack = list.querySelector('.reaction-stack');
  const next = list.querySelector('.reaction-next');
  const shareBtn = list.querySelector('.reaction-share');
  if (shareBtn) shareBtn.addEventListener('click', () => openProductShareModal(state || {}, p));
  const reveal = () => {
    if (revealed < cards.length) {
      const c = cards[revealed++];
      const el = document.createElement('div');
      el.className = `reaction-card reaction-${c.tone || (good ? 'good' : 'bad')}`;
      el.innerHTML = `<div class="reaction-source">${c.src}</div><div class="reaction-score">${c.score}</div><div class="reaction-quote">"${c.quote}"</div>`;
      stack.appendChild(el);
      next.textContent = revealed < cards.length ? 'NEXT REVIEW' : (good ? 'RIDE THE HYPE' : 'SURVIVE THE TAKES');
      return;
    }
    modal.classList.add('hidden');
    if (onDone) onDone();
  };
  next.addEventListener('click', reveal);
  modal.classList.remove('hidden');
  setTimeout(reveal, 250);
}

/** Branded "share your product" card with a Sandscape play link. */
export function openProductShareModal(state, product) {
  if (!product || !product.idea) return;
  state = state || {};
  const b = product.brand || productBrand(product.idea.name, product.idea.industry);
  const link = shareURL(state, product);
  const old = document.getElementById('product-share-modal'); if (old) old.remove();
  const modal = document.createElement('div'); modal.id = 'product-share-modal'; modal.className = 'modal'; document.body.appendChild(modal);
  const users = Math.round((product.userBase || 1) * 8200);
  const st = Math.max(0, Math.min(5, Math.round((product.reviewScore || 0) * 5)));
  const starStr = '★'.repeat(st) + '☆'.repeat(5 - st);
  modal.innerHTML = `<div class="modal-content share-content" style="--bc:${b.color};--bc2:${b.color2}">
    <button class="share-close" aria-label="Close">&times;</button>
    <h3 class="share-title">Ship it to the world</h3>
    <div class="share-card">
      <div class="share-card-head">${brandLogoSVG(b, 60)}
        <div class="share-card-id"><h2>${escapeAttr(product.idea.name)}</h2><p>${escapeAttr(product.idea.tagline || b.slogan)}</p><span class="share-co">${escapeAttr(state.companyName || 'Startup')}</span></div>
      </div>
      <div class="share-stats">
        <div class="share-stat"><b>$${(product.idea.mrr || 0).toLocaleString()}</b><span>MRR</span></div>
        <div class="share-stat"><b>${users.toLocaleString()}</b><span>users</span></div>
        <div class="share-stat"><b>${Math.round(product.quality || 0)}</b><span>quality</span></div>
        <div class="share-stat"><b class="share-stars">${starStr}</b><span>critics</span></div>
      </div>
      <div class="share-foot">Play <b>Startup Panic</b> on Sandscape</div>
    </div>
    <div class="share-linkrow"><input class="share-link" readonly value="${escapeAttr(link)}" /></div>
    <div class="share-actions">
      <button class="btn btn-primary share-do">\U0001F4E3 Share</button>
      <button class="btn share-copy">\U0001F517 Copy link</button>
      <button class="btn share-dl">⬇ Image</button>
    </div>
  </div>`;
  const close = () => modal.remove();
  modal.querySelector('.share-close').onclick = close;
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  const linkEl = modal.querySelector('.share-link');
  if (linkEl) linkEl.onclick = () => linkEl.select();
  modal.querySelector('.share-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(link); showToast('Link copied  paste it anywhere', 'success', 2200); }
    catch (e) { if (linkEl) linkEl.select(); showToast('Select the link and copy it', 'warning'); }
  };
  modal.querySelector('.share-do').onclick = async () => {
    const data = { title: 'Startup Panic', text: shareText(state, product), url: link };
    if (navigator.share) { try { await navigator.share(data); } catch (e) {} }
    else { try { await navigator.clipboard.writeText(data.text + ' ' + link); showToast('Share text copied  paste it into a post', 'success', 2600); } catch (e) { showToast('Sharing is not available here', 'warning'); } }
  };
  modal.querySelector('.share-dl').onclick = () => {
    const cv = drawProductCard(state, product);
    if (!cv) { showToast('Cannot render the image here', 'warning'); return; }
    cv.toBlob((blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (product.idea.name || 'product').replace(/[^a-z0-9]/gi, '') + '_startuppanic.png'; a.click(); showToast('Share image downloaded', 'success'); });
  };
}

let _pitchModal       = null;
let _pitchOnDeliver   = null;
let _pitchOnCancel    = null;
let _pitchTimer       = null;
let _selectedWords    = [];
let _selectedClaims   = [];
let _pitchState       = null;

const PITCH_CLAIMS = [
  { id: 'enterprise_pipeline', label: 'Enterprise pipeline', boost: 0.16, risk: 0.08 },
  { id: 'viral_growth', label: 'Viral growth', boost: 0.22, risk: 0.14 },
  { id: 'ai_moat', label: 'Defensible AI moat', boost: 0.28, risk: 0.22 },
  { id: 'positive_unit_econ', label: 'Positive unit economics', boost: 0.34, risk: 0.31 },
];

export function openPitchModal(state, onDeliver, onCancel) {
  _pitchModal = document.getElementById('vc-pitch-modal');
  if (!_pitchModal) return;

  _pitchState     = state;
  _pitchOnDeliver = onDeliver;
  _pitchOnCancel  = onCancel;
  _selectedWords  = [];
  _selectedClaims = [];
  const buzzwords = getPitchBuzzwords(12);
  const grid = document.getElementById('buzzword-grid');
  if (!grid) return;

  // Round info panel
  const roundInfo = document.getElementById('pitch-round-info');
  const round = FUNDING_ROUNDS[state.roundIndex];
  if (round) {
    const prodOk = state.shippedProducts.length >= round.reqProducts;
    const hypeOk = state.hype >= round.reqHype;
    roundInfo.innerHTML = `
      <div class="pitch-round-name">${round.name} - target ${fmtMoney(round.amount)}</div>
      <div class="pitch-round-blurb">"${round.blurb}"</div>
      <div class="pitch-round-reqs">
        <span class="${prodOk ? 'req-met' : 'req-unmet'}">${prodOk ? 'OK' : 'NO'} Products ${state.shippedProducts.length}/${round.reqProducts}</span>
        <span class="${hypeOk ? 'req-met' : 'req-unmet'}">${hypeOk ? 'OK' : 'NO'} Hype ${Math.round(state.hype)}/${round.reqHype}</span>
      </div>
      <div class="investor-lineup">
        ${[
          ['Crypto Chad', '$5M', 'Blockchain products only', '+50% Hype', 'Higher scandal chance'],
          ['Pragmatic Pam', '$2M', `${round.reqProducts} live products`, 'Lower burn', 'Hates buzzwords'],
          ['FOMO Fiona', '$8M', `${round.reqHype}+ Hype`, 'Fast term sheet', 'Demands growth at any cost'],
        ].map(([name, money, req, bonus, penalty], i) => `
          <div class="investor-card">
            <div class="investor-portrait">${name.split(' ').map(w => w[0]).join('')}</div>
            <div class="investor-name">${name}</div>
            <div class="investor-money">Money: <b>${money}</b></div>
            <div class="investor-trade">Requires: ${req}</div>
            <div class="investor-bonus">Bonus: ${bonus}</div>
            <div class="investor-penalty">Penalty: ${penalty}</div>
          </div>`).join('')}
      </div>
    `;
  } else {
    roundInfo.innerHTML = '<div class="pitch-round-name">ALL ROUNDS RAISED</div>';
  }

  // Live "VC mood" meter that reacts to every buzzword/claim you pick.
  let mood = document.getElementById('pitch-mood');
  if (!mood) {
    mood = document.createElement('div');
    mood.id = 'pitch-mood';
    mood.className = 'pitch-mood';
    mood.innerHTML = `
      <div class="pitch-mood-row">
        <span class="pitch-mood-tag">VC MOOD</span>
        <span class="pitch-mood-label" id="pitch-mood-label">Checking their phone</span>
      </div>
      <div class="pitch-mood-track"><div class="pitch-mood-fill" id="pitch-mood-fill"></div></div>`;
    roundInfo.insertAdjacentElement('afterend', mood);
  }

  const existingClaims = document.getElementById('pitch-claim-grid');
  if (existingClaims) existingClaims.remove();
  const claimGrid = document.createElement('div');
  claimGrid.id = 'pitch-claim-grid';
  claimGrid.className = 'pitch-claim-grid';
  claimGrid.innerHTML = PITCH_CLAIMS.map(c => `<button class="claim-chip" data-claim="${c.id}">${c.label}<span>+${Math.round(c.boost * 100)} / ${Math.round(c.risk * 100)}% risk</span></button>`).join('');
  grid.insertAdjacentElement('afterend', claimGrid);
  claimGrid.querySelectorAll('.claim-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const claim = PITCH_CLAIMS.find(c => c.id === btn.dataset.claim);
      const idx = _selectedClaims.findIndex(c => c.id === claim.id);
      if (idx >= 0) {
        _selectedClaims.splice(idx, 1);
        btn.classList.remove('selected');
      } else {
        _selectedClaims.push(claim);
        btn.classList.add('selected');
      }
      updatePitchPreview();
    });
  });

  // Build buzzword grid
  grid.innerHTML = '';
  for (const bw of buzzwords) {
    const chip = document.createElement('div');
    chip.className    = 'buzzword-chip';
    chip.textContent  = bw.word;
    chip.dataset.word = bw.word;
    chip.addEventListener('click', () => toggleBuzzword(chip, bw));
    grid.appendChild(chip);
  }

  updatePitchPreview();
  document.getElementById('btn-deliver-pitch').disabled = true;

  // Timer
  let timeLeft = 20;
  document.getElementById('pitch-timer-display').textContent = `${timeLeft}s`;
  document.getElementById('pitch-timer-bar').style.transition = 'none';
  document.getElementById('pitch-timer-bar').style.width = '100%';

  requestAnimationFrame(() => {
    document.getElementById('pitch-timer-bar').style.transition = `width ${timeLeft}s linear`;
    document.getElementById('pitch-timer-bar').style.width = '0%';
  });

  _pitchTimer = setInterval(() => {
    timeLeft -= 0.1;
    document.getElementById('pitch-timer-display').textContent = `${Math.max(0, timeLeft).toFixed(0)}s`;
    if (timeLeft <= 0) {
      clearInterval(_pitchTimer);
      handleDeliverPitch();
    }
  }, 100);

  _pitchModal.classList.remove('hidden');

  document.getElementById('btn-deliver-pitch').onclick = handleDeliverPitch;
  document.getElementById('btn-cancel-pitch').onclick  = handleCancelPitch;
}

function toggleBuzzword(chip, bw) {
  const idx = _selectedWords.indexOf(bw);
  if (idx !== -1) {
    _selectedWords.splice(idx, 1);
    chip.classList.remove('selected');
  } else {
    if (_selectedWords.length >= 3) {
      const first = _selectedWords.shift();
      document.querySelector(`[data-word="${first.word}"]`)?.classList.remove('selected');
    }
    _selectedWords.push(bw);
    chip.classList.add('selected');
  }
  updatePitchPreview();
}

function updatePitchPreview() {
  const previewEl  = document.getElementById('pitch-preview-text');
  const fundEl     = document.getElementById('pitch-funding-estimate');
  const verdictEl  = document.getElementById('pitch-verdict');
  const deliverBtn = document.getElementById('btn-deliver-pitch');

  if (previewEl) previewEl.textContent = buildPitchSentence(_selectedWords);

  const est = estimatePitch(_pitchState, { words: _selectedWords, claims: _selectedClaims });
  if (fundEl) fundEl.textContent = fmtMoney(est.projected);

  // VC mood meter reacts live to pitch quality - the addictive feedback loop.
  const moodFill = document.getElementById('pitch-mood-fill');
  const moodLabel = document.getElementById('pitch-mood-label');
  if (moodFill) {
    const moodPct = Math.max(0, Math.min(100, ((est.quality - 0.85) / (1.9 - 0.85)) * 100));
    moodFill.style.width = `${moodPct}%`;
    moodFill.classList.toggle('mood-hot', !!est.willClose);
    if (moodLabel) {
      moodLabel.textContent = !_selectedWords.length ? 'Checking their phone'
        : moodPct < 25 ? 'Visibly skeptical'
        : moodPct < 50 ? 'Mildly curious'
        : moodPct < 72 ? 'Leaning in'
        : moodPct < 90 ? 'Reaching for the term sheet'
        : 'FOMO ACTIVATED';
    }
  }
  if (verdictEl) {
    if (!_selectedWords.length) {
      verdictEl.textContent = '';
      verdictEl.className = 'pitch-verdict';
    } else if (est.willClose) {
      verdictEl.textContent = est.lieRisk > 0 ? ` CLOSES IF BLUFF HOLDS (${Math.round(est.lieRisk * 100)}% risk)` : ' ROUND WILL CLOSE';
      verdictEl.className = 'pitch-verdict verdict-good';
    } else {
      verdictEl.textContent = ' VCs will pass (bridge $ only)';
      verdictEl.className = 'pitch-verdict verdict-bad';
    }
  }
  if (deliverBtn) deliverBtn.disabled = _selectedWords.length === 0;
}

function handleDeliverPitch() {
  clearInterval(_pitchTimer);
  if (_pitchModal) _pitchModal.classList.add('hidden');
  if (_pitchOnDeliver) _pitchOnDeliver({ words: [..._selectedWords], claims: [..._selectedClaims] });
}

function handleCancelPitch() {
  clearInterval(_pitchTimer);
  if (_pitchModal) _pitchModal.classList.add('hidden');
  if (_pitchOnCancel) _pitchOnCancel();
}

//  Loading Screen 
const LOADING_MESSAGES = [
  'Bootstrapping disruption engine...',
  'Securing Series A term sheet...',
  'Inflating the pre-money valuation...',
  'Stuffing the pitch deck with buzzwords...',
  'Assembling IKEA desks (wrong screws)...',
  'Sourcing candidates with red flags...',
  'Ghostwriting founder\'s Twitter...',
  'Preparing pitch deck animations...',
  'Loading 10x engineers...',
  'Connecting to the hype mainframe...',
  'Negotiating with the AWS bill...',
  'Teaching the chatbot to say "synergy"...',
  'Pre-monetizing the onboarding flow...',
  'Aligning the team on a vibe...',
  'Drafting the apology email in advance...',
  'Buying followers (wholesale)...',
  'Adding a fee to the other fees...',
  'Convincing the linter it has no feelings...',
  'Renaming "users" to "the community"...',
  'Removing the off switch...',
];

let _loadingInterval = null;
let _loadingProgress = 0;
let _loadingMsgIdx   = 0;

export function startLoading() {
  showScreen('loading-screen');
  _loadingProgress = 0;
  _loadingMsgIdx   = 0;
  _updateLoadingBar(0);
  _loadingInterval = setInterval(() => {
    _loadingMsgIdx = (_loadingMsgIdx + 1) % LOADING_MESSAGES.length;
    document.getElementById('loading-status').textContent = LOADING_MESSAGES[_loadingMsgIdx];
  }, 600);
}

export function updateLoadingProgress(pct) {
  _loadingProgress = Math.min(100, pct);
  _updateLoadingBar(_loadingProgress);
}

export function finishLoading(onComplete) {
  _updateLoadingBar(100);
  setTimeout(() => {
    clearInterval(_loadingInterval);
    document.getElementById('loading-status').textContent = 'Company founded. IPO inevitable.';
    setTimeout(onComplete, 500);
  }, 400);
}

function _updateLoadingBar(pct) {
  const bar = document.getElementById('loading-bar');
  if (bar) bar.style.width = `${pct}%`;
}

//  Game Over / Win Stats 
function statBlock(label, value) {
  return `
    <div class="stat-item">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
    </div>
  `;
}

export function showGameOverStats(state) {
  const container = document.getElementById('game-over-stats');
  if (!container) return;

  const elapsedMin = Math.floor(state.time / 60);
  const elapsedSec = Math.floor(state.time % 60);

  container.innerHTML =
    statBlock('SURVIVED', `${elapsedMin}:${String(elapsedSec).padStart(2, '0')}`) +
    statBlock('RAISED', fmtMoney(state.totalRaised)) +
    statBlock('PRODUCTS', state.stats.productsShipped) +
    statBlock('HIRES', state.stats.hires);
}

export function showWinStats(state) {
  const container = document.getElementById('win-stats');
  if (!container) return;

  container.innerHTML =
    statBlock('TOTAL RAISED', fmtMoney(state.totalRaised)) +
    statBlock('VALUATION', fmtMoney(getValuation(state))) +
    statBlock('PRODUCTS', state.stats.productsShipped) +
    statBlock('TEAM SIZE', state.employees.length);
}


//  Build Sprint  themed development mini-game (drives quality via actionResolveCrunchSprint)
/** Round score 0..1 from needle position vs the target zone. Exported for tests. */
export function _bsScore(m, c, h) {
  const d = Math.abs(m - c);
  if (d <= h) return 1 - (d / h) * 0.25;          // inside the zone: 0.75 .. 1.0
  return Math.max(0, 0.75 - (d - h) / 45);         // outside: falls off to 0
}

const BS_THEMES = {
  AI:       { title: 'Train the Model',   color: '#4D6BFF' },
  Robotics: { title: 'Calibrate the Rig', color: '#19C37D' },
  Gaming:   { title: 'Nail the Playtest', color: '#FF4D9D' },
  Finance:  { title: 'Time the Market',   color: '#FF9A1F' },
  Health:   { title: 'Pass the Trial',    color: '#28C7D8' },
  Social:   { title: 'Ride the Trend',    color: '#8B5CF6' },
  SaaS:     { title: 'Ship the Sprint',   color: '#4D6BFF' },
  FinTech:  { title: 'Clear the Ledger',  color: '#FF9A1F' },
  Quantum:  { title: 'Collapse the Wavefunction', color: '#4D6BFF' },
  AGI:      { title: 'Align the AGI',     color: '#8B5CF6' },
  Biotech:  { title: 'Sequence the Genome', color: '#19C37D' },
  Fusion:   { title: 'Contain the Plasma', color: '#FF9A1F' },
  Rockets:  { title: 'Stick the Landing', color: '#FF9A1F' },
  Satellites:{ title: 'Reach Orbit',      color: '#4D6BFF' },
  Drones:   { title: 'Hold the Swarm',    color: '#FF9A1F' },
  'Autonomous Defense': { title: 'Arm the Aegis', color: '#FF4D5E' },
  default:  { title: 'Build Sprint',      color: '#4D6BFF' },
};

export function openBuildSprintModal(state, product, onFinish, onCancel) {
  const theme = BS_THEMES[(product && product.idea && product.idea.industry)] || BS_THEMES.default;
  // Sprint variety: ~1/3 timing (below), ~1/3 mash-fast, ~1/3 type-fast with a scrolling git log.
  const _variety = Math.random();
  if (_variety < 0.34) { openTapGame({ title: theme.title, color: theme.color, instruction: 'Mash the button (or Space) to push commits before the build breaks.' }, onFinish, onCancel); return; }
  if (_variety < 0.67) { openClickRush({ title: theme.title, color: theme.color, note: 'Smash each bug as it pops. Ship commits before the build breaks.', unit: 'commits shipped', duration: 9, targetHits: 12 }, onFinish, onCancel); return; }
  const ROUNDS = 4;
  let round = 0; const scores = [];
  let marker = 0, dir = 1, speed = 1, zoneC = 50, zoneH = 16, locked = false, rafId = null, done = false;

  const old = document.getElementById('build-sprint-modal'); if (old) old.remove();
  const modal = document.createElement('div'); modal.id = 'build-sprint-modal'; modal.className = 'modal'; document.body.appendChild(modal);

  const keyHandler = (e) => {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); lock(); }
    else if (e.code === 'Escape') cancel();
  };
  window.addEventListener('keydown', keyHandler);

  function cleanup() { done = true; if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('keydown', keyHandler); }
  function finish() { if (done) return; cleanup(); modal.remove(); const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.4; onFinish(avg); }
  function cancel() { if (done) return; cleanup(); modal.remove(); if (onCancel) onCancel(); }
  function grade(a) { return a >= .9 ? 'S' : a >= .78 ? 'A' : a >= .62 ? 'B' : a >= .45 ? 'C' : 'D'; }

  function render() {
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    modal.innerHTML = `<div class="modal-content bs-content" style="--bs:${theme.color}">
      <div class="bs-head"><h2>${theme.title}</h2><div class="bs-round">Round ${Math.min(round + 1, ROUNDS)}/${ROUNDS}</div></div>
      <p class="modal-note">Tap the bar (or hit Space) when the needle is in the zone. Zones tighten each round. A clean run lifts quality and trims bugs.</p>
      <div class="bs-track"><div class="bs-zone" style="left:${zoneC - zoneH}%;width:${zoneH * 2}%"></div><div class="bs-needle" style="left:${marker}%"></div></div>
      <div class="bs-foot"><div class="bs-grade">${scores.length ? ('Grade ' + grade(avg)) : ''}</div><button class="btn btn-primary bs-tap" type="button">LOCK</button></div>
      <div class="bs-pips">${Array.from({ length: ROUNDS }, (_, i) => `<span class="${i < scores.length ? (scores[i] >= .62 ? 'hit' : 'miss') : ''}"></span>`).join('')}</div>
    </div>`;
    const track = modal.querySelector('.bs-track'); if (track) track.onclick = lock;
    const tap = modal.querySelector('.bs-tap'); if (tap) tap.onclick = (e) => { e.stopPropagation(); lock(); };
  }
  function loop() {
    if (done) return;
    rafId = requestAnimationFrame(loop);
    if (locked) return;
    marker += dir * speed;
    if (marker >= 100) { marker = 100; dir = -1; }
    else if (marker <= 0) { marker = 0; dir = 1; }
    const n = modal.querySelector('.bs-needle'); if (n) n.style.left = marker + '%';
  }
  function newRound() {
    locked = false;
    zoneH = Math.max(7, 17 - round * 2.7);
    zoneC = 22 + Math.random() * 56;
    speed = 0.85 + round * 0.25;
    marker = Math.random() * 100; dir = Math.random() < 0.5 ? 1 : -1;
    render(); loop();
  }
  function lock() {
    if (locked || done) return; locked = true;
    scores.push(_bsScore(marker, zoneC, zoneH));
    const card = modal.querySelector('.bs-content'); if (card) { card.classList.remove('bs-flash'); void card.offsetWidth; card.classList.add('bs-flash'); }
    render();
    round++;
    setTimeout(() => { if (round >= ROUNDS) finish(); else newRound(); }, 600);
  }

  newRound();
}


/* ---- Objectives / quest tracker (top-left HUD panel) ---- */
function getObjectives(state, users) {
  const team = (state.employees || []).length;
  const raised = state.totalRaised || 0;
  const hype = state.hype || 0;
  const shipped = (state.stats && state.stats.productsShipped) || 0;
  return [
    { label: 'Release your first product', done: shipped >= 1, cur: shipped, tgt: 1, kind: 'bool' },
    { label: 'Reach 10K users',            done: users >= 10000, cur: users, tgt: 10000, kind: 'users' },
    { label: 'Get 15 Hype',                done: hype >= 15,    cur: Math.round(hype), tgt: 15, kind: 'plain' },
    { label: 'Build a dev team',           done: team >= 3,     cur: team, tgt: 3, kind: 'plain' },
    { label: 'Raise $250K',                done: raised >= 250000, cur: raised, tgt: 250000, kind: 'money' },
  ];
}
function renderObjectives(state, users) {
  const list = document.getElementById('objectives-list'); if (!list) return;
  const objs = getObjectives(state, users);
  const sig = objs.map(o => o.done ? '1' : Math.floor((o.cur / o.tgt) * 20)).join('|');
  if (list._sig === sig) return; list._sig = sig;
  list.innerHTML = objs.map(o => {
    let prog = '';
    if (!o.done) {
      if (o.kind === 'money') prog = `${fmtMoney(o.cur)} / ${fmtMoney(o.tgt)}`;
      else if (o.kind === 'users') prog = `${fmtUsers(Math.min(o.cur, o.tgt))} / ${fmtUsers(o.tgt)}`;
      else if (o.kind === 'plain') prog = `${o.cur} / ${o.tgt}`;
    }
    return `<div class="obj-row ${o.done ? 'obj-done' : ''}"><span class="obj-check">${o.done ? '\u2713' : ''}</span><span class="obj-label">${o.label}</span><span class="obj-prog">${prog}</span></div>`;
  }).join('');
}


/* ====== Resource history + click-to-chart (top-bar tiles) ====== */
const _statHist = { cash: [], runway: [], hype: [], users: [], burnout: [], trust: [] };
let _statClock = -99, _statsWired = false, _chartState = null;
const STAT_META = {
  cash:    { name: 'Cash',    emoji: '\u{1F4B0}', color: '#19C37D', fmt: v => fmtMoney(v) },
  runway:  { name: 'Runway',  emoji: '\u{23F3}',  color: '#FF9A1F', fmt: v => v == null ? '∞' : v + 'd' },
  hype:    { name: 'Hype',    emoji: '\u{1F525}', color: '#FF4D9D', fmt: v => Math.round(v) },
  users:   { name: 'Users',   emoji: '\u{1F465}', color: '#4D6BFF', fmt: v => fmtUsers(v) },
  burnout: { name: 'Burnout', emoji: '\u{1F50B}', color: '#8B5CF6', fmt: v => Math.round(v) + '%' },
  trust:   { name: 'Trust',   emoji: '\u{1F6E1}', color: '#16B0C9', fmt: v => Math.round(v) + '%' },
};
const CAPTIONS = {
  cash:    ['Burn rate: spiritual.', 'The CFO is a spreadsheet named Gary.', 'Profit is a Q5 problem.', 'We round to the nearest vibe.'],
  runway:  ['Runway measured in espressos.', 'We prefer the word "urgency".', 'Plenty of time. Probably.', 'The fumes are premium-grade.'],
  hype:    ['Hype is a renewable resource (it is not).', 'One post from glory or ruin.', 'The algorithm giveth.', 'Trending, allegedly.'],
  users:   ['Some of them are even real.', 'DAU: Daily Annoyed Users.', 'Growth! Direction unspecified.', '40% bots, 60% hope.'],
  burnout: ['Morale is load-bearing.', 'The ping-pong table is weeping.', 'Hydrate the team, cowards.', 'Crunch is just spicy rest.'],
  trust:   ['Trust me, bro: the metric.', 'One scandal from a rebrand.', 'Reputation is just lag.', 'The apology draft is pre-written.'],
};

function recordStats(state) {
  _chartState = state;
  if (!_statsWired) wireStatClicks();
  if (state.time - _statClock < 1.2) return;          // sample ~ every 1.2s
  _statClock = state.time;
  const cur = hud._cur || {};
  for (const k of Object.keys(_statHist)) {
    const v = cur[k];
    if (v == null && k !== 'runway') continue;
    const arr = _statHist[k]; arr.push(v == null ? 0 : v);
    if (arr.length > 48) arr.shift();
  }
}
function wireStatClicks() {
  _statsWired = true;
  const map = { cash: '.hud-resource-cash', runway: '.hud-resource-runway', hype: '.hud-resource-hype', users: '.hud-resource-users', burnout: '.hud-resource-burnout', trust: '.hud-resource-trust' };
  for (const key of Object.keys(map)) {
    const el = document.querySelector(map[key]);
    if (el) { el.style.cursor = 'pointer'; el.title = 'Click for chart + projection'; el.addEventListener('click', () => openStatChart(key)); }
  }
}
function sparklineSVG(data, color, projValue) {
  const W = 440, H = 150, pad = 12;
  if (!data || data.length < 2) return '<div class="sc-empty">gathering data… give it a few seconds</div>';
  const proj = (projValue == null) ? data[data.length - 1] : projValue;
  const vals = data.concat([proj]);
  const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
  const histW = (W - 2 * pad) * 0.58, projW = (W - 2 * pad) * 0.42, n = data.length;
  const hx = i => pad + (n === 1 ? 0 : (i / (n - 1)) * histW);
  const yv = v => H - pad - ((v - min) / span) * (H - 2 * pad);
  const pts = data.map((v, i) => hx(i).toFixed(1) + ',' + yv(v).toFixed(1)).join(' ');
  const lastX = hx(n - 1), lastY = yv(data[n - 1]);
  const divX = pad + histW, projX = pad + histW + projW, projY = yv(proj), baseY = (H - pad).toFixed(1);
  const area = pts + ' ' + lastX.toFixed(1) + ',' + baseY + ' ' + pad + ',' + baseY;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none">
    <line x1="${divX.toFixed(1)}" y1="${pad}" x2="${divX.toFixed(1)}" y2="${baseY}" stroke="rgba(255,255,255,.16)" stroke-width="1" stroke-dasharray="2 3"/>
    <polyline points="${area}" fill="${color}22" stroke="none"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/>
    <line x1="${lastX.toFixed(1)}" y1="${lastY.toFixed(1)}" x2="${projX.toFixed(1)}" y2="${projY.toFixed(1)}" stroke="${color}" stroke-width="2.4" stroke-dasharray="5 4" opacity=".85"/>
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3.6" fill="${color}"/>
    <circle cx="${projX.toFixed(1)}" cy="${projY.toFixed(1)}" r="3.4" fill="none" stroke="${color}" stroke-width="1.8"/>
    <text x="${divX.toFixed(1)}" y="${(H-2).toFixed(1)}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,.4)">now</text>
    <text x="${(projX-2).toFixed(1)}" y="${(H-2).toFixed(1)}" text-anchor="end" font-size="9" fill="rgba(255,255,255,.4)">+30d</text>
  </svg>`;
}
/** Open the dark chart popover for a resource key. Exported for tests. */
export function openStatChart(key) {
  const meta = STAT_META[key]; if (!meta) return;
  const hist = _statHist[key] || [];
  const cur = (hud._cur && hud._cur[key] != null) ? hud._cur[key] : (hist.length ? hist[hist.length - 1] : 0);
  if (typeof document === 'undefined') return;
  const old = document.getElementById('stat-chart-modal'); if (old) old.remove();
  const modal = document.createElement('div'); modal.id = 'stat-chart-modal'; modal.className = 'modal'; document.body.appendChild(modal);
  let proj = 'Gathering data…', dirCls = '', proj30 = null;
  if (hist.length >= 3) {
    const k = Math.min(16, hist.length), r = hist.slice(-k);
    const slope = (r[r.length - 1] - r[0]) / ((k - 1) || 1);   // per ~1.2s sample
    // 1 game-day ~ 3s; sampled every 1.2s => ~2.5 samples/day => 75 samples over 30 days
    let pv = hist[hist.length - 1] + slope * 75;
    pv = (key === 'trust' || key === 'burnout') ? Math.max(0, Math.min(100, pv)) : Math.max(0, pv);
    proj30 = pv;
    const eps = (Math.max(...hist) - Math.min(...hist)) * 0.02;
    const dir = slope > eps ? 'rising' : slope < -eps ? 'falling' : 'holding steady';
    dirCls = slope > eps ? 'up' : slope < -eps ? 'down' : '';
    proj = `Trending ${dir} · 30-day outlook ~ ${meta.fmt(key === 'runway' ? Math.round(pv) : pv)}`;
  }
  const cap = CAPTIONS[key][Math.floor(Math.random() * CAPTIONS[key].length)];
  modal.innerHTML = `<div class="modal-content stat-chart" style="--sc:${meta.color}">
    <button class="share-close" aria-label="Close">&times;</button>
    <div class="sc-head"><span class="sc-emoji">${meta.emoji}</span><div><div class="sc-name">${meta.name}</div><div class="sc-cur">${meta.fmt(cur)}</div></div></div>
    <div class="sc-chart">${sparklineSVG(hist, meta.color, proj30)}</div>
    <div class="sc-proj ${dirCls}">${proj}</div>
    <div class="sc-cap">“${cap}”</div>
  </div>`;
  modal.querySelector('.share-close').onclick = () => modal.remove();
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}


/** Dark, funny proposal modal. onResolve(accept:boolean) is called on choice. */
export function openProposalModal(state, proposal, onResolve) {
  if (typeof document === 'undefined' || !proposal) return;
  const old = document.getElementById('proposal-modal'); if (old) old.remove();
  const modal = document.createElement('div'); modal.id = 'proposal-modal'; modal.className = 'modal'; document.body.appendChild(modal);
  modal.innerHTML = `<div class="modal-content proposal-modal-content">
    <div class="prop-tag">${escapeAttr(proposal.accentLabel || 'PROPOSAL')}</div>
    <h2 class="prop-who">${escapeAttr(proposal.who || 'A Proposal')}</h2>
    <div class="prop-handle">${escapeAttr(proposal.handle || '')}</div>
    <p class="prop-pitch">${escapeAttr(proposal.pitch || '')}</p>
    <div class="prop-actions">
      <button class="btn prop-decline" type="button">Pass</button>
      <button class="btn btn-primary prop-accept" type="button">Accept</button>
    </div>
  </div>`;
  const done = (accept) => { modal.remove(); if (onResolve) onResolve(accept); };
  modal.querySelector('.prop-accept').onclick = () => done(true);
  modal.querySelector('.prop-decline').onclick = () => done(false);
  modal.addEventListener('click', (e) => { if (e.target === modal) done(false); });
}
