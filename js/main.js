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
  DeskStation, ProductShowcase, PitchRoom, buildFacility, EmployeeCharacter, CHARACTER_PALETTE, makeCompanySign,
  makeDeskMarker, DESK_SLOT_POSITIONS, SteamPuff,
} from './gameObjects.js';
import {
  GameState, updateGame, CONFIG, fmtMoney, FACILITIES,
  actionLaunchProduct, actionDeliverPitch, actionCaffeinate, actionPivot, actionExtinguishFire,
  actionBuildDesk, actionBuyComputer, actionHireCandidate, actionStartProduct,
  actionBuyFacility, actionUpgradeFacility, actionResearch, actionBuyServer, actionExpandOffice, getModifiers,
  actionTakeLoan, actionAcceptPeddler,
} from './gameLogic.js';
import {
  showScreen, hideScreen, initHUD, showHUD, hideHUD, updateHUD,
  initEmployeeBar, updateEmployeeBar,
  addEventCard, updateEventTimer, removeEventCard, clearAllEventCards,
  showToast, showAlert, clearAlert, openPitchModal, openHireModal, openBuildModal, openDevelopModal, openResearchModal, openLaunchModal,
  openLoanModal, openPeddlerModal,
  startLoading, updateLoadingProgress, finishLoading,
} from './ui.js';
import { CameraControls } from './cameraControls.js';
import { updateTweens, Spring } from './tween.js';
import { VoidParticles, createVoidGrid, createAmbientOrbs, DataStreams } from './environment.js';
import {
  genCompanyIdentity, founderTweet, showTweetPopup,
  disasterHeadline, showChyron, renderEndingScreen, pushFeedItem,
} from './viral.js';

// THREE is loaded globally via <script src="js/lib/three.min.js">
const THREE = window.THREE;

// Horizontal floor plane (y=0) for click-to-move / placement raycasting
const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const OFFICE_BOUNDS = { minX: -4.5, maxX: 4.5, minZ: -3.5, maxZ: 3.5 };
// The founder's seat (in front of desk slot 0) — sit here to develop / work
const FOUNDER_SIT = { x: DESK_SLOT_POSITIONS[0].x, z: DESK_SLOT_POSITIONS[0].z + 0.55 };
const _tmpTarget = new THREE.Vector3();

