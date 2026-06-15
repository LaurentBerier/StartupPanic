/**
 * gameLogic.js — Core game mechanics, tycoon economy, and event management.
 *
 * Covers:
 *  - Cash economy: burn rate (base + salaries) vs MRR from shipped products
 *  - Office building: desks + computers (capacity for hiring)
 *  - Hiring: candidates with roles, salaries and personality traits
 *  - Personality quirk events
 *  - Product development: absurd products that ship and generate MRR
 *  - VC funding rounds (Pre-Seed → Series C) — the win path
 *  - Server fires, PR disasters, burnout, pivot
 */

import { clamp } from './tween.js';

// ─── Game Constants ───────────────────────────────────────────────────────────
export const CONFIG = {
  // Economy
  STARTING_CASH:         60000,
  BASE_BURN_PER_SEC:     80,     // $/s fixed costs (rent, AWS, kombucha tap)
  MRR_HYPE_FLOOR:        0.4,    // revenue multiplier at 0 hype
  MRR_HYPE_SCALE:        0.9,    // extra revenue multiplier at 100 hype

  // Hype
  HYPE_MAX:              100,
  HYPE_DECAY_PER_SEC:    1.5,
  HYPE_LAUNCH_BURST:     18,     // base hype per feature launch stunt

  // Office building
  DESK_SLOTS:            6,
  DESK_COST:             6000,
  COMPUTER_COST:         4000,
  NO_COMPUTER_PENALTY:   0.5,    // productivity multiplier without a computer

  // Hiring
  HIRE_SIGNING_BONUS:    1500,

  // Employees
  ENERGY_DECAY_PER_SEC:  0.012,
  BURNOUT_HYPE_DRAIN:    1.2,    // hype/s drained per burned-out employee
  CAFFEINE_COST:         400,
  CAFFEINE_RESTORE:      0.65,

  // Events
  FIRE_CASH_DAMAGE:      6000,
  FIRE_DURATION:         12,
  FIRE_SPAWN_INTERVAL:   [22, 40],
  PR_HYPE_DRAIN_PER_SEC: 3.0,
  PR_DURATION:           [15, 30],
  PR_SPAWN_INTERVAL:     [30, 55],
  QUIRK_INTERVAL:        [16, 30],

  PIVOT_CASH_COST:       8000,

  // Cooldowns (seconds)
  CD_LAUNCH:             8,
  CD_PITCH:              22,
  CD_CAFFEINE:           10,
  CD_PIVOT:              45,

  // Glitch overlay starts when runway falls below this many seconds
  RUNWAY_GLITCH_SEC:     45,
};

// ─── Roles ────────────────────────────────────────────────────────────────────
export const ROLES = {
  eng:    { key: 'eng',    label: 'ENGINEER',      icon: '⌨️', dev: 1.2,  hypeAura: 0,    salaryRange: [45, 70] },
  design: { key: 'design', label: 'DESIGNER',      icon: '🎨', dev: 0.8,  hypeAura: 0.15, salaryRange: [35, 55] },
  growth: { key: 'growth', label: 'GROWTH HACKER', icon: '📈', dev: 0.35, hypeAura: 0.45, salaryRange: [30, 50] },
};

// ─── Personalities ────────────────────────────────────────────────────────────
// devMult: dev speed multiplier; energyMult: burnout speed multiplier;
// caffeineMult: how hard coffee hits; pitchBonus: added to pitch quality;
// hypeAura: passive hype/s; quirk: random event key; quirkChance: per quirk tick.
export const PERSONALITIES = {
  cofounder: {
    label: 'CO-FOUNDER', icon: '🦄',
    desc: 'Paid in equity and vibes. Surprisingly stable.',
    devMult: 1.0, energyMult: 0.7, hypeAura: 0.1, quirk: 'viral', quirkChance: 0.2,
  },
  tenx: {
    label: '10X ENGINEER', icon: '⚡',
    desc: 'Ships twice as fast. Combusts twice as fast.',
    devMult: 2.2, energyMult: 2.5, quirk: 'crunch', quirkChance: 0.35,
  },
  zen: {
    label: 'ZEN MASTER', icon: '🧘',
    desc: 'Never burns out. Deadlines are a social construct.',
    devMult: 0.65, energyMult: 0.1, quirk: 'meditate', quirkChance: 0.3,
  },
  cryptobro: {
    label: 'CRYPTO BRO', icon: '🪙',
    desc: '+25% pitch quality. Occasionally launches an unauthorized token.',
    devMult: 0.85, pitchBonus: 0.25, quirk: 'pr', quirkChance: 0.3,
  },
  gremlin: {
    label: 'CAFFEINE GREMLIN', icon: '🧌',
    desc: 'Runs hot, steals coworkers\' espresso. Coffee hits twice as hard.',
    devMult: 1.35, energyMult: 1.6, caffeineMult: 2, quirk: 'steal', quirkChance: 0.35,
  },
  influencer: {
    label: 'LINKEDIN INFLUENCER', icon: '📱',
    desc: 'Posts about hustle instead of hustling. Constant hype trickle.',
    devMult: 0.5, energyMult: 0.8, hypeAura: 0.6, quirk: 'viral', quirkChance: 0.4,
  },
  drama: {
    label: 'DRAMA MAGNET', icon: '🎭',
    desc: 'Great output. Exhausts everyone within Slack radius.',
    devMult: 1.3, quirk: 'drain_team', quirkChance: 0.35,
  },
  quiet: {
    label: 'QUIET GENIUS', icon: '🤫',
    desc: 'Refuses meetings. Code appears mysteriously at 3AM.',
    devMult: 1.7, energyMult: 0.9, quirk: 'silent_ship', quirkChance: 0.3,
  },
};

