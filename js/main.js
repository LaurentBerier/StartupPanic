/**
 * main.js  Entry point for Startup Panic Simulator (Tycoon Edition).
 *
 * Bootstraps:
 *  1. Loading screen
 *  2. Three.js scene, renderer, camera
 *  3. All game objects (diorama, furniture, central core, pitch room, showcase)
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
  DeskStation, ProductShowcase, PitchRoom, buildFacility, EmployeeCharacter, CHARACTER_PALETTE, CHARACTER_STAND_Y, makeCompanySign,
  makeDeskMarker, DESK_SLOT_POSITIONS, SteamPuff,
} from './gameObjects.js';
import {
  GameState, updateGame, CONFIG, fmtMoney, FACILITIES,
  actionLaunchProduct, actionDeliverPitch, actionCaffeinate, actionPivot, actionExtinguishFire,
  actionBuildDesk, actionBuyComputer, actionHireCandidate, actionStartProduct,
  actionBuyFacility, actionUpgradeFacility, actionResearch, actionBuyServer, actionExpandOffice, getModifiers,
  actionTakeLoan, actionAcceptPeddler, actionAcceptAcquisition, actionDeclineAcquisition, actionResolveBoardDilemma,
  actionSetDevMode, actionResolveCrunchSprint, actionSetProductPrice, actionRefactorProduct, actionQueueFeature,
  actionVersionPushProduct, actionResolvePRResponse, actionResolveClone, actionMarketingPost, getFounderDesk,
  actionResolvePoach, actionResolveMeme, actionResolveRegulator,
  actionPizzaParty, actionPromoteEmployee,
  rollProposal, actionResolveProposal, peddlerProposal,
} from './gameLogic.js';
import {
  showScreen, hideScreen, initHUD, showHUD, hideHUD, updateHUD,
  initEmployeeBar, updateEmployeeBar, setTeamHandlers, openEmployeeModal,
  addEventCard, updateEventTimer, removeEventCard, clearAllEventCards,
  showToast, showCashHit, showGainFloat, showAlert, clearAlert, celebrate, flashScreen, openPitchModal, openHireModal, openBuildModal, openDevelopModal, openResearchModal, openLaunchModal,
  openLoanModal, openPeddlerModal, openDecisionModal, openLaunchDayModal, openProductModal, openInternetReactionModal,
  openCrunchSprintModal, openBuildSprintModal, openPRComposerModal, openFirefightModal,
  startLoading, updateLoadingProgress, finishLoading,
  openProposalModal,
} from './ui.js';
import { CameraControls } from './cameraControls.js';
import { findPath } from './pathfind.js';
import { initLevelLink } from './levelLoader.js';
import { openTimingGame, openTapGame, openClickRush, openSquashGame, openPourGame } from './minigames.js';
let _mktGameFlip = false, _prGameFlip = false;   // alternate minigame flavors run-to-run
const PR_PHRASES = ['we hear you', 'lessons were learned', 'we take this seriously', 'a small number of users', 'out of an abundance of caution', 'your trust matters', 'this does not reflect our values', 'we have paused the feature', 'an independent review', 'effective immediately'];
const PR_LOGS = ['Legal redlined the whole thing', 'PR: "can we blame a typo?"', 'Swapped "sorry" for "regret"', 'Added the word "journey"', 'CEO wants more synergy in it', 'Comms: "post it before the podcast"', 'Board: "is this lawsuit-proof?"', 'Added a sad-but-hopeful emoji', 'Reframed it as a "learning moment"', 'Final draft posted 4:59pm Friday'];
import { updateTweens, Spring } from './tween.js';
import { VoidParticles, createVoidGrid, createAmbientOrbs, DataStreams } from './environment.js';
import {
  genCompanyIdentity, founderTweet, showTweetPopup,
  disasterHeadline, showChyron, renderEndingScreen,
} from './viral.js';
import {
  resetStory, tickStory, onStoryEvent, onStoryAction, pushProposalCard, pushMarketItem,
} from './storyEngine.js';
import { startMarketFeed } from './marketFeed.js';

// THREE is loaded globally via <script src="js/lib/three.min.js">
const THREE = window.THREE;

// Horizontal floor plane (y=0) for click-to-move / placement raycasting
const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const OFFICE_BOUNDS = { minX: -4.5, maxX: 4.5, minZ: -3.5, maxZ: 3.5 };
// Founder sit target is created from the first desk the player buys/places.
const _tmpTarget = new THREE.Vector3();

//  Global references 
let scene, camera, renderer;
let controls;
let state;
let mercury;
let furniture;
let pitchRoom;
let showcase;
let _lastMilestoneSeq = 0, _milestoneTimer = null;
const _proposals = new Map();
let marketFeedCtl = null;
/** Register an openable offer/proposal and drop its card into the feed. */
function pushOfferCard(prop) {
  if (!prop) return;
  if (_proposals.size >= 6) return; // don't let offers pile up unread
  _proposals.set(prop.pid, prop);
  pushProposalCard(prop);
}
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

//  Game Loop State 
let lastTime    = 0;
let isRunning   = false;
let animFrameId = null;
let bootReady   = false;
let bootError   = null;
window._startupPanicBoot = { ready: false, error: null };

