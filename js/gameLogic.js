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
  BASE_BURN_PER_SEC:     105,    // $/s fixed costs (rent, AWS, kombucha tap)
  MRR_HYPE_FLOOR:        0.4,    // revenue multiplier at 0 hype
  MRR_HYPE_SCALE:        0.9,    // extra revenue multiplier at 100 hype
  DEBT_LIMIT:            -75000, // you can run in the red, but bankrupt below this

  // Hype
  HYPE_MAX:              100,
  HYPE_DECAY_PER_SEC:    1.9,
  HYPE_LAUNCH_BURST:     18,     // base hype per feature launch stunt

  // Office building
  DESK_SLOTS:            6,
  DESK_COST:             6000,
  COMPUTER_COST:         4000,
  NO_COMPUTER_PENALTY:   0.5,    // productivity multiplier without a computer

  // Hiring
  HIRE_SIGNING_BONUS:    1500,

  // Founder (you) — works only while seated at your desk
  FOUNDER_DEV:           1.5,

  // Employees — must be at their desk AND caffeinated to work
  ENERGY_DECAY_PER_SEC:  0.016,
  WORK_ENERGY_MIN:       0.18,   // below this they're too tired to work (need coffee)
  BURNOUT_HYPE_DRAIN:    1.2,    // hype/s drained per burned-out employee
  CAFFEINE_COST:         400,
  CAFFEINE_RESTORE:      0.65,

  // Events
  FIRE_CASH_DAMAGE:      6000,
  FIRE_DURATION:         13,
  FIRE_SPAWN_INTERVAL:   [42, 75],   // server meltdowns are now rare, not constant
  SERVER_COST:           6500,    // cost to replace a server destroyed by fire
  NUM_RACKS:             2,       // physical server racks in the office
  FACILITY_MAX_LEVEL:    3,       // devices/rooms can be upgraded to Lv 3
  PR_HYPE_DRAIN_PER_SEC: 3.0,
  PR_DURATION:           [15, 30],
  PR_SPAWN_INTERVAL:     [30, 55],
  QUIRK_INTERVAL:        [16, 30],
  PEDDLER_INTERVAL:      [45, 80],   // shady peddlers swing by occasionally

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

// ─── Facilities: Devices & Rooms (construction) ───────────────────────────────
// kind: 'Device' (small, Tier 1) or 'Room' (larger, gated by research tier).
// eff multipliers default 1 (×); additive bonuses default 0. upkeep adds to burn.
export const FACILITIES = [
  // Tier 1 — devices, available from the start
  { id: 'espresso',  name: 'Espresso Bar',     icon: '☕', kind: 'Device', tier: 1, cost: 9000,  upkeep: 6,  desc: 'Caffeine on tap. Team burns out 30% slower.',     eff: { energyDecay: 0.7 } },
  { id: 'gpu',       name: 'GPU Cluster',       icon: '🖥️', kind: 'Device', tier: 1, cost: 18000, upkeep: 14, desc: 'More compute. +35% team dev speed.',               eff: { dev: 1.35 } },
  { id: 'neon',      name: 'Neon Brand Wall',   icon: '💡', kind: 'Device', tier: 1, cost: 12000, upkeep: 8,  desc: 'Looks legit on camera. +0.8 passive Hype/s.',      eff: { hypeAura: 0.8 } },
  { id: 'dashboard', name: 'Growth Dashboard',  icon: '📊', kind: 'Device', tier: 1, cost: 15000, upkeep: 10, desc: 'Optimize the funnel. +18% MRR.',                   eff: { mrr: 1.18 } },
  { id: 'sprinkler', name: 'Fire Suppression',  icon: '🧯', kind: 'Device', tier: 1, cost: 11000, upkeep: 7,  desc: 'Halve fire damage; server fires 40% rarer.',       eff: { fireDamage: 0.5, fireInterval: 1.4 } },
  // Tier 2 — rooms, need "Facilities Permit" research
  { id: 'serverroom', name: 'Server Room',      icon: '🗄️', kind: 'Room', tier: 2, cost: 45000, upkeep: 22, desc: 'Dedicated infra. +25% dev speed, fire damage −40%.', eff: { dev: 1.25, fireDamage: 0.6 } },
  { id: 'breakroom',  name: 'Break Room',       icon: '🛋️', kind: 'Room', tier: 2, cost: 38000, upkeep: 18, desc: 'Naps & ping-pong. Burnout −45%, +0.3 Hype/s.',       eff: { energyDecay: 0.55, hypeAura: 0.3 } },
  { id: 'warroom',    name: 'War Room',         icon: '🎯', kind: 'Room', tier: 2, cost: 42000, upkeep: 20, desc: 'Where pitches are forged. +0.4 pitch quality.',      eff: { pitch: 0.4 } },
  { id: 'cafeteria',  name: 'Cafeteria',        icon: '🍜', kind: 'Room', tier: 2, cost: 40000, upkeep: 19, desc: 'Free lunch (not really free). Burnout −35%, +8% MRR.', eff: { energyDecay: 0.65, mrr: 1.08 } },
  // Tier 3 — advanced rooms, need "Corporate Campus" research
  { id: 'lab',        name: 'R&D Lab',          icon: '🔬', kind: 'Room', tier: 3, cost: 75000, upkeep: 34, desc: 'Bleeding edge. +30% dev speed, +12% MRR.',           eff: { dev: 1.3, mrr: 1.12 } },
  { id: 'legal',      name: 'Legal Department',  icon: '⚖️', kind: 'Room', tier: 3, cost: 65000, upkeep: 30, desc: 'Actual lawyers. PR disasters 55% less severe.',      eff: { prSeverity: 0.45 } },
  { id: 'datacenter', name: 'Private Data Center',icon: '🏢', kind: 'Room', tier: 3, cost: 95000, upkeep: 42, desc: 'Own your infra. +40% dev speed, fires 60% rarer.',     eff: { dev: 1.4, fireInterval: 1.6 } },
];

