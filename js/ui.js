/**
 * ui.js — HUD management, toasts, modals (VC pitch, hire, build, develop),
 * screen transitions. All UI operates on DOM elements; no Three.js here.
 */

import {
  CONFIG, ROLES, PERSONALITIES, FUNDING_ROUNDS,
  getPitchBuzzwords, buildPitchSentence, estimatePitch,
  generateCandidates, generateProductChoices,
  getMRR, getBurnRate, getNetCashFlow, getRunwaySeconds, getValuation,
  getTeamDevPower, getGlitchLevel, fmtMoney,
} from './gameLogic.js';

// ─── Screen Management ────────────────────────────────────────────────────────
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

// ─── HUD ─────────────────────────────────────────────────────────────────────
const hud = {
  el:             null,
  cashValue:      null,
  netValue:       null,
  runwayDays:     null,
  hypeFill:       null,
  hypeValue:      null,
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
  cdLabels:       {},
};

export function initHUD() {
  hud.el             = document.getElementById('hud');
  hud.cashValue      = document.getElementById('cash-value');
  hud.netValue       = document.getElementById('net-value');
  hud.runwayDays     = document.getElementById('runway-days');
  hud.hypeFill       = document.getElementById('hype-fill');
  hud.hypeValue      = document.getElementById('hype-value');
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

  hud.cdLabels = {
    launch:   document.getElementById('cd-launch'),
    pitch:    document.getElementById('cd-pitch'),
    caffeine: document.getElementById('cd-caffeine'),
    pivot:    document.getElementById('cd-pivot'),
  };
}

export function showHUD() {
  if (hud.el) hud.el.classList.remove('hidden');
}

export function hideHUD() {
  if (hud.el) hud.el.classList.add('hidden');
}

/**
 * Update HUD meters and cooldown labels every frame.
 */
export function updateHUD(state) {
  if (!hud.el) return;

  // Cash + net flow
  hud.cashValue.textContent = fmtMoney(state.cash);
  const net = getNetCashFlow(state);
  const mrr = getMRR(state);
  const burn = getBurnRate(state);
  hud.netValue.textContent = `${net >= 0 ? '+' : ''}${fmtMoney(net)}/s`;
  hud.netValue.className = net >= 0 ? 'net-positive' : 'net-negative';
  hud.netValue.title = `MRR +${fmtMoney(mrr)}/s · Burn -${fmtMoney(burn)}/s`;

  // Runway
  const runwaySec = getRunwaySeconds(state);
  if (runwaySec === Infinity) {
    hud.runwayDays.textContent = 'runway ∞';
    hud.runwayDays.classList.remove('critical-text');
  } else {
    const days = Math.floor(runwaySec / 3); // scaled to feel like days
    hud.runwayDays.textContent = `runway ${days}d`;
    hud.runwayDays.classList.toggle('critical-text', runwaySec < CONFIG.RUNWAY_GLITCH_SEC);
  }

  // Hype meter
  hud.hypeFill.style.width = `${(state.hype / CONFIG.HYPE_MAX) * 100}%`;
  hud.hypeValue.textContent = Math.round(state.hype);

  // Valuation + round badge
  hud.valuationDisp.textContent = fmtMoney(getValuation(state));
  const round = FUNDING_ROUNDS[state.roundIndex];
  hud.roundDisplay.textContent = round ? `NEXT: ${round.name}` : 'IPO READY';

  // Dev progress card
  if (state.activeProduct) {
    const ap = state.activeProduct;
    const pct = Math.min(100, (ap.progress / ap.idea.devPoints) * 100);
    hud.devCard.classList.remove('hidden');
    hud.devName.textContent = ap.idea.name;
    hud.devPct.textContent = `${Math.floor(pct)}%`;
    hud.devFill.style.width = `${pct}%`;
    hud.devPower.textContent = `team speed ${getTeamDevPower(state).toFixed(1)}×`;
  } else {
    hud.devCard.classList.add('hidden');
  }

  // Cooldown labels
  updateCooldownLabel('launch',   state.cooldowns.launch);
  updateCooldownLabel('pitch',    state.cooldowns.pitch);
  updateCooldownLabel('caffeine', state.cooldowns.caffeine);
  updateCooldownLabel('pivot',    state.cooldowns.pivot);

  // Glitch overlay
  updateGlitchOverlay(state);
}