// ─── Global references ────────────────────────────────────────────────────────
let scene, camera, renderer;
let controls;
let state;
let mercury;
let furniture;
let pitchRoom;
let showcase;
let platform;
let companySign = null;
let voidParticles, dataStreams;
let confettiList = [];
let activeFireObjects = new Map(); // fireId -> { fireObj, light }
let deskStations = new Map();      // deskId -> DeskStation
let facilityObjects = new Map();   // facilityId -> THREE.Group
let player = null;                 // the founder avatar (walkable)
let deskMarker = null;             // "sit here" marker at the founder's desk
let firstSitDone = false;          // pop the develop prompt the first time you sit
let placing = null;                // { id, ghost } during facility placement
let roamers = [];                  // employees temporarily walking to a room
let breakTimer = 14;               // seconds until the next coffee/break run
let fireAlertUp = false;           // is the sticky "server on fire" alert showing
let feedTimer = 2;                 // seconds until the next social/news feed item
let pointerDownPos = null;         // for distinguishing a click from a camera drag

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
  platform = new OfficePlatform();
  platform.addToScene(scene);
  window._platform = platform; // debug access

  updateLoadingProgress(45);
  await delay(150);

  furniture = new OfficeFurniture();
  furniture.addToScene(scene);

  mercury = new MercuryAICore();
  // Central "blob" removed from the scene by request — the object is kept so
  // its setHype/surge/contract calls elsewhere remain safe no-ops.

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

  // ── Raycasting for fire clicks / click-to-move / placement ──
  canvas.addEventListener('mousedown', (e) => { pointerDownPos = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('mousemove', onCanvasMouseMove);

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

  facilityObjects.forEach(obj => scene.remove(obj));
  facilityObjects.clear();

  if (player) { scene.remove(player.root); player = null; }
  if (deskMarker) { scene.remove(deskMarker); deskMarker = null; }
  roamers.forEach(r => scene.remove(r.char.root));
  roamers = [];
  breakTimer = 14;
  firstSitDone = false;
  cancelPlacement();

  // Restore both server racks to operational (visuals persist across runs)
  for (let i = 0; i < CONFIG.NUM_RACKS; i++) furniture.setRackDown(i, false);

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

  // Company identity — use the name the player typed (or a suggestion)
  const id = genCompanyIdentity();
  const nameInput = document.getElementById('company-name-input');
  const chosen = nameInput && nameInput.value.trim();
  state.companyName   = chosen || id.name;
  state.companyPitch  = id.pitch;
  state.founderHandle = state.companyName.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 14) + '_ceo';
  state.peakValuation = 0;

  // Company-name sign (hand-drawn in the garage) + reset office look to the garage
  if (companySign) { scene.remove(companySign); companySign = null; }
  companySign = makeCompanySign(state.companyName, state.officeTier);
  scene.add(companySign);
  platform.setTier(state.officeTier);

  // "Sit here" marker at the founder's desk
  deskMarker = makeDeskMarker();
  deskMarker.position.set(FOUNDER_SIT.x, 0, FOUNDER_SIT.z);
  scene.add(deskMarker);

  // Spawn starting desks + co-founder
  for (const desk of state.desks) createDeskStation(desk);
  for (const emp of state.employees) {
    const station = deskStations.get(emp.deskId);
    if (station) station.setEmployee(emp.colorIdx);
  }

  // Spawn the founder avatar (the walkable "you" — gold, with a plumbob)
  player = new EmployeeCharacter({ color: 0xFFD54A, walker: true });
  player.setBasePosition(0, 0.22, 0.6); // start standing in the middle — walk to your chair
  scene.add(player.root);
  window._player = player; // debug access

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
  document.getElementById('btn-research').onclick       = handleOpenResearchModal;
  document.getElementById('btn-launch-product').onclick = handleOpenLaunchModal;
  document.getElementById('btn-vc-pitch').onclick       = handleOpenPitchModal;
  document.getElementById('btn-caffeinate').onclick     = handleCaffeinate;
  document.getElementById('btn-pivot').onclick          = handlePivot;
  document.getElementById('btn-loan').onclick           = handleOpenLoanModal;
  document.getElementById('btn-pause').onclick          = pauseGame;

  // Reset & seed the live feed; clear any sticky fire alert
  fireAlertUp = false; feedTimer = 2; clearAlert();
  const feedEl = document.getElementById('social-feed');
  if (feedEl) { feedEl.innerHTML = ''; for (let i = 0; i < 4; i++) pushFeedItem(state); }

  isRunning   = true;
  lastTime    = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);

  showToast(`Founded ${state.companyName}: ${state.companyPitch}`, 'info', 5000);
  showTweetPopup(state, founderTweet(state, 'found'));
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

    // Player avatar: collision obstacles, walk, animate, desk detection
    if (player) {
      player.obstacles = getObstacles();
      player.updateWalk(dt);
      player.update(t, 99);
      const d = Math.hypot(player.root.position.x - FOUNDER_SIT.x, player.root.position.z - FOUNDER_SIT.z);
      state.founderAtDesk = d < 0.85;
      // First time you settle at your desk → prompt to develop your first product
      if (state.founderAtDesk && !firstSitDone && state.time > 0.6) {
        firstSitDone = true;
        showToast('🪑 Settled in. Time to build something gloriously absurd.', 'info', 3000);
        openDevelopFlow();
      }
      if (deskMarker) {
        deskMarker.userData.arrow.visible = !state.founderAtDesk;
        deskMarker.userData.arrow.position.y = 0.95 + Math.sin(t * 3) * 0.08;
        deskMarker.userData.ring.material.emissiveIntensity = state.founderAtDesk ? 0.35 : 0.7 + Math.sin(t * 4) * 0.4;
      }
    }

    // Ambient life: employees taking breaks in rooms
    breakTimer -= dt;
    if (breakTimer <= 0) { breakTimer = 10 + Math.random() * 9; maybeStartBreak(); }
    updateRoamers(dt, t);

    // Persistent "server on fire" alert — stays up until every fire is out
    const burning = state.fires.length > 0;
    if (burning && !fireAlertUp) {
      fireAlertUp = true;
      showAlert('A SERVER IS ON FIRE! All work is frozen until it\'s out.', {
        sticky: true, icon: '🔥', header: '🔥 SERVER MELTDOWN',
        hint: '🧯 Click the burning server — you\'ll run over and put it out.',
      });
    } else if (!burning && fireAlertUp) {
      fireAlertUp = false;
      clearAlert();
    }

    // Live social / news feed keeps rolling
    feedTimer -= dt;
    if (feedTimer <= 0) { feedTimer = 2.6 + Math.random() * 2.4; pushFeedItem(state); }

    // Move ghost during placement is handled on mousemove; keep it grounded
    if (placing && placing.ghost) placing.ghost.position.y = 0;

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

    // ── Camera Controls (gently follow the founder with a little lag) ──
    if (player) controls.target.lerp(_tmpTarget.set(player.root.position.x, 0.6, player.root.position.z), 0.045);
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
        if (ev.destroyed) {
          furniture.setRackDown(ev.rackIdx, true);
          showToast(`🔥 Server destroyed! Productivity drops — replace it in CONSTRUCTION (${fmtMoney(CONFIG.SERVER_COST)}).`, 'error', 5500);
        } else {
          showToast('🔥 Fire burned out on an already-dead server.', 'warning', 3500);
        }
        mercury.contract();
        break;
      }

      case 'spawn_pr': {
        const pr = ev.pr;
        addEventCard(`pr-${pr.id}`, 'pr', `⚠ ${pr.title}`, pr.desc);
        showToast(`PR DISASTER: ${pr.title}`, 'error', 4000);
        showChyron(disasterHeadline(state));
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

      case 'product_ready': {
        showToast(`✅ ${ev.product.idea.name} is built — hit LAUNCH PRODUCT to take it live!`, 'success', 5000);
        mercury.surge();
        break;
      }

      case 'peddler': {
        cancelPlacement(); state.paused = true;
        openPeddlerModal(state, ev.deal,
          (deal) => {
            state.paused = false;
            const r = actionAcceptPeddler(state, deal);
            if (r.success) {
              showToast(`🧥 Deal done: +${fmtMoney(deal.cash)}${deal.debt ? `, +${fmtMoney(deal.debt)} debt` : ''}.`, deal.debt ? 'warning' : 'success', 4500);
            }
          },
          () => { state.paused = false; showToast('You wave the peddler off.', 'info', 1800); }
        );
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

  addEventCard(`fire-${fireId}`, 'fire', '🔥 SERVER MELTDOWN', 'Walk over & click it to extinguish!');
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
// ─── Launch Product Modal ───────────────────────────────────────────────────
function handleOpenLaunchModal() {
  if (state.gameOver || state.won) return;
  cancelPlacement(); state.paused = true;

  openLaunchModal(state,
    (index) => {
      state.paused = false;
      const result = actionLaunchProduct(state, index);
      if (!result.success) { showToast(result.reason, 'warning'); return; }
      const p = result.product;
      showcase.addProduct(p.shelfIdx);
      showToast(`🚀 LAUNCHED ${p.idea.name}! ${result.reviewGood ? 'Reviews are glowing.' : 'Reviews are… a learning opportunity.'} +${fmtMoney(p.idea.mrr)}/s MRR, +${result.hypeGained} Hype.`, result.reviewGood ? 'success' : 'warning', 5500);
      showTweetPopup(state, founderTweet(state, 'ship', { product: p.idea.name }));
      mercury.surge();
      spawnConfetti(new THREE.Vector3(2.6, 1.4, -3.2));
    },
    () => { state.paused = false; }
  );
}

// ─── Build Modal ──────────────────────────────────────────────────────────────
function handleOpenBuildModal() {
  if (state.gameOver || state.won) return;
  cancelPlacement(); state.paused = true;

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
        showToast(`🪑 Desk installed! Slot ${result.desk.slot + 1}/${state.deskSlots}.`, 'success', 3000);
      } else if (kind === 'expand') {
        const result = actionExpandOffice(state);
        if (!result.success) { showToast(result.reason, 'warning'); return; }
        platform.setTier(state.officeTier);
        // The sign upgrades from hand-drawn cardboard to a polished logo
        if (companySign) { scene.remove(companySign); }
        companySign = makeCompanySign(state.companyName, state.officeTier);
        scene.add(companySign);
        showToast(`🏗️ Office expanded to ${result.tier.name}! ${result.tier.slots} desk slots now available.`, 'success', 4000);
        mercury.surge();
      } else if (kind === 'computer') {
        const result = actionBuyComputer(state);
        if (!result.success) {
          showToast(result.reason, 'warning');
          return;
        }
        const station = deskStations.get(result.desk.id);
        if (station) station.addComputer();
        showToast('🖥 Computer installed. Productivity restored.', 'success', 3000);
      } else if (kind === 'server') {
        const result = actionBuyServer(state);
        if (!result.success) {
          showToast(result.reason, 'warning');
          return;
        }
        furniture.setRackDown(result.rackIdx, false);
        showToast('🗄️ New server racked & humming. Productivity restored.', 'success', 3500);
        mercury.surge();
      } else if (kind.startsWith('upgrade:')) {
        const id = kind.slice(8);
        const result = actionUpgradeFacility(state, id);
        if (!result.success) { showToast(result.reason, 'warning'); return; }
        const obj = facilityObjects.get(id);
        if (obj) { const sc = 1 + (result.level - 1) * 0.12; obj.scale.set(sc, sc, sc); } // visibly grows
        showToast(`⬆ ${result.facility.name} upgraded to Lv ${result.level}! Stronger effect, bigger upkeep.`, 'success', 4000);
        mercury.surge();
      } else {
        // facility id — enter placement mode (drag a ghost, click to place)
        beginPlacement(kind);
      }
    },
    () => { state.paused = false; }
  );
}