// ─── Research / Tech Tree (instant unlocks, gated by prereqs + cash) ──────────
export const RESEARCH = [
  { id: 'facilities1', name: 'Bribe the Inspector',  tier: 1, cost: 14000,  req: [],                       unlockTier: 2, desc: 'Unlock Tier-2 rooms. He "didn\'t see any of the wiring." 🤝' },
  { id: 'adnetwork',   name: 'Monetize Your Soul',  tier: 1, cost: 16000,  req: [],                       eff: { mrr: 1.2 },              desc: '+20% MRR. The privacy policy is now a single shrug emoji.' },
  { id: 'devtools',    name: 'Replace IDEs w/ Vibes',tier: 1, cost: 18000,  req: [],                       eff: { dev: 1.15 },             desc: '+15% dev speed. The linter has been emotionally suppressed.' },
  { id: 'genai',       name: 'Hallucinate Boldly',  tier: 2, cost: 70000,  req: ['devtools'],             eff: { dev: 1.25, shipHype: 6 },desc: '+25% dev speed; launches give +6 Hype. It\'s not wrong, it\'s "visionary." 🔮' },
  { id: 'growthhack',  name: 'Manufacture FOMO',    tier: 2, cost: 80000,  req: ['adnetwork'],            eff: { mrr: 1.3, hypeAura: 0.4 },desc: '+30% MRR, +0.4 Hype/s. Waitlist of 4M (3.9M are your own bots).' },
  { id: 'facilities2', name: 'Annex the Parking Lot',tier: 2, cost: 90000,  req: ['facilities1'],          unlockTier: 3, desc: 'Unlock Tier-3 facilities. Now with a slide nobody is allowed to use. 🛝' },
  { id: 'agents',      name: 'Fire All, Keep Bots',  tier: 3, cost: 220000, req: ['genai'],                eff: { dev: 1.4 },              desc: '+40% dev speed. The agents have begun CC\'ing your therapist. 🤖' },
  { id: 'autoscale',   name: 'Summon ∞ Servers',     tier: 3, cost: 260000, req: ['growthhack'],           eff: { mrr: 1.5, fireInterval: 1.5 }, desc: '+50% MRR; fires 50% rarer. The AWS bill is now structurally load-bearing.' },
  { id: 'agi',         name: 'Press the AGI Button', tier: 4, cost: 850000, req: ['agents', 'autoscale'],  eff: { dev: 1.6, mrr: 1.5, hypeAura: 1.0 }, desc: 'EVERYTHING, but more. A voice in the datacenter has started asking "why." ☢️' },
];

// ─── Bank Loans (instant cash, ongoing interest) ─────────────────────────────
export const LOANS = [
  { id: 'micro',  name: 'Microloan',         icon: '💵', cash: 20000,  interest: 28,  desc: 'A credit union that "believes in you." +$28/s interest.' },
  { id: 'series', name: 'Bridge Loan',       icon: '🏦', cash: 60000,  interest: 95,  desc: 'A real bank, real paperwork. +$95/s interest.' },
  { id: 'mega',   name: 'Venture Debt',      icon: '🏛️', cash: 150000, interest: 260, desc: 'The terms are a love letter to the lender. +$260/s interest.' },
];