// 
//  INITIALIZATION
// 
async function init() {
  startLoading();

  updateLoadingProgress(10);
  await delay(200);

  //  Three.js Scene 
  const canvas = document.getElementById('game-canvas');
  const setup  = initScene(canvas);
  scene    = setup.scene;
  camera   = setup.camera;
  renderer = setup.renderer;

  // Expose scene globally for gameLogic fire extinguish
  window._gameScene = scene;

  updateLoadingProgress(30);
  await delay(150);

  //  Build Scene Objects 
  platform = new OfficePlatform();
  platform.addToScene(scene);
  window._platform = platform; // debug access

  updateLoadingProgress(45);
  await delay(150);

  furniture = new OfficeFurniture();
  furniture.addToScene(scene);

  mercury = new MercuryAICore();
  // Central "blob" removed from the scene by request  the object is kept so
  // its setHype/surge/contract calls elsewhere remain safe no-ops.

  updateLoadingProgress(60);
  await delay(100);

  //  Tycoon Objects 
  pitchRoom = new PitchRoom();
  pitchRoom.addToScene(scene);

  showcase = new ProductShowcase();
  showcase.addToScene(scene);

  //  Environment Elements 
  voidParticles = new VoidParticles();
  voidParticles.addToScene(scene);

  dataStreams = new DataStreams();
  dataStreams.addToScene(scene);

  scene.add(createVoidGrid());
  scene.add(createAmbientOrbs());
  initLevelLink(scene);   // dynamic link with the three.js Editor (level.json)

  updateLoadingProgress(80);
  await delay(100);

  //  Camera Controls 
  controls = new CameraControls(camera, canvas);

  //  HUD Setup
  initHUD();
  setTeamHandlers({ onPizza: handlePizzaParty, onPromote: handlePromote, onOpen: handleOpenEmployee });

  //  Raycasting for fire clicks / click-to-move / placement 
  canvas.addEventListener('mousedown', (e) => { pointerDownPos = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('mousemove', onCanvasMouseMove);

  updateLoadingProgress(100);
  bootReady = true;
  bootError = null;
  window._startupPanicBoot = { ready: true, error: null };

  finishLoading(() => {
    showScreen('main-menu');
  });
}

// 
//  GAME SESSION START / STOP
// 
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

  // Reset server rack visuals; the new run's state decides which are online.
  for (let i = 0; i < CONFIG.NUM_RACKS; i++) furniture.setRackDown(i, true);

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
  for (let i = 0; i < CONFIG.NUM_RACKS; i++) furniture.setRackDown(i, !!state.rackDown[i]);

  // Company identity  use the name the player typed (or a suggestion)
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

  // Spawn any desks in state. A fresh run starts empty; the first placed desk
  // becomes the founder workstation and gets the "sit here" marker.
  for (const desk of state.desks) createDeskStation(desk);
  for (const emp of state.employees) {
    const station = deskStations.get(emp.deskId);
    if (station) station.setEmployee(emp.colorIdx);
  }

  // Spawn the founder avatar (the walkable "you"  gold, with a plumbob)
  player = new EmployeeCharacter({ color: 0xFFD54A, walker: true });
  player.setBasePosition(0, CHARACTER_STAND_Y, 0.6); // start standing in the middle  walk to your chair
  scene.add(player.root);
  window._player = player; // debug access

  // Init UI
  initEmployeeBar(state);
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
  const wire = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  wire('btn-build', handleOpenBuildModal);
  wire('btn-hire', handleOpenHireModal);
  wire('btn-develop', handleOpenDevelopModal);
  wire('btn-research', handleOpenResearchModal);
  wire('btn-launch-product', handleOpenLaunchModal);
  wire('btn-ship-update', handleOpenProductModal);
  wire('btn-marketing', handleMarketingPost);
  wire('btn-vc-pitch', handleOpenPitchModal);
  wire('btn-caffeinate', handleCaffeinate);
  wire('btn-pivot', handlePivot);
  wire('btn-loan', handleOpenLoanModal);
  wire('menu-pause', pauseGame);
  // Top-right HUD menu (hamburger): toggle + items
  const _menuBtn = document.getElementById('btn-hud-menu');
  const _menuDrop = document.getElementById('hud-menu-dropdown');
  if (_menuBtn && _menuDrop) {
    _menuBtn.onclick = (e) => { e.stopPropagation(); _menuDrop.classList.toggle('hidden'); };
    document.addEventListener('click', (e) => { if (!_menuBtn.contains(e.target) && !_menuDrop.contains(e.target)) _menuDrop.classList.add('hidden'); });
  }
  wire('menu-options', () => { if (_menuDrop) _menuDrop.classList.add('hidden'); showScreen('how-to-play-screen'); });
  wire('menu-theme', () => {
    document.body.classList.toggle('theme-light');
    const lbl = document.getElementById('menu-theme-label');
    if (lbl) lbl.textContent = document.body.classList.contains('theme-light') ? 'Dark mode' : 'Light mode';
    if (_menuDrop) _menuDrop.classList.add('hidden');
  });
  document.querySelectorAll('[data-dev-mode]').forEach(btn => {
    btn.onclick = () => handleSetDevMode(btn.dataset.devMode);
  });
  const crunchBtn = document.getElementById('btn-crunch-sprint');
  if (crunchBtn) crunchBtn.onclick = handleCrunchSprint;

  // Grouped actions: each category reveals its real buttons in a bottom sheet,
  // so the permanent bar stays tiny (Team / Make / Grow + a contextual Launch).
  const _sheet = document.getElementById('action-sheet');
  const _sheetTitle = document.getElementById('action-sheet-title');
  const _CAT = { team: 'Company', make: 'Development', grow: 'Business', build: 'Build' };
  const _showCat = (cat) => {
    if (!_sheet) return;
    _sheet.querySelectorAll('.action-sheet-group').forEach(g => g.classList.toggle('hidden', g.dataset.cat !== cat));
    if (_sheetTitle) _sheetTitle.textContent = _CAT[cat] || '';
    _sheet.classList.remove('hidden');
    _sheet.dataset.cat = cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  };
  const _hideSheet = () => {
    if (_sheet) _sheet.classList.add('hidden');
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  };
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.onclick = () => {
      const cat = btn.dataset.cat;
      if (cat === 'build') { _hideSheet(); handleOpenBuildModal(); return; }   // Buy opens the shop directly
      if (!_sheet || _sheet.classList.contains('hidden') || _sheet.dataset.cat !== cat) _showCat(cat);
      else _hideSheet();
    };
  });
  const _sheetClose = document.getElementById('action-sheet-close');
  if (_sheetClose) _sheetClose.onclick = _hideSheet;
  if (_sheet) _sheet.querySelectorAll('.action-btn').forEach(b => b.addEventListener('click', _hideSheet));
  const _feedEl = document.getElementById('social-feed');
  if (_feedEl) _feedEl.addEventListener('click', (e) => {
    if (!e.target.closest) return;
    if (e.target.closest('.fi-react')) return;   // reactions are handled by the story engine
    // Clicking the CTA button OR anywhere on the offer card opens the proposal.
    const btn  = e.target.closest('.fi-cta');
    const card = e.target.closest('.feed-item.fi-offer') || (btn && btn.closest('.feed-item'));
    const pid  = (btn && btn.dataset.pid) || (card && card.dataset.pid);
    if (!pid) return;
    const prop = _proposals.get(pid); if (!prop) return;
    state.paused = true;
    openProposalModal(state, prop, (accept) => {
      state.paused = false;
      const r = actionResolveProposal(state, prop, accept);
      _proposals.delete(pid);
      if (card) { card.classList.add('fi-resolved'); const row = card.querySelector('.fi-cta-row'); if (row) row.remove(); }
      if (r.spent) flashSpend({ cost: r.spent });
      showToast(r.outcome, r.hype >= 0 ? 'success' : 'warning', 4800);
    });
  });

  // Reacting to the feed (like/repost/reply) gives a tiny hype drip with
  // diminishing returns - doomscrolling is not a growth strategy.
  if (!window._feedReactWired) {
    window._feedReactWired = true;
    window.addEventListener('feed-react', (e) => {
      if (!state || state.gameOver || state.won) return;
      state._feedReactBudget = state._feedReactBudget ?? 3;
      if (state._feedReactBudget <= 0) {
        if (Math.random() < 0.25) showToast('The algorithm has stopped caring about your likes (for now).', 'info', 2200);
        return;
      }
      state._feedReactBudget--;
      const gain = e.detail?.kind === 'repost' ? 0.8 : 0.5;
      state.hype = Math.min(CONFIG.HYPE_MAX, state.hype + gain);
      if (Math.random() < 0.18) {
        const quips = [
          'An intern liked your like. Synergy.',
          'You reposted it. Your mom reposted your repost. Momentum.',
          'Replied "this" - thought leadership achieved.',
          'Engagement farmed. The crops are hype.',
        ];
        showToast(quips[Math.floor(Math.random() * quips.length)], 'info', 2400);
      }
    });
  }

  // Reset the live feed; clear any sticky fire alert. In stealth the feed is
  // near-silent (nobody knows you exist yet)  it only roars to life on launch.
  // The story engine now owns the feed: a reactive, self-chaining narrative.
  fireAlertUp = false; feedTimer = 16; clearAlert();
  resetStory(state);

  // Real market/tech headlines (RSS) laundered into parody & dripped into the feed.
  if (marketFeedCtl) marketFeedCtl.stop();
  marketFeedCtl = startMarketFeed(pushMarketItem, {
    // World/market news exists regardless of your startup  flows even in stealth.
    // Kept sparse (each headline brings its own crowd of reaction comments).
    shouldEmit: () => isRunning && state && !state.paused,
    intervalMs: 80000,
  });

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
  if (marketFeedCtl) { marketFeedCtl.stop(); marketFeedCtl = null; }
}

function createDeskStation(desk) {
  const station = new DeskStation(desk.slot, desk.hasComputer, desk.x != null ? { x: desk.x, z: desk.z } : null);
  station.addToScene(scene);
  deskStations.set(desk.id, station);
  if (desk.employeeId === -1) ensureFounderDeskMarker();
}

function getFounderSitTarget() {
  const desk = getFounderDesk(state);
  if (!desk) return null;
  const station = deskStations.get(desk.id);
  if (!station) return null;
  return {
    x: station.root.position.x,
    z: station.root.position.z + 0.55,
  };
}

function ensureFounderDeskMarker() {
  const sit = state ? getFounderSitTarget() : null;
  if (!sit) return;
  if (!deskMarker) {
    deskMarker = makeDeskMarker();
    scene.add(deskMarker);
  }
  deskMarker.position.set(sit.x, 0, sit.z);
}