// ─── Facility Placement (drag-to-place build mode) ───────────────────────────
function beginPlacement(id) {
  const f = FACILITIES.find(x => x.id === id);
  if (!f) return;
  const mods = getModifiers(state);
  if (f.tier > mods.tierUnlocked) { showToast(`Locked — research Tier-${f.tier} facilities first.`, 'warning'); return; }
  if (state.cash < f.cost) { showToast(`Need ${fmtMoney(f.cost)} to build the ${f.name}.`, 'warning'); return; }

  cancelPlacement();
  const ghost = ghostify(buildFacility(id));
  scene.add(ghost);
  placing = { id, ghost };
  showToast(`📍 Move the ${f.name} and click to place it. (Esc to cancel)`, 'info', 4000);
}

function ghostify(obj) {
  obj.traverse(o => {
    if (o.isMesh && o.material) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = 0.45;
      o.material.depthWrite = false;
    }
  });
  return obj;
}

function placementPoint(raycaster) {
  const pt = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(FLOOR_PLANE, pt)) return null;
  pt.x = Math.max(OFFICE_BOUNDS.minX, Math.min(OFFICE_BOUNDS.maxX, pt.x));
  pt.z = Math.max(OFFICE_BOUNDS.minZ, Math.min(OFFICE_BOUNDS.maxZ, pt.z));
  pt.y = 0;
  return pt;
}