const CD_BUTTON_IDS = {
  launch:   'btn-launch-feature',
  pitch:    'btn-vc-pitch',
  caffeine: 'btn-caffeinate',
  pivot:    'btn-pivot',
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
    el.textContent = 'READY';
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

// ─── Employee Bar ─────────────────────────────────────────────────────────────
export function initEmployeeBar(employees) {
  if (!hud.employeeBar) return;
  hud.employeeBar.innerHTML = '';

  for (const emp of employees) {
    const p = PERSONALITIES[emp.personality];
    const chip = document.createElement('div');
    chip.className = 'employee-chip';
    chip.id        = `emp-chip-${emp.id}`;
    chip.title     = `${p.label} — ${p.desc}`;
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

// ─── Event Queue ──────────────────────────────────────────────────────────────
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

// ─── Toast Notifications ──────────────────────────────────────────────────────
export function showToast(message, type = 'info', duration = 3000) {
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

// ─── Hire Modal ───────────────────────────────────────────────────────────────
export function openHireModal(state, onHire, onClose) {
  const modal = document.getElementById('hire-modal');
  const list  = document.getElementById('candidate-list');
  const note  = document.getElementById('hire-note');
  if (!modal || !list) return;

  const candidates = generateCandidates(state);
  const freeDesk   = state.desks.some(d => d.employeeId === null);
  const canAfford  = state.cash >= CONFIG.HIRE_SIGNING_BONUS;

  if (!freeDesk) {
    note.textContent = '⚠ No free desk — build one first (BUILD menu).';
    note.classList.add('modal-note-warn');
  } else if (!canAfford) {
    note.textContent = `⚠ Need ${fmtMoney(CONFIG.HIRE_SIGNING_BONUS)} signing bonus.`;
    note.classList.add('modal-note-warn');
  } else {
    note.textContent = `Signing bonus ${fmtMoney(CONFIG.HIRE_SIGNING_BONUS)} · salary paid per second · choose wisely.`;
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
        <span class="candidate-icon">${p.icon}</span>
        <div>
          <div class="candidate-name">${cand.name}</div>
          <div class="candidate-role">${role.icon} ${role.label}</div>
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

// ─── Build Modal ──────────────────────────────────────────────────────────────
export function openBuildModal(state, onBuy, onClose) {
  const modal = document.getElementById('build-modal');
  const list  = document.getElementById('build-options');
  if (!modal || !list) return;

  const desksUsed     = state.desks.length;
  const desksMax      = CONFIG.DESK_SLOTS;
  const noComputer    = state.desks.filter(d => !d.hasComputer).length;
  const canBuyDesk    = desksUsed < desksMax && state.cash >= CONFIG.DESK_COST;
  const canBuyComp    = noComputer > 0 && state.cash >= CONFIG.COMPUTER_COST;

  list.innerHTML = `
    <div class="build-card">
      <div class="build-icon">🪑</div>
      <div class="build-info">
        <div class="build-name">DESK</div>
        <div class="build-desc">One seat for one hire. ${desksUsed}/${desksMax} slots used.</div>
      </div>
      <button id="btn-buy-desk" class="btn btn-primary btn-sm" ${canBuyDesk ? '' : 'disabled'}>
        ${desksUsed >= desksMax ? 'FULL' : fmtMoney(CONFIG.DESK_COST)}
      </button>
    </div>
    <div class="build-card">
      <div class="build-icon">🖥</div>
      <div class="build-info">
        <div class="build-name">COMPUTER</div>
        <div class="build-desc">Without one, employees work at half speed. ${noComputer} desk${noComputer === 1 ? '' : 's'} missing one.</div>
      </div>
      <button id="btn-buy-computer" class="btn btn-primary btn-sm" ${canBuyComp ? '' : 'disabled'}>
        ${noComputer === 0 ? 'ALL SET' : fmtMoney(CONFIG.COMPUTER_COST)}
      </button>
    </div>
  `;

  document.getElementById('btn-buy-desk').onclick = () => {
    modal.classList.add('hidden');
    onBuy('desk');
  };
  document.getElementById('btn-buy-computer').onclick = () => {
    modal.classList.add('hidden');
    onBuy('computer');
  };
  document.getElementById('btn-close-build').onclick = () => {
    modal.classList.add('hidden');
    onClose();
  };

  modal.classList.remove('hidden');
}

// ─── Develop Modal ────────────────────────────────────────────────────────────
export function openDevelopModal(state, onPick, onClose) {
  const modal = document.getElementById('develop-modal');
  const list  = document.getElementById('product-choice-list');
  const note  = document.getElementById('develop-note');
  if (!modal || !list) return;

  list.innerHTML = '';

  if (state.activeProduct) {
    const ap = state.activeProduct;
    const pct = Math.floor(Math.min(100, (ap.progress / ap.idea.devPoints) * 100));
    note.textContent = `Already building ${ap.idea.name} (${pct}%). One absurd product at a time.`;
  } else if (!state.employees.length) {
    note.textContent = '⚠ You need at least one employee to build a product.';
  } else {
    const power = getTeamDevPower(state);
    note.textContent = `Pick the next absurd product. Team dev speed: ${power.toFixed(1)}×`;

    const ideas = generateProductChoices(state);
    const powerSafe = Math.max(power, 0.1);
    for (const idea of ideas) {
      const eta = Math.ceil(idea.devPoints / powerSafe);
      const card = document.createElement('div');
      card.className = 'candidate-card product-card';
      card.innerHTML = `
        <div class="candidate-header">
          <div>
            <div class="candidate-name">${idea.name}</div>
            <div class="product-stats">
              <span class="accent-cyan">+${fmtMoney(idea.mrr)}/s MRR</span> ·
              <span class="accent-magenta">+${idea.hype} Hype</span> ·
              ~${eta}s build
            </div>
          </div>
        </div>
        <div class="candidate-desc">${idea.desc}</div>
        <button class="btn btn-primary btn-sm product-pick-btn">BUILD THIS</button>
      `;
      card.querySelector('.product-pick-btn').addEventListener('click', () => {
        modal.classList.add('hidden');
        onPick(idea);
      });
      list.appendChild(card);
    }
  }

  document.getElementById('btn-close-develop').onclick = () => {
    modal.classList.add('hidden');
    onClose();
  };

  modal.classList.remove('hidden');
}

// ─── VC Pitch Modal ───────────────────────────────────────────────────────────
let _pitchModal       = null;
let _pitchOnDeliver   = null;
let _pitchOnCancel    = null;
let _pitchTimer       = null;
let _selectedWords    = [];
let _pitchState       = null;

export function openPitchModal(state, onDeliver, onCancel) {
  _pitchModal = document.getElementById('vc-pitch-modal');
  if (!_pitchModal) return;

  _pitchState     = state;
  _pitchOnDeliver = onDeliver;
  _pitchOnCancel  = onCancel;
  _selectedWords  = [];
  const buzzwords = getPitchBuzzwords(12);

  // Round info panel
  const roundInfo = document.getElementById('pitch-round-info');
  const round = FUNDING_ROUNDS[state.roundIndex];
  if (round) {
    const prodOk = state.shippedProducts.length >= round.reqProducts;
    const hypeOk = state.hype >= round.reqHype;
    roundInfo.innerHTML = `
      <div class="pitch-round-name">${round.name} — target ${fmtMoney(round.amount)}</div>
      <div class="pitch-round-blurb">"${round.blurb}"</div>
      <div class="pitch-round-reqs">
        <span class="${prodOk ? 'req-met' : 'req-unmet'}">${prodOk ? '✓' : '✗'} Products ${state.shippedProducts.length}/${round.reqProducts}</span>
        <span class="${hypeOk ? 'req-met' : 'req-unmet'}">${hypeOk ? '✓' : '✗'} Hype ${Math.round(state.hype)}/${round.reqHype}</span>
      </div>
    `;
  } else {
    roundInfo.innerHTML = '<div class="pitch-round-name">ALL ROUNDS RAISED</div>';
  }

  // Build buzzword grid
  const grid = document.getElementById('buzzword-grid');
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

  const est = estimatePitch(_pitchState, _selectedWords);
  if (fundEl) fundEl.textContent = fmtMoney(est.projected);
  if (verdictEl) {
    if (!_selectedWords.length) {
      verdictEl.textContent = '';
      verdictEl.className = 'pitch-verdict';
    } else if (est.willClose) {
      verdictEl.textContent = '● ROUND WILL CLOSE';
      verdictEl.className = 'pitch-verdict verdict-good';
    } else {
      verdictEl.textContent = '○ VCs will pass (bridge $ only)';
      verdictEl.className = 'pitch-verdict verdict-bad';
    }
  }
  if (deliverBtn) deliverBtn.disabled = _selectedWords.length === 0;
}

function handleDeliverPitch() {
  clearInterval(_pitchTimer);
  if (_pitchModal) _pitchModal.classList.add('hidden');
  if (_pitchOnDeliver) _pitchOnDeliver([..._selectedWords]);
}

function handleCancelPitch() {
  clearInterval(_pitchTimer);
  if (_pitchModal) _pitchModal.classList.add('hidden');
  if (_pitchOnCancel) _pitchOnCancel();
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
const LOADING_MESSAGES = [
  'Bootstrapping disruption engine...',
  'Securing Series A term sheet...',
  'Initializing the mercury AI core...',
  'Training model on buzzwords...',
  'Assembling IKEA desks (wrong screws)...',
  'Sourcing candidates with red flags...',
  'Ghostwriting founder\'s Twitter...',
  'Preparing pitch deck animations...',
  'Loading 10x engineers...',
  'Connecting to the hype mainframe...',
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

// ─── Game Over / Win Stats ─────────────────────────────────────────────────────
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