// 
//  MAIN GAME LOOP
// 
function gameLoop(timestamp) {
  if (!isRunning) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap at 100ms
  lastTime = timestamp;

  if (!state.paused) {
    //  Game Logic Update 
    const events = updateGame(state, dt);
    processGameEvents(events);

    //  3D Object Updates 
    const t = timestamp / 1000;

    // Central core reacts to hype and dwindling cash
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
      if (station) {
        station.setEnergy(emp.energy, emp.burnedOut);
        if (station.setMood) station.setMood(Math.max(0, Math.min(1, ((emp.happiness ?? 70) - (emp.stress ?? 20) * 0.5) / 100)));
      }
    });
    let seed = 0;
    deskStations.forEach(station => station.update(t, seed++));

    // Player avatar: collision obstacles, walk, animate, desk detection
    if (player) {
      player.obstacles = getObstacles();
      player.updateWalk(dt);
      player.update(t, 99);
      const founderSit = getFounderSitTarget();
      const d = founderSit ? Math.hypot(player.root.position.x - founderSit.x, player.root.position.z - founderSit.z) : Infinity;
      const _wasAtDesk = state.founderAtDesk;
      state.founderAtDesk = d < 0.85;
      if (state.founderAtDesk && !_wasAtDesk && player.sit) player.sit();
      else if (!state.founderAtDesk && _wasAtDesk && player.stand) player.stand();
      // First time you settle at your desk  prompt to develop your first product
      if (state.founderAtDesk && !firstSitDone && state.time > 0.6) {
        firstSitDone = true;
        if (getFounderDesk(state)?.hasComputer && (getModifiers(state).serverWorking || 0) > 0) {
          showToast('Settled in. Time to create something gloriously absurd.', 'info', 3000);
          openDevelopFlow();
        } else {
          showToast('Founder desk placed. Add a computer and server, then develop.', 'info', 3500);
        }
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

    // Persistent "server on fire" alert  stays up until every fire is out
    const burning = state.fires.length > 0;
    if (burning && !fireAlertUp) {
      fireAlertUp = true;
      showAlert('A SERVER IS ON FIRE! All work is frozen until it\'s out.', {
        sticky: true, icon: '!', header: 'SERVER MELTDOWN',
        hint: 'Click the burning server - you\'ll run over and put it out.',
      });
    } else if (!burning && fireAlertUp) {
      fireAlertUp = false;
      clearAlert();
    }

    // Live social / news feed: the story engine advances its own arcs, fires
    // due beats, checks milestones, and sprinkles ambient chatter on its own clock.
    tickStory(state, dt);
    if (state._milestoneSeq && state._milestoneSeq !== _lastMilestoneSeq) { _lastMilestoneSeq = state._milestoneSeq; showMilestone(state._milestoneText); }
    if (state.live && !state.paused) {
      if (state._proposalTimer == null) state._proposalTimer = 32 + Math.random() * 22;
      state._proposalTimer -= dt;
      if (state._proposalTimer <= 0) {
        state._proposalTimer = 58 + Math.random() * 46;
        if (_proposals.size < 4) pushOfferCard(rollProposal(state));
      }
    }

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

    //  Event Card Timer Updates 
    for (const fire of state.fires) {
      updateEventTimer(`fire-${fire.id}`, fire.timer, CONFIG.FIRE_DURATION);
    }
    for (const pr of state.prDisasters) {
      updateEventTimer(`pr-${pr.id}`, pr.timer, pr.maxTimer);
    }

    //  HUD Update 
    updateHUD(state);
    updateEmployeeBar(state);

    //  Camera Controls (gently follow the founder with a little lag) 
    if (player && controls.follow) controls.target.lerp(_tmpTarget.set(player.root.position.x, 0.6, player.root.position.z), 0.085);
    if (controls.follow !== controls._prevFollow) {
      controls._prevFollow = controls.follow;
      if (!controls.follow) showToast('Free camera. Press F to snap back to your founder.', 'info', 3200);
    }
    controls.update(dt);

    //  Tweens 
    updateTweens(dt);
  }

  // Render every frame regardless of pause
  renderFrame();

  animFrameId = requestAnimationFrame(gameLoop);
}

