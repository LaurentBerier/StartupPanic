/**
 * minigames.js  Reusable skill minigames for Startup Panic.
 *
 * Two mechanics, both self-contained DOM overlays that resolve to a 0..1 score:
 *   - openTimingGame(cfg, onFinish, onCancel)  the sweet-spot "lock it in the zone"
 *     game (the Build Sprint generalized). Used for dev sprints, firefights, pitch.
 *   - openTapGame(cfg, onFinish, onCancel)  a rapid-tap "build the meter" game.
 *     Used for the marketing / go-viral hype push.
 *
 * The scoring/stepping cores are exported as pure functions so they are testable
 * in Node. All DOM access is guarded by `hasDOM`.
 */

const hasDOM = typeof document !== 'undefined';
const rand = a => a[Math.floor(Math.random() * a.length)];

/*  pure, testable cores  */

/** Sweet-spot round score 0..1 from needle position vs the target zone. */
export function timingScore(m, c, h) {
  const d = Math.abs(m - c);
  if (d <= h) return 1 - (d / h) * 0.25;        // inside the zone: 0.75 .. 1.0
  return Math.max(0, 0.75 - (d - h) / 45);       // outside: falls off to 0
}
/** Tap-meter decay between taps. */
export function tapTick(charge, dt, drain) { return Math.max(0, charge - drain * dt); }
/** Tap-meter gain on a tap. */
export function tapHit(charge, gain) { return Math.min(1, charge + gain); }
/** Letter grade from a 0..1 score. */
export function grade(a) { return a >= .9 ? 'S' : a >= .78 ? 'A' : a >= .62 ? 'B' : a >= .45 ? 'C' : 'D'; }

function freshModal(id) {
  const old = document.getElementById(id); if (old) old.remove();
  const m = document.createElement('div'); m.id = id; m.className = 'modal'; document.body.appendChild(m);
  return m;
}

