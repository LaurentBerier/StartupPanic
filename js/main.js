/**
 * main.js — Entry point for AI Startup Panic Simulator (Tycoon Edition).
 *
 * Bootstraps:
 *  1. Loading screen
 *  2. Three.js scene, renderer, camera
 *  3. All game objects (diorama, furniture, mercury AI, pitch room, showcase)
 *  4. Game state and logic (cash economy, hiring, products, funding rounds)
 *  5. HUD and UI layer (build/hire/develop/pitch modals)
 *  6. Camera controls
 *  7. Input / raycasting for fire clicking
 *  8. Main game loop (requestAnimationFrame)
 *  9. Menu navigation + state machine
 */

import { initScene, getScene, getCamera, getRenderer, addFireLight, removeFireLight, updateFireLights, renderFrame } from './scene.js';
import {
  OfficePlatform, OfficeFurniture, MercuryAICore, ServerFire, HypeConfetti,
  DeskStation, ProductShowcase, PitchRoom,
} from './gameObjects.js';
import {
  GameState, updateGame, CONFIG, fmtMoney,
  actionLaunchFeature, actionDeliverPitch, actionCaffeinate, actionPivot, actionExtinguishFire,
  actionBuildDesk, actionBuyComputer, actionHireCandidate, actionStartProduct,
} from './gameLogic.js';
import {
  showScreen, hideScreen, initHUD, showHUD, hideHUD, updateHUD,
  initEmployeeBar, updateEmployeeBar,
  addEventCard, updateEventTimer, removeEventCard, clearAllEventCards,
  showToast, openPitchModal, openHireModal, openBuildModal, openDevelopModal,
  startLoading, updateLoadingProgress, finishLoading,
  showGameOverStats, showWinStats,
} from './ui.js';
import { CameraControls } from './cameraControls.js';
import { updateTweens, Spring } from './tween.js';
import { VoidParticles, createVoidGrid, createAmbientOrbs, DataStreams } from './environment.js';

// THREE is loaded globally via <script src="js/lib/three.min.js">
const THREE = window.THREE;

// ─── Global references ────────────────────────────────────────────────────────
let scene, camera, renderer;
let controls;
let state;
let mercury;
let furniture;
let pitchRoom;
let showcase;
let voidParticles, dataStreams;
let confettiList = [];
let activeFireObjects = new Map(); // fireId -> { fireObj, light }
let deskStations = new Map();      // deskId -> DeskStation

// Springs for mercury reactions
const mercuryStressSpring = new Spring({ stiffness: 150, damping: 20, target: 0 });

// ─── Game Loop State ──────────────────────────────────────────────────────────
let lastTime    = 0;
let isRunning   = false;
let animFrameId = null;