// 
//  GAME EVENT PROCESSING
// 
function processGameEvents(events) {
  for (const ev of events) {
    // Let the story engine react to every event (it picks the ones it cares about).
    onStoryEvent(state, ev.type, ev);
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
          triggerShake(true);
          showToast(`Server destroyed! Productivity drops - replace it in BUY (${fmtMoney(CONFIG.SERVER_COST)}).`, 'error', 5500);
        } else {
          showToast(' Fire burned out on an already-dead server.', 'warning', 3500);
        }
        mercury.contract();
        break;
      }

      case 'spawn_pr': {
        const pr = ev.pr;
        addEventCard(`pr-${pr.id}`, 'pr', pr.title, pr.desc);
        showToast(`PR DISASTER: ${pr.title}`, 'error', 4000);
          showChyron(disasterHeadline(state));
        triggerShake();
        mercury.contract();
        cancelPlacement(); state.paused = true;
        openPRComposerModal(pr, (choice) => {
          const resolve = (score) => {
            const r = actionResolvePRResponse(state, pr.id, choice, score);
            state.paused = false;
            if (!r.success) { showToast(r.reason, 'warning'); return; }
            if (r.cost) flashSpend(r);
            const grade = score == null ? '' : ` (${['D', 'C', 'B', 'A', 'S'][Math.min(4, Math.floor(score * 5))]})`;
            showToast(`${r.response.label}${grade}: ${r.hypeDelta >= 0 ? '+' : ''}${r.hypeDelta} Hype, severity now ${r.pr.severity.toFixed(1)}x.`, r.hypeDelta >= 0 ? 'success' : 'warning', 3600);
          };
          if (choice === 'apology') {
            _prGameFlip = !_prGameFlip;
            if (_prGameFlip) openSquashGame({ title: 'Ratio the Bad Takes', color: '#FF9A1F', emoji: '😡', hitEmoji: '🧯', note: 'Squash every hot take before it trends. Escapees quote-tweet.', unit: 'takes contained', duration: 10, targetHits: 12 }, resolve, () => { state.paused = false; });
            else openClickRush({ title: 'Damage Control', color: '#FF9A1F', logs: PR_LOGS, logMaker: (m) => m, note: 'Tap each talking point fast. Get the statement out before the narrative hardens.', unit: 'lines on the record', duration: 10, targetHits: 9 }, resolve, () => { state.paused = false; });
          }
          else if (choice === 'meme') openTapGame({ title: 'Meme It Away', color: '#8B5CF6', duration: 6, instruction: 'Mash to push your counter-meme before the bad takes pile up.' }, resolve, () => { state.paused = false; });
          else resolve(null);
        });
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

      case 'employee_quit': {
        const emp = ev.employee;
        const station = emp && deskStations.get(emp.deskId);
        if (station && station.clearEmployee) station.clearEmployee();
        initEmployeeBar(state);
        showToast(`${emp ? emp.name : 'Someone'} just quit. Their desk is a ghost town.`, 'error', 4600);
        triggerShake();
        mercury.contract();
        break;
      }

      case 'emp_levelup': {
        showToast(`${ev.employee.name} leveled up to ${ev.title}.`, 'success', 2600);
        break;
      }

      case 'team_gossip': {
        // The story engine surfaces this in the feed; no toast needed.
        break;
      }

      case 'era_unlock': {
        const era = ev.era || {};
        celebrate(`${(era.name || 'NEW ERA').toUpperCase()} UNLOCKED`, 'bigger products, bigger problems', 'hype');
        cheerTeam(2);
        showToast(`New era: ${era.name}. Fresh frontiers are in the Develop menu.`, 'success', 5200);
        triggerShake(true); mercury.surge();
        break;
      }

      case 'lifeline': {
        // A shady lifeline peddler goes to the FEED as a clickable offer (like all
        // shady deals). Only the legit bank lender still interrupts with a modal.
        if (ev.kind !== 'bank') {
          pushOfferCard(peddlerProposal(state, ev.deal));
          showToast('Nearly broke - a shady lifeline just slid into your feed. Tap it to inspect.', 'warning', 4200);
          break;
        }
        cancelPlacement(); state.paused = true;
        if (ev.kind === 'bank') {
          const loan = ev.loan;
          openDecisionModal({
            title: 'THE BANK CALLS',
            text: `Nearly out of cash. A lender suddenly "believes in your vision" (and your collateral). ${loan.name}: +${fmtMoney(loan.cash)} now, +${fmtMoney(loan.interest)}/s interest, forever.`,
            options: [
              { label: `Take the ${loan.name}`, desc: `+${fmtMoney(loan.cash)} cash, +${fmtMoney(loan.interest)}/s burn.`, primary: true },
              { label: 'Tough It Out', desc: 'Pride intact. Runway, less so.' },
            ],
          }, (_o, idx) => {
            state.paused = false;
            if (idx === 0) {
              playCashGrab('Grab the Loan', (score) => {
                const r = actionTakeLoan(state, loan.id);
                if (r.success) {
                  const bonus = Math.round(loan.cash * 0.25 * score);
                  if (bonus) state.cash += bonus;
                  showGainFloat(loan.cash + bonus, 'cash');
                  showToast(`Lifeline: ${loan.name} secured. +${fmtMoney(loan.cash)}${bonus ? ` (+${fmtMoney(bonus)} grabbed!)` : ''}.`, 'success', 4200);
                }
              });
            } else showToast('You wave off the bank. Bold.', 'info', 2400);
          });
        }
        break;
      }

      case 'quirk': {
        showToast(ev.text, ev.tone || 'info', 4000);
        break;
      }

      case 'product_ready': {
        showToast(`${ev.product.idea.name} is built - hit LAUNCH PRODUCT to take it live!`, 'success', 5000);
        mercury.surge();
        break;
      }

      case 'product_feature_ready': {
        showToast(`${ev.product.idea.name} shipped ${ev.feature.name}. +${fmtMoney(ev.feature.mrrBoost)}/s potential, +${ev.feature.hype} Hype.`, 'success', 4200);
        mercury.surge();
        break;
      }

      case 'product_crash': {
        addEventCard(`outage-${ev.product.shelfIdx}`, 'pr', `${ev.product.idea.name} OUTAGE`, 'MRR is zero while the product is down.');
        showToast(`${ev.product.idea.name} crashed. Tech debt is now revenue debt.`, 'warning', 4500);
        triggerShake();
        mercury.contract();
        break;
      }

      case 'product_recovered': {
        removeEventCard(`outage-${ev.product.shelfIdx}`);
        showToast(`${ev.product.idea.name} is back online.`, 'success', 2400);
        break;
      }

      case 'market_trend': {
        showToast(`Market trend: ${ev.trend.label}. Matching products earn +${Math.round(ev.trend.mrrBonus * 100)}% MRR.`, 'info', 4200);
        break;
      }

      case 'competitor_clone': {
        cancelPlacement(); state.paused = true;
        openDecisionModal({
          title: `${ev.clone.rival} CLONED YOU`,
          text: ev.clone.text,
          options: [
            { label: 'Out-Hype Them', desc: `${fmtMoney(CONFIG.CLONE_OUTHYPE_COST)} marketing blitz, clears clone, +14 Hype.`, primary: true },
            { label: 'Lawyer Up', desc: 'Cease and desist. Cheaper if Legal Department exists.' },
            { label: 'Differentiate', desc: `${fmtMoney(CONFIG.CLONE_PIVOT_COST)} release, clears clone and refreshes the product.` },
            { label: 'Ignore It', desc: 'Save cash. MRR keeps bleeding until they fade.' },
          ],
        }, (_option, idx) => {
          state.paused = false;
          const choice = ['outhype', 'lawyer', 'pivot', 'ride'][idx] || 'ride';
          const r = actionResolveClone(state, choice);
          if (!r.success) { showToast(r.reason, 'warning'); return; }
          if (r.cost) flashSpend(r);
          showToast(r.note, r.cleared ? 'success' : 'warning', 4200);
        });
        break;
      }

      case 'clone_faded': {
        showToast(`${ev.clone.rival}'s clone faded. Your MRR is back.`, 'success', 3200);
        break;
      }

      case 'peddler': {
        // Shady offers now slide into the FEED as a clickable card instead of a
        // blocking modal  the player must tap "Inspect the offer" to accept.
        pushOfferCard(peddlerProposal(state, ev.deal));
        showToast('A shady offer just hit your feed. Tap it to inspect.', 'info', 3200);
        break;
        }

      case 'board_dilemma': {
        cancelPlacement(); state.paused = true;
        openDecisionModal({
          title: ev.dilemma.title,
          text: ev.dilemma.text,
          options: ev.dilemma.options,
        }, (_option, idx) => {
          state.paused = false;
          const r = actionResolveBoardDilemma(state, ev.dilemma, idx);
          if (!r.success) { showToast(r.reason || 'Board decision failed.', 'warning'); return; }
          if (r.cost) flashSpend(r);
          const cashText = r.cashDelta ? `${r.cashDelta > 0 ? '+' : '-'}${fmtMoney(Math.abs(r.cashDelta))}` : 'no cash change';
          const hypeText = r.hypeDelta ? `${r.hypeDelta > 0 ? '+' : ''}${r.hypeDelta} Hype` : 'no Hype change';
          showToast(`${r.option.label}: ${cashText}, ${hypeText}.`, r.cashDelta < 0 ? 'warning' : 'info', 4500);
          if (r.spawnedPr) {
            const pr = r.spawnedPr;
            addEventCard(`pr-${pr.id}`, 'pr', pr.title, pr.desc);
            showChyron(disasterHeadline(state));
            mercury.contract();
          }
        });
        break;
      }

      case 'talent_poach': {
        cancelPlacement(); state.paused = true;
        const offer = ev.offer;
        openDecisionModal({
          title: `${offer.rival.toUpperCase()} WANTS ${offer.name}`,
          text: offer.text,
          options: [
            { label: `Counter the Offer (${fmtMoney(offer.counterCost)})`, desc: `Match it - ${offer.name} stays for a 12% raise and a fancy title.`, primary: true },
            { label: 'Promote, No Raise', desc: 'Free. A shiny title keeps them ~62% of the time. Otherwise they bolt.' },
            { label: 'Let Them Walk', desc: `Save the cash. ${offer.name} leaves and frees their desk.` },
          ],
        }, (_o, idx) => {
          state.paused = false;
          const choice = ['counter', 'promote', 'walk'][idx] || 'walk';
          const r = actionResolvePoach(state, offer, choice);
          if (!r.success) { showToast(r.reason, 'warning'); return; }
          if (r.cost) flashSpend(r);
          if (!r.kept && r.deskId != null) {
            const station = deskStations.get(r.deskId);
            if (station) station.clearEmployee();
          }
          initEmployeeBar(state);
          showToast(r.note, r.kept ? 'success' : 'warning', 4400);
          if (r.kept) mercury.surge(); else mercury.contract();
        });
        break;
      }

      case 'meme_moment': {
        cancelPlacement(); state.paused = true;
        const m = ev.moment;
        openDecisionModal({
          title: `${m.productName} IS A MEME`,
          text: m.text,
          options: [
            { label: 'Lean All The Way In', desc: '+22 Hype now - but the bit might curdle into a PR fire.', primary: true },
            { label: `Drop Merch Instantly (${fmtMoney(m.merchCash)})`, desc: 'Cash in fast. Big cash, small Hype.' },
            { label: 'Stay Classy', desc: '+6 Hype, team morale up. The tasteful, slightly smug option.' },
          ],
        }, (_o, idx) => {
          state.paused = false;
          const choice = ['lean', 'merch', 'classy'][idx] || 'classy';
          const r = actionResolveMeme(state, m, choice);
          if (!r.success) { showToast(r.reason, 'warning'); return; }
          if (r.cashGain) showGainFloat(r.cashGain, 'cash');
          if (r.cashGain || r.hypeDelta > 0) spawnConfetti(new THREE.Vector3(2.6, 1.4, -3.2));
          if (r.hypeDelta >= 12) { celebrate('VIRAL', `+${r.hypeDelta} Hype`, 'hype'); cheerTeam(); }
          showToast(r.note, r.spawnedPr ? 'warning' : 'success', 4400);
          if (r.spawnedPr) {
            const pr = r.spawnedPr;
            addEventCard(`pr-${pr.id}`, 'pr', pr.title, pr.desc);
            showChyron(disasterHeadline(state));
            mercury.contract();
          } else mercury.surge();
        });
        break;
      }

      case 'regulator': {
        cancelPlacement(); state.paused = true;
        const probe = ev.probe;
        openDecisionModal({
          title: 'REGULATORS APPEAR',
          text: probe.text,
          options: [
            { label: `Lawyer Up (${fmtMoney(probe.lawyerCost)})`, desc: 'Safe and boring. A Legal Department makes it land harder.', primary: true },
            { label: `"Consulting Fee" (${fmtMoney(probe.bribeCost)})`, desc: 'Usually works. Occasionally becomes a federal case.' },
            { label: 'Stonewall ("No Comment")', desc: 'Free, but ~55% chance it spawns a PR disaster instead.' },
          ],
        }, (_o, idx) => {
          state.paused = false;
          const choice = ['lawyer', 'bribe', 'stonewall'][idx] || 'stonewall';
          const r = actionResolveRegulator(state, probe, choice);
          if (!r.success) { showToast(r.reason, 'warning'); return; }
          if (r.cost) flashSpend(r);
          showChyron({ net: 'CNNN', text: `${probe.who} opens inquiry into ${state.companyName}` });
          showToast(r.note, r.spawnedPr ? 'warning' : 'success', 4800);
          if (r.spawnedPr) {
            const pr = r.spawnedPr;
            addEventCard(`pr-${pr.id}`, 'pr', pr.title, pr.desc);
            mercury.contract();
          }
        });
        break;
      }

      case 'acquisition_offer': {
        cancelPlacement(); state.paused = true;
        openDecisionModal({
          title: `${ev.offer.acquirer} WANTS IN`,
          text: ev.offer.text,
          options: [
            { label: `Accept ${fmtMoney(ev.offer.amount)}`, desc: 'Exit now, cash out, and let someone else discover the codebase.', primary: true },
            { label: 'Stay Independent', desc: '+6 Hype. The board pretends this was brave.' },
          ],
        }, (_option, idx) => {
          if (idx === 0) {
            state.paused = false;
            const r = actionAcceptAcquisition(state, ev.offer);
            if (r.success) {
              stopGame();
              onWin();
            }
            return;
          }
          state.paused = false;
          actionDeclineAcquisition(state);
          showToast('You decline the offer. The team posts a manifesto and Hype rises.', 'success', 4200);
        });
        break;
      }

      case 'repo_warning': {
        const s = Math.ceil(ev.secondsLeft);
        const stage = ev.secondsLeft > 28 ? 0 : ev.secondsLeft > 12 ? 1 : 2;
        const msgs = [
          [`🚚 Cash is negative. The landlord "just wants to talk". Repo in ~${s}s.`,
           `🚚 A repo van has circled the block twice. ~${s}s to go cash-positive.`],
          [`📦 The repo men are measuring the espresso machine. ~${s}s!`,
           `📦 They've started stacking the beanbags by the door. ~${s}s!`],
          [`🔧 THEY ARE UNBOLTING THE DESKS. ~${s}s! SELL SOMETHING!`,
           `🔧 One of them is holding your monitor. ~${s}s! DO SOMETHING!`],
        ][stage];
        showToast(msgs[Math.floor(Math.random() * msgs.length)], stage === 2 ? 'error' : 'warning', 3800);
        if (stage === 2) triggerShake();
        break;
      }

      case 'repo_saved': {
        showToast('💸 Back in the black. The repo men leave, visibly disappointed.', 'success', 3200);
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

//  Spawn a Server Fire 
function spawnFire() {
  const online = (furniture.serverRacks || [])
    .map((rack, idx) => ({ pos: rack.position.clone().setY(0.2), idx }))
    .filter(r => !(state.rackDown || [])[r.idx]);
  if (!online.length) return;
  const target = online[Math.floor(Math.random() * online.length)];
  const pos = target.pos.clone();

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
    rackIdx:     target.idx,
    fireObject: null,
  };
  state.fires.push(fireData);

  const fireObj = new ServerFire(pos);
  fireObj.addToScene(scene);
  fireData.fireObject = fireObj;

  const light = addFireLight(pos);
  activeFireObjects.set(fireId, { fireObj, light, fireData });

  addEventCard(`fire-${fireId}`, 'fire', 'SERVER MELTDOWN', 'Walk over & click it to extinguish!');
}

//  Remove fire from scene (after extinguish or damage) 
function removeFireFromScene(fireData) {
  const entry = activeFireObjects.get(fireData.id);
  if (!entry) return;

  const { fireObj, light } = entry;
  fireObj.extinguish(scene);
  removeFireLight(light);
  activeFireObjects.delete(fireData.id);
}

// 
//  PLAYER ACTIONS
// 
//  Launch Product Modal 
function flashSpend(result) {
  if (result && result.success && result.cost) showCashHit(result.cost);
}

function handleOpenLaunchModal() {
  if (state.gameOver || state.won) return;
  cancelPlacement(); state.paused = true;

  openLaunchModal(state,
    (index) => {
      const product = state.readyProducts[index];
      if (!product) { state.paused = false; showToast('Nothing ready to launch.', 'warning'); return; }
      openLaunchDayModal(state, product, (plan) => {
        const result = actionLaunchProduct(state, index, plan);
        if (!result.success) { state.paused = false; showToast(result.reason, 'warning'); return; }
        const p = result.product;
        showcase.addProduct(p.shelfIdx, p.brand);

        openInternetReactionModal(result, () => {
          state.paused = false;
          if (result.firstLaunch) goLiveBigBang(p, result);
          else if (result.flopped) {
            showToast(`LAUNCHED ${p.idea.name} - and it flopped. Reviews are brutal. Only +${fmtMoney(p.idea.mrr)}/s MRR, +${result.hypeGained} Hype.`, 'warning', 5500);
            showChyron(disasterHeadline(state));
          } else {
            showToast(`LAUNCHED ${p.idea.name}! Reviews are glowing. +${fmtMoney(p.idea.mrr)}/s MRR, +${result.hypeGained} Hype.`, 'success', 5500);
            celebrate(`${p.idea.name} SHIPPED`, 'the reviews are glowing', 'good');
            cheerTeam();
          }

          // Story engine: a fresh launch (or flop) arc, unless this is the first
          // launch  goLiveBigBang fires the special 'debut' arc instead.
          if (!result.firstLaunch) onStoryAction(state, 'launch', { product: p.idea.name, hit: !result.flopped, quality: p.quality, bugs: p.bugs, reviewScore: result.reviewScore });

          showTweetPopup(state, founderTweet(state, 'ship', { product: p.idea.name }));
          mercury.surge();
          spawnConfetti(new THREE.Vector3(2.6, 1.4, -3.2));
        }, state);
      }, () => { state.paused = false; });
    },
    () => { state.paused = false; }
  );
}

const CASH_LOGS = ['snatched a wad of twenties', 'grabbed the briefcase', 'pocketed the petty cash', 'caught a falling check', 'cleared out the register', 'bagged the signing bonus', 'swiped the swag budget', 'liberated some equity', 'found cash in the couch cushions', 'emptied the tip jar'];
function playCashGrab(title, onDone) {
  state.paused = true;
  openClickRush(
    { title: title || 'Grab the Cash', color: '#19C37D', logs: CASH_LOGS, logMaker: (m) => m, note: 'Grab every stack before it vanishes!', unit: 'stacks grabbed', duration: 6, targetHits: 9 },
    (score) => { state.paused = false; onDone(score); },
    () => { state.paused = false; onDone(0.5); }
  );
}
function showMilestone(text) {
  const el = document.getElementById('milestone-banner'); if (!el) return;
  const t = document.getElementById('milestone-text'); if (t) t.textContent = text || 'Milestone reached!';
  el.classList.remove('hidden', 'mb-in'); void el.offsetWidth; el.classList.add('mb-in');
  const view = document.getElementById('milestone-view');
  if (view) view.onclick = hideMilestone;
  if (_milestoneTimer) clearTimeout(_milestoneTimer);
  _milestoneTimer = setTimeout(hideMilestone, 6500);
}
function hideMilestone() { const el = document.getElementById('milestone-banner'); if (el) el.classList.add('hidden'); }

//  The Big Bang: your first product goes live, the world wakes up 
function goLiveBigBang(p, result) {
  const verdict = result.flopped
    ? 'The launch lands with a thud - but you exist now. AWS bills, VCs, and chaos all just woke up.'
    : 'It LANDS. The press is calling, the VCs are circling, and the real costs just kicked in.';
  showAlert(`${state.companyName} IS LIVE. ${verdict}`, {
    sticky: false, icon: 'LIVE', header: 'YOU SHIPPED. THE WORLD NOTICED.',
    hint: 'Burn just jumped, disasters can strike, and PITCH TO VC is now open.',
  });
  showToast(`${p.idea.name} is live! ${result.flopped ? 'It flopped, but the world finally sees you.' : `Glowing reviews - +${fmtMoney(p.idea.mrr)}/s MRR.`}`, 'info', 6000);
  showChyron({ net: 'TechCrush', text: `${state.companyName} emerges from stealth with ${p.idea.name}` });
  // The world wakes up: kick off the 'debut' storyline arc.
  onStoryAction(state, 'debut', { product: p.idea.name });
  celebrate(`${state.companyName} IS LIVE`, p.idea.name, 'hype');
  cheerTeam(2.2);
  triggerShake(true);
  spawnConfetti(new THREE.Vector3(2.6, 1.4, -3.2));
  spawnConfetti(mercury.root.position.clone().add(new THREE.Vector3(0, 0.6, 0)));
}

//  Build Modal 
function handleOpenBuildModal() {
  if (state.gameOver || state.won) return;
  cancelPlacement(); state.paused = true;

  openBuildModal(state,
    (kind) => {
      state.paused = false;
      if (kind === 'desk') {
        beginPlacement('desk');
      } else if (kind === 'expand') {
        const result = actionExpandOffice(state);
        if (!result.success) { showToast(result.reason, 'warning'); return; }
        flashSpend(result);
        platform.setTier(state.officeTier);
        // The sign upgrades from hand-drawn cardboard to a polished logo
        if (companySign) { scene.remove(companySign); }
        companySign = makeCompanySign(state.companyName, state.officeTier);
        scene.add(companySign);
        showToast(` Office expanded to ${result.tier.name}! ${result.tier.slots} desk slots now available.`, 'success', 4000);
        celebrate('OFFICE UPGRADED', result.tier.name, 'good');
        mercury.surge();
      } else if (kind === 'computer') {
        beginPlacement('computer');
      } else if (kind === 'server') {
        beginPlacement('server');
      } else if (kind.startsWith('upgrade:')) {
        const id = kind.slice(8);
        const result = actionUpgradeFacility(state, id);
        if (!result.success) { showToast(result.reason, 'warning'); return; }
        flashSpend(result);
        const obj = facilityObjects.get(id);
        if (obj) { const sc = 1 + (result.level - 1) * 0.12; obj.scale.set(sc, sc, sc); } // visibly grows
        showToast(` ${result.facility.name} upgraded to Lv ${result.level}! Stronger effect, bigger upkeep.`, 'success', 4000);
        mercury.surge();
      } else {
        // facility id  enter placement mode (drag a ghost, click to place)
        beginPlacement(kind);
      }
    },
    () => { state.paused = false; }
  );
}

//  Facility Placement (drag-to-place build mode) 
function beginPlacement(id) {
  let ghost = null;
  let label = '';
  if (id === 'desk') {
    if (state.desks.length >= state.deskSlots) { showToast('Office is full - expand first.', 'warning'); return; }
    if (state.cash < CONFIG.DESK_COST) { showToast(`Need ${fmtMoney(CONFIG.DESK_COST)} for a desk.`, 'warning'); return; }
    ghost = ghostify(new DeskStation(0, false).root);
    label = 'desk';
  } else if (id === 'computer') {
    if (!state.desks.length) { showToast('Buy and place a desk first.', 'warning'); return; }
    if (!state.desks.some(d => !d.hasComputer)) { showToast('Every desk already has a computer.', 'info'); return; }
    if (state.cash < CONFIG.COMPUTER_COST) { showToast(`Need ${fmtMoney(CONFIG.COMPUTER_COST)} for a computer.`, 'warning'); return; }
    label = 'computer target';
  } else if (id === 'server') {
    if (!(state.rackDown || []).some(Boolean)) { showToast('All servers are already online.', 'info'); return; }
    if (state.cash < CONFIG.SERVER_COST) { showToast(`Need ${fmtMoney(CONFIG.SERVER_COST)} for a server.`, 'warning'); return; }
    ghost = ghostify(makeServerGhost());
    label = 'server';
  } else {
    const f = FACILITIES.find(x => x.id === id);
    if (!f) return;
    const mods = getModifiers(state);
    if (f.tier > mods.tierUnlocked) { showToast(`Locked  research Tier-${f.tier} facilities first.`, 'warning'); return; }
    if (state.cash < f.cost) { showToast(`Need ${fmtMoney(f.cost)} to build the ${f.name}.`, 'warning'); return; }
    ghost = ghostify(buildFacility(id));
    label = f.name;
  }

  cancelPlacement();
  if (ghost) scene.add(ghost);
  placing = { id, ghost };
  const message = id === 'computer'
    ? 'Click the desk that should get this computer. (Esc to cancel)'
    : `Move the ${label} and click to place it. (Esc to cancel)`;
  showToast(message, 'info', 4000);
  showPlacementHint(
    id === 'computer' ? 'Install computer' : `Place ${label}`,
    id === 'computer' ? 'Click the desk that should receive this computer.' : 'Move the preview, then click the floor to place it.'
  );
}

function makeServerGhost() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.34, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.4, roughness: 0.5 })
  );
  body.position.y = 0.17;
  g.add(body);
  for (let i = 0; i < 4; i++) {
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x34c759, emissive: 0x34c759, emissiveIntensity: 0.8 })
    );
    led.position.set(-0.3 + i * 0.16, 0.17, 0.36);
    g.add(led);
  }
  return g;
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