function tryPlaceFacility(raycaster) {
  const pt = placementPoint(raycaster);
  if (!pt) return;
  const result = actionBuyFacility(state, placing.id);
  if (!result.success) { showToast(result.reason, 'warning'); cancelPlacement(); return; }
  const obj = buildFacility(placing.id);
  obj.position.set(pt.x, 0, pt.z);
  scene.add(obj);
  facilityObjects.set(placing.id, obj);
  showToast(`${result.facility.icon} ${result.facility.name} built! ${result.facility.desc}`, 'success', 4500);
  mercury.surge();
  spawnConfetti(new THREE.Vector3(pt.x, 1, pt.z));
  cancelPlacement();
}

function cancelPlacement() {
  if (placing) {
    if (placing.ghost) scene.remove(placing.ghost);
    placing = null;
  }
}

function onCanvasMouseMove(event) {
  if (!placing) return;
  const canvas = document.getElementById('game-canvas');
  const rect   = canvas.getBoundingClientRect();
  const raycaster = controls.getPickRay(event.clientX - rect.left, event.clientY - rect.top);
  const pt = placementPoint(raycaster);
  if (pt) placing.ghost.position.set(pt.x, 0, pt.z);
}

// ─── Bank Loan Modal ────────────────────────────────────────────────────────────
function handleOpenLoanModal() {
  if (state.gameOver || state.won) return;
  cancelPlacement(); state.paused = true;
  openLoanModal(state,
    (id) => {
      state.paused = false;
      const r = actionTakeLoan(state, id);
      if (r.success) showToast(`🏦 Borrowed ${fmtMoney(r.loan.cash)}. Interest +${fmtMoney(r.loan.interest)}/s forever. Spend wisely.`, 'warning', 4500);
    },
    () => { state.paused = false; }
  );
}