const HIREABLE_PERSONALITIES = Object.keys(PERSONALITIES).filter(k => k !== 'cofounder');

export const CANDIDATE_NAMES = [
  'JAX', 'KIKI', 'PIPER', 'RIVER', 'NOVA', 'SAGE', 'KALE', 'CHAD III',
  'LUMEN', 'FENNEC', 'BLAZE', 'WREN', 'MOSS', 'TATE', 'JUNIPER', 'ORION',
  'BEX', 'HARLOW', 'DASH', 'ZILLOW (LEGAL NAME)',
];

// ─── Absurd Product Ideas ─────────────────────────────────────────────────────
// devPoints: effort to ship; mrr: $/s base revenue; hype: burst on ship;
// absurdity: flavor multiplier shown to player (affects pitch quality slightly).
export const PRODUCT_IDEAS = [
  { name: 'ToastGPT',            desc: 'An AI toaster that roasts you before your bread.',           devPoints: 55,  mrr: 220, hype: 12, absurdity: 1.1 },
  { name: 'CryBaby Analytics',   desc: 'Detects when users cry, upsells them tissues.',              devPoints: 70,  mrr: 300, hype: 14, absurdity: 1.2 },
  { name: 'BlockchainForCats',   desc: 'Decentralized litter box consensus protocol.',               devPoints: 80,  mrr: 340, hype: 16, absurdity: 1.4 },
  { name: 'MoodCloud',           desc: 'Stores feelings in the cloud. Free tier deletes happiness.', devPoints: 65,  mrr: 280, hype: 13, absurdity: 1.2 },
  { name: 'AI Stand-Up Desk',    desc: 'Does stand-up comedy about your posture.',                   devPoints: 60,  mrr: 250, hype: 12, absurdity: 1.1 },
  { name: 'SynergyJuicer',       desc: 'Juices synergy. Literally. Please stop asking.',             devPoints: 90,  mrr: 420, hype: 18, absurdity: 1.5 },
  { name: 'GhostScrum',          desc: 'An AI scrum master that haunts your sprints.',               devPoints: 75,  mrr: 330, hype: 15, absurdity: 1.3 },
  { name: 'NFT Air',             desc: 'Tokenized breathing. Each breath is non-fungible.',          devPoints: 50,  mrr: 200, hype: 16, absurdity: 1.6 },
  { name: 'VibeCompiler',        desc: 'Compiles vibes straight to production. Mostly segfaults.',   devPoints: 100, mrr: 480, hype: 20, absurdity: 1.4 },
  { name: 'DateMyData',          desc: 'Your spreadsheet deserves love too.',                        devPoints: 70,  mrr: 310, hype: 14, absurdity: 1.3 },
  { name: 'QuantumYoga',         desc: 'Be in two poses at once. Namaste, probably.',                devPoints: 85,  mrr: 380, hype: 17, absurdity: 1.4 },
  { name: 'PetrichorAI',         desc: 'The smell of rain, as a service. $99/mo.',                   devPoints: 95,  mrr: 450, hype: 18, absurdity: 1.5 },
  { name: 'InfluencerEgg',       desc: 'An egg with 4M followers that endorses your brand.',         devPoints: 60,  mrr: 260, hype: 19, absurdity: 1.7 },
  { name: 'SaaSquatch',          desc: 'Enterprise software no one has ever actually seen.',         devPoints: 110, mrr: 520, hype: 21, absurdity: 1.6 },
];

// ─── Funding Rounds (the win ladder) ──────────────────────────────────────────
export const FUNDING_ROUNDS = [
  { name: 'PRE-SEED', amount: 50000,   reqProducts: 0, reqHype: 20, blurb: 'An angel investor with FOMO.' },
  { name: 'SEED',     amount: 150000,  reqProducts: 1, reqHype: 35, blurb: 'They want to see "a product". Any product.' },
  { name: 'SERIES A', amount: 400000,  reqProducts: 2, reqHype: 50, blurb: 'Growth or get out.' },
  { name: 'SERIES B', amount: 1000000, reqProducts: 4, reqHype: 60, blurb: 'The partners demand absurdity at scale.' },
  { name: 'SERIES C', amount: 2500000, reqProducts: 6, reqHype: 75, blurb: 'Close this round and ring the IPO bell.' },
];