function findDeskFromRay(raycaster, pt = null) {
  const meshes = [];
  const meshToDesk = new Map();
  deskStations.forEach((station, deskId) => {
    station.root.traverse(obj => {
      if (obj.isMesh) {
        meshes.push(obj);
        meshToDesk.set(obj, deskId);
      }
    });
  });
  const hits = meshes.length ? raycaster.intersectObjects(meshes, false) : [];
  if (hits.length) {
    let obj = hits[0].object;
    while (obj && !meshToDesk.has(obj)) obj = obj.parent;
    const deskId = meshToDesk.get(obj || hits[0].object);
    const desk = state.desks.find(d => d.id === deskId);
    if (desk) return desk;
  }

  if (!pt) return null;
  let nearest = null;
  let nearestDist = Infinity;
  deskStations.forEach((station, deskId) => {
    const d = Math.hypot(station.root.position.x - pt.x, station.root.position.z - pt.z);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = state.desks.find(x => x.id === deskId) || null;
    }
  });
  return nearestDist <= 0.85 ? nearest : null;
}

function tryPlaceFacility(raycaster) {
  const pt = placementPoint(raycaster);
  if (placing.id === 'computer') {
    const desk = findDeskFromRay(raycaster, pt);
    if (!desk) { showToast('Click a desk to install the computer.', 'warning'); return; }
    const result = actionBuyComputer(state, desk.id);
    if (!result.success) { showToast(result.reason, 'warning'); return; }
    flashSpend(result);
    const station = deskStations.get(result.desk.id);
    if (station) station.addComputer();
    const label = result.desk.employeeId === -1 ? 'founder desk' : `desk ${result.desk.slot + 1}`;
    showToast(`Computer installed on the ${label}.`, 'success', 3000);
    mercury.surge();
    spawnConfetti(new THREE.Vector3(station?.root.position.x ?? 0, 1, station?.root.position.z ?? 0));
    cancelPlacement();
    return;
  }
  if (!pt) return;
  if (placing.id === 'desk') {
    const result = actionBuildDesk(state, { x: pt.x, z: pt.z });
    if (!result.success) { showToast(result.reason, 'warning'); cancelPlacement(); return; }
    flashSpend(result);
    createDeskStation(result.desk);
    const label = result.desk.employeeId === -1 ? 'Founder desk placed. Add a computer, then a server.' : `Employee desk placed. Slot ${result.desk.slot + 1}/${state.deskSlots}.`;
    showToast(label, 'success', 3500);
    spawnConfetti(new THREE.Vector3(pt.x, 1, pt.z));
    cancelPlacement();
    return;
  }
  if (placing.id === 'server') {
    const result = actionBuyServer(state);
    if (!result.success) { showToast(result.reason, 'warning'); cancelPlacement(); return; }
    flashSpend(result);
    const rack = furniture.serverRacks && furniture.serverRacks[result.rackIdx];
    if (rack) rack.position.set(pt.x, 0.17, pt.z);
    furniture.setRackDown(result.rackIdx, false);
    showToast('Server placed and humming. Development unlocked.', 'success', 3500);
    mercury.surge();
    spawnConfetti(new THREE.Vector3(pt.x, 1, pt.z));
    cancelPlacement();
    return;
  }
  const result = actionBuyFacility(state, placing.id);
  if (!result.success) { showToast(result.reason, 'warning'); cancelPlacement(); return; }
  flashSpend(result);
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
  hidePlacementHint();
}