// ─── Peddlers (random shady offers — fast cash, nasty strings) ────────────────
// cash = instant money; debt = added principal (counts toward bankruptcy);
// hype = reputation change (+/-).
export const PEDDLER_DEALS = [
  { cash: 25000, debt: 40000, hype: 0,   text: 'A loan shark in a great coat fronts you $25k. The vig is… aggressive.' },
  { cash: 18000, debt: 0,     hype: 14,  text: 'A guy sells you 2 million "users" out of a van. (They are bots, but loud ones.)' },
  { cash: 30000, debt: 0,     hype: -16, text: 'A peddler buys your user data for $30k cash. Word… gets around.' },
  { cash: 15000, debt: 0,     hype: 8,   text: '"Totally legal" ad inventory for $15k up front. Probably fine.' },
  { cash: 40000, debt: 58000, hype: 0,   text: 'An "angel" wires $40k. He is neither an angel nor ever reachable again.' },
  { cash: 12000, debt: 0,     hype: -6,  text: 'Pawn the good espresso machine and the office plants for a quick $12k.' },
];

// ─── Office Expansion Tiers (more desk slots) ─────────────────────────────────
export const OFFICE_TIERS = [
  { name: 'Garage',        slots: 6,  cost: 0 },
  { name: 'Real Office',   slots: 9,  cost: 35000 },
  { name: 'Whole Floor',   slots: 12, cost: 140000 },
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

// ─── Procedural Product Word Banks ────────────────────────────────────────────
// Mixed in with the hand-tuned PRODUCT_IDEAS so every run feels fresh.
export const NAME_PRE = ['Synerg','Quant','Hyper','Neuro','Cogni','Blok','Vibe','Doom','Flux','Zap','Mind','Aether','Omni','Prox','Senti','Loop','Dyna','Nova','Echo','Grift','Scale','Pivot','Halluci','Yeet','Vapor','Singul','Apex','Crypt','Borg','Maxx','Lumin','Cortex','Drift','Babel','Mirage','Frothe'];
export const NAME_SUF = ['.ai','.io','GPT','ly','Labs','X','Corp','DAO','.xyz','verse','OS','Hub','Genix','Mind','Loop','Net','Flow','Stack'];
export const PRODUCT_NOUNS = ['AI Girlfriend','GPT Lawyer','Infinite Meme Generator','AI CEO Replacement','InfluencerGPT','Auto-TikTok Factory','AI Dating Coach','AI Politician Generator','Blockchain Toaster','AI Therapist','Crypto Babysitter','AI Priest','Smart Fridge Influencer','AI Dungeon Master','Neural Sommelier','GPT Plumber','Autonomous HOA President','Sentient Vending Machine','AI Marriage Counselor','GPT Personal Trainer','AI Hostage Negotiator','AI Substitute Teacher','AI Tax Optimizer','GPT Cult Leader','AI Wedding Officiant','Self-Driving Stroller','AI Bartender','Neural Resume Embellisher','GPT Confession Booth','AI Funeral Planner','Blockchain Tamagotchi','AI Eulogy Writer','AI Hype Man','GPT Replacement Spouse','Synthetic Influencer Farm','AI Apology Generator'];
export const AUDIENCES = ['for Cats','for Divorced Dads','for Toddlers','for Billionaires','for the Recently Deceased','for Houseplants','for Insomniacs','for Cult Leaders','for Ghosts','for Influencers','for Lonely Astronauts','for Disgraced CEOs','for Sentient Roombas','for Crypto Widows','for Doomsday Preppers','for Reply Guys','for Tired Millennials','for Anxious Dogs','for Burnt-Out Monks','for HR Departments','for Conspiracy Theorists','for Unpaid Interns','for Pigeons','for Vampires','for Middle Managers','for People Who Hate People','for Emotionally Unavailable Men','for Haunted Houses','for Failed Influencers','for Gen Z'];
// Parodies of well-known platforms — full product concepts, dropped in occasionally
export const PLATFORM_PARODIES = [
  { name: 'LinkedOut',           desc: 'Professional networking where everyone is unemployed and posting about it. #blessed #opentowork' },
  { name: 'Tinder for Audits',   desc: 'Swipe right on an IRS agent. It\'s a match — and you owe back taxes.' },
  { name: 'Uber for Dread',      desc: 'A calm stranger drives you nowhere while you quietly question every life choice.' },
  { name: 'Slacker',             desc: 'Team chat where nine people watch one person type "…" for an hour.' },
  { name: 'Zoomf',              desc: 'Video calls that should\'ve been emails. Now with worse audio and a frozen face.' },
  { name: 'AirBnBoo',            desc: 'Stay somewhere magical. The 3am footsteps are, per the listing, "a feature."' },
  { name: 'OnlyFunds',           desc: 'Subscribe to a VC and watch your money disappear, personally and intimately.' },
  { name: 'X (Formerly Worse)',  desc: 'A town square, if the square were on fire and run entirely by one guy.' },
  { name: 'Spotifry',            desc: 'Stream music that pays artists in "exposure" and small amounts of weather.' },
  { name: 'BossTok',             desc: 'An infinite scroll of your manager doing little dances about synergy.' },
  { name: 'Reddit for Cats',     desc: 'Nine million communities, all of them downvoting you, a cat, specifically.' },
  { name: 'DoorDash for Feelings', desc: 'Emotional support delivered in 30 minutes or your existential sadness is free.' },
  { name: 'BeReal-ish',          desc: 'Be authentic at a random moment — right after 45 minutes of careful retakes.' },
  { name: 'Threadbare',          desc: 'A Twitter clone that launched the same week as nine other Twitter clones.' },
  { name: 'GitHub for Crimes',   desc: 'Version-control your alibi. Now with branches, and a very nervous legal team.' },
  { name: 'Yelp for People',     desc: 'Rate your friends 1–5 stars. Statistically, nobody is above a 3.2.' },
  { name: 'Notionn\'t',          desc: 'A workspace so flexible you spend 100% of your time configuring it and 0% working.' },
  { name: 'Robinhoodwink',       desc: 'Commission-free trading. You are not the customer — you are the product AND the loss.' },
];

// Weirder, higher-potential products unlocked by research (tier 2+)
export const PRODUCT_NOUNS_ADV = ['AGI Overlord', 'Sentient Ad Network', 'Quantum Dream Broker', 'Neural Reality Editor', 'Autonomous Hedge Fund', 'Synthetic Celebrity Factory', 'Mind-Upload Beta', 'Singularity-as-a-Service', 'Self-Aware Spreadsheet', 'Emotion Futures Market', 'AI Nation-State', 'Recursive Startup Generator', 'Hallucination Marketplace', 'Posthuman Dating Network'];
export const TWISTS = ['that learned everything from Reddit','powered entirely by unpaid interns','with a crypto wallet built in','that only speaks in memes','trained on group chats it shouldn\'t have','but it\'s secretly 400 contractors','that gaslights you for engagement','with absolutely no off switch','banned in three countries','that the founder doesn\'t understand','running on one overheating laptop','trained on stolen fan-fiction','that subtweets its own users','with a "trust me bro" privacy policy','that demands equity','that reports you to HR','powered by vibes and venture debt','that hallucinates legal advice','optimized for outrage','that\'s technically a pyramid scheme','that the AI itself is trying to escape','with a manifesto instead of a roadmap','that quietly mines crypto on your phone','that only works during demos','that won an award before it existed'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randRange([min, max]) { return min + Math.random() * (max - min); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function ri(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/**
 * Generate a fresh, cursed product idea from the word banks.
 * Matches the PRODUCT_IDEAS shape (so it drops into dev/ship logic),
 * plus hidden `ethical`/`scam` flavor used to weight the run's ending.
 */
/**
 * Product potential tier from research — higher = weirder, more lucrative ideas.
 * Research comes *before* developing for a reason: it unlocks better products.
 */
export function getProductTier(state) {
  let t = 0;
  for (const id of ['devtools', 'genai', 'agents', 'agi']) {
    if (state.research && state.research.includes(id)) t++;
  }
  return t; // 0..4
}

export function generateProceduralProduct(state) {
  const tier = state ? getProductTier(state) : 0;
  const pot  = 1 + tier * 0.28; // research-driven potential multiplier

  // ~40% of the time: a parody of a well-known platform (recognizable = juicier)
  if (Math.random() < 0.4) {
    const p = pick(PLATFORM_PARODIES);
    return {
      name: p.name, desc: p.desc, tier,
      devPoints: ri(50, 115),
      mrr:       Math.round(ri(230, 600) * pot),
      hype:      Math.round(ri(13, 25) * (1 + tier * 0.15)),
      absurdity: +(1.2 + Math.random() * 0.6 + tier * 0.12).toFixed(2),
      ethical:   ri(5, 90),
      scam:      ri(5, 85),
      procedural: true,
    };
  }

  const pool = tier >= 2 ? PRODUCT_NOUNS.concat(PRODUCT_NOUNS_ADV) : PRODUCT_NOUNS;
  const noun = pick(pool);
  const aud  = pick(AUDIENCES);
  const twist = pick(TWISTS);
  const name = Math.random() < 0.6 ? `${noun} ${aud}` : noun;
  const desc = `${noun} ${aud}, ${twist}.`;
  return {
    name, desc, tier,
    devPoints: ri(48, 120),
    mrr:       Math.round(ri(190, 560) * pot),
    hype:      Math.round(ri(10, 22) * (1 + tier * 0.15)),
    absurdity: +(1 + Math.random() * 0.75 + tier * 0.12).toFixed(2),
    ethical:   ri(5, 90),
    scam:      ri(5, 85),
    procedural: true,
  };
}

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

    // Company identity (set at startGame via viral.js) + comedy layer
    this.companyName  = 'STEALTH STARTUP';
    this.companyPitch = '';
    this.founderHandle = 'founder';
    this.lastTweet    = '';
    this.peakValuation = 0;

    this.cooldowns = { launch: 0, pitch: 0, caffeine: 0, pivot: 0 };

    this.fires       = [];  // { id, timer, maxTimer, fireObject }
    this.prDisasters = [];  // { id, title, desc, timer, maxTimer, severity }
    this.rackDown    = new Array(CONFIG.NUM_RACKS).fill(false); // destroyed servers

    // Debt financing
    this.debt     = 0;   // total principal owed (bank loans + peddlers)
    this.loanBurn = 0;   // $/s interest added to burn rate

    // Office: you start with one small desk — yours. No employees yet.
    // employeeId -1 marks the founder's desk (occupied by you, not hireable).
    this.desks = [
      { id: 0, slot: 0, hasComputer: true, employeeId: -1 },
    ];

    this.employees = [];

    // Products: develop → ready → launch (live)
    this.activeProduct   = null;  // { idea, progress } — currently developing
    this.readyProducts   = [];    // { idea } — developed, not yet launched
    this.shippedProducts = [];    // { idea, shelfIdx } — launched & earning MRR

    // Construction & tech
    this.facilities = [];      // owned facility ids
    this.facilityLevels = {};  // id -> level (1..FACILITY_MAX_LEVEL)
    this.research   = [];      // completed research node ids
    this.officeTier = 0;   // index into OFFICE_TIERS
    this.deskSlots  = OFFICE_TIERS[0].slots;
    this.founderAtDesk = false; // true while the player avatar is sitting at their desk

    // Funding
    this.roundIndex  = 0;
    this.totalRaised = 0;

    // Spawn timers
    this._nextFireTime    = randRange(CONFIG.FIRE_SPAWN_INTERVAL);
    this._nextPRTime      = randRange(CONFIG.PR_SPAWN_INTERVAL);
    this._nextQuirkTime   = randRange(CONFIG.QUIRK_INTERVAL);
    this._nextPeddlerTime = randRange(CONFIG.PEDDLER_INTERVAL);

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

// ─── Construction / Tech Modifiers ────────────────────────────────────────────
/**
 * Aggregate all facility + research effects into a single modifier object.
 * Multipliers (dev, mrr, energyDecay, fireDamage, fireInterval, prSeverity)
 * default to 1; additive bonuses (hypeAura, pitch, shipHype, upkeep) to 0.
 * tierUnlocked gates which facility tiers can be built.
 */
export function getModifiers(state) {
  const m = {
    dev: 1, mrr: 1, energyDecay: 1, fireDamage: 1, fireInterval: 1, prSeverity: 1,
    hypeAura: 0, pitch: 0, shipHype: 0, upkeep: 0, tierUnlocked: 1,
  };
  // Effects scale with facility level: +X% multipliers grow, reductions deepen,
  // flat bonuses stack. Research always applies at level 1.
  const INCREASE = ['dev', 'mrr', 'fireInterval'];
  const REDUCE   = ['energyDecay', 'fireDamage', 'prSeverity'];
  const ADD      = ['hypeAura', 'pitch', 'shipHype'];
  const applyLeveled = (eff, L = 1) => {
    if (!eff) return;
    for (const k of INCREASE) if (eff[k] != null) m[k] *= 1 + (eff[k] - 1) * L;
    for (const k of REDUCE)   if (eff[k] != null) m[k] *= Math.max(0.15, 1 - (1 - eff[k]) * L);
    for (const k of ADD)      if (eff[k] != null) m[k] += eff[k] * L;
  };
  for (const id of state.facilities) {
    const f = FACILITIES.find(x => x.id === id);
    if (!f) continue;
    const L = (state.facilityLevels && state.facilityLevels[id]) || 1;
    applyLeveled(f.eff, L);
    m.upkeep += (f.upkeep || 0) * L;
  }
  for (const id of state.research) {
    const n = RESEARCH.find(x => x.id === id);
    if (!n) continue;
    applyLeveled(n.eff, 1);
    if (n.unlockTier) m.tierUnlocked = Math.max(m.tierUnlocked, n.unlockTier);
  }

  // Server infrastructure: destroyed racks throttle dev speed & revenue
  const down = (state.rackDown || []).filter(d => d).length;
  const working = CONFIG.NUM_RACKS - down;
  const serverMult = working >= CONFIG.NUM_RACKS ? 1 : working === 1 ? 0.6 : 0.25;
  m.dev *= serverMult;
  m.mrr *= serverMult;
  m.serverWorking = working;
  m.serverMult = serverMult;
  return m;
}

// ─── Derived Values ───────────────────────────────────────────────────────────
export function getEmployeeDevPower(state, emp) {
  if (emp.burnedOut) return 0;
  if (emp.atDesk === false) return 0;                 // away from desk (on a break) → not working
  if (emp.energy < CONFIG.WORK_ENERGY_MIN) return 0;  // too tired — needs caffeine to work
  const role = ROLES[emp.role];
  const p    = PERSONALITIES[emp.personality];
  const desk = state.desks.find(d => d.id === emp.deskId);
  const computerMult = (desk && desk.hasComputer) ? 1 : CONFIG.NO_COMPUTER_PENALTY;
  // Caffeinated (high energy) works FASTER: ranges ~0.35× (drained) → ~1.35× (full).
  const energyMult = 0.35 + emp.energy;
  return role.dev * (p.devMult ?? 1) * energyMult * computerMult;
}

export function getTeamDevPower(state) {
  // No work gets done while a server is on fire — put it out first.
  if (state.fires && state.fires.length > 0) return 0;
  // The founder only works while seated at their desk; employees per their own rules.
  const founderDev = state.founderAtDesk ? CONFIG.FOUNDER_DEV : 0;
  const base = founderDev + state.employees.reduce((s, e) => s + getEmployeeDevPower(state, e), 0);
  return base * getModifiers(state).dev;
}

export function getHypeAura(state) {
  const fromTeam = state.employees.reduce((s, e) => {
    if (e.burnedOut) return s;
    return s + (ROLES[e.role].hypeAura ?? 0) + (PERSONALITIES[e.personality].hypeAura ?? 0);
  }, 0);
  return fromTeam + getModifiers(state).hypeAura;
}

export function getSalaryBurn(state) {
  return state.employees.reduce((s, e) => s + e.salary, 0);
}

export function getBurnRate(state) {
  return CONFIG.BASE_BURN_PER_SEC + getSalaryBurn(state) + getModifiers(state).upkeep + (state.loanBurn || 0);
}

export function getMRR(state) {
  const base = state.shippedProducts.reduce((s, p) => s + p.idea.mrr, 0);
  const hypeMult = CONFIG.MRR_HYPE_FLOOR + CONFIG.MRR_HYPE_SCALE * (state.hype / CONFIG.HYPE_MAX);
  return base * hypeMult * getModifiers(state).mrr;
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
  const used = new Set(state.shippedProducts.map(p => p.idea.name));
  if (state.activeProduct) used.add(state.activeProduct.idea.name);

  const choices = [];
  let guard = 0;
  while (choices.length < count && guard++ < 60) {
    let idea;
    // ~25% of the time offer a hand-tuned classic; otherwise generate fresh.
    if (Math.random() < 0.2) {
      const pool = PRODUCT_IDEAS.filter(p => !used.has(p.name));
      idea = pool.length ? pick(pool) : generateProceduralProduct(state);
    } else {
      idea = generateProceduralProduct(state);
    }
    if (used.has(idea.name)) continue;
    used.add(idea.name);
    choices.push(idea);
  }
  return choices;
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

  // War Room and other facilities sharpen the pitch
  quality += getModifiers(state).pitch;

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
  const mods = getModifiers(state);

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
      emp.energy = Math.max(0, emp.energy - CONFIG.ENERGY_DECAY_PER_SEC * (p.energyMult ?? 1) * mods.energyDecay * dt);
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

  // ── Product Development → "ready to launch" (does NOT auto-launch) ──
  if (state.activeProduct) {
    state.activeProduct.progress += getTeamDevPower(state) * dt;
    if (state.activeProduct.progress >= state.activeProduct.idea.devPoints) {
      const product = { idea: state.activeProduct.idea };
      state.readyProducts.push(product);
      state.activeProduct = null;
      events.push({ type: 'product_ready', product });
    }
  }

  // ── Cash Flow ──
  const net = getNetCashFlow(state);
  state.cash += net * dt;

  // ── Auto-repay debt from surplus (half of positive cash flow) ──
  if (state.debt > 0 && net > 0 && state.cash > 0) {
    const repay = Math.min(state.debt, state.cash, net * 0.5 * dt);
    if (repay > 0) {
      state.loanBurn *= (state.debt - repay) / state.debt; // interest scales down with principal
      state.debt -= repay;
      state.cash -= repay;
      if (state.debt < 1) { state.debt = 0; state.loanBurn = 0; }
    }
  }

  // ── Active Fire Timers ──
  for (let i = state.fires.length - 1; i >= 0; i--) {
    const fire = state.fires[i];
    fire.timer -= dt;
    if (fire.timer <= 0) {
      // The fire burns out → that server rack is destroyed (you must buy a new one)
      const idx = (fire.fireObject && fire.fireObject.position3d.x < 0) ? 0 : 1;
      let destroyed = false;
      if (state.rackDown && !state.rackDown[idx]) { state.rackDown[idx] = true; destroyed = true; }
      events.push({ type: 'fire_damage', fire, rackIdx: idx, destroyed });
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
    state._nextFireTime = randRange(CONFIG.FIRE_SPAWN_INTERVAL) * mods.fireInterval;
  }

  // ── Event Spawning: PR Disasters ──
  state._nextPRTime -= dt;
  if (state._nextPRTime <= 0) {
    const template = pick(PR_DISASTERS);
    const duration = randRange(CONFIG.PR_DURATION);
    const prEvent = {
      id: state.nextEventId(),
      title: template.title, desc: template.desc,
      timer: duration, maxTimer: duration, severity: template.severity * mods.prSeverity,
    };
    state.prDisasters.push(prEvent);
    events.push({ type: 'spawn_pr', pr: prEvent });
    state._nextPRTime = randRange(CONFIG.PR_SPAWN_INTERVAL);
  }

  // ── Peddler Offers ──
  state._nextPeddlerTime -= dt;
  if (state._nextPeddlerTime <= 0) {
    state._nextPeddlerTime = randRange(CONFIG.PEDDLER_INTERVAL);
    if (!state.paused) events.push({ type: 'peddler', deal: pick(PEDDLER_DEALS) });
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
  state.peakValuation = Math.max(state.peakValuation, getValuation(state));

  if (state.cash <= CONFIG.DEBT_LIMIT) {
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
  if (state.desks.length >= state.deskSlots) {
    return { success: false, reason: 'Office is full — expand the office for more desk slots.' };
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
    atDesk: true,            // working at their desk (set false while on a break)
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
    return { success: false, reason: `Already developing ${state.activeProduct.idea.name}.` };
  }
  state.activeProduct = { idea, progress: 0 };
  return { success: true, idea };
}

/**
 * Launch a developed ("ready") product — it goes live, earns MRR, and
 * generates a Hype burst. This is the only way products start making money.
 */
export function actionLaunchProduct(state, index) {
  const product = state.readyProducts[index];
  if (!product) return { success: false, reason: 'Nothing ready to launch — develop a product first.' };
  state.readyProducts.splice(index, 1);
  product.shelfIdx = state.shippedProducts.length;
  state.shippedProducts.push(product);
  state.stats.productsShipped++;

  const mods = getModifiers(state);
  const burst = Math.min(45, 14 + product.idea.hype + (product.idea.absurdity - 1) * 12) + mods.shipHype;
  state.hype = clamp(state.hype + burst, 0, CONFIG.HYPE_MAX);

  const reviewGood = product.idea.hype + (product.idea.absurdity - 1) * 10 > 16;
  return { success: true, product, hypeGained: Math.round(burst), reviewGood };
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
 * Take a bank loan — instant cash now, permanent interest added to burn.
 */
export function actionTakeLoan(state, id) {
  const loan = LOANS.find(x => x.id === id);
  if (!loan) return { success: false, reason: 'Unknown loan.' };
  state.cash    += loan.cash;
  state.debt    += loan.cash;
  state.loanBurn += loan.interest;
  return { success: true, loan };
}

/**
 * Accept a peddler's shady offer — fast cash, with strings (debt / hype hit).
 */
export function actionAcceptPeddler(state, deal) {
  if (!deal) return { success: false };
  state.cash += deal.cash || 0;
  state.debt += deal.debt || 0;
  if (deal.hype) state.hype = clamp(state.hype + deal.hype, 0, CONFIG.HYPE_MAX);
  return { success: true, deal };
}

/**
 * Expand the office to the next tier — unlocks more desk slots.
 */
export function actionExpandOffice(state) {
  const next = OFFICE_TIERS[state.officeTier + 1];
  if (!next) return { success: false, reason: 'Office is already at maximum size.' };
  if (state.cash < next.cost) {
    return { success: false, reason: `Need ${fmtMoney(next.cost)} to expand to ${next.name}.` };
  }
  state.cash -= next.cost;
  state.officeTier++;
  state.deskSlots = next.slots;
  return { success: true, tier: next };
}

/**
 * Replace a server destroyed by fire. Restores a downed rack for cash.
 */
export function actionBuyServer(state) {
  const idx = (state.rackDown || []).findIndex(d => d);
  if (idx === -1) return { success: false, reason: 'All servers are operational.' };
  if (state.cash < CONFIG.SERVER_COST) {
    return { success: false, reason: `Need ${fmtMoney(CONFIG.SERVER_COST)} for a new server.` };
  }
  state.cash -= CONFIG.SERVER_COST;
  state.rackDown[idx] = false;
  return { success: true, rackIdx: idx };
}

/**
 * Buy a facility (device or room). Gated by research tier + cash. One each.
 */
export function actionBuyFacility(state, id) {
  const f = FACILITIES.find(x => x.id === id);
  if (!f) return { success: false, reason: 'Unknown facility.' };
  if (state.facilities.includes(id)) return { success: false, reason: 'Already built.' };
  const mods = getModifiers(state);
  if (f.tier > mods.tierUnlocked) {
    return { success: false, reason: `Locked — research Tier-${f.tier} facilities first.` };
  }
  if (state.cash < f.cost) {
    return { success: false, reason: `Need ${fmtMoney(f.cost)} to build the ${f.name}.` };
  }
  state.cash -= f.cost;
  state.facilities.push(id);
  state.facilityLevels[id] = 1;
  return { success: true, facility: f };
}

/**
 * Upgrade an owned facility one level (stronger effect, higher upkeep).
 */
export function actionUpgradeFacility(state, id) {
  const f = FACILITIES.find(x => x.id === id);
  if (!f || !state.facilities.includes(id)) return { success: false, reason: 'Build it first.' };
  const level = state.facilityLevels[id] || 1;
  if (level >= CONFIG.FACILITY_MAX_LEVEL) return { success: false, reason: `${f.name} is already maxed (Lv ${level}).` };
  const cost = Math.round(f.cost * level * 0.9);
  if (state.cash < cost) return { success: false, reason: `Need ${fmtMoney(cost)} to upgrade the ${f.name}.` };
  state.cash -= cost;
  state.facilityLevels[id] = level + 1;
  return { success: true, facility: f, level: level + 1, cost };
}

/**
 * Research a tech node. Instant; gated by prerequisites + cash.
 */
export function actionResearch(state, nodeId) {
  const n = RESEARCH.find(x => x.id === nodeId);
  if (!n) return { success: false, reason: 'Unknown research.' };
  if (state.research.includes(nodeId)) return { success: false, reason: 'Already researched.' };
  if (n.req.some(r => !state.research.includes(r))) {
    return { success: false, reason: 'Locked — finish the prerequisites first.' };
  }
  if (state.cash < n.cost) {
    return { success: false, reason: `Need ${fmtMoney(n.cost)} for R&D.` };
  }
  state.cash -= n.cost;
  state.research.push(nodeId);
  return { success: true, node: n };
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