// ─── Buzzword Database ────────────────────────────────────────────────────────
export const BUZZWORDS = [
  { word: 'Blockchain',      category: 'tech',    mult: 1.2 },
  { word: 'AI-Native',       category: 'tech',    mult: 1.5 },
  { word: 'Quantum',         category: 'tech',    mult: 1.4 },
  { word: 'Metaverse',       category: 'tech',    mult: 1.0 },
  { word: 'Web3',            category: 'tech',    mult: 1.1 },
  { word: 'Neural',          category: 'tech',    mult: 1.3 },
  { word: 'Disruption',      category: 'biz',     mult: 1.2 },
  { word: 'Synergy',         category: 'biz',     mult: 0.9 },
  { word: 'Pivot',           category: 'biz',     mult: 1.0 },
  { word: 'Scale',           category: 'biz',     mult: 1.1 },
  { word: 'B2B SaaS',        category: 'biz',     mult: 1.3 },
  { word: '10x Returns',     category: 'biz',     mult: 1.4 },
  { word: 'Unicorn Path',    category: 'biz',     mult: 1.6 },
  { word: 'Democratize',     category: 'social',  mult: 1.1 },
  { word: 'Impact',          category: 'social',  mult: 1.0 },
  { word: 'Ecosystem',       category: 'social',  mult: 1.2 },
  { word: 'Platform Play',   category: 'biz',     mult: 1.3 },
  { word: 'ML Pipeline',     category: 'tech',    mult: 1.4 },
  { word: 'Zero-Shot',       category: 'tech',    mult: 1.5 },
  { word: 'AGI Adjacent',    category: 'tech',    mult: 1.8 },
  { word: 'Moat',            category: 'biz',     mult: 1.2 },
  { word: 'Flywheel',        category: 'biz',     mult: 1.1 },
  { word: 'Series A Ready',  category: 'biz',     mult: 1.0 },
  { word: 'Pre-Traction',    category: 'biz',     mult: 0.8 },
  { word: 'Token Economy',   category: 'tech',    mult: 1.2 },
  { word: 'Frictionless',    category: 'social',  mult: 1.0 },
];

// ─── Feature Announcement Templates ──────────────────────────────────────────
const FEATURE_TEMPLATES = [
  'We\'re launching [X]GPT — the first AI that generates [Y].',
  'Introducing [X] 2.0: now [Y] at scale.',
  'Our [X] model achieves [Y]-level performance at 1/100th the cost.',
  '[X] meets [Y] in our revolutionary new product.',
  'We\'ve open-sourced our [X] engine. [Y] is just the beginning.',
  'Announcing [X]-as-a-Service. [Y] has never been easier.',
  'Breaking: Our AI taught itself [X] overnight. Also [Y].',
  '[X] is deprecated. We\'ve reinvented it as [Y].',
  'We\'re not building [X]. We\'re building the [Y] of [X].',
  'Our [X] doesn\'t just predict [Y]. It invents new [Y].',
];

const FEATURE_X = ['Mercury', 'Obsidian', 'Quantum', 'Neural', 'Synth', 'Vertex', 'Lambda', 'Cortex'];
const FEATURE_Y = ['sentience', 'general intelligence', 'disruption', 'value alignment',
                   'consciousness', 'creativity', 'empathy at scale', 'autonomous agency'];