function showPlacementHint(title, text) {
  const el = document.getElementById('placement-hint');
  const titleEl = document.getElementById('placement-title');
  const textEl = document.getElementById('placement-text');
  if (!el) return;
  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = text;
  el.classList.remove('hidden');
}

function hidePlacementHint() {
  const el = document.getElementById('placement-hint');
  if (el) el.classList.add('hidden');
}

function onCanvasMouseMove(event) {
  if (!placing) return;
  const canvas = document.getElementById('game-canvas');
  const rect   = canvas.getBoundingClientRect();
  const raycaster = controls.getPickRay(event.clientX - rect.left, event.clientY - rect.top);
  const pt = placementPoint(raycaster);
  if (pt && placing.ghost) placing.ghost.position.set(pt.x, 0, pt.z);
}

//  Bank Loan Modal 
function handleOpenLoanModal() {
  if (state.gameOver || state.won) return;
  cancelPlacement(); state.paused = true;
  openLoanModal(state,
    (id) => {
      state.paused = false;
      const r = actionTakeLoan(state, id);
      if (r.success) { showGainFloat(r.loan.cash, 'cash'); showToast(` Borrowed ${fmtMoney(r.loan.cash)}. Interest +${fmtMoney(r.loan.interest)}/s forever. Spend wisely.`, 'warning', 4500); }
    },
    () => { state.paused = false; }
  );
}

//  Research Modal 
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
      flashSpend(result);
      showToast(` Researched: ${result.node.name}. ${result.node.desc}`, 'success', 4500);
      mercury.surge();
    },
    () => { state.paused = false; }
  );
}

//  Hire Modal 
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
      flashSpend(result);
      const station = deskStations.get(result.desk.id);
      if (station) station.setEmployee(result.employee.colorIdx);
      initEmployeeBar(state);
      showToast(` Hired ${result.employee.name}! Salary ${fmtMoney(result.employee.salary)}/s.`, 'success', 4000);
      onStoryAction(state, 'hire', { employee: result.employee });
      mercury.surge();
    },
    () => { state.paused = false; }
  );
}