// ─── Research Modal ─────────────────────────────────────────────────────────────
function handleOpenResearchModal() {
  if (state.gameOver || state.won) return;
  cancelPlacement(); state.paused = true;

  openResearchModal(state,
    (nodeId) => {
      state.paused = false;
      const result = actionResearch(state, nodeId);
      if (!result.success) {
        showToast(result.reason, 'warning');
        return;
      }
      showToast(`🔬 Researched: ${result.node.name}. ${result.node.desc}`, 'success', 4500);
      mercury.surge();
    },
    () => { state.paused = false; }
  );
}

// ─── Hire Modal ───────────────────────────────────────────────────────────────
function handleOpenHireModal() {
  if (state.gameOver || state.won) return;
  cancelPlacement(); state.paused = true;

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
  // Must be sitting at your desk to develop — otherwise walk there first
  if (!state.founderAtDesk) {
    showToast('🪑 Sit at your desk to develop a product.', 'warning');
    if (player) player.walkTo(FOUNDER_SIT.x, FOUNDER_SIT.z, () => {
      if (!state.gameOver && !state.won) openDevelopFlow();
    });
    return;
  }
  openDevelopFlow();
}

function openDevelopFlow() {
  firstSitDone = true; // any path that opens Develop consumes the first-sit prompt
  cancelPlacement(); state.paused = true;

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

  cancelPlacement(); state.paused = true;
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
        showTweetPopup(state, founderTweet(state, 'round', { round: result.round.name }));
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
  if (!state || state.gameOver || state.won) return;

  // Ignore the click that ends a camera-orbit drag — only deliberate clicks act
  if (pointerDownPos && Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y) > 6) return;

  const canvas = document.getElementById('game-canvas');
  const rect   = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const raycaster = controls.getPickRay(x, y);

  // ── Placement mode (building a facility) intercepts the click ──
  if (placing) { tryPlaceFacility(raycaster); return; }

  if (state.paused) return;

  // ── 1) Click a server fire → send the founder over to put it out ──
  const hitboxes = [];
  activeFireObjects.forEach(({ fireObj }) => {
    if (fireObj.hitbox) hitboxes.push(fireObj.hitbox);
  });
  if (hitboxes.length) {
    const hits = raycaster.intersectObjects(hitboxes, false);
    if (hits.length) {
      const fire = hits[0].object.userData.fire;
      const fireStateEntry = fire && state.fires.find(f => f.fireObject === fire);
      if (fireStateEntry && player) {
        const fx = Math.max(OFFICE_BOUNDS.minX, Math.min(OFFICE_BOUNDS.maxX, fire.position3d.x * 0.8));
        const fz = Math.max(OFFICE_BOUNDS.minZ, Math.min(OFFICE_BOUNDS.maxZ, fire.position3d.z + 0.95));
        const targetId = fireStateEntry.id;
        player.walkTo(fx, fz, () => {
          // Only extinguish if this fire is still burning when the founder arrives
          const still = state.fires.find(f => f.id === targetId);
          if (!still) { showToast('Too late — that server already burned down.', 'warning', 2500); return; }
          const fpos = still.fireObject ? still.fireObject.position3d.clone() : new THREE.Vector3(fx, 0.3, fz);
          const result = actionExtinguishFire(state, still.id);
          if (result.success) {
            removeFireFromScene(still);
            removeEventCard(`fire-${still.id}`);
            spawnExtinguishFX(fpos); // steam burst + flash
            showToast(`🧯 Fire out! Server saved. +${result.hypeBonus} HYPE`, 'success', 2500);
            mercury.surge();
          }
        });
        showToast('🏃 Run! Heading to the server fire…', 'info', 1600);
      }
      return;
    }
  }

  // ── 2) Otherwise walk the founder to the clicked floor spot ──
  if (player) {
    const pt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(FLOOR_PLANE, pt)) {
      const tx = Math.max(OFFICE_BOUNDS.minX, Math.min(OFFICE_BOUNDS.maxX, pt.x));
      const tz = Math.max(OFFICE_BOUNDS.minZ, Math.min(OFFICE_BOUNDS.maxZ, pt.z));
      player.walkTo(tx, tz);
    }
  }
}

// ─── Collision obstacles for the player ──────────────────────────────────────
function getObstacles() {
  const obs = [];
  deskStations.forEach((st, deskId) => {
    if (deskId === 0) return; // your own desk is walkable so you can sit
    obs.push({ x: st.root.position.x, z: st.root.position.z, r: 0.5 });
  });
  if (furniture && furniture.serverRacks) {
    furniture.serverRacks.forEach(r => obs.push({ x: r.position.x, z: r.position.z, r: 0.7 }));
  }
  facilityObjects.forEach(o => obs.push({ x: o.position.x, z: o.position.z, r: 0.8 }));
  return obs;
}