const PR_DISASTERS = [
  { title: 'DATA BREACH',      desc: 'We left the database public again.',        severity: 1.2 },
  { title: 'VIRAL THREAD',     desc: 'A dev tweeted our burn rate. In detail.',   severity: 1.0 },
  { title: 'AI HALLUCINATION', desc: 'The AI gave medical advice. Wrong advice.', severity: 1.4 },
  { title: 'CEO GAFFE',        desc: 'You said "users are just metrics" live.',   severity: 1.3 },
  { title: 'EQUITY DRAMA',     desc: 'Early employees comparing Carta shares.',   severity: 0.9 },
  { title: 'DEMO FAILURE',     desc: 'TechCrunch demo crashed. Twice.',           severity: 1.1 },
  { title: 'LAWSUIT',          desc: 'Legal called. The TOS we ignored matters.', severity: 1.5 },
  { title: 'TALENT EXODUS',    desc: 'Lead engineer posted "I quit" on Medium.',  severity: 1.2 },
  { title: 'MEDIA EXPOSÉ',     desc: 'Bloomberg says we\'re "vibe-funded".',      severity: 1.0 },
  { title: 'VC DOUBT',         desc: 'Our lead investor asked for traction data.',severity: 0.8 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randRange([min, max]) { return min + Math.random() * (max - min); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function fmtMoney(n) {
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e9) return `${sign}$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(n)}`;
}

// ─── Game State ────────────────────────────────────────────────────────────────
export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.cash     = CONFIG.STARTING_CASH;
    this.hype     = 25;
    this.time     = 0;
    this.paused   = false;
    this.gameOver = false;
    this.won      = false;

    this.cooldowns = { launch: 0, pitch: 0, caffeine: 0, pivot: 0 };

    this.fires       = [];  // { id, timer, maxTimer, fireObject }
    this.prDisasters = [];  // { id, title, desc, timer, maxTimer, severity }

    // Office: you start with 2 desks (one with a computer) and your co-founder
    this.desks = [
      { id: 0, slot: 0, hasComputer: true,  employeeId: 0    },
      { id: 1, slot: 1, hasComputer: false, employeeId: null },
    ];

    this.employees = [{
      id: 0, name: 'MO', role: 'eng', personality: 'cofounder',
      salary: 0, energy: 1.0, burnedOut: false, deskId: 0, colorIdx: 0,
    }];

    // Products
    this.activeProduct   = null;  // { idea, progress }
    this.shippedProducts = [];    // { idea, shelfIdx }

    // Funding
    this.roundIndex  = 0;
    this.totalRaised = 0;

    // Spawn timers
    this._nextFireTime  = randRange(CONFIG.FIRE_SPAWN_INTERVAL);
    this._nextPRTime    = randRange(CONFIG.PR_SPAWN_INTERVAL);
    this._nextQuirkTime = randRange(CONFIG.QUIRK_INTERVAL);

    this.stats = {
      launches: 0, pitches: 0, firesKilled: 0, caffeinations: 0, pivots: 0,
      hires: 0, productsShipped: 0, peakHype: 0,
    };

    this._eventIdCounter = 0;
    this._entityIdCounter = 1; // 0 taken by co-founder/desk
  }

  nextEventId()  { return ++this._eventIdCounter; }
  nextEntityId() { return ++this._entityIdCounter; }
}

// ─── Derived Values ───────────────────────────────────────────────────────────
export function getEmployeeDevPower(state, emp) {
  if (emp.burnedOut) return 0;
  const role = ROLES[emp.role];
  const p    = PERSONALITIES[emp.personality];
  const desk = state.desks.find(d => d.id === emp.deskId);
  const computerMult = (desk && desk.hasComputer) ? 1 : CONFIG.NO_COMPUTER_PENALTY;
  return role.dev * (p.devMult ?? 1) * (0.35 + 0.65 * emp.energy) * computerMult;
}

export function getTeamDevPower(state) {
  return state.employees.reduce((s, e) => s + getEmployeeDevPower(state, e), 0);
}

export function getHypeAura(state) {
  return state.employees.reduce((s, e) => {
    if (e.burnedOut) return s;
    return s + (ROLES[e.role].hypeAura ?? 0) + (PERSONALITIES[e.personality].hypeAura ?? 0);
  }, 0);
}

export function getSalaryBurn(state) {
  return state.employees.reduce((s, e) => s + e.salary, 0);
}

export function getBurnRate(state) {
  return CONFIG.BASE_BURN_PER_SEC + getSalaryBurn(state);
}

export function getMRR(state) {
  const base = state.shippedProducts.reduce((s, p) => s + p.idea.mrr, 0);
  return base * (CONFIG.MRR_HYPE_FLOOR + CONFIG.MRR_HYPE_SCALE * (state.hype / CONFIG.HYPE_MAX));
}

export function getNetCashFlow(state) {
  return getMRR(state) - getBurnRate(state);
}

export function getRunwaySeconds(state) {
  const net = getNetCashFlow(state);
  if (net >= 0) return Infinity;
  return state.cash / -net;
}

export function getValuation(state) {
  return state.totalRaised * 3 + getMRR(state) * 1200 + state.hype * 25000;
}

export function getGlitchLevel(state) {
  const sec = getRunwaySeconds(state);
  if (sec > CONFIG.RUNWAY_GLITCH_SEC) return 0;
  return 1 - sec / CONFIG.RUNWAY_GLITCH_SEC; // 0..1 intensity
}

// ─── Candidate / Product Generation ──────────────────────────────────────────
export function generateCandidates(state, count = 3) {
  const usedNames = new Set(state.employees.map(e => e.name));
  const pool = CANDIDATE_NAMES.filter(n => !usedNames.has(n));
  const candidates = [];
  const usedPersonalities = new Set();

  for (let i = 0; i < count; i++) {
    const name = pool.length ? pool.splice(Math.floor(Math.random() * pool.length), 1)[0] : `HIRE-${Math.floor(Math.random() * 999)}`;
    // Avoid duplicate personalities within one batch
    let pKeys = HIREABLE_PERSONALITIES.filter(k => !usedPersonalities.has(k));
    if (!pKeys.length) pKeys = HIREABLE_PERSONALITIES;
    const personality = pick(pKeys);
    usedPersonalities.add(personality);

    const role   = pick(Object.keys(ROLES));
    const salary = Math.round(randRange(ROLES[role].salaryRange) / 5) * 5;
    candidates.push({ name, role, personality, salary });
  }
  return candidates;
}

