/**
 * ui.js  HUD management, toasts, modals (VC pitch, hire, build, develop),
 * screen transitions. All UI operates on DOM elements; no Three.js here.
 */

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
  hud.netValue.title = `MRR +${fmtMoney(mrr)}/s  Burn -${fmtMoney(burn)}/s`;

  // Runway
  const runwaySec = getRunwaySeconds(state);
  if (runwaySec === Infinity) {
    hud.runwayDays.textContent = 'runway infinity';
    hud.runwayDays.classList.remove('critical-text');
  } else {
    const days = Math.floor(runwaySec / 3); // scaled to feel like days
    hud.runwayDays.textContent = `runway ${days}d`;
    hud.runwayDays.classList.toggle('critical-text', runwaySec < CONFIG.RUNWAY_GLITCH_SEC);
  }

  // Hype meter (flash on a real spike: launch, marketing, viral win)
  if (hud.lastHype != null && state.hype - hud.lastHype >= 3) {
    hud.hypeFill.classList.remove('hype-spike');
    void hud.hypeFill.offsetWidth;
    hud.hypeFill.classList.add('hype-spike');
  }
  hud.lastHype = state.hype;
  hud.hypeFill.style.width = `${(state.hype / CONFIG.HYPE_MAX) * 100}%`;
  hud.hypeValue.textContent = Math.round(state.hype);
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
  hud.valuationDisp.textContent = fmtMoney(getValuation(state));
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