// ─── Ambient Life: employees walk to rooms to recharge ───────────────────────
const REST_FACILITIES = ['breakroom', 'cafeteria', 'espresso'];

function maybeStartBreak() {
  // Need a rest facility to walk to
  let dest = null;
  for (const id of REST_FACILITIES) {
    if (facilityObjects.has(id)) { dest = facilityObjects.get(id).position; break; }
  }
  if (!dest) return;

  // Pick the most tired employee not already on a break
  const candidates = state.employees.filter(e => {
    if (e.burnedOut) return false;
    const st = deskStations.get(e.deskId);
    return st && st.character && !st._onBreak && e.energy < 0.75;
  });
  if (!candidates.length) return;
  candidates.sort((a, b) => a.energy - b.energy);
  const emp = candidates[0];
  const station = deskStations.get(emp.deskId);

  station._onBreak = true;
  station.character.root.visible = false;
  emp.atDesk = false; // away from desk → stops contributing dev power

  const dpos = station.root.position;
  const startPt = { x: dpos.x, z: dpos.z + 0.3 };
  const roamer = new EmployeeCharacter({
    color: CHARACTER_PALETTE[emp.colorIdx % CHARACTER_PALETTE.length], walker: true,
  });
  roamer.setBasePosition(startPt.x, 0.22, startPt.z);
  scene.add(roamer.root);

  const restPt = { x: dest.x, z: dest.z + 0.7 };
  roamer.walkTo(restPt.x, restPt.z);
  roamers.push({ char: roamer, emp, station, phase: 'toRoom', rest: 0, deskPt: startPt });
}

function updateRoamers(dt, t) {
  for (let i = roamers.length - 1; i >= 0; i--) {
    const r = roamers[i];
    r.char.updateWalk(dt);
    r.char.update(t, 50 + i);

    if (r.phase === 'toRoom' && !r.char.isWalking()) {
      r.phase = 'rest'; r.rest = 2.5;
    } else if (r.phase === 'rest') {
      r.rest -= dt;
      if (r.rest <= 0) { r.phase = 'toDesk'; r.char.walkTo(r.deskPt.x, r.deskPt.z); }
    } else if (r.phase === 'toDesk' && !r.char.isWalking()) {
      scene.remove(r.char.root);
      if (r.station) {
        r.station._onBreak = false;
        if (r.station.character) r.station.character.root.visible = true;
      }
      r.emp.energy = Math.min(1, r.emp.energy + 0.35);
      r.emp.burnedOut = false;
      r.emp.atDesk = true; // back at the desk → working again
      roamers.splice(i, 1);
    }
  }
}

// ─── Confetti Burst ───────────────────────────────────────────────────────────
function spawnConfetti(origin) {
  const c = new HypeConfetti(origin, scene);
  confettiList.push(c);
}

// ─── Extinguish FX (steam puff + flash) ──────────────────────────────────────
function spawnExtinguishFX(pos) {
  confettiList.push(new SteamPuff(new THREE.Vector3(pos.x, 0.5, pos.z), scene));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAUSE
// ═══════════════════════════════════════════════════════════════════════════════
function pauseGame() {
  cancelPlacement(); state.paused = true;
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
  cancelPlacement();
  fireAlertUp = false; clearAlert();
  renderEndingScreen(state, false);
  showScreen('game-over-screen');
  mercury.setStress(1);
  mercury.setHype(0);
}

function onWin() {
  hideHUD();
  cancelPlacement();
  fireAlertUp = false; clearAlert();
  renderEndingScreen(state, true);
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
  // Pre-fill a startup-name suggestion; 🎲 rerolls it
  const nameInput = document.getElementById('company-name-input');
  const rerollBtn = document.getElementById('btn-reroll-name');
  if (nameInput && !nameInput.value) nameInput.value = genCompanyIdentity().name;
  if (rerollBtn && nameInput) rerollBtn.onclick = () => { nameInput.value = genCompanyIdentity().name; };

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

  // Escape key cancels placement, otherwise toggles pause
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && state && isRunning) {
      if (placing) { cancelPlacement(); showToast('Placement cancelled.', 'info', 1500); return; }
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