//  Develop Modal 
function handleOpenDevelopModal() {
  if (state.gameOver || state.won) return;
  const founderDesk = getFounderDesk(state);
  if (!founderDesk) {
    showToast('Buy and place your founder desk first.', 'warning');
    handleOpenBuildModal();
    return;
  }
  if (!founderDesk.hasComputer) {
    showToast('Buy a computer for your founder desk before development can start.', 'warning');
    handleOpenBuildModal();
    return;
  }
  if ((getModifiers(state).serverWorking || 0) <= 0) {
    showToast('Buy and place a server before development can start.', 'warning');
    handleOpenBuildModal();
    return;
  }
  // Must be sitting at your desk to develop  otherwise walk there first
  if (!state.founderAtDesk) {
    showToast(' Sit at your desk to develop a product.', 'warning');
    const sit = getFounderSitTarget();
    if (player && sit) goTo(sit.x, sit.z, () => {
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
      flashSpend(result);
      showToast(` Development started: ${idea.name}`, 'info', 3500);
    },
    () => { state.paused = false; }
  );
}

function handleSetDevMode(modeId) {
  if (!state.activeProduct) {
    showToast('Start a product before changing dev tactics.', 'warning');
    return;
  }
  const r = actionSetDevMode(state, modeId);
  if (!r.success) { showToast(r.reason, 'warning'); return; }
  showToast(`Dev mode: ${r.mode.label}.`, 'info', 1800);
}

function handleCrunchSprint() {
  if (!state.activeProduct) {
    showToast('Start a product before crunching.', 'warning');
    return;
  }
  if (state.cooldowns.crunch > 0) {
    showToast(`Crunch cooldown: ${state.cooldowns.crunch.toFixed(1)}s`, 'warning');
    return;
  }
  cancelPlacement(); state.paused = true;
  openBuildSprintModal(state, state.activeProduct, (score) => {
    state.paused = false;
    const r = actionResolveCrunchSprint(state, score);
    if (!r.success) { showToast(r.reason, 'warning'); return; }
    const tone = score > 0.72 ? 'success' : score > 0.42 ? 'info' : 'warning';
    const bugTxt = r.bugDelta > 0 ? `+${r.bugDelta} bugs, ` : r.bugDelta < 0 ? `${r.bugDelta} bugs, ` : '';
    showToast(`Build sprint: +${r.progress} progress, ${bugTxt}${r.qualityDelta >= 0 ? '+' : ''}${r.qualityDelta} quality.`, tone, 4200);
    if (score > 0.74) celebrate('CLEAN BUILD', `+${r.qualityDelta} quality`, 'good');
  }, () => { state.paused = false; });
}

function handleOpenProductModal() {
  if (state.gameOver || state.won) return;
  cancelPlacement(); state.paused = true;
  openProductModal(state, {
    onPrice: (index, price) => {
      const r = actionSetProductPrice(state, index, price);
      if (!r.success) showToast(r.reason, 'warning');
    },
    onRefactor: (index) => {
      const r = actionRefactorProduct(state, index);
      if (!r.success) { showToast(r.reason, 'warning'); return; }
      flashSpend(r);
      showToast(`Refactor sprint cleaned up ${r.product.idea.name}.`, 'success', 2800);
    },
    onQueueFeature: (index, featureId) => {
      const r = actionQueueFeature(state, index, featureId);
      if (!r.success) { showToast(r.reason, 'warning'); return; }
      flashSpend(r);
      showToast(`Queued ${r.feature.name} for ${r.product.idea.name}.`, 'success', 2800);
    },
    onVersionPush: (index) => {
      const r = actionVersionPushProduct(state, index);
      if (!r.success) { showToast(r.reason, 'warning'); return; }
      flashSpend(r);
      if (r.bigWin) showToast(`Version push landed! +${fmtMoney(r.mrrBoost)}/s and +${r.hype} Hype.`, 'success', 4200);
      else showToast(`Version push broke production. ${r.product.idea.name} is down for ${Math.ceil(r.outage)}s.`, 'warning', 4600);
    },
  }, () => { state.paused = false; });
}

function handleMarketingPost() {
  if (state.gameOver || state.won) return;
  if (state.cooldowns.marketing > 0) { showToast(`Marketing cooldown: ${state.cooldowns.marketing.toFixed(1)}s`, 'warning'); return; }
  if (state.cash < CONFIG.MARKETING_COST) { showToast(`Need ${fmtMoney(CONFIG.MARKETING_COST)} to run a campaign.`, 'warning'); return; }
  cancelPlacement(); state.paused = true;
  _mktGameFlip = !_mktGameFlip;
  const _mktResolve = (score) => {
    state.paused = false;
    const result = actionMarketingPost(state, score);
    if (!result.success) { showToast(result.reason || 'Marketing is not available right now.', 'warning'); return; }
    flashSpend(result);
    showGainFloat(result.hypeDelta, 'hype');
    showToast(`Campaign landed: +${result.hypeDelta} Hype.`, 'success', 4000);
    if (score >= 0.85) celebrate('GONE VIRAL', `+${result.hypeDelta} Hype`, 'hype');
    onStoryAction(state, 'marketing', {});
    mercury.surge();
  };
  if (_mktGameFlip) {
    openSquashGame({ title: 'Farm Engagement', color: '#FF4D9D', emoji: '👍', hitEmoji: '💖', note: 'Harvest every like before the algorithm buries you. Missed ones churn.', unit: 'engagements farmed', duration: 8, targetHits: 13 }, _mktResolve, () => { state.paused = false; });
  } else {
    openTapGame({ title: 'Go Viral', color: '#FF4D9D', duration: 6, instruction: 'Mash the button (or Space) to spike the campaign before the moment passes.' }, _mktResolve, () => { state.paused = false; });
  }
}

//  Pitch Modal 
function handleOpenPitchModal() {
  if (!state.live) {
    showToast('No VCs in stealth  launch your first product, then pitch.', 'warning');
    return;
  }
  if (state.cooldowns.pitch > 0) {
    showToast(`Pitch cooldown: ${state.cooldowns.pitch.toFixed(1)}s`, 'warning');
    return;
  }
  if (state.gameOver || state.won) return;

  cancelPlacement(); state.paused = true;
  pitchRoom.showVCs();

  openPitchModal(state,
    (selectedWords) => {
      pitchRoom.hideVCs();
      openTimingGame({ title: 'Read the Room', color: '#FF9A1F', rounds: 3, instruction: 'Land each beat of the pitch in the zone. Strong delivery sways the partners.' }, (deliveryScore) => {
      state.paused = false;

      const result = actionDeliverPitch(state, selectedWords, deliveryScore);
      if (!result.success) {
        showToast(result.reason || 'Pitch failed.', 'error');
        return;
      }

      if (result.caught) {
        showToast(result.reason, 'warning', 4500);
        showChyron({ net: 'VC Wire', text: `${state.companyName} pitch collapses after "creative metrics" question` });
        mercury.contract();
        return;
      }

      if (result.closed) {
        showToast(` ${result.round.name} CLOSED! Raised ${fmtMoney(result.raised)}!`, 'success', 5000);
        showGainFloat(result.raised, 'cash');
        triggerShake(true);
        showTweetPopup(state, founderTweet(state, 'round', { round: result.round.name }));
        onStoryAction(state, 'funding', { round: result.round.name });
        celebrate(`${result.round.name} CLOSED`, `+${fmtMoney(result.raised)} raised`, 'good');
        cheerTeam(2);
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
      }, () => { state.paused = false; pitchRoom.hideVCs(); });
    },
    () => {
      state.paused = false;
      pitchRoom.hideVCs();
    }
  );
}

function handleCaffeinate() {
  if (state.gameOver || state.won) return;
  if (state.cooldowns.caffeine > 0) { showToast(`Coffee cooldown: ${state.cooldowns.caffeine.toFixed(1)}s`, 'warning'); return; }
  if (state.cash < CONFIG.CAFFEINE_COST) { showToast(`Need ${fmtMoney(CONFIG.CAFFEINE_COST)} for the coffee run.`, 'warning'); return; }
  if (!state.employees.some(e => e.burnedOut || e.energy < 0.85)) { showToast('All employees still sharp.', 'info'); return; }
  cancelPlacement(); state.paused = true;
  openPourGame({ title: 'Coffee Run', note: 'Stop each pour inside the band. Burnt espresso restores nothing but resentment.' }, (score) => {
    state.paused = false;
    const result = actionCaffeinate(state, score);
    if (!result.success) { showToast(result.reason || 'Nothing to caffeinate.', 'warning'); return; }
    if (result.restoredCount === 0) { showToast('All employees still sharp.', 'info'); return; }
    flashSpend(result);
    const quality = score >= 0.9 ? 'Barista-grade!' : score >= 0.62 ? 'Solid brew.' : 'Mostly foam...';
    showToast(`☕ ${quality} ${result.restoredCount} employee(s) recharged. -${fmtMoney(CONFIG.CAFFEINE_COST)}`, score >= 0.62 ? 'success' : 'warning', 2500);
  }, () => { state.paused = false; });
}

function handlePivot() {
  const result = actionPivot(state);
  if (!result.success) {
    showToast(result.reason || 'Cannot pivot now.', 'warning');
    return;
  }
  flashSpend(result);
  showToast(` PIVOTED! Cleared ${result.cleared} PR disaster(s). -${fmtMoney(result.cost)}`, 'warning', 4000);

  // Remove all PR event cards; re-add active fire cards
  clearAllEventCards();
  state.fires.forEach(fire => addEventCard(`fire-${fire.id}`, 'fire', ' SERVER MELTDOWN', `Click it or lose ${fmtMoney(CONFIG.FIRE_CASH_DAMAGE)}!`));

  mercury.surge();
}

//  Team: pizza, promote, profile (wired to the employee bar via setTeamHandlers)
function handlePizzaParty() {
  if (state.gameOver || state.won) return;
  const r = actionPizzaParty(state);
  if (!r.success) { showToast(r.reason, 'warning'); return; }
  flashSpend(r);
  showToast(`Pizza for all ${r.count}! Morale up, productivity heroically unchanged.`, 'success', 3600);
  spawnConfetti(new THREE.Vector3(0, 1.5, 0));
  onStoryAction(state, 'pizza', {});
  initEmployeeBar(state);
}
function handlePromote(empId) {
  if (state.gameOver || state.won) return;
  const r = actionPromoteEmployee(state, empId);
  if (!r.success) { showToast(r.reason, 'warning'); return; }
  flashSpend(r);
  showToast(`${r.employee.name} is now ${r.title}! Loyalty soars, salary too.`, 'success', 4200);
  spawnConfetti(new THREE.Vector3(0, 1.5, 0));
  triggerShake();
  onStoryAction(state, 'promote', { employee: r.employee, title: r.title });
  initEmployeeBar(state);
  openEmployeeModal(state, empId);
}
function handleOpenEmployee(empId) {
  if (state.gameOver || state.won) return;
  openEmployeeModal(state, empId);
}

//  Raycasting: Click to Extinguish Fires 
function onCanvasClick(event) {
  if (!state || state.gameOver || state.won) return;

  // Ignore the click that ends a camera-orbit drag  only deliberate clicks act
  if (pointerDownPos && Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y) > 6) return;

  const canvas = document.getElementById('game-canvas');
  const rect   = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const raycaster = controls.getPickRay(x, y);

  //  Placement mode (building a facility) intercepts the click 
  if (placing) { tryPlaceFacility(raycaster); return; }

  if (state.paused) return;

  //  1) Click a server fire  send the founder over to put it out 
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
        goTo(fx, fz, () => {
          // Only extinguish if this fire is still burning when the founder arrives
          const still = state.fires.find(f => f.id === targetId);
          if (!still) { showToast('Too late  that server already burned down.', 'warning', 2500); return; }
          const fpos = still.fireObject ? still.fireObject.position3d.clone() : new THREE.Vector3(fx, 0.3, fz);
          state.paused = true;
          openFirefightModal((score) => {
            state.paused = false;
            const current = state.fires.find(f => f.id === targetId);
            if (!current) return;
            if (score < 0.45) {
              current.timer = Math.max(1.5, current.timer - 3.5);
              showToast('Firefight botched. The rack is still burning.', 'warning', 3000);
              return;
            }
            const result = actionExtinguishFire(state, current.id, score);
            if (result.success) {
              removeFireFromScene(current);
              removeEventCard(`fire-${current.id}`);
              spawnExtinguishFX(fpos);
              const bonus = result.hypeBonus;
              showToast(`Fire out! Server saved. +${bonus} HYPE`, 'success', 2500);
              mercury.surge();
            }
          });
        });
        showToast(' Run! Heading to the server fire', 'info', 1600);
      }
      return;
    }
  }

  //  2) Otherwise walk the founder to the clicked floor spot 
  if (player) {
    const pt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(FLOOR_PLANE, pt)) {
      const tx = Math.max(OFFICE_BOUNDS.minX, Math.min(OFFICE_BOUNDS.maxX, pt.x));
      const tz = Math.max(OFFICE_BOUNDS.minZ, Math.min(OFFICE_BOUNDS.maxZ, pt.z));
      goTo(tx, tz);
    }
  }
}