export function generateProductChoices(state, count = 3) {
  const taken = new Set(state.shippedProducts.map(p => p.idea.name));
  if (state.activeProduct) taken.add(state.activeProduct.idea.name);
  const pool = PRODUCT_IDEAS.filter(p => !taken.has(p.name));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ─── Pitch Mechanics ──────────────────────────────────────────────────────────
export function getPitchBuzzwords(count = 12) {
  const shuffled = [...BUZZWORDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function calcPitchQuality(state, selectedBuzzwords) {
  if (!selectedBuzzwords.length) return 0;

  const categories = new Set(selectedBuzzwords.map(b => b.category));
  const diversityBonus = categories.size >= 3 ? 1.35 : categories.size === 2 ? 1.15 : 1.0;
  const legendaryBonus = selectedBuzzwords.some(b => b.mult >= 1.5) ? 1.15 : 1.0;
  const avgMult = selectedBuzzwords.reduce((s, b) => s + b.mult, 0) / selectedBuzzwords.length;

  let quality = avgMult * diversityBonus * legendaryBonus;

  // Team pitch bonuses (e.g. Crypto Bro)
  for (const emp of state.employees) {
    if (!emp.burnedOut) quality += PERSONALITIES[emp.personality].pitchBonus ?? 0;
  }
  // A little absurdity goes a long way with VCs
  const absurdity = state.shippedProducts.reduce((s, p) => s + (p.idea.absurdity - 1), 0);
  quality += Math.min(0.3, absurdity * 0.05);

  return quality;
}

/**
 * Shared by the modal preview and the deliver action so they always agree.
 */
export function estimatePitch(state, selectedBuzzwords) {
  const round = FUNDING_ROUNDS[state.roundIndex] || null;
  const quality = calcPitchQuality(state, selectedBuzzwords);
  if (!round) return { round: null, quality, meets: false, willClose: false, projected: 0 };

  const meets = state.shippedProducts.length >= round.reqProducts
             && state.hype >= round.reqHype;
  const willClose = meets && quality >= 1.05;
  const projected = willClose
    ? Math.round(round.amount * Math.min(1.5, 0.7 + quality * 0.3))
    : Math.round(round.amount * 0.06 * quality);

  return { round, quality, meets, willClose, projected };
}

export function buildPitchSentence(words) {
  if (words.length === 0) return '"Our platform leverages..."';
  if (words.length === 1) return `"We leverage ${words[0].word} to disrupt the status quo."`;
  if (words.length === 2) return `"Our ${words[0].word} platform delivers ${words[1].word} at unprecedented scale."`;
  const template = FEATURE_TEMPLATES[Math.floor(Math.random() * FEATURE_TEMPLATES.length)]
    .replaceAll('[X]', words[0].word)
    .replaceAll('[Y]', words[1].word);
  return `"${template}"`;
}

export function getRandomFeatureAnnouncement() {
  const template = pick(FEATURE_TEMPLATES);
  return template.replaceAll('[X]', pick(FEATURE_X)).replaceAll('[Y]', pick(FEATURE_Y));
}

// ─── Quirk Events ─────────────────────────────────────────────────────────────
function applyQuirk(state, emp, events) {
  const p = PERSONALITIES[emp.personality];
  switch (p.quirk) {
    case 'crunch': {
      if (!state.activeProduct) return;
      state.activeProduct.progress += 15;
      emp.energy = Math.max(0.05, emp.energy - 0.25);
      events.push({ type: 'quirk', employee: emp, tone: 'warning',
        text: `⚡ ${emp.name} entered hyperfocus. +15 dev progress, energy tanked.` });
      break;
    }
    case 'meditate': {
      for (const e of state.employees) e.energy = Math.min(1, e.energy + 0.1);
      events.push({ type: 'quirk', employee: emp, tone: 'success',
        text: `🧘 ${emp.name} led a breathing exercise. Team +10% energy.` });
      break;
    }
    case 'pr': {
      const duration = randRange(CONFIG.PR_DURATION);
      const prEvent = {
        id: state.nextEventId(),
        title: 'ROGUE TOKEN LAUNCH',
        desc: `${emp.name} launched $${emp.name.replace(/[^A-Z]/g, '')}COIN without asking.`,
        timer: duration, maxTimer: duration, severity: 1.3,
      };
      state.prDisasters.push(prEvent);
      events.push({ type: 'spawn_pr', pr: prEvent });
      events.push({ type: 'quirk', employee: emp, tone: 'error',
        text: `🪙 ${emp.name} launched an unauthorized token. PR is melting.` });
      break;
    }
    case 'steal': {
      const others = state.employees.filter(e => e !== emp && !e.burnedOut);
      if (!others.length) return;
      const victim = pick(others);
      victim.energy = Math.max(0.05, victim.energy - 0.2);
      emp.energy    = Math.min(1, emp.energy + 0.2);
      events.push({ type: 'quirk', employee: emp, tone: 'warning',
        text: `🧌 ${emp.name} stole ${victim.name}'s espresso. ${victim.name} is fading.` });
      break;
    }
    case 'viral': {
      state.hype = clamp(state.hype + 8, 0, CONFIG.HYPE_MAX);
      events.push({ type: 'quirk', employee: emp, tone: 'success',
        text: `📱 ${emp.name}'s post went viral. +8 Hype.` });
      break;
    }
    case 'drain_team': {
      for (const e of state.employees) {
        if (e !== emp && !e.burnedOut) e.energy = Math.max(0.05, e.energy - 0.12);
      }
      events.push({ type: 'quirk', employee: emp, tone: 'warning',
        text: `🎭 ${emp.name} started a reply-all war. Team energy drained.` });
      break;
    }
    case 'silent_ship': {
      if (!state.activeProduct) return;
      state.activeProduct.progress += 10;
      events.push({ type: 'quirk', employee: emp, tone: 'success',
        text: `🤫 ${emp.name} silently pushed 40 commits overnight. +10 dev progress.` });
      break;
    }
  }
}

// ─── Game Update Logic ─────────────────────────────────────────────────────────
export function updateGame(state, dt) {
  if (state.paused || state.gameOver || state.won) return [];

  const events = [];
  state.time += dt;

  // ── Cooldowns ──
  for (const key of Object.keys(state.cooldowns)) {
    if (state.cooldowns[key] > 0) {
      state.cooldowns[key] = Math.max(0, state.cooldowns[key] - dt);
    }
  }

  // ── Employee Energy / Burnout ──
  let burnoutCount = 0;
  for (const emp of state.employees) {
    const p = PERSONALITIES[emp.personality];
    if (!emp.burnedOut) {
      emp.energy = Math.max(0, emp.energy - CONFIG.ENERGY_DECAY_PER_SEC * (p.energyMult ?? 1) * dt);
      if (emp.energy <= 0) {
        emp.burnedOut = true;
        events.push({ type: 'burnout', employee: emp });
      }
    }
    if (emp.burnedOut) burnoutCount++;
  }

  // ── Hype ──
  let hypeDelta = -CONFIG.HYPE_DECAY_PER_SEC;
  hypeDelta -= burnoutCount * CONFIG.BURNOUT_HYPE_DRAIN;
  for (const pr of state.prDisasters) hypeDelta -= CONFIG.PR_HYPE_DRAIN_PER_SEC * pr.severity;
  hypeDelta += getHypeAura(state);
  state.hype = clamp(state.hype + hypeDelta * dt, 0, CONFIG.HYPE_MAX);

  // ── Product Development ──
  if (state.activeProduct) {
    state.activeProduct.progress += getTeamDevPower(state) * dt;
    if (state.activeProduct.progress >= state.activeProduct.idea.devPoints) {
      const product = { idea: state.activeProduct.idea, shelfIdx: state.shippedProducts.length };
      state.shippedProducts.push(product);
      state.activeProduct = null;
      state.hype = clamp(state.hype + product.idea.hype, 0, CONFIG.HYPE_MAX);
      state.stats.productsShipped++;
      events.push({ type: 'product_shipped', product });
    }
  }

  // ── Cash Flow ──
  state.cash += getNetCashFlow(state) * dt;

  // ── Active Fire Timers ──
  for (let i = state.fires.length - 1; i >= 0; i--) {
    const fire = state.fires[i];
    fire.timer -= dt;
    if (fire.timer <= 0) {
      state.cash = Math.max(0, state.cash - CONFIG.FIRE_CASH_DAMAGE);
      events.push({ type: 'fire_damage', fire, penalty: CONFIG.FIRE_CASH_DAMAGE });
      state.fires.splice(i, 1);
      if (fire.fireObject) fire.fireObject.extinguish(window._gameScene);
    }
  }

  // ── Active PR Timers ──
  for (let i = state.prDisasters.length - 1; i >= 0; i--) {
    const pr = state.prDisasters[i];
    pr.timer -= dt;
    if (pr.timer <= 0) {
      events.push({ type: 'pr_resolved', pr });
      state.prDisasters.splice(i, 1);
    }
  }

  // ── Event Spawning: Fires ──
  state._nextFireTime -= dt;
  if (state._nextFireTime <= 0) {
    events.push({ type: 'spawn_fire' });
    state._nextFireTime = randRange(CONFIG.FIRE_SPAWN_INTERVAL);
  }

  // ── Event Spawning: PR Disasters ──
  state._nextPRTime -= dt;
  if (state._nextPRTime <= 0) {
    const template = pick(PR_DISASTERS);
    const duration = randRange(CONFIG.PR_DURATION);
    const prEvent = {
      id: state.nextEventId(),
      title: template.title, desc: template.desc,
      timer: duration, maxTimer: duration, severity: template.severity,
    };
    state.prDisasters.push(prEvent);
    events.push({ type: 'spawn_pr', pr: prEvent });
    state._nextPRTime = randRange(CONFIG.PR_SPAWN_INTERVAL);
  }

  // ── Personality Quirks ──
  state._nextQuirkTime -= dt;
  if (state._nextQuirkTime <= 0) {
    state._nextQuirkTime = randRange(CONFIG.QUIRK_INTERVAL);
    if (state.employees.length) {
      const emp = pick(state.employees);
      const p = PERSONALITIES[emp.personality];
      if (!emp.burnedOut && Math.random() < (p.quirkChance ?? 0)) {
        applyQuirk(state, emp, events);
      }
    }
  }

  // ── Stats / Lose Condition ──
  state.stats.peakHype = Math.max(state.stats.peakHype, state.hype);

  if (state.cash <= 0) {
    state.cash = 0;
    state.gameOver = true;
    events.push({ type: 'game_over' });
  }

  return events;
}

// ─── Player Actions ────────────────────────────────────────────────────────────

/**
 * Buy a new desk (next free slot).
 */
export function actionBuildDesk(state) {
  if (state.desks.length >= CONFIG.DESK_SLOTS) {
    return { success: false, reason: 'Office is full. No more desk slots.' };
  }
  if (state.cash < CONFIG.DESK_COST) {
    return { success: false, reason: `Need ${fmtMoney(CONFIG.DESK_COST)} for a desk.` };
  }
  state.cash -= CONFIG.DESK_COST;
  const desk = {
    id: state.nextEntityId(),
    slot: state.desks.length,
    hasComputer: false,
    employeeId: null,
  };
  state.desks.push(desk);
  return { success: true, desk };
}

/**
 * Buy a computer for a desk that lacks one (prefers occupied desks).
 */
export function actionBuyComputer(state) {
  const candidates = state.desks
    .filter(d => !d.hasComputer)
    .sort((a, b) => (b.employeeId !== null) - (a.employeeId !== null));
  if (!candidates.length) {
    return { success: false, reason: 'Every desk already has a computer.' };
  }
  if (state.cash < CONFIG.COMPUTER_COST) {
    return { success: false, reason: `Need ${fmtMoney(CONFIG.COMPUTER_COST)} for a computer.` };
  }
  state.cash -= CONFIG.COMPUTER_COST;
  const desk = candidates[0];
  desk.hasComputer = true;
  return { success: true, desk };
}

/**
 * Hire a candidate — needs a free desk and the signing bonus.
 */
export function actionHireCandidate(state, candidate) {
  const desk = state.desks.find(d => d.employeeId === null);
  if (!desk) {
    return { success: false, reason: 'No free desk! Build one first.' };
  }
  if (state.cash < CONFIG.HIRE_SIGNING_BONUS) {
    return { success: false, reason: `Need ${fmtMoney(CONFIG.HIRE_SIGNING_BONUS)} signing bonus.` };
  }
  state.cash -= CONFIG.HIRE_SIGNING_BONUS;

  const employee = {
    id: state.nextEntityId(),
    name: candidate.name,
    role: candidate.role,
    personality: candidate.personality,
    salary: candidate.salary,
    energy: 1.0,
    burnedOut: false,
    deskId: desk.id,
    colorIdx: state.employees.length % 6,
  };
  desk.employeeId = employee.id;
  state.employees.push(employee);
  state.stats.hires++;

  return { success: true, employee, desk };
}

/**
 * Start developing a product idea.
 */
export function actionStartProduct(state, idea) {
  if (state.activeProduct) {
    return { success: false, reason: `Already building ${state.activeProduct.idea.name}.` };
  }
  if (!state.employees.length) {
    return { success: false, reason: 'No employees to build it. Hire someone!' };
  }
  state.activeProduct = { idea, progress: 0 };
  return { success: true, idea };
}

/**
 * Launch a feature — marketing stunt that generates a Hype burst.
 */
export function actionLaunchFeature(state) {
  if (state.cooldowns.launch > 0) {
    return { success: false, reason: `Cooldown: ${state.cooldowns.launch.toFixed(1)}s` };
  }
  if (state.paused || state.gameOver || state.won) return { success: false };

  const hypeGained = CONFIG.HYPE_LAUNCH_BURST * (1 + Math.random() * 0.4 - 0.2);
  state.hype = clamp(state.hype + hypeGained, 0, CONFIG.HYPE_MAX);
  state.cooldowns.launch = CONFIG.CD_LAUNCH;
  state.stats.launches++;

  return {
    success: true,
    announcement: getRandomFeatureAnnouncement(),
    hypeGained: Math.round(hypeGained),
  };
}

/**
 * Deliver a VC pitch for the current funding round.
 * Closing a round requires meeting its product/hype requirements AND a
 * good buzzword quality score. Otherwise the VCs pass and toss bridge money.
 */
export function actionDeliverPitch(state, selectedBuzzwords) {
  if (state.cooldowns.pitch > 0) {
    return { success: false, reason: `Cooldown: ${state.cooldowns.pitch.toFixed(1)}s` };
  }
  if (state.gameOver || state.won) return { success: false };
  if (state.roundIndex >= FUNDING_ROUNDS.length) {
    return { success: false, reason: 'All rounds raised. You already won?' };
  }

  const est = estimatePitch(state, selectedBuzzwords);
  state.cooldowns.pitch = CONFIG.CD_PITCH;
  state.stats.pitches++;

  if (est.willClose) {
    state.cash        += est.projected;
    state.totalRaised += est.projected;
    state.hype         = clamp(state.hype + 18, 0, CONFIG.HYPE_MAX);
    const closedRound  = est.round;
    state.roundIndex++;

    const won = state.roundIndex >= FUNDING_ROUNDS.length;
    if (won) state.won = true;

    return { success: true, closed: true, raised: est.projected, round: closedRound, won };
  }

  // VCs pass — small bridge check out of pity (or boredom)
  state.cash        += est.projected;
  state.totalRaised += est.projected;
  state.hype         = clamp(state.hype + 4, 0, CONFIG.HYPE_MAX);

  let reason;
  if (!est.meets) {
    const r = est.round;
    const needP = Math.max(0, r.reqProducts - state.shippedProducts.length);
    reason = needP > 0
      ? `VCs want ${r.reqProducts} shipped product${r.reqProducts > 1 ? 's' : ''} (need ${needP} more).`
      : `VCs want ${r.reqHype}+ Hype before they commit.`;
  } else {
    reason = 'Weak buzzword game. The partners were unmoved.';
  }

  return { success: true, closed: false, raised: est.projected, round: est.round, reason };
}

/**
 * Caffeinate employees — costs cash, restores energy.
 * Caffeine Gremlins get double restore.
 */
export function actionCaffeinate(state) {
  if (state.cooldowns.caffeine > 0) {
    return { success: false, reason: `Cooldown: ${state.cooldowns.caffeine.toFixed(1)}s` };
  }
  if (state.cash < CONFIG.CAFFEINE_COST) {
    return { success: false, reason: `Need ${fmtMoney(CONFIG.CAFFEINE_COST)} for the coffee run.` };
  }
  if (state.paused || state.gameOver || state.won) return { success: false };

  let restored = 0;
  for (const emp of state.employees) {
    if (emp.burnedOut || emp.energy < 0.85) {
      const mult = PERSONALITIES[emp.personality].caffeineMult ?? 1;
      emp.energy = Math.min(1.0, emp.energy + CONFIG.CAFFEINE_RESTORE * mult);
      emp.burnedOut = false;
      restored++;
    }
  }
  if (restored === 0) {
    return { success: true, restoredCount: 0 };
  }

  state.cash -= CONFIG.CAFFEINE_COST;
  state.cooldowns.caffeine = CONFIG.CD_CAFFEINE;
  state.stats.caffeinations++;

  return { success: true, restoredCount: restored };
}

/**
 * Pivot — clears all PR disasters at a cash cost.
 */
export function actionPivot(state) {
  if (state.cooldowns.pivot > 0) {
    return { success: false, reason: `Cooldown: ${state.cooldowns.pivot.toFixed(1)}s` };
  }
  if (!state.prDisasters.length) {
    return { success: false, reason: 'No active PR disasters to pivot from.' };
  }
  if (state.cash < CONFIG.PIVOT_CASH_COST) {
    return { success: false, reason: `Need ${fmtMoney(CONFIG.PIVOT_CASH_COST)} for the rebrand.` };
  }
  if (state.paused || state.gameOver || state.won) return { success: false };

  const cleared = state.prDisasters.length;
  state.prDisasters = [];
  state.cash -= CONFIG.PIVOT_CASH_COST;
  state.cooldowns.pivot = CONFIG.CD_PIVOT;
  state.stats.pivots++;

  return { success: true, cleared, cost: CONFIG.PIVOT_CASH_COST };
}

/**
 * Extinguish a server fire.
 */
export function actionExtinguishFire(state, fireId) {
  const idx = state.fires.findIndex(f => f.id === fireId);
  if (idx === -1) return { success: false };

  const fire = state.fires[idx];
  state.fires.splice(idx, 1);
  state.stats.firesKilled++;
  const bonus = fire.timer > CONFIG.FIRE_DURATION * 0.5 ? 5 : 2;
  state.hype = clamp(state.hype + bonus, 0, CONFIG.HYPE_MAX);

  return { success: true, hypeBonus: bonus };
}