function updateOnboarding(state) {
  if (!hud.onboardingCard || !hud.onboardingSteps) return;
  const steps = onboardingStepData(state);
  const complete = steps.every(s => s.done);
  const startedProduct = getActiveProducts(state).length > 0 || state.readyProducts.length > 0 || state.shippedProducts.length > 0;
  if (state.live || startedProduct || complete) {
    hud.onboardingCard.classList.add('hidden');
    return;
  }

  const current = steps.find(s => !s.done) || steps[steps.length - 1];
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
export function initEmployeeBar(employees) {
  if (!hud.employeeBar) return;
  hud.employeeBar.innerHTML = '';

  for (const emp of employees) {
    const p = PERSONALITIES[emp.personality];
    const chip = document.createElement('div');
    chip.className = 'employee-chip';
    chip.id        = `emp-chip-${emp.id}`;
    chip.title     = `${p.label} - ${p.desc}`;
    chip.innerHTML = `
      <div class="employee-avatar">${p.icon}</div>
      <div class="employee-name">${emp.name}</div>
      <div class="employee-caffeine-track">
        <div class="employee-caffeine-fill" id="emp-caffeine-${emp.id}" style="width:100%"></div>
      </div>
    `;
    hud.employeeBar.appendChild(chip);
  }
}

export function updateEmployeeBar(employees) {
  for (const emp of employees) {
    const chip = document.getElementById(`emp-chip-${emp.id}`);
    const bar  = document.getElementById(`emp-caffeine-${emp.id}`);
    if (!chip || !bar) continue;

    bar.style.width = `${(emp.energy * 100).toFixed(0)}%`;

    bar.classList.remove('low', 'empty');
    chip.classList.remove('burned-out', 'low-energy');

    if (emp.burnedOut) {
      bar.classList.add('empty');
      chip.classList.add('burned-out');
    } else if (emp.energy < 0.3) {
      bar.classList.add('low');
      chip.classList.add('low-energy');
    }
  }
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
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.innerHTML = `
      <div class="candidate-header">
        <span class="candidate-icon">${icon('person')}</span>
        <div>
          <div class="candidate-name">${cand.name}</div>
          <div class="candidate-role">${role.icon} ${role.label} - ${p.icon}</div>
        </div>
        <div class="candidate-salary">${fmtMoney(cand.salary)}/s</div>
      </div>
      <div class="candidate-personality">${p.label}</div>
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
      <div class="build-icon">${icon('desk')}</div>
      <div class="build-info">
        <div class="build-name">DESK</div>
        <div class="build-desc">${deskDesc}</div>
      </div>
      <button id="btn-buy-desk" class="btn btn-primary btn-sm" ${canBuyDesk ? '' : 'disabled'}>
        ${desksUsed >= desksMax ? 'FULL' : fmtMoney(CONFIG.DESK_COST)}
      </button>
    </div>
    <div class="build-card ${desksUsed === 0 || noComputer === 0 ? 'build-locked' : ''}">
      <div class="build-icon">${icon('computer')}</div>
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
    <div class="build-icon">${icon('server')}</div>
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
        <div class="build-icon">${icon(f.kind === 'Room' ? 'office' : 'tool')}</div>
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
  section('OFFICE EXPANSION');
  const expandCard = document.createElement('div');
  expandCard.className = 'build-card build-expansion-card';
  expandCard.innerHTML = `
    <div class="build-icon">${icon('office')}</div>
    <div class="build-info">
      <div class="build-name">${OFFICE_TIERS[state.officeTier].name}</div>
      <div class="build-desc">${nextTier ? `Upgrade to ${nextTier.name}: ${nextTier.slots} desk slots and a more polished office.` : 'Maximum office size reached.'}</div>
    </div>
    <button id="btn-expand-office" class="btn btn-primary btn-sm" ${nextTier && state.cash >= nextTier.cost ? '' : 'disabled'}>
      ${nextTier ? fmtMoney(nextTier.cost) : 'MAX'}
    </button>
  `;
  list.appendChild(expandCard);

  const expandBtn = document.getElementById('btn-expand-office');
  if (expandBtn) expandBtn.onclick = () => { modal.classList.add('hidden'); onBuy('expand'); };

  document.getElementById('btn-close-build').onclick = () => {
    modal.classList.add('hidden');
    onClose();
  };

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
      <div class="build-icon">${icon('cash')}</div>
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
        <div class="build-icon">${icon('spark')}</div>
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

export function openDevelopModal(state, onPick, onClose) {
  const modal = document.getElementById('develop-modal');
  const list  = document.getElementById('product-choice-list');
  const note  = document.getElementById('develop-note');
  if (!modal || !list) return;

  const rerollBtn = document.getElementById('btn-reroll-products');
  const activeProducts = getActiveProducts(state);
  const lanes = getDevelopmentLaneCount(state);
  const building = activeProducts.length >= lanes;

  const growTextarea = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };

  const renderChoices = () => {
    list.innerHTML = '';
    if (building) {
      const laneSummary = activeProducts.map(ap => `${ap.idea.name} ${Math.floor(Math.min(100, (ap.progress / ap.idea.devPoints) * 100))}%`).join(' | ');
      note.textContent = `All ${lanes} development lane${lanes === 1 ? '' : 's'} busy: ${laneSummary}. Hire more people to run more products at once.`;
      return;
    }
    const power = getTeamDevPower(state);
    const firstEver = !state.live;
    note.textContent = firstEver
      ? `You have ${fmtMoney(state.cash)}. ${activeProducts.length}/${lanes} dev lanes busy. Set each idea's AMBITION - more investment means a bigger product AND better odds it lands. Your first launch wakes the whole market.`
      : `You have ${fmtMoney(state.cash)}. ${activeProducts.length}/${lanes} dev lanes busy. Higher AMBITION = bigger investment, bigger upside, and better launch odds. Dev speed: ${power.toFixed(1)}x.`;
    const powerSafe = Math.max(power, 0.1);
    let idx = 0;
    for (const idea of generateProductChoices(state)) {
      idea.ambition = 1;
      const base = { mrr: idea.mrr, hype: idea.hype, dev: idea.devPoints };
      const card = document.createElement('div');
      card.className = 'candidate-card product-card';
      card.style.animationDelay = (idx++ * 0.07) + 's';
      card.innerHTML = `
        ${productGraphic(idea)}
        <div class="product-name-row">
          <textarea class="product-name-input" maxlength="48" rows="1" spellcheck="false">${escapeAttr(idea.name)}</textarea>
          <button class="product-dice" title="Randomize this idea">RANDOM</button>
        </div>
        <div class="product-tagline">${idea.desc}</div>
        <div class="product-scope">
          <span class="scope-label">AMBITION <span class="scope-val">1.0x</span></span>
          <input type="range" class="scope-slider" min="0.5" max="2" step="0.1" value="1">
        </div>
        <div class="product-stats">
          <span class="accent-cyan stat-mrr">+${fmtMoney(idea.mrr)}/s MRR</span> 
          <span class="accent-magenta stat-hype">+${idea.hype} Hype</span> 
          <span class="stat-eta">~${Math.ceil(idea.devPoints / powerSafe)}s build</span>
        </div>
        <div class="product-invest">
          <span class="stat-invest"> Invest <strong>-</strong></span> 
          <span class="stat-success"> <strong>-</strong> to land</span>
        </div>
        <button class="btn btn-primary btn-sm product-pick-btn">DEVELOP</button>
      `;
      const ta = card.querySelector('.product-name-input');
      const slider = card.querySelector('.scope-slider');
      const dice = card.querySelector('.product-dice');
      const investEl  = card.querySelector('.stat-invest');
      const successEl = card.querySelector('.stat-success');
      const pickBtn   = card.querySelector('.product-pick-btn');
      const applyScope = () => {
        const sc = parseFloat(slider.value);
        idea.ambition = sc;
        idea.mrr = Math.round(base.mrr * sc);
        idea.hype = Math.max(1, Math.round(base.hype * sc));
        idea.devPoints = Math.round(base.dev * sc);
        const invest  = computeInvestment(idea);
        const chance  = Math.round(computeSuccessChance(state, sc) * 100);
        const broke   = invest > state.cash;
        card.querySelector('.scope-val').textContent = sc.toFixed(1) + 'x';
        card.querySelector('.stat-mrr').textContent = `+${fmtMoney(idea.mrr)}/s MRR`;
        card.querySelector('.stat-hype').textContent = `+${idea.hype} Hype`;
        card.querySelector('.stat-eta').textContent = `~${Math.ceil(idea.devPoints / powerSafe)}s build`;
        investEl.innerHTML  = ` Invest <strong class="${broke ? 'accent-error' : 'accent-amber'}">${fmtMoney(invest)}</strong>`;
        successEl.innerHTML = ` <strong class="${chance >= 75 ? 'accent-cyan' : chance >= 55 ? 'accent-amber' : 'accent-error'}">${chance}%</strong> to land`;
        pickBtn.textContent = broke ? `NEED ${fmtMoney(invest)}` : `DEVELOP - ${fmtMoney(invest)}`;
        pickBtn.classList.toggle('btn-disabled', broke);
        card.querySelectorAll('.product-stats span, .product-invest span').forEach(e => { e.classList.remove('stat-pulse'); void e.offsetWidth; e.classList.add('stat-pulse'); });
      };
      slider.addEventListener('input', applyScope);
      ta.addEventListener('input', () => growTextarea(ta));
      dice.addEventListener('click', () => {
        const fresh = generateProductChoices(state)[0];
        Object.assign(idea, { name: fresh.name, desc: fresh.desc, mrr: fresh.mrr, hype: fresh.hype, devPoints: fresh.devPoints, absurdity: fresh.absurdity });
        base.mrr = idea.mrr; base.hype = idea.hype; base.dev = idea.devPoints;
        slider.value = '1';
        const graphic = card.querySelector('.product-graphic');
        if (graphic) graphic.outerHTML = productGraphic(idea);
        ta.value = idea.name; growTextarea(ta);
        card.querySelector('.product-tagline').textContent = idea.desc;
        applyScope();
        dice.classList.remove('spin'); void dice.offsetWidth; dice.classList.add('spin');
      });
      pickBtn.addEventListener('click', () => {
        const invest = computeInvestment(idea);
        if (invest > state.cash) {
          note.textContent = `Can't afford ${fmtMoney(invest)} for that ambition - dial it down or raise cash first.`;
          return;
        }
        const custom = ta.value.trim().replace(/\s+/g, ' ');
        if (custom) idea.name = custom;
        modal.classList.add('hidden');
        onPick(idea);
      });
      applyScope();
      list.appendChild(card);
    }
    // size each title textarea to show the full name (no clipping, wraps to N lines)
    requestAnimationFrame(() => list.querySelectorAll('.product-name-input').forEach(growTextarea));
  };

  if (rerollBtn) {
    rerollBtn.style.display = building ? 'none' : '';
    rerollBtn.onclick = renderChoices; // randomize all three proposals
  }
  renderChoices();

  document.getElementById('btn-close-develop').onclick = () => {
    modal.classList.add('hidden');
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
            ${FEATURE_OPTIONS.map(f => `<option value="${f.id}">${f.name} - ${fmtMoney(f.cost)}</option>`).join('')}
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
    { key: 'reliability', label: 'Reliability', desc: 'Better chance it lands.' },
    { key: 'marketing', label: 'Marketing', desc: 'Bigger Hype burst.' },
    { key: 'legal', label: 'Legal Polish', desc: 'Safer launch and softer flops.' },
  ];
  const remaining = () => CONFIG.LAUNCH_POLISH_POINTS - rows.reduce((sum, row) => sum + plan[row.key], 0);

  const render = () => {
    const effects = computeLaunchPlanEffects(plan);
    const chance = Math.round(Math.min(CONFIG.SUCCESS_MAX, Math.max(CONFIG.SUCCESS_MIN, baseChance + effects.successBonus)) * 100);
    title.innerHTML = 'LAUNCH <span class="accent-cyan">DAY</span>';
    text.textContent = `${product.idea.name}: spend the final ${CONFIG.LAUNCH_POLISH_POINTS} polish points before the press arrives.`;
    list.innerHTML = `
      <div class="launch-day-summary">
        <span><strong>${chance}%</strong> to land</span>
        <span><strong>+${effects.hypeBonus}</strong> bonus Hype</span>
        <span><strong>${remaining()}</strong> points left</span>
      </div>
      <div class="launch-day-grid"></div>
      <button class="btn btn-primary launch-ship-btn">SHIP IT</button>
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
      onLaunch({ ...plan });
    });
  };

  if (footer && cancel) {
    footer.classList.remove('hidden');
    cancel.onclick = () => {
      modal.classList.add('hidden');
      if (onCancel) onCancel();
    };
  }

  render();
  modal.classList.remove('hidden');
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