//  Collision obstacles for the player 
function getObstacles() {
  const obs = [];
  deskStations.forEach((st, deskId) => {
    const desk = state.desks.find(d => d.id === deskId);
    if (desk && desk.employeeId === -1) return; // your own desk is walkable so you can sit
    obs.push({ x: st.root.position.x, z: st.root.position.z, r: 0.5 });
  });
  if (furniture && furniture.serverRacks) {
    furniture.serverRacks.forEach(r => { if (r.visible) obs.push({ x: r.position.x, z: r.position.z, r: 0.7 }); });
  }
  facilityObjects.forEach(o => obs.push({ x: o.position.x, z: o.position.z, r: 0.8 }));
  return obs;
}

// Walk the founder to (x,z), routing AROUND obstacles via the pathfinder.
function goTo(x, z, onArrive) {
  if (!player) return;
  const path = findPath(
    { x: player.root.position.x, z: player.root.position.z },
    { x, z }, getObstacles(), OFFICE_BOUNDS, { cell: 0.4, agentR: 0.3 }
  );
  player.walkPath(path, onArrive);
}

//  Ambient Life: employees walk to rooms to recharge 
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
  emp.atDesk = false; // away from desk  stops contributing dev power

  const dpos = station.root.position;
  const startPt = { x: dpos.x, z: dpos.z + 0.3 };
  const roamer = new EmployeeCharacter({
    color: CHARACTER_PALETTE[emp.colorIdx % CHARACTER_PALETTE.length], walker: true,
  });
  roamer.setBasePosition(startPt.x, CHARACTER_STAND_Y, startPt.z);
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
      r.emp.atDesk = true; // back at the desk  working again
      roamers.splice(i, 1);
    }
  }
}

//  Confetti Burst 
function spawnConfetti(origin) {
  const c = new HypeConfetti(origin, scene);
  confettiList.push(c);
}

// The whole team does a little celebratory jump.
function cheerTeam(dur = 1.6) {
  deskStations.forEach(st => { if (st.cheer) st.cheer(dur); });
}

//  Extinguish FX (steam puff + flash)
function spawnExtinguishFX(pos) {
  confettiList.push(new SteamPuff(new THREE.Vector3(pos.x, 0.5, pos.z), scene));
}

//  Screen Shake (impact juice on big moments)
let _shakeTimer = null;
function triggerShake(big = false) {
  const c = document.getElementById('game-canvas');
  if (!c) return;
  c.classList.remove('fx-shake', 'fx-shake-big');
  void c.offsetWidth; // restart the animation
  c.classList.add(big ? 'fx-shake-big' : 'fx-shake');
  clearTimeout(_shakeTimer);
  _shakeTimer = setTimeout(() => c.classList.remove('fx-shake', 'fx-shake-big'), big ? 600 : 440);
}

// 
//  PAUSE
// 
function pauseGame() {
  cancelPlacement(); state.paused = true;
  const ps = document.getElementById('pause-screen');
  if (ps) { ps.classList.remove('hidden'); ps.classList.add('active'); }
}

function resumeGame() {
  state.paused = false;
  const ps = document.getElementById('pause-screen');
  if (ps) { ps.classList.remove('active'); ps.classList.add('hidden'); }
  lastTime = performance.now(); // Reset dt to avoid jump
}

// 
//  GAME OVER / WIN
// 
function onGameOver() {
  triggerShake(true);
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

// 
//  MENU NAVIGATION
// 
function setupMenuNavigation() {
  // Pre-fill a startup-name suggestion;  rerolls it
  const nameInput = document.getElementById('company-name-input');
  const rerollBtn = document.getElementById('btn-reroll-name');
  if (nameInput && !nameInput.value) nameInput.value = genCompanyIdentity().name;
  if (rerollBtn && nameInput) rerollBtn.onclick = () => { nameInput.value = genCompanyIdentity().name; };

  document.getElementById('btn-start').onclick = () => {
    if (!bootReady) {
      const msg = bootError
        ? `Startup scene failed to initialize: ${bootError.message || bootError}`
        : 'Still booting the office scene. Try again in a moment.';
      showToast(msg, bootError ? 'error' : 'info', 5000);
      console.warn(msg);
      return;
    }
    startGame();
  };

  document.getElementById('btn-how-to-play').onclick = () => {
    showScreen('how-to-play-screen');
  };

  const _wm = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  _wm('btn-back-to-menu', () => showScreen('main-menu'));
  _wm('btn-resume', () => resumeGame());
  _wm('btn-quit-to-menu', () => { stopGame(); hideHUD(); clearAllEventCards(); showScreen('main-menu'); });

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

//  Utility 
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//  THREE availability check (loaded globally) 
if (typeof window.THREE === 'undefined') {
  console.error('Three.js not loaded! Check js/lib/three.min.js');
}

// 
//  BOOTSTRAP
// 
document.addEventListener('DOMContentLoaded', () => {
  setupMenuNavigation();
  init().catch(err => {
    bootReady = false;
    bootError = err;
    window._startupPanicBoot = { ready: false, error: err.message || String(err) };
    console.error('Init failed:', err);
    hideScreen('loading-screen');
    showScreen('main-menu');
    const status = document.getElementById('loading-status');
    if (status) {
      status.textContent = 'Initialization failed. Check console.';
      status.style.color = '#FF4C4C';
    }
    showToast(`Startup scene failed: ${err.message || err}`, 'error', 7000);
  });
});