/*  Timing game (sweet-spot)  */
export function openTimingGame(cfg = {}, onFinish = () => {}, onCancel = null) {
  const color = cfg.color || '#4D6BFF';
  const title = cfg.title || 'Sprint';
  const instruction = cfg.instruction || 'Tap the bar (or hit Space) when the needle is in the zone.';
  const ROUNDS = cfg.rounds || 4;
  const zone0  = cfg.zoneStart != null ? cfg.zoneStart : 17;
  const shrink = cfg.zoneShrink != null ? cfg.zoneShrink : 2.7;
  const spd0   = cfg.speedBase != null ? cfg.speedBase : 0.85;
  const spdStep = cfg.speedStep != null ? cfg.speedStep : 0.25;

  if (!hasDOM) { onFinish(0.6); return; }
  const modal = freshModal('minigame-timing-modal');
  let round = 0; const scores = [];
  let marker = 0, dir = 1, speed = 1, zoneC = 50, zoneH = 16, locked = false, rafId = null, done = false;

  const keyHandler = (e) => {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); lock(); }
    else if (e.code === 'Escape') cancel();
  };
  window.addEventListener('keydown', keyHandler);
  function cleanup() { done = true; if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('keydown', keyHandler); }
  function finish() { if (done) return; cleanup(); modal.remove(); onFinish(scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.4); }
  function cancel() { if (done) return; cleanup(); modal.remove(); if (onCancel) onCancel(); }

  function render() {
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    modal.innerHTML = `<div class="modal-content bs-content" style="--bs:${color}">
      <div class="bs-head"><h2>${title}</h2><div class="bs-round">Round ${Math.min(round + 1, ROUNDS)}/${ROUNDS}</div></div>
      <p class="modal-note">${instruction} Zones tighten each round.</p>
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
    zoneH = Math.max(7, zone0 - round * shrink);
    zoneC = 22 + Math.random() * 56;
    speed = spd0 + round * spdStep;
    marker = Math.random() * 100; dir = Math.random() < 0.5 ? 1 : -1;
    render(); loop();
  }
  function lock() {
    if (locked || done) return; locked = true;
    scores.push(timingScore(marker, zoneC, zoneH));
    const card = modal.querySelector('.bs-content'); if (card) { card.classList.remove('bs-flash'); void card.offsetWidth; card.classList.add('bs-flash'); }
    render();
    round++;
    setTimeout(() => { if (round >= ROUNDS) finish(); else newRound(); }, 600);
  }
  newRound();
}

/*  Tap game (build the meter)  */
export function openTapGame(cfg = {}, onFinish = () => {}, onCancel = null) {
  const color = cfg.color || '#FF4D9D';
  const title = cfg.title || 'Go Viral';
  const instruction = cfg.instruction || 'Mash the button (or Space) to spike the meter before time runs out.';
  const duration = cfg.duration || 6;
  const gain  = cfg.gain  != null ? cfg.gain  : 0.052;
  const drain = cfg.drain != null ? cfg.drain : 0.16;

  if (!hasDOM) { onFinish(0.6); return; }
  const modal = freshModal('minigame-tap-modal');
  let charge = 0, peak = 0, timeLeft = duration, rafId = null, done = false, last = null, taps = 0;

  const keyHandler = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); tap(); } else if (e.code === 'Escape') cancel(); };
  window.addEventListener('keydown', keyHandler);
  function cleanup() { done = true; if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('keydown', keyHandler); }
  function finish() { if (done) return; cleanup(); modal.remove(); onFinish(peak); }
  function cancel() { if (done) return; cleanup(); modal.remove(); if (onCancel) onCancel(); }

  modal.innerHTML = `<div class="modal-content tap-content" style="--tg:${color}">
    <div class="bs-head"><h2>${title}</h2><div class="bs-round" id="tg-time">${duration.toFixed(1)}s</div></div>
    <p class="modal-note">${instruction}</p>
    <div class="tap-meter"><div class="tap-fill" id="tg-fill"></div><div class="tap-peak" id="tg-peak"></div></div>
    <button class="btn btn-primary tap-btn" id="tg-btn" type="button">TAP!</button>
    <div class="tap-timebar"><i id="tg-timebar"></i></div>
  </div>`;
  const fill = modal.querySelector('#tg-fill'), peakEl = modal.querySelector('#tg-peak');
  const timeEl = modal.querySelector('#tg-time'), timeBar = modal.querySelector('#tg-timebar');
  const btn = modal.querySelector('#tg-btn');
  function tap() { if (done) return; charge = tapHit(charge, gain); peak = Math.max(peak, charge); taps++; if (btn) { btn.classList.remove('tap-bump'); void btn.offsetWidth; btn.classList.add('tap-bump'); } }
  if (btn) btn.onclick = tap;

  function loop(ts) {
    if (done) return;
    rafId = requestAnimationFrame(loop);
    const now = ts / 1000;
    const dt = last == null ? 0 : Math.max(0, Math.min(0.05, now - last));
    last = now;
    timeLeft -= dt;
    charge = tapTick(charge, dt, drain);
    if (fill) fill.style.width = (charge * 100) + '%';
    if (peakEl) peakEl.style.left = (peak * 100) + '%';
    if (timeEl) timeEl.textContent = Math.max(0, timeLeft).toFixed(1) + 's';
    if (timeBar) timeBar.style.width = Math.max(0, (timeLeft / duration) * 100) + '%';
    if (timeLeft <= 0) finish();
  }
  rafId = requestAnimationFrame(loop);
}


/*  Type game (crunch commits)  type dev commands fast, funny git log scrolls  */
const TYPE_COMMANDS = ['git push --force', 'rm -rf node_modules', 'npm run build', 'docker compose up', 'git commit -am wip', 'kubectl apply yolo', 'chmod 777 prod', 'git blame greg', 'sudo make build', 'git rebase main', 'npm install vibes', 'deploy on friday', 'git stash pop', 'restart the server', 'git merge no-ff', 'ship the thing'];
const GIT_MSGS = ['fix: works on my machine now', 'refactor: deleted the failing tests', 'feat: shipped it, will regret later', 'fix: undo the previous fix', 'chore: blame the intern', 'hotfix: prod is probably fine', 'feat: added more buttons', 'fix: it was DNS, it is always DNS', 'wip: do not deploy (deployed)', 'fix: removed the off switch', 'perf: feels faster, trust me', 'fix: turned the bug into a feature', 'revert: revert the revert', 'feat: 0 to 1 (the 1 is hope)', 'style: aligned one pixel for 3 hours', 'fix: pushed straight to main, sorry'];
const GIT_BRANCH = ['main', 'hotfix', 'wip', 'feature/yolo', 'release', 'patch-1'];
function gitHash() { return Math.random().toString(16).slice(2, 8); }

/** True when typed input matches the target command (trim + case-insensitive). Exported for tests. */
export function _typeMatch(input, target) { return String(input).trim().toLowerCase() === String(target).trim().toLowerCase(); }

export function openTypeGame(cfg = {}, onFinish = () => {}, onCancel = null) {
  const color = cfg.color || '#19C37D';
  const title = cfg.title || 'Crunch Commits';
  const duration = cfg.duration || 12;
  const target = cfg.target || 7;
  const commands = cfg.commands || TYPE_COMMANDS;
  const logs = cfg.logs || GIT_MSGS;
  const makeLog = cfg.logMaker || ((m) => `[${rand(GIT_BRANCH)} ${gitHash()}] ${m}`);
  const note = cfg.note || 'Type each command and hit Enter fast. Ship as many commits as you can before the build breaks.';
  const prompt = cfg.prompt || '$';
  const unit = cfg.unit || 'commits shipped';
  const placeholder = cfg.placeholder || 'type it here...';
  if (!hasDOM) { onFinish(0.6); return; }
  const modal = freshModal('minigame-type-modal');
  let timeLeft = duration, done = 0, over = false, rafId = null, last = null, current = '';
  const logLines = [];

  const keyHandler = (e) => { if (e.code === 'Escape') cancel(); };
  window.addEventListener('keydown', keyHandler);
  function cleanup() { over = true; if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('keydown', keyHandler); }
  function finish() { if (over) return; cleanup(); modal.remove(); onFinish(Math.max(0, Math.min(1, done / target))); }
  function cancel() { if (over) return; cleanup(); modal.remove(); if (onCancel) onCancel(); }
  function nextCommand() { current = rand(commands); }
  function commitLine() { logLines.unshift(makeLog(rand(logs))); if (logLines.length > 7) logLines.pop(); }
  const termHTML = () => logLines.map(l => `<div class="type-log">${l}</div>`).join('') || `<div class="type-log dim">${prompt} awaiting input...</div>`;

  modal.innerHTML = `<div class="modal-content type-content" style="--tg:${color}">
    <div class="bs-head"><h2>${title}</h2><div class="bs-round" id="ty-time">${duration.toFixed(1)}s</div></div>
    <p class="modal-note">${note}</p>
    <div class="type-term" id="ty-term">${termHTML()}</div>
    <div class="type-cmd">${prompt} <b id="ty-cmd">${current}</b></div>
    <input id="ty-in" class="type-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${placeholder}" />
    <div class="tap-timebar"><i id="ty-bar"></i></div>
    <div class="type-count"><b id="ty-done">0</b> ${unit}</div>
  </div>`;
  nextCommand();
  const cmdEl = modal.querySelector('#ty-cmd'); if (cmdEl) cmdEl.textContent = current;
  const inp = modal.querySelector('#ty-in');
  if (inp) {
    inp.addEventListener('input', () => {
      if (_typeMatch(inp.value, current)) {
        done++; commitLine(); nextCommand(); inp.value = '';
        const c = modal.querySelector('#ty-cmd'); if (c) c.textContent = current;
        const t = modal.querySelector('#ty-term'); if (t) t.innerHTML = termHTML();
        const d = modal.querySelector('#ty-done'); if (d) d.textContent = done;
        const card = modal.querySelector('.type-content'); if (card) { card.classList.remove('bs-flash'); void card.offsetWidth; card.classList.add('bs-flash'); }
      }
    });
    setTimeout(() => inp.focus(), 30);
  }
  function loop(ts) {
    if (over) return;
    rafId = requestAnimationFrame(loop);
    const now = ts / 1000; const dt = last == null ? 0 : Math.max(0, Math.min(0.05, now - last)); last = now;
    timeLeft -= dt;
    const tb = modal.querySelector('#ty-bar'); if (tb) tb.style.width = Math.max(0, (timeLeft / duration) * 100) + '%';
    const tt = modal.querySelector('#ty-time'); if (tt) tt.textContent = Math.max(0, timeLeft).toFixed(1) + 's';
    if (timeLeft <= 0) finish();
  }
  rafId = requestAnimationFrame(loop);
}

/*  Click Rush  agility clicking; targets pop up, smash them fast.
    Keeps the scrolling log (git commits for sprints, apologies for PR).  */
export function openClickRush(cfg = {}, onFinish = () => {}, onCancel = null) {
  const color = cfg.color || '#19C37D';
  const title = cfg.title || 'Click Rush';
  const duration = cfg.duration || 9;
  const target = cfg.targetHits || 12;
  const logs = cfg.logs || GIT_MSGS;
  const makeLog = cfg.logMaker || ((m) => `[${rand(GIT_BRANCH)} ${gitHash()}] ${m}`);
  const note = cfg.note || 'Smash each target as fast as you can.';
  const unit = cfg.unit || 'shipped';
  const life = cfg.life || 1.05;
  if (!hasDOM) { onFinish(0.6); return; }
  const modal = freshModal('minigame-click-modal');
  let timeLeft = duration, hits = 0, over = false, rafId = null, last = null, spawnT = 0, active = null;
  const logLines = [];

  const keyHandler = (e) => { if (e.code === 'Escape') cancel(); };
  window.addEventListener('keydown', keyHandler);
  function cleanup() { over = true; if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('keydown', keyHandler); if (active && active._die) clearTimeout(active._die); }
  function finish() { if (over) return; cleanup(); modal.remove(); onFinish(Math.max(0, Math.min(1, hits / target))); }
  function cancel() { if (over) return; cleanup(); modal.remove(); if (onCancel) onCancel(); }
  const termHTML = () => logLines.map(l => `<div class="type-log">${l}</div>`).join('') || `<div class="type-log dim">awaiting carnage...</div>`;

  modal.innerHTML = `<div class="modal-content click-content" style="--tg:${color}">
    <div class="bs-head"><h2>${title}</h2><div class="bs-round" id="cr-time">${duration.toFixed(1)}s</div></div>
    <p class="modal-note">${note}</p>
    <div class="type-term" id="cr-term">${termHTML()}</div>
    <div class="click-area" id="cr-area"></div>
    <div class="tap-timebar"><i id="cr-bar"></i></div>
    <div class="type-count"><b id="cr-hits">0</b> ${unit}</div>
  </div>`;
  const area = modal.querySelector('#cr-area');

  function hit(t) {
    if (over) return;
    if (t._die) clearTimeout(t._die);
    t.remove(); if (active === t) active = null;
    hits++; logLines.unshift(makeLog(rand(logs))); if (logLines.length > 7) logLines.pop();
    const term = modal.querySelector('#cr-term'); if (term) term.innerHTML = termHTML();
    const hc = modal.querySelector('#cr-hits'); if (hc) hc.textContent = hits;
  }
  function spawn() {
    if (!area || active) return;
    const t = document.createElement('button');
    t.type = 'button'; t.className = 'click-target'; t.style.setProperty('--tc', color);
    t.style.left = (8 + Math.random() * 80) + '%';
    t.style.top  = (10 + Math.random() * 74) + '%';
    t.addEventListener('click', (e) => { e.stopPropagation(); hit(t); });
    area.appendChild(t); active = t;
    t._die = setTimeout(() => { if (t.parentNode) t.remove(); if (active === t) active = null; }, life * 1000);
  }
  function loop(ts) {
    if (over) return;
    rafId = requestAnimationFrame(loop);
    const now = ts / 1000; const dt = last == null ? 0 : Math.max(0, Math.min(0.05, now - last)); last = now;
    timeLeft -= dt; spawnT -= dt;
    if (!active && spawnT <= 0) { spawn(); spawnT = 0.30 + Math.random() * 0.30; }
    const tb = modal.querySelector('#cr-bar'); if (tb) tb.style.width = Math.max(0, (timeLeft / duration) * 100) + '%';
    const tt = modal.querySelector('#cr-time'); if (tt) tt.textContent = Math.max(0, timeLeft).toFixed(1) + 's';
    if (timeLeft <= 0) finish();
  }
  rafId = requestAnimationFrame(loop);
}