// ═══════════════════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════
async function init() {
  startLoading();

  updateLoadingProgress(10);
  await delay(200);

  // ── Three.js Scene ──
  const canvas = document.getElementById('game-canvas');
  const setup  = initScene(canvas);
  scene    = setup.scene;
  camera   = setup.camera;
  renderer = setup.renderer;

  // Expose scene globally for gameLogic fire extinguish
  window._gameScene = scene;

  updateLoadingProgress(30);
  await delay(150);

  // ── Build Scene Objects ──
  const platform = new OfficePlatform();
  platform.addToScene(scene);

  updateLoadingProgress(45);
  await delay(150);

  furniture = new OfficeFurniture();
  furniture.addToScene(scene);

  mercury = new MercuryAICore();
  mercury.addToScene(scene);

  updateLoadingProgress(60);
  await delay(100);

  // ── Tycoon Objects ──
  pitchRoom = new PitchRoom();
  pitchRoom.addToScene(scene);

  showcase = new ProductShowcase();
  showcase.addToScene(scene);

  // ── Environment Elements ──
  voidParticles = new VoidParticles();
  voidParticles.addToScene(scene);

  dataStreams = new DataStreams();
  dataStreams.addToScene(scene);

  scene.add(createVoidGrid());
  scene.add(createAmbientOrbs());

  updateLoadingProgress(80);
  await delay(100);

  // ── Camera Controls ──
  controls = new CameraControls(camera, canvas);

  // ── HUD Setup ──
  initHUD();

  // ── Raycasting for fire clicks ──
  canvas.addEventListener('click', onCanvasClick);

  updateLoadingProgress(100);

  finishLoading(() => {
    showScreen('main-menu');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GAME SESSION START / STOP
// ═══════════════════════════════════════════════════════════════════════════════
function startGame() {
  // Clean up dynamic objects from previous sessions
  deskStations.forEach(station => scene.remove(station.root));
  deskStations.clear();

  showcase.reset();
  pitchRoom.hideVCs();

  confettiList.forEach(c => scene.remove(c.root));
  confettiList = [];

  activeFireObjects.forEach(({ fireObj, light }) => {
    fireObj.extinguish(scene);
    removeFireLight(light);
  });
  activeFireObjects.clear();
  clearAllEventCards();

  // Reset game state
  state = new GameState();
  window._gameState = state; // debug access

  // Spawn starting desks + co-founder
  for (const desk of state.desks) createDeskStation(desk);
  for (const emp of state.employees) {
    const station = deskStations.get(emp.deskId);
    if (station) station.setEmployee(emp.colorIdx);
  }

  // Init UI
  initEmployeeBar(state.employees);
  showHUD();
  mercury.setHype(state.hype / CONFIG.HYPE_MAX);

  // Hide menu/over screens
  hideScreen('main-menu');
  hideScreen('game-over-screen');
  hideScreen('win-screen');
  hideScreen('pause-screen');
  hideScreen('loading-screen');

  document.getElementById('game-canvas').style.display = 'block';

  // Wire action buttons
  document.getElementById('btn-build').onclick          = handleOpenBuildModal;
  document.getElementById('btn-hire').onclick           = handleOpenHireModal;
  document.getElementById('btn-develop').onclick        = handleOpenDevelopModal;
  document.getElementById('btn-launch-feature').onclick = handleLaunchFeature;
  document.getElementById('btn-vc-pitch').onclick       = handleOpenPitchModal;
  document.getElementById('btn-caffeinate').onclick     = handleCaffeinate;
  document.getElementById('btn-pivot').onclick          = handlePivot;
  document.getElementById('btn-pause').onclick          = pauseGame;

  isRunning   = true;
  lastTime    = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);

  showToast('Day 1: two desks, one co-founder, infinite ambition.', 'info', 4000);
}

function stopGame() {
  isRunning = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = null;
}

function createDeskStation(desk) {
  const station = new DeskStation(desk.slot, desk.hasComputer);
  station.addToScene(scene);
  deskStations.set(desk.id, station);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN GAME LOOP
// ═══════════════════════════════════════════════════════════════════════════════
function gameLoop(timestamp) {
  if (!isRunning) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap at 100ms
  lastTime = timestamp;

  if (!state.paused) {
    // ── Game Logic Update ──
    const events = updateGame(state, dt);
    processGameEvents(events);

    // ── 3D Object Updates ──
    const t = timestamp / 1000;

    // Mercury AI reacts to hype and dwindling cash
    const stressLevel = Math.min(1, Math.max(0, 1 - state.cash / CONFIG.STARTING_CASH));
    mercuryStressSpring.target = stressLevel;
    mercuryStressSpring.update(dt);

    mercury.setHype(state.hype / CONFIG.HYPE_MAX);
    mercury.setStress(mercuryStressSpring.value);
    mercury.update(dt, t);

    // Furniture monitor animations
    furniture.updateMonitors(t);

    // Environment
    if (voidParticles) voidParticles.update(t);
    if (dataStreams)   dataStreams.update(t);

    // Desk stations + employee characters
    state.employees.forEach(emp => {
      const station = deskStations.get(emp.deskId);
      if (station) station.setEnergy(emp.energy, emp.burnedOut);
    });
    let seed = 0;
    deskStations.forEach(station => station.update(t, seed++));

    // Tycoon objects
    showcase.update(t);
    pitchRoom.update(t);

    // Fire particle updates
    activeFireObjects.forEach(({ fireObj }) => {
      fireObj.update(dt, t);
    });

    // Confetti updates
    confettiList = confettiList.filter(c => {
      c.update(dt);
      return !c.done;
    });

    // Fire lights flicker
    updateFireLights(t);

    // ── Event Card Timer Updates ──
    for (const fire of state.fires) {
      updateEventTimer(`fire-${fire.id}`, fire.timer, CONFIG.FIRE_DURATION);
    }
    for (const pr of state.prDisasters) {
      updateEventTimer(`pr-${pr.id}`, pr.timer, pr.maxTimer);
    }

    // ── HUD Update ──
    updateHUD(state);
    updateEmployeeBar(state.employees);

    // ── Camera Controls ──
    controls.update(dt);

    // ── Tweens ──
    updateTweens(dt);
  }

  // Render every frame regardless of pause
  renderFrame();

  animFrameId = requestAnimationFrame(gameLoop);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GAME EVENT PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════
function processGameEvents(events) {
  for (const ev of events) {
    switch (ev.type) {

      case 'spawn_fire': {
        spawnFire();
        break;
      }

      case 'fire_damage': {
        removeFireFromScene(ev.fire);
        removeEventCard(`fire-${ev.fire.id}`);
        showToast(`Server rack burned! -${fmtMoney(ev.penalty)}`, 'error', 3500);
        mercury.contract();
        break;
      }

      case 'spawn_pr': {
        const pr = ev.pr;
        addEventCard(`pr-${pr.id}`, 'pr', `⚠ ${pr.title}`, pr.desc);
        showToast(`PR DISASTER: ${pr.title}`, 'error', 4000);
        mercury.contract();
        break;
      }

      case 'pr_resolved': {
        removeEventCard(`pr-${ev.pr.id}`);
        showToast(`PR disaster faded: ${ev.pr.title}`, 'info', 2000);
        break;
      }

      case 'burnout': {
        showToast(`${ev.employee.name} burned out! Caffeinate!`, 'warning', 3000);
        break;
      }

      case 'quirk': {
        showToast(ev.text, ev.tone || 'info', 4000);
        break;
      }

      case 'product_shipped': {
        const idea = ev.product.idea;
        showcase.addProduct(ev.product.shelfIdx);
        showToast(`📦 SHIPPED: ${idea.name}! +${fmtMoney(idea.mrr)}/s MRR, +${idea.hype} Hype`, 'success', 5000);
        mercury.surge();
        spawnConfetti(new THREE.Vector3(2.6, 1.4, -3.2));
        break;
      }

      case 'game_over': {
        stopGame();
        onGameOver();
        break;
      }
    }
  }
}

// ─── Spawn a Server Fire ──────────────────────────────────────────────────────
function spawnFire() {
  const rackPositions = [
    new THREE.Vector3(-3.5, 0.2, -2.5),
    new THREE.Vector3( 3.5, 0.2, -2.5),
  ];
  const pos = rackPositions[Math.floor(Math.random() * rackPositions.length)].clone();

  // Don't stack fires on same spot
  const existingFires = [...activeFireObjects.values()];
  const tooClose = existingFires.some(({ fireObj }) =>
    fireObj.position3d.distanceTo(pos) < 1.5
  );
  if (tooClose && existingFires.length > 0) return;

  const fireId = state.nextEventId();
  const fireData = {
    id:         fireId,
    timer:      CONFIG.FIRE_DURATION,
    maxTimer:   CONFIG.FIRE_DURATION,
    fireObject: null,
  };
  state.fires.push(fireData);

  const fireObj = new ServerFire(pos);
  fireObj.addToScene(scene);
  fireData.fireObject = fireObj;

  const light = addFireLight(pos);
  activeFireObjects.set(fireId, { fireObj, light, fireData });

  addEventCard(`fire-${fireId}`, 'fire', '🔥 SERVER MELTDOWN', `Click it or lose ${fmtMoney(CONFIG.FIRE_CASH_DAMAGE)}!`);
  showToast('ALERT: Server meltdown! Click to extinguish!', 'error', 3000);
}

// ─── Remove fire from scene (after extinguish or damage) ─────────────────────
function removeFireFromScene(fireData) {
  const entry = activeFireObjects.get(fireData.id);
  if (!entry) return;

  const { fireObj, light } = entry;
  fireObj.extinguish(scene);
  removeFireLight(light);
  activeFireObjects.delete(fireData.id);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PLAYER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function handleLaunchFeature() {
  const result = actionLaunchFeature(state);
  if (!result.success) {
    showToast(result.reason || 'Cannot launch now.', 'warning');
    return;
  }

  showToast(`🚀 LAUNCHED: ${result.announcement.substring(0, 60)}...`, 'success', 5000);
  showToast(`+${result.hypeGained} HYPE`, 'info', 2000);
  mercury.surge();
  spawnConfetti(mercury.root.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
}

// ─── Build Modal ──────────────────────────────────────────────────────────────
function handleOpenBuildModal() {
  if (state.gameOver || state.won) return;
  state.paused = true;

  openBuildModal(state,
    (kind) => {
      state.paused = false;
      if (kind === 'desk') {
        const result = actionBuildDesk(state);
        if (!result.success) {
          showToast(result.reason, 'warning');
          return;
        }
        createDeskStation(result.desk);
        showToast(`🪑 Desk installed! Slot ${result.desk.slot + 1}/${CONFIG.DESK_SLOTS}.`, 'success', 3000);
      } else {
        const result = actionBuyComputer(state);
        if (!result.success) {
          showToast(result.reason, 'warning');
          return;
        }
        const station = deskStations.get(result.desk.id);
        if (station) station.addComputer();
        showToast('🖥 Computer installed. Productivity restored.', 'success', 3000);
      }
    },
    () => { state.paused = false; }
  );
}

// ─── Hire Modal ───────────────────────────────────────────────────────────────
function handleOpenHireModal() {
  if (state.gameOver || state.won) return;
  state.paused = true;

  openHireModal(state,
    (candidate) => {
      state.paused = false;
      const result = actionHireCandidate(state, candidate);
      if (!result.success) {
        showToast(result.reason, 'warning');
        return;
      }
      const station = deskStations.get(result.desk.id);
      if (station) station.setEmployee(result.employee.colorIdx);
      initEmployeeBar(state.employees);
      showToast(`🎉 Hired ${result.employee.name}! Salary ${fmtMoney(result.employee.salary)}/s.`, 'success', 4000);
      mercury.surge();
    },
    () => { state.paused = false; }
  );
}

// ─── Develop Modal ────────────────────────────────────────────────────────────
function handleOpenDevelopModal() {
  if (state.gameOver || state.won) return;
  state.paused = true;

  openDevelopModal(state,
    (idea) => {
      state.paused = false;
      const result = actionStartProduct(state, idea);
      if (!result.success) {
        showToast(result.reason, 'warning');
        return;
      }
      showToast(`🛠 Development started: ${idea.name}`, 'info', 3500);
    },
    () => { state.paused = false; }
  );
}

// ─── Pitch Modal ──────────────────────────────────────────────────────────────
function handleOpenPitchModal() {
  if (state.cooldowns.pitch > 0) {
    showToast(`Pitch cooldown: ${state.cooldowns.pitch.toFixed(1)}s`, 'warning');
    return;
  }
  if (state.gameOver || state.won) return;

  state.paused = true;
  pitchRoom.showVCs();

  openPitchModal(state,
    (selectedWords) => {
      state.paused = false;
      pitchRoom.hideVCs();

      const result = actionDeliverPitch(state, selectedWords);
      if (!result.success) {
        showToast(result.reason || 'Pitch failed.', 'error');
        return;
      }

      if (result.closed) {
        showToast(`💰 ${result.round.name} CLOSED! Raised ${fmtMoney(result.raised)}!`, 'success', 5000);
        mercury.surge();
        spawnConfetti(pitchRoom.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
        spawnConfetti(mercury.root.position.clone().add(new THREE.Vector3(0, 0.5, 0)));

        if (result.won) {
          stopGame();
          onWin();
        }
      } else {
        showToast(`VCs passed: ${result.reason}`, 'warning', 4500);
        if (result.raised > 0) {
          showToast(`They left ${fmtMoney(result.raised)} as a "bridge". Ouch.`, 'info', 3500);
        }
      }
    },
    () => {
      state.paused = false;
      pitchRoom.hideVCs();
    }
  );
}

function handleCaffeinate() {
  const result = actionCaffeinate(state);
  if (!result.success) {
    showToast(result.reason || 'Nothing to caffeinate.', 'warning');
    return;
  }
  if (result.restoredCount === 0) {
    showToast('All employees still sharp.', 'info');
    return;
  }
  showToast(`☕ Coffee run! ${result.restoredCount} employee(s) recharged. -${fmtMoney(CONFIG.CAFFEINE_COST)}`, 'success', 2500);
}

function handlePivot() {
  const result = actionPivot(state);
  if (!result.success) {
    showToast(result.reason || 'Cannot pivot now.', 'warning');
    return;
  }
  showToast(`↻ PIVOTED! Cleared ${result.cleared} PR disaster(s). -${fmtMoney(result.cost)}`, 'warning', 4000);

  // Remove all PR event cards; re-add active fire cards
  clearAllEventCards();
  state.fires.forEach(fire => addEventCard(`fire-${fire.id}`, 'fire', '🔥 SERVER MELTDOWN', `Click it or lose ${fmtMoney(CONFIG.FIRE_CASH_DAMAGE)}!`));

  mercury.surge();
}

// ─── Raycasting: Click to Extinguish Fires ────────────────────────────────────
function onCanvasClick(event) {
  if (!state || state.paused || state.gameOver || state.won) return;

  const canvas = document.getElementById('game-canvas');
  const rect   = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const raycaster = controls.getPickRay(x, y);

  const hitboxes = [];
  activeFireObjects.forEach(({ fireObj }) => {
    if (fireObj.hitbox) hitboxes.push(fireObj.hitbox);
  });

  if (hitboxes.length === 0) return;

  const hits = raycaster.intersectObjects(hitboxes, false);
  if (hits.length === 0) return;

  const hit  = hits[0].object;
  const fire = hit.userData.fire;
  if (!fire) return;

  const fireStateEntry = state.fires.find(f => f.fireObject === fire);
  if (!fireStateEntry) return;

  const result = actionExtinguishFire(state, fireStateEntry.id);
  if (result.success) {
    removeFireFromScene(fireStateEntry);
    removeEventCard(`fire-${fireStateEntry.id}`);
    showToast(`🧯 Fire extinguished! +${result.hypeBonus} HYPE`, 'success', 2500);
    mercury.surge();
  }
}

// ─── Confetti Burst ───────────────────────────────────────────────────────────
function spawnConfetti(origin) {
  const c = new HypeConfetti(origin, scene);
  confettiList.push(c);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAUSE
// ═══════════════════════════════════════════════════════════════════════════════
function pauseGame() {
  state.paused = true;
  document.getElementById('pause-screen').classList.remove('hidden');
  document.getElementById('pause-screen').classList.add('active');
}

function resumeGame() {
  state.paused = false;
  document.getElementById('pause-screen').classList.remove('active');
  document.getElementById('pause-screen').classList.add('hidden');
  lastTime = performance.now(); // Reset dt to avoid jump
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GAME OVER / WIN
// ═══════════════════════════════════════════════════════════════════════════════
function onGameOver() {
  hideHUD();
  showGameOverStats(state);
  showScreen('game-over-screen');
  mercury.setStress(1);
  mercury.setHype(0);
}

function onWin() {
  hideHUD();
  showWinStats(state);
  showScreen('win-screen');
  mercury.surge();
  spawnConfetti(mercury.root.position.clone());
  spawnConfetti(mercury.root.position.clone().add(new THREE.Vector3(-1, 0.5, 0)));
  spawnConfetti(mercury.root.position.clone().add(new THREE.Vector3( 1, 0.5, 0)));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MENU NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════
function setupMenuNavigation() {
  document.getElementById('btn-start').onclick = () => {
    startGame();
  };

  document.getElementById('btn-how-to-play').onclick = () => {
    showScreen('how-to-play-screen');
  };

  document.getElementById('btn-back-to-menu').onclick = () => {
    showScreen('main-menu');
  };

  document.getElementById('btn-resume').onclick = () => {
    resumeGame();
  };

  document.getElementById('btn-quit-to-menu').onclick = () => {
    stopGame();
    hideHUD();
    clearAllEventCards();
    showScreen('main-menu');
  };

  document.getElementById('btn-restart').onclick = () => {
    hideScreen('game-over-screen');
    startGame();
  };

  document.getElementById('btn-go-home').onclick = () => {
    showScreen('main-menu');
  };

  document.getElementById('btn-play-again').onclick = () => {
    hideScreen('win-screen');
    startGame();
  };

  document.getElementById('btn-win-home').onclick = () => {
    showScreen('main-menu');
  };

  // Escape key toggles pause
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && state && isRunning) {
      if (state.paused) resumeGame();
      else pauseGame();
    }
  });
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── THREE availability check (loaded globally) ───────────────────────────────
if (typeof window.THREE === 'undefined') {
  console.error('Three.js not loaded! Check js/lib/three.min.js');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  setupMenuNavigation();
  init().catch(err => {
    console.error('Init failed:', err);
    document.getElementById('loading-status').textContent = 'Initialization failed. Check console.';
    document.getElementById('loading-status').style.color = '#FF4C4C';
  });
});
