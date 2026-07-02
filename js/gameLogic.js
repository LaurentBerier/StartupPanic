/**
 * gameLogic.js  Core game mechanics, tycoon economy, and event management.
 *
 * Covers:
 *  - Cash economy: burn rate (base + salaries) vs MRR from shipped products
 *  - Office building: desks + computers (capacity for hiring)
 *  - Hiring: candidates with roles, salaries and personality traits
 *  - Personality quirk events
 *  - Product development: absurd products that ship and generate MRR
 *  - VC funding rounds (Pre-Seed  Series C)  the win path
 *  - Server fires, PR disasters, burnout, pivot
 */

import { productBrand } from './brand.js';

import { clamp } from './tween.js';

//  Game Constants 
export const CONFIG = {
  // Economy
  STARTING_CASH:         26000,
  PRE_LAUNCH_BURN:       50,     // $/s while still in stealth (garage rent + ramen clock)
  BASE_BURN_PER_SEC:     125,    // $/s fixed costs AFTER you go live (AWS, real rent, kombucha tap)
  BURN_RAMP_PER_MIN:     0.055,  // live burn creeps up ~5.5%/min (success attracts invoices)
  BURN_RAMP_CAP:         1.8,    // ...capped at +80%
  MRR_HYPE_FLOOR:        0.72,   // revenue multiplier at 0 hype; stay relevant or starve
  MRR_HYPE_SCALE:        0.78,   // extra revenue multiplier at 100 hype
  DEBT_LIMIT:            -45000, // hard floor: below this the bank simply stops pretending
  REPO_GRACE:            42,     // seconds you can run cash-negative before the repo men finish
  REPO_ACCEL:            2.2,    // countdown up to ~3.2x faster the deeper in the red you are
  LIFELINE_CASH:         3500,   // below this (and bleeding) a bank or peddler steps in
  LIFELINE_RUNWAY:       30,     // ...if runway is under this many seconds
  LIFELINE_COOLDOWN:     [34, 55],

  // Product investment & launch odds  starting an ambitious project costs
  // more up front, but it's far more likely to succeed when it launches.
  PRODUCT_MRR_MULT:      1.5,    // product ideas are meaningful businesses, not novelty coupons
  PRODUCT_MRR_BONUS:     80,     // floor lift so the first launch can nearly flip cashflow
  INVEST_BASE:           900,    // flat cost to spin up any project
  INVEST_PER_DEVPOINT:   70,     // $ per point of build effort (ambition)
  INVEST_PER_MRR:        3.5,    // $ per $/s of intended revenue
  SUCCESS_BASE:          0.66,   // launch success chance at ambition 1.0
  SUCCESS_AMBITION_SLOPE:0.26,   // +/- chance per 1.0 of ambition above/below 1.0
  SUCCESS_PER_ENG:       0.04,   // each non-burned-out engineer improves the odds
  SUCCESS_ENG_CAP:       0.12,   // ...up to this much
  SUCCESS_MIN:           0.35,
  SUCCESS_MAX:           0.95,
  FLOP_MRR_MULT:         0.58,   // a flopped launch still earns meaningful revenue
  FLOP_HYPE_MULT:        0.4,    // ...and a much smaller hype burst
  LAUNCH_POLISH_POINTS:  5,
  LAUNCH_RELIABILITY_BONUS: 0.035, // success chance per point
  LAUNCH_LEGAL_BONUS:    0.018, // success chance per point + softens flops
  LAUNCH_MARKETING_HYPE: 3,     // extra hype per point

  // Hype
  HYPE_MAX:              100,
  HYPE_DECAY_PER_SEC:    1.15,
  HYPE_LAUNCH_BURST:     18,     // base hype per feature launch stunt

  // Office building  a sensible "furniture < workstation < infrastructure" ladder:
  // a desk is cheap furniture, a computer is a real dev machine, and a server
  // (below) is the expensive infrastructure. Trio sums to $15K so the early-game
  // runway is unchanged from the old 6K/4K/5K - only the ordering is fixed.
  DESK_SLOTS:            8,
  DESK_COST:             3000,   // just a desk + chair (a seat / hiring capacity)
  COMPUTER_COST:         5000,   // a beefy dev workstation
  NO_COMPUTER_PENALTY:   0.5,    // productivity multiplier without a computer

  // Hiring
  HIRE_SIGNING_BONUS:    1500,

  // Founder (you)  works only while seated at your desk
  FOUNDER_DEV:           1.5,

  // Employees  must be at their desk AND caffeinated to work
  ENERGY_DECAY_PER_SEC:  0.016,
  WORK_ENERGY_MIN:       0.18,   // below this they're too tired to work (need coffee)
  BURNOUT_HYPE_DRAIN:    1.2,    // hype/s drained per burned-out employee
  CAFFEINE_COST:         400,
  CAFFEINE_RESTORE:      0.65,

  // Events
  FIRE_CASH_DAMAGE:      6000,
  FIRE_DURATION:         13,
  FIRE_SPAWN_INTERVAL:   [72, 120],  // server meltdowns are now rare, not constant
  SERVER_COST:           7000,    // real infrastructure - the priciest of the buy trio (and the cost to replace a fire-destroyed rack)
  NUM_RACKS:             2,       // physical server racks in the office
  FACILITY_MAX_LEVEL:    3,       // devices/rooms can be upgraded to Lv 3
  PR_HYPE_DRAIN_PER_SEC: 2.0,
  PR_DURATION:           [15, 30],
  PR_SPAWN_INTERVAL:     [58, 98],
  QUIRK_INTERVAL:        [36, 64],
  PEDDLER_INTERVAL:      [80, 135],  // shady peddlers swing by occasionally
  BOARD_INTERVAL:        [88, 145],
  ACQUISITION_CHECK:     [95, 145],
  MAJOR_EVENT_GAP:       [24, 42],   // minimum spacing between decision-modal events (no stacking)
  CLONE_INTERVAL:        [115, 185], // a rival eventually knocks off your best product
  POACH_INTERVAL:        [105, 165], // a rival tries to steal your best engineer
  MEME_INTERVAL:         [90, 145],  // a product randomly becomes a meme
  REGULATOR_INTERVAL:    [125, 200], // a regulator comes knocking once you matter

  PIVOT_CASH_COST:       8000,
  MARKETING_COST:        1800,
  MARKETING_HYPE_BASE:   9,
  MARKETING_HYPE_LIVE:   13,

  //  Market trends  a rotating "hot category" buffs matching products 
  TREND_INTERVAL:        [60, 95],   // a new category trends every ~minute once live
  TREND_MRR_BONUS:       0.4,        // +40% MRR for products in the hot category

  //  Product aging  shipped products decay unless you ship updates 
  AGING_PER_SEC:         0.004,      // freshness lost per second once live (~125s to floor)
  FRESH_FLOOR:           0.5,        // a neglected product still earns this fraction
  UPDATE_COST_BASE:      2500,       // base cost to ship a refresh across the portfolio
  UPDATE_COST_PER_PRODUCT: 1500,     // + per shipped product
  UPDATE_HYPE:           6,          // hype burst for shipping updates
  TECH_DEBT_PER_SEC:     0.045,      // shipped products quietly rot unless maintained
  TECH_DEBT_MRR_PENALTY: 0.0045,     // MRR penalty per tech-debt point
  BUG_MRR_PENALTY:       0.018,      // MRR penalty per bug point
  CRASH_CHECK_PER_SEC:   0.0012,     // high tech debt + bugs can knock a product offline
  REFACTOR_BASE_COST:    1800,
  REFACTOR_DEBT_COST:    95,
  VERSION_PUSH_COST:     4500,
  FEATURE_DEV_MULT:      0.55,       // share of team power used on shipped-product roadmap

  //  Morale / development control
  MORALE_START:          76,
  MORALE_RECOVER_PER_SEC:0.06,
  MORALE_BURNOUT_HIT:    8,
  CRUNCH_COOLDOWN:       18,

  //  Employees as people: mood, stress, loyalty, growth
  EMP_HAPPY_START:       72,    // 0..100  how good it feels to work here
  EMP_STRESS_START:      18,    // 0..100  pressure / anxiety
  EMP_LOYALTY_START:     55,    // 0..100  how likely they are to stay
  EMP_HAPPY_DRIFT:       0.05,  // per-sec lerp toward the happiness target
  EMP_STRESS_DRIFT:      0.07,  // per-sec lerp toward the stress target
  EMP_LOYALTY_DRIFT:     0.02,  // per-sec lerp (loyalty is slow to move)
  EMP_XP_PER_SEC:        0.55,  // experience gained while productively working
  EMP_QUIT_HAPPY:        24,    // below this happiness + low loyalty => quit risk
  EMP_QUIT_LOYALTY:      30,
  EMP_QUIT_WATCH:        16,    // seconds of misery before they may walk
  PIZZA_COST:            1200,  // a company-wide morale band-aid that works absurdly well
  CD_PIZZA:              26,
  PROMOTE_RAISE:         0.14,  // promoting bumps title + raises salary 14%
  GOSSIP_INTERVAL:       [18, 34], // seconds between office gossip / relationship beats

  //  Competitor clone  a knockoff bleeds the cloned product's MRR 
  CLONE_MRR_MULT:        0.6,        // cloned product earns 60% until you respond
  CLONE_RIDE_DURATION:   50,         // if ignored, the rival fizzles after this long
  CLONE_OUTHYPE_COST:    9000,       // outspend them on marketing
  CLONE_LAWYER_COST:     14000,      // cease & desist (halved if you have a Legal Dept)
  CLONE_PIVOT_COST:      7000,       // differentiate with a fresh release

  // Cooldowns (seconds)
  CD_LAUNCH:             8,
  CD_PITCH:              22,
  CD_CAFFEINE:           10,
  CD_PIVOT:              45,
  CD_UPDATE:             16,
  CD_CRUNCH:             18,
  CD_MARKETING:          18,

  // Glitch overlay starts when runway falls below this many seconds
  RUNWAY_GLITCH_SEC:     45,
};

//  Roles 
export const ROLES = {
  eng:    { key: 'eng',    label: 'ENGINEER',      icon: 'E', dev: 1.2,  hypeAura: 0,    salaryRange: [45, 70] },
  design: { key: 'design', label: 'DESIGNER',      icon: 'D', dev: 0.8,  hypeAura: 0.15, salaryRange: [35, 55] },
  growth: { key: 'growth', label: 'GROWTH HACKER', icon: 'G', dev: 0.35, hypeAura: 0.45, salaryRange: [30, 50] },
};

//  Personalities 
// devMult: dev speed multiplier; energyMult: burnout speed multiplier;
// caffeineMult: how hard coffee hits; pitchBonus: added to pitch quality;
// hypeAura: passive hype/s; quirk: random event key; quirkChance: per quirk tick.
export const PERSONALITIES = {
  cofounder: {
    label: 'CO-FOUNDER', icon: 'C',
    desc: 'Paid in equity and vibes. Surprisingly stable.',
    devMult: 1.0, energyMult: 0.7, hypeAura: 0.1, quirk: 'viral', quirkChance: 0.2,
  },
  tenx: {
    label: '10X ENGINEER', icon: '10x',
    desc: 'Ships twice as fast. Combusts twice as fast.',
    devMult: 2.2, energyMult: 2.5, quirk: 'crunch', quirkChance: 0.35,
  },
  zen: {
    label: 'ZEN MASTER', icon: 'Z',
    desc: 'Never burns out. Deadlines are a social construct.',
    devMult: 0.65, energyMult: 0.1, quirk: 'meditate', quirkChance: 0.3,
  },
  cryptobro: {
    label: 'CRYPTO BRO', icon: '$',
    desc: '+25% pitch quality. Occasionally launches an unauthorized token.',
    devMult: 0.85, pitchBonus: 0.25, quirk: 'pr', quirkChance: 0.3,
  },
  gremlin: {
    label: 'CAFFEINE GREMLIN', icon: 'C',
    desc: 'Runs hot, steals coworkers\' espresso. Coffee hits twice as hard.',
    devMult: 1.35, energyMult: 1.6, caffeineMult: 2, quirk: 'steal', quirkChance: 0.35,
  },
  influencer: {
    label: 'LINKEDIN INFLUENCER', icon: 'IN',
    desc: 'Posts about hustle instead of hustling. Constant hype trickle.',
    devMult: 0.5, energyMult: 0.8, hypeAura: 0.6, quirk: 'viral', quirkChance: 0.4,
  },
  drama: {
    label: 'DRAMA MAGNET', icon: 'D',
    desc: 'Great output. Exhausts everyone within Slack radius.',
    devMult: 1.3, quirk: 'drain_team', quirkChance: 0.35,
  },
  quiet: {
    label: 'QUIET GENIUS', icon: 'Q',
    desc: 'Refuses meetings. Code appears mysteriously at 3AM.',
    devMult: 1.7, energyMult: 0.9, quirk: 'silent_ship', quirkChance: 0.3,
  },
};

const HIREABLE_PERSONALITIES = Object.keys(PERSONALITIES).filter(k => k !== 'cofounder');

//  Traits
// A light flavor layer on top of personality. Each employee carries 1-2 traits.
// `good` drives the dot color in the UI; `eff` folds small, readable modifiers
// into productivity / mood. The blurbs are pure comedy and show in the card.
export const TRAITS = [
  // positive
  { id: 'genius',      label: 'Genius',        good: true,  eff: { dev: 1.18 },                 blurb: 'Solves in an afternoon what the team feared for a month.' },
  { id: 'creative',    label: 'Creative',      good: true,  eff: { dev: 1.06, hypeAura: 0.12 }, blurb: 'Ideas at 3am, half of them dangerous, two of them brilliant.' },
  { id: 'workaholic',  label: 'Workaholic',    good: true,  eff: { dev: 1.12, stress: 10 },     blurb: 'Replies to Slack from inside the shower. Glorious. Concerning.' },
  { id: 'fastlearner', label: 'Fast Learner',  good: true,  eff: { xp: 1.6 },                   blurb: 'Levels up suspiciously fast. Already eyeing your job.' },
  { id: 'leader',      label: 'Great Leader',  good: true,  eff: { teamHappy: 6 },               blurb: 'Everyone within Slack radius works a little happier.' },
  { id: 'gymbro',      label: 'Gym Bro',       good: true,  eff: { energyMult: 0.8 },            blurb: 'Will tell you about the cold plunge. Genuinely never tired.' },
  // negative
  { id: 'doomscroll',  label: 'Doom Scroller', good: false, eff: { dev: 0.9 },                  blurb: 'Reads the entire internet daily. Reports back, unprompted.' },
  { id: 'drama',       label: 'Drama Queen',   good: false, eff: { teamHappy: -5 },             blurb: 'Their personal life is a subscription the whole office pays for.' },
  { id: 'aidoomer',    label: 'AI Doomer',     good: false, eff: { stress: 14 },                blurb: 'Has a countdown. Brings it up in standup. Every standup.' },
  { id: 'coffee',      label: 'Coffee Addict', good: false, eff: { energyMult: 1.25 },          blurb: 'Six espressos deep. Vibrating gently. Output unmatched, briefly.' },
  { id: 'late',        label: 'Always Late',   good: false, eff: { dev: 0.94 },                 blurb: '"Traffic." There is no traffic. They walk to work.' },
  { id: 'leaker',      label: 'Leaks Everything', good: false, eff: { leak: 0.5 },              blurb: 'Cannot keep a secret to save the cap table. Or yours.' },
  { id: 'crypto',      label: 'Crypto Bro',    good: false, eff: { hypeAura: 0.1 },             blurb: 'Has a coin. Wants you to have the coin. The coin is down 90%.' },
  { id: 'oversharer',  label: 'Oversharer',    good: false, eff: { teamHappy: -3 },             blurb: 'You now know far too much about their roommate situation.' },
];
const TRAIT_BY_ID = Object.fromEntries(TRAITS.map(t => [t.id, t]));
export function traitById(id) { return TRAIT_BY_ID[id]; }

const BOND_TYPES = [
  { type: 'friend',  good: true,  verb: 'is close with', icon: '🤝' },
  { type: 'mentor',  good: true,  verb: 'mentors',        icon: '🎓' },
  { type: 'crush',   good: true,  verb: 'has a crush on', icon: '💘' },
  { type: 'rival',   good: false, verb: 'feuds with',     icon: '⚔' },
];
export function bondMeta(type) { return BOND_TYPES.find(b => b.type === type) || BOND_TYPES[0]; }

function rollTraits() {
  const ids = TRAITS.map(t => t.id);
  const a = ids[Math.floor(Math.random() * ids.length)];
  if (Math.random() < 0.42) {
    let b = a, guard = 0;
    while (b === a && guard++ < 6) b = ids[Math.floor(Math.random() * ids.length)];
    return b === a ? [a] : [a, b];
  }
  return [a];
}

// New hire forms a relationship with a random existing teammate ~72% of the time.
function formBonds(state, emp) {
  const others = state.employees.filter(e => e.id !== emp.id);
  if (!others.length || Math.random() > 0.72) return;
  const other = others[Math.floor(Math.random() * others.length)];
  const b = BOND_TYPES[Math.floor(Math.random() * BOND_TYPES.length)];
  emp.bonds.push({ withId: other.id, type: b.type });
  const recip = b.type === 'rival' ? 'rival' : b.type === 'crush' ? null : 'friend';
  if (recip) { other.bonds = other.bonds || []; other.bonds.push({ withId: emp.id, type: recip }); }
}

export const CANDIDATE_NAMES = [
  'JAX', 'KIKI', 'PIPER', 'RIVER', 'NOVA', 'SAGE', 'KALE', 'CHAD III',
  'LUMEN', 'FENNEC', 'BLAZE', 'WREN', 'MOSS', 'TATE', 'JUNIPER', 'ORION',
  'BEX', 'HARLOW', 'DASH', 'ZILLOW (LEGAL NAME)',
  'CRYPTID', 'BRAYDEN', 'ESPRESSO', 'KALE JR', 'ZYNN', 'MX. VIBES',
  'GREG (THE BACKEND)', 'PERPETUA', 'BOSCO', 'SLATE', 'AXOLOTL', 'DELL',
  'PRIYANKA-9000', 'THORNE', 'BIFF', 'CLEMENTINE', 'VOID', 'KEYNES',
];

//  Absurd Product Ideas 
// devPoints: effort to ship; mrr: $/s base revenue; hype: burst on ship;
// absurdity: flavor multiplier shown to player (affects pitch quality slightly).
export const PRODUCT_IDEAS = [
  { name: 'BlockchainForCats',   desc: 'Decentralized litter-box consensus protocol. Each clump is a block.',     devPoints: 80,  mrr: 340, hype: 16, absurdity: 1.4 },
  { name: 'NFT Air',             desc: 'Tokenized breathing. Each breath is non-fungible (and weirdly pricey).',  devPoints: 50,  mrr: 200, hype: 16, absurdity: 1.6 },
  { name: 'SaaSquatch',          desc: 'Enterprise software no one has ever actually seen working.',              devPoints: 110, mrr: 520, hype: 21, absurdity: 1.6 },
  { name: 'InfluencerEgg',       desc: 'An egg with 4M followers that endorses your brand for equity.',           devPoints: 60,  mrr: 260, hype: 19, absurdity: 1.7 },
  { name: 'Goat Yoga On-Demand', desc: 'A goat is dispatched to your home in 30 minutes to stand on you.',        devPoints: 65,  mrr: 280, hype: 14, absurdity: 1.3 },
  { name: 'Artisanal Tap Water', desc: 'Small-batch municipal water. $14 a bottle. "Ethically sourced."',         devPoints: 55,  mrr: 240, hype: 13, absurdity: 1.4 },
  { name: 'Subscription Ice',    desc: 'Premium ice cubes, delivered monthly. Cancel anytime (you cannot).',      devPoints: 60,  mrr: 250, hype: 12, absurdity: 1.3 },
  { name: 'Uber for Dread',      desc: 'A calm stranger drives you nowhere as you question every life choice.',    devPoints: 75,  mrr: 330, hype: 15, absurdity: 1.5 },
  { name: 'CryBaby Analytics',   desc: 'Detects when users cry, then upsells them artisanal tissues.',            devPoints: 70,  mrr: 300, hype: 14, absurdity: 1.2 },
  { name: 'SynergyJuicer',       desc: 'A $700 press that squeezes pre-packaged synergy. Wi-Fi required.',        devPoints: 90,  mrr: 420, hype: 18, absurdity: 1.5 },
  { name: 'GhostKitchen Prime',  desc: 'Forty restaurant brands, one microwave, zero of them real.',             devPoints: 85,  mrr: 380, hype: 17, absurdity: 1.4 },
  { name: 'MoodCloud',           desc: 'Stores your feelings in the cloud. The free tier deletes happiness.',     devPoints: 65,  mrr: 280, hype: 13, absurdity: 1.2 },
  { name: 'PetrichorBox',        desc: 'The smell of rain, as a monthly subscription. $99/mo, no refunds.',       devPoints: 95,  mrr: 450, hype: 18, absurdity: 1.5 },
  { name: 'Co-Living Pods',      desc: 'Bunk beds for adults, rebranded as a "vertically integrated lifestyle".', devPoints: 70,  mrr: 310, hype: 14, absurdity: 1.3 },
  { name: 'ToastGPT',            desc: 'A smart toaster that roasts you, personally, before your bread.',         devPoints: 60,  mrr: 250, hype: 12, absurdity: 1.1 },
  { name: 'Rentacle',            desc: 'Rent anything from anyone. Mostly it is one guy named Greg renting Greg.', devPoints: 72,  mrr: 320, hype: 15, absurdity: 1.4 },
  { name: 'AwkAI',               desc: 'An AI that ends your text conversations so you do not have to. $40/mo.',    devPoints: 58,  mrr: 270, hype: 16, absurdity: 1.5 },
  { name: 'DoomScroll Pro',      desc: 'The same bad news, but premium, ad-free, and somehow worse.',              devPoints: 64,  mrr: 290, hype: 17, absurdity: 1.4 },
  { name: 'Quantum Parking',     desc: 'Your car is in all spots until observed. Tickets are also quantum.',        devPoints: 88,  mrr: 400, hype: 16, absurdity: 1.6 },
  { name: 'LinkedIn for Dogs',   desc: 'Professional networking for dogs. Every profile is "open to treats".',      devPoints: 62,  mrr: 260, hype: 18, absurdity: 1.5 },
  { name: 'Subscription Sleep',  desc: 'Sleep, but metered. The free tier wakes you at 3AM to upsell you.',         devPoints: 76,  mrr: 340, hype: 14, absurdity: 1.4 },
  { name: 'CramponClub',         desc: 'Cold plunge as a service. We mail you ice and unresolved childhood issues.', devPoints: 68,  mrr: 300, hype: 13, absurdity: 1.3 },
  { name: 'GaslightDB',          desc: 'A database that insists the data you lost was never there to begin with.',  devPoints: 92,  mrr: 460, hype: 15, absurdity: 1.5 },
  { name: 'Web5',                desc: 'We skipped Web4 because Web4 sounded fake. Trust the roadmap.',             devPoints: 84,  mrr: 420, hype: 20, absurdity: 1.7 },
  { name: 'EmotiTollbooth',      desc: 'A booth that charges you a small fee to feel anything at all.',            devPoints: 66,  mrr: 290, hype: 13, absurdity: 1.4 },
];

//  Funding Rounds (the win ladder) 
// No funding exists until you've actually launched something  every round
// now requires at least one product live. The quiet, pre-launch garage gets
// zero VC interest, by design.
export const FUNDING_ROUNDS = [
  { name: 'PRE-SEED', amount: 50000,   reqProducts: 1, reqHype: 25, blurb: 'An angel investor noticed you finally shipped.' },
  { name: 'SEED',     amount: 150000,  reqProducts: 2, reqHype: 35, blurb: 'They want to see traction. Any traction.' },
  { name: 'SERIES A', amount: 400000,  reqProducts: 3, reqHype: 50, blurb: 'Growth or get out.' },
  { name: 'SERIES B', amount: 1000000, reqProducts: 4, reqHype: 60, blurb: 'The partners demand absurdity at scale.' },
  { name: 'SERIES C', amount: 2500000, reqProducts: 6, reqHype: 75, blurb: 'Close this round and ring the IPO bell.' },
];

//  Market Categories (for rotating "hot trend" buffs) 
// A product is classified by keyword-matching its name + description. Each week
// (~minute) a different category trends and buffs matching products' MRR.
// keys are matched as whole tokens against a normalized haystack (camelCase is
// split, so "ToastGPT"  "toast gpt"), which keeps short keys like 'ai' from
// matching inside unrelated words ('chain', 'email', ).
export const MARKET_CATEGORIES = [
  { id: 'ai',           label: 'AI',            icon: 'AI', keys: ['ai', 'gpt', 'intelligence', 'sentient', 'robot', 'therapist', 'agent', 'neural', 'chatbot', 'self aware', 'self driving'] },
  { id: 'crypto',       label: 'Crypto / Web3', icon: 'W3', keys: ['blockchain', 'crypto', 'nft', 'token', 'dao', 'web3', 'coin', 'ledger', 'ponzi', 'pyramid'] },
  { id: 'social',       label: 'Social',        icon: 'SO', keys: ['social', 'influencer', 'meme', 'follow', 'tok', 'tweet', 'thread', 'dating', 'match', 'linked', 'reddit', 'yelp'] },
  { id: 'delivery',     label: 'On-Demand',     icon: 'OD', keys: ['uber', 'door dash', 'on demand', 'delivery', 'dispatch', '30 minutes', 'gig', 'fleet', 'scooter', 'walker', 'kitchen'] },
  { id: 'subscription', label: 'Subscription',  icon: 'SUB', keys: ['subscription', 'box', 'monthly', 'saas', 'cleanse', 'kit', 'mattress', 'membership', 'utility', 'loyalty'] },
  { id: 'wellness',     label: 'Wellness',      icon: 'ZEN', keys: ['yoga', 'wellness', 'mood', 'feelings', 'breathwork', 'meditation', 'sleep', 'plunge', 'therapy', 'calm', 'religion', 'cult', 'church'] },
];

//  Facilities: Devices & Rooms (construction) 
// kind: 'Device' (small, Tier 1) or 'Room' (larger, gated by research tier).
// eff multipliers default 1 (); additive bonuses default 0. upkeep adds to burn.
export const FACILITIES = [
  // Tier 1  devices, available from the start
  { id: 'espresso',  name: 'Espresso Bar',     icon: '+', emoji: '☕', kind: 'Device', tier: 1, cost: 9000,  upkeep: 6,  desc: 'Caffeine on tap. Team burns out 30% slower.',     eff: { energyDecay: 0.7 } },
  { id: 'gpu',       name: 'GPU Cluster',       icon: '+', emoji: '🎛️', kind: 'Device', tier: 1, cost: 18000, upkeep: 14, desc: 'More compute. +35% team dev speed.',               eff: { dev: 1.35 } },
  { id: 'neon',      name: 'Neon Brand Wall',   icon: '+', emoji: '🌈', kind: 'Device', tier: 1, cost: 12000, upkeep: 8,  desc: 'Looks legit on camera. +0.8 passive Hype/s.',      eff: { hypeAura: 0.8 } },
  { id: 'dashboard', name: 'Growth Dashboard',  icon: '+', emoji: '📈', kind: 'Device', tier: 1, cost: 15000, upkeep: 10, desc: 'Optimize the funnel. +18% MRR.',                   eff: { mrr: 1.18 } },
  { id: 'sprinkler', name: 'Fire Suppression',  icon: '+', emoji: '🧯', kind: 'Device', tier: 1, cost: 11000, upkeep: 7,  desc: 'Halve fire damage; server fires 40% rarer.',       eff: { fireDamage: 0.5, fireInterval: 1.4 } },
  // Tier 2  rooms, need "Facilities Permit" research
  { id: 'serverroom', name: 'Server Room',      icon: '#', emoji: '🗄️', kind: 'Room', tier: 2, cost: 45000, upkeep: 22, desc: 'Dedicated infra. +25% dev speed, fire damage -40%.', eff: { dev: 1.25, fireDamage: 0.6 } },
  { id: 'breakroom',  name: 'Break Room',       icon: '#', emoji: '🛋️', kind: 'Room', tier: 2, cost: 38000, upkeep: 18, desc: 'Naps & ping-pong. Burnout -45%, +0.3 Hype/s.',       eff: { energyDecay: 0.55, hypeAura: 0.3 } },
  { id: 'warroom',    name: 'War Room',         icon: '#', emoji: '🎯', kind: 'Room', tier: 2, cost: 42000, upkeep: 20, desc: 'Where pitches are forged. +0.4 pitch quality.',      eff: { pitch: 0.4 } },
  { id: 'cafeteria',  name: 'Cafeteria',        icon: '#', emoji: '🍜', kind: 'Room', tier: 2, cost: 40000, upkeep: 19, desc: 'Free lunch (not really free). Burnout -35%, +8% MRR.', eff: { energyDecay: 0.65, mrr: 1.08 } },
  // Tier 3  advanced rooms, need "Corporate Campus" research
  { id: 'lab',        name: 'R&D Lab',          icon: '#', emoji: '🧪', kind: 'Room', tier: 3, cost: 75000, upkeep: 34, desc: 'Bleeding edge. +30% dev speed, +12% MRR, launches land more often.', eff: { dev: 1.3, mrr: 1.12, success: 0.08 } },
  { id: 'legal',      name: 'Legal Department',  icon: '#', emoji: '⚖️', kind: 'Room', tier: 3, cost: 65000, upkeep: 30, desc: 'Actual lawyers. PR disasters 55% less severe.',      eff: { prSeverity: 0.45 } },
  { id: 'datacenter', name: 'Private Data Center',icon: '#', emoji: '🏰', kind: 'Room', tier: 3, cost: 95000, upkeep: 42, desc: 'Own your infra. +40% dev speed, fires 60% rarer.',     eff: { dev: 1.4, fireInterval: 1.6 } },
];

//  Research / Tech Tree (instant unlocks, gated by prereqs + cash) 
export const RESEARCH = [
  { id: 'facilities1', name: 'Bribe the Inspector',  emoji: '🤝', tier: 1, cost: 14000,  req: [],                       unlockTier: 2, desc: 'Unlock Tier-2 rooms. He "didn\'t see any of the wiring." ' },
  { id: 'adnetwork',   name: 'Monetize Your Soul',  emoji: '👁️', tier: 1, cost: 16000,  req: [],                       eff: { mrr: 1.2 },              desc: '+20% MRR. The privacy policy is now a single shrug emoji.' },
  { id: 'devtools',    name: 'Replace IDEs w/ Vibes',emoji: '🔮', tier: 1, cost: 18000,  req: [],                       eff: { dev: 1.15 },             desc: '+15% dev speed. The linter has been emotionally suppressed.' },
  { id: 'genai',       name: 'Ship First, Test Never',emoji: '🚀', tier: 2, cost: 70000,  req: ['devtools'],             eff: { dev: 1.25, shipHype: 6, success: 0.05 },desc: '+25% dev speed; launches give +6 Hype and land a bit more often. QA is now a state of mind. ' },
  { id: 'growthhack',  name: 'Manufacture FOMO',    emoji: '🤖', tier: 2, cost: 80000,  req: ['adnetwork'],            eff: { mrr: 1.3, hypeAura: 0.4 },desc: '+30% MRR, +0.4 Hype/s. Waitlist of 4M (3.9M are your own bots).' },
  { id: 'facilities2', name: 'Annex the Parking Lot',emoji: '🅿️', tier: 2, cost: 90000,  req: ['facilities1'],          unlockTier: 3, desc: 'Unlock Tier-3 facilities. Now with a slide nobody is allowed to use. ' },
  { id: 'agents',      name: 'Outsource Everything', emoji: '🌍', tier: 3, cost: 220000, req: ['genai'],                eff: { dev: 1.4 },              desc: '+40% dev speed. The whole company is now contractors in 11 time zones. ' },
  { id: 'autoscale',   name: 'Summon Infinite Servers',     emoji: '♾️', tier: 3, cost: 260000, req: ['growthhack'],           eff: { mrr: 1.5, fireInterval: 1.5 }, desc: '+50% MRR; fires 50% rarer. The AWS bill is now structurally load-bearing.' },
  { id: 'agi',         name: 'Pivot to Everything',  emoji: '🌀', tier: 4, cost: 850000, req: ['agents', 'autoscale'],  eff: { dev: 1.6, mrr: 1.5, hypeAura: 1.0 }, desc: 'EVERYTHING, but more. The pitch deck is now 400 slides and zero nouns. ' },
];

//  Bank Loans (instant cash, ongoing interest) 
export const LOANS = [
  { id: 'micro',  name: 'Microloan',         icon: '$', emoji: '🐖', cash: 20000,  interest: 28,  desc: 'A credit union that "believes in you." +$28/s interest.' },
  { id: 'series', name: 'Bridge Loan',       icon: 'B', emoji: '🏦', cash: 60000,  interest: 95,  desc: 'A real bank, real paperwork. +$95/s interest.' },
  { id: 'mega',   name: 'Venture Debt',      icon: 'VC', emoji: '🦈', cash: 150000, interest: 260, desc: 'The terms are a love letter to the lender. +$260/s interest.' },
];

//  Development Tactics 
// While a product is in development, the player can steer the team's posture.
// Fast mode ships sooner but creates bugs; polish mode slows progress and raises
// launch/product quality.
export const DEV_MODES = {
  balanced: { id: 'balanced', label: 'Balanced', speed: 1.0, qualityPerSec: 0.012, bugPerSec: 0.008, moralePerSec: 0 },
  fast:     { id: 'fast',     label: 'Move Fast', speed: 1.32, qualityPerSec: -0.01, bugPerSec: 0.045, moralePerSec: -0.035 },
  polish:   { id: 'polish',   label: 'Polish',    speed: 0.72, qualityPerSec: 0.055, bugPerSec: -0.018, moralePerSec: 0.012 },
};

//  Shipped Product Roadmap Features 
export const FEATURE_OPTIONS = [
  { id: 'growth_loop', name: 'Growth Loop', emoji: '🌀', dev: 42, cost: 3500, mrrBoost: 95,  hype: 8,  burn: 8,  bugRisk: 0.22, desc: '+MRR and Hype, adds support burn.' },
  { id: 'enterprise',  name: 'Enterprise Tier', emoji: '🏢', dev: 62, cost: 6500, mrrBoost: 180, hype: 5,  burn: 16, bugRisk: 0.32, desc: 'Big MRR, boring meetings, more bugs.' },
  { id: 'ai_wrapper',  name: 'AI Wrapper', emoji: '🎁', dev: 50, cost: 5200, mrrBoost: 135, hype: 15, burn: 12, bugRisk: 0.42, desc: 'Huge hype, fragile demo energy.' },
  { id: 'stability',   name: 'Stability Pass', emoji: '🩹', dev: 38, cost: 2800, mrrBoost: 45,  hype: 4,  burn: 4,  bugRisk: 0.08, desc: 'Small upside, lowers tech debt on ship.' },
];

//  Peddlers (random shady offers  fast cash, nasty strings) 
// cash = instant money; debt = added principal (counts toward bankruptcy);
// hype = reputation change (+/-).
export const PEDDLER_DEALS = [
  { cash: 25000, debt: 40000, hype: 0,   text: 'A loan shark in a great coat fronts you $25k. The vig is... aggressive.' },
  { cash: 18000, debt: 0,     hype: 14,  text: 'A guy sells you 2 million "users" out of a van. (They are bots, but loud ones.)' },
  { cash: 30000, debt: 0,     hype: -16, text: 'A peddler buys your user data for $30k cash. Word gets around.' },
  { cash: 15000, debt: 0,     hype: 8,   text: '"Totally legal" ad inventory for $15k up front. Probably fine.' },
  { cash: 40000, debt: 58000, hype: 0,   text: 'An "angel" wires $40k. He is neither an angel nor ever reachable again.' },
  { cash: 12000, debt: 0,     hype: -6,  text: 'Pawn the good espresso machine and the office plants for a quick $12k.' },
  { cash: 22000, debt: 0,     hype: 11,  text: 'A "growth agency" sells you a trending hashtag for $0 down. The bots are included.' },
  { cash: 35000, debt: 52000, hype: 6,   text: 'A man named Dimitri offers $35k against "future vibes". The contract is in Comic Sans.' },
  { cash: 9000,  debt: 0,     hype: -10, text: 'Sell your domain\'s good karma to an SEO wizard. Google will notice eventually.' },
  { cash: 50000, debt: 80000, hype: 0,   text: 'A SPAC made of three shell companies wants in. The lawyers are also shells.' },
  { cash: 16000, debt: 0,     hype: 9,   text: 'Buy a verified checkmark farm. 80,000 accounts, all named some variant of "Brad".' },
  { cash: 28000, debt: 0,     hype: -14, text: 'License your users\' DMs to a "sentiment lab". Nobody reads the email about it.' },
  { cash: 20000, debt: 0,     hype: -8,  text: 'A "reputation manager" offers $20k to bury one bad review under nine glowing fakes.' },
  { cash: 33000, debt: 47000, hype: 0,   text: 'A crypto exchange (currently "under maintenance") fronts you $33k in a coin you cannot sell.' },
  { cash: 14000, debt: 0,     hype: 10,  text: 'A man with a clipboard sells you a trending sound for $14k. It is, technically, a scream.' },
  { cash: 26000, debt: 0,     hype: -12, text: 'License the office WiFi logs to an ad broker. $26k now, a class-action someday.' },
  { cash: 8000,  debt: 0,     hype: 7,   text: 'Rent your logo to a mystery brand for one weekend. $8k. Do not ask what they sell.' },
  { cash: 45000, debt: 70000, hype: 4,   text: 'A "family office" (one guy, his cousin) wires $45k against "the upside". The upside is undefined.' },
  { cash: 17000, debt: 0,     hype: -9,  text: 'Sell early access to your unreleased feature to a competitor "for research". $17k.' },
  { cash: 11000, debt: 0,     hype: 12,  text: 'Buy a viral apology-video template for $11k. You have not done anything yet. Yet.' },
];

export const BOARD_DILEMMAS = [
  {
    id: 'layoffs',
    title: 'Board Dilemma: Extend Runway',
    text: 'The board wants "operational excellence", which is investor for making fewer people do more work.',
    options: [
      { label: 'Do Layoffs', desc: '+$18K cash, -14 Hype, team burns out faster.', effect: { cash: 18000, hype: -14, energyHit: 0.18 } },
      { label: 'Protect Team', desc: '-$9K cash, +8 Hype. A rare humane LinkedIn post.', effect: { cash: -9000, hype: 8 } },
    ],
  },
  {
    id: 'privacy',
    title: 'Board Dilemma: Monetize Data',
    text: 'A partner slides over a deck titled "Consent Is A Growth Channel". Everyone avoids eye contact.',
    options: [
      { label: 'Sell The Data', desc: '+$24K cash, +10 Hype, future PR risk.', effect: { cash: 24000, hype: 10, pr: true } },
      { label: 'Stay Clean', desc: '-$6K legal audit, +12 Hype. The lawyers blink twice.', effect: { cash: -6000, hype: 12 } },
    ],
  },
  {
    id: 'quality',
    title: 'Board Dilemma: Ship Quality',
    text: 'Customers found a bug where the app becomes sentient and invoices itself. The board calls this "traction".',
    options: [
      { label: 'Patch It Properly', desc: '-$10K cash, +10 Hype, better launch discipline.', effect: { cash: -10000, hype: 10, launchBuff: 0.04 } },
      { label: 'Call It Beta', desc: '+$12K cash, -10 Hype. Product Twitter notices.', effect: { cash: 12000, hype: -10, pr: true } },
    ],
  },
  {
    id: 'rebrand',
    title: 'Board Dilemma: The Rebrand',
    text: 'A consultant wants $20K to drop a vowel from your name and call it "a bold new chapter".',
    options: [
      { label: 'Drop The Vowel', desc: '-$20K cash, +16 Hype. The new logo is just a circle.', effect: { cash: -20000, hype: 16 } },
      { label: 'Keep The Vowels', desc: '+4 Hype. You spent the money on snacks instead. Morale up.', effect: { hype: 4 } },
    ],
  },
  {
    id: 'allhands',
    title: 'Board Dilemma: Mandatory Fun',
    text: 'The board demands a "culture offsite" to a trampoline park. Productivity, briefly, will not exist.',
    options: [
      { label: 'Book The Trampolines', desc: '-$7K cash, +9 Hype, but the team comes back exhausted.', effect: { cash: -7000, hype: 9, energyHit: 0.12 } },
      { label: 'Cancel It', desc: '+$3K saved, -6 Hype. The group chat goes quiet and cold.', effect: { cash: 3000, hype: -6 } },
    ],
  },
  {
    id: 'crunch_mandate',
    title: 'Board Dilemma: Hustle Harder',
    text: 'An investor posts "real founders sleep at the office". The board forwards it with no comment.',
    options: [
      { label: 'Embrace The Grind', desc: '+0.05 launch buff, but the whole team burns hotter.', effect: { launchBuff: 0.05, energyHit: 0.2 } },
      { label: 'Protect Work-Life', desc: '-$5K morale budget, +11 Hype. A rare sane decision.', effect: { cash: -5000, hype: 11 } },
    ],
  },
  {
    id: 'influencer_seat',
    title: 'Board Dilemma: The Celebrity Advisor',
    text: 'A washed-up reality star offers to "advise" for equity and a parking spot. They have 14M followers.',
    options: [
      { label: 'Give Them Equity', desc: '+$15K from their fans, +12 Hype, future PR risk.', effect: { cash: 15000, hype: 12, pr: true } },
      { label: 'Politely Decline', desc: '+6 Hype for restraint. They subtweet you anyway.', effect: { hype: 6 } },
    ],
  },
  {
    id: 'opensource', title: 'Board Dilemma: Open Source It',
    text: 'An engineer wants to open-source the core. The board hears "give away the company for GitHub stars".',
    options: [
      { label: 'Open Source It', desc: '-$4K, +14 Hype. Devs adore you; the moat evaporates.', effect: { cash: -4000, hype: 14 } },
      { label: 'Keep It Closed', desc: '+$6K enterprise interest, -5 Hype. Hacker News is furious.', effect: { cash: 6000, hype: -5 } },
    ],
  },
  {
    id: 'superbowl', title: 'Board Dilemma: The Super Bowl Ad',
    text: 'A media buyer offers a Super Bowl slot. It costs everything. It is seen by everyone, for four seconds.',
    options: [
      { label: 'Buy The Ad', desc: '-$30K, +22 Hype. Your servers should probably be warned.', effect: { cash: -30000, hype: 22 } },
      { label: 'Stay Frugal', desc: '+$2K saved, +3 Hype. Growth via "word of mouth" (there are no words).', effect: { cash: 2000, hype: 3 } },
    ],
  },
  {
    id: 'unionize', title: 'Board Dilemma: The Team Wants A Union',
    text: 'The team is organizing. The board uses the word "family" fourteen times in a single email.',
    options: [
      { label: 'Voluntarily Recognize', desc: '-$8K, +16 Hype, a much happier team.', effect: { cash: -8000, hype: 16 } },
      { label: 'Hire A "Consultant"', desc: '+$5K efficiency, -18 Hype, PR risk.', effect: { cash: 5000, hype: -18, pr: true } },
    ],
  },
  {
    id: 'founder_book', title: 'Board Dilemma: Write The Book',
    text: 'A publisher wants your founder wisdom. You have been a founder for nine months.',
    options: [
      { label: 'Write "Move Fast"', desc: '+$9K advance, +10 Hype, team rolls its eyes.', effect: { cash: 9000, hype: 10 } },
      { label: 'Stay Humble', desc: '+7 Hype. You ship instead. The team is genuinely shocked.', effect: { hype: 7 } },
    ],
  },
  {
    id: 'token', title: 'Board Dilemma: Launch A Token',
    text: 'Someone says the word "token" and the crypto guy on the board levitates slightly.',
    options: [
      { label: 'Launch $PANIC', desc: '+$26K, +12 Hype, significant PR risk.', effect: { cash: 26000, hype: 12, pr: true } },
      { label: 'Absolutely Not', desc: '+9 Hype for restraint. He sulks for a week.', effect: { hype: 9 } },
    ],
  },
  {
    id: 'rto', title: 'Board Dilemma: Return To Office',
    text: 'The board read one article about "collaboration" and now wants everyone back five days a week.',
    options: [
      { label: 'Mandate RTO', desc: '+0.04 launch buff, -12 Hype, morale dips.', effect: { launchBuff: 0.04, hype: -12, energyHit: 0.1 } },
      { label: 'Stay Remote', desc: '-$3K stipends, +13 Hype. The team weeps with joy.', effect: { cash: -3000, hype: 13 } },
    ],
  },
  {
    id: 'pivot_ai', title: 'Board Dilemma: Pivot To AI (Again)',
    text: 'The board wants to add "AI" to literally everything, including the company lunch.',
    options: [
      { label: 'Bolt On AI', desc: '+$14K, +15 Hype, the demo is held together with prayer.', effect: { cash: 14000, hype: 15, pr: true } },
      { label: 'Stay Focused', desc: '+8 Hype, +0.03 launch buff. Radical.', effect: { hype: 8, launchBuff: 0.03 } },
    ],
  },
];

function availableBoardDilemmas(state) {
  return BOARD_DILEMMAS.filter(d => {
    if (d.id === 'layoffs') return state.employees.length > 0;
    if (d.id === 'quality') return state.shippedProducts.length > 0 || state.readyProducts.length > 0 || getActiveProducts(state).length > 0;
    return true;
  });
}

//  Office Expansion Tiers (more desk slots) 
export const OFFICE_TIERS = [
  { name: 'Garage',        slots: 8,  cost: 0 },
  { name: 'Real Office',   slots: 12, cost: 30000 },   // +4 seats and a polished office, not +1 for a fortune
  { name: 'Whole Floor',   slots: 16, cost: 100000 },  // +4 more seats for the late-game team
];

//  Buzzword Database 
export const BUZZWORDS = [
  { word: 'Blockchain',         category: 'tech',    mult: 1.2 },
  { word: 'AI-Powered',         category: 'tech',    mult: 1.5 },
  { word: 'Quantum',            category: 'tech',    mult: 1.4 },
  { word: 'Cloud-Native',       category: 'tech',    mult: 1.2 },
  { word: 'Web3',               category: 'tech',    mult: 1.1 },
  { word: 'IoT-Enabled',        category: 'tech',    mult: 1.2 },
  { word: 'Network Effects',    category: 'tech',    mult: 1.3 },
  { word: 'Disruptive',         category: 'biz',     mult: 1.2 },
  { word: 'Synergy',            category: 'biz',     mult: 0.9 },
  { word: 'Pivot-Ready',        category: 'biz',     mult: 1.0 },
  { word: 'Hyper-Scale',        category: 'biz',     mult: 1.1 },
  { word: 'B2B2C SaaS',         category: 'biz',     mult: 1.3 },
  { word: '10x Returns',        category: 'biz',     mult: 1.4 },
  { word: 'Unicorn Path',       category: 'biz',     mult: 1.6 },
  { word: 'Direct-to-Consumer', category: 'biz',     mult: 1.2 },
  { word: 'Subscription',       category: 'biz',     mult: 1.2 },
  { word: 'Platform Play',      category: 'biz',     mult: 1.3 },
  { word: 'Hockey-Stick',       category: 'biz',     mult: 1.4 },
  { word: 'Category-Defining',  category: 'biz',     mult: 1.5 },
  { word: 'Moat',               category: 'biz',     mult: 1.2 },
  { word: 'Flywheel',           category: 'biz',     mult: 1.1 },
  { word: 'Pre-Revenue',        category: 'biz',     mult: 0.8 },
  { word: 'TAM Expansion',      category: 'biz',     mult: 1.3 },
  { word: 'Democratizing',      category: 'social',  mult: 1.1 },
  { word: 'Mission-Driven',     category: 'social',  mult: 1.0 },
  { word: 'Ecosystem',          category: 'social',  mult: 1.2 },
  { word: 'Gamified',           category: 'social',  mult: 1.2 },
  { word: 'Artisanal',          category: 'social',  mult: 1.0 },
  { word: 'Carbon-Neutral',     category: 'social',  mult: 1.1 },
  { word: 'Frictionless',       category: 'social',  mult: 1.0 },
];

//  Feature Announcement Templates 
const FEATURE_TEMPLATES = [
  'We\'re not building [X]. We\'re building the [Y] of [X].',
  'Think [X], but for [Y]. Nobody asked. Everybody\'s funding it.',
  '[X] meets [Y] in our category-defining new platform.',
  'We put the [X] in [Y]. Legal is still reviewing whether we can say that.',
  'Our [X] doesn\'t just do [Y]  it reinvents [Y] from first principles.',
  'Introducing [X]-as-a-Service. [Y] has never been this frictionless.',
  '[X] is dead. We pivoted to [Y] over a single weekend.',
  'We\'re the [X] for [Y]  and soon the [Y] for [X].',
  'One platform. Infinite [X]. Zero [Y]. Pre-revenue, post-vibes.',
  'We leverage [X] to disrupt [Y] faster than regulators can spell it.',
];

const FEATURE_X = ['Synergy', 'Hustle', 'Disruption', 'Scale', 'Vibes', 'Growth', 'Hype', 'Velocity'];
const FEATURE_Y = ['market dominance', 'frictionless growth', 'category creation', 'hockey-stick traction',
                   'unicorn status', 'viral loops', 'engagement at scale', 'shareholder delight'];

const PR_DISASTERS = [
  { title: 'DATA BREACH',      desc: 'We left the database public again.',        severity: 1.2 },
  { title: 'VIRAL THREAD',     desc: 'A dev tweeted our burn rate. In detail.',   severity: 1.0 },
  { title: 'PRODUCT RECALL',   desc: 'Regulators say the product is, technically, "not safe".', severity: 1.4 },
  { title: 'CEO GAFFE',        desc: 'You said "users are just metrics" live.',   severity: 1.3 },
  { title: 'EQUITY DRAMA',     desc: 'Early employees comparing Carta shares.',   severity: 0.9 },
  { title: 'DEMO FAILURE',     desc: 'TechCrunch demo crashed. Twice.',           severity: 1.1 },
  { title: 'LAWSUIT',          desc: 'Legal called. The TOS we ignored matters.', severity: 1.5 },
  { title: 'TALENT EXODUS',    desc: 'Lead engineer posted "I quit" on Medium.',  severity: 1.2 },
  { title: 'MEDIA EXPOS',     desc: 'Bloomberg says we\'re "vibe-funded".',      severity: 1.0 },
  { title: 'VC DOUBT',         desc: 'Our lead investor asked for traction data.',severity: 0.8 },
  { title: 'AI HALLUCINATION', desc: 'Our chatbot told a user to drink a server.', severity: 1.2 },
  { title: 'FOUNDER PODCAST',  desc: 'You talked for 3 hours and confessed everything.', severity: 1.1 },
  { title: 'SLACK LEAK',       desc: 'The #no-customers channel is now public.',  severity: 1.3 },
  { title: 'PRICING BACKLASH', desc: 'You added a fee to read the other fees.',    severity: 1.0 },
  { title: 'OUTAGE MELTDOWN',  desc: 'The status page is also down. Bold choice.', severity: 1.1 },
  { title: 'GLASSDOOR RIOT',   desc: '1-star reviews mention "the smell" specifically.', severity: 0.9 },
  { title: 'INFLUENCER FEUD',  desc: 'A 19-year-old with 9M followers hates us now.', severity: 1.2 },
  { title: 'COOKIE SCANDAL',   desc: 'Turns out "essential cookies" included a webcam.', severity: 1.4 },
];

//  Procedural Product Word Banks 
// Mixed in with the hand-tuned PRODUCT_IDEAS so every run feels fresh.
export const NAME_PRE = ['Synerg','Hyper','Goose','Snack','Hustle','Vibe','Doom','Flux','Zap','Boop','Plush','Munch','Hop','Bork','Fizz','Loop','Dyna','Nova','Echo','Grift','Scale','Pivot','Wiggle','Yeet','Vapor','Singul','Apex','Crisp','Blob','Maxx','Lumin','Sprout','Drift','Babel','Mirage','Froth','Quark','Noodle','Grav','Zest','Toober','Wonk','Glint','Pebble','Smol','Churn','Vortex','Mega','Tingl','Snorkel','Yolo'];
export const NAME_SUF = ['.co','.io','.ai','ly','Labs','X','Corp','DAO','.xyz','verse','OS','Hub','ify','sy','Box','Kit','Now','Wagon','Mart','Crate','.gg','flow','grid','base','stack','pad','loop','tron','genix','r','core','pal'];
export const PRODUCT_NOUNS = ['Meal-Kit Subscription','Juice Cleanse Startup','Oat-Milk Empire','Artisanal Toast Bar','Cricket-Protein Snack Brand','Subscription Box','Direct-to-Consumer Mattress','Smart Water Bottle','On-Demand Dog Walker','Goat-Yoga Studio','Cold-Plunge Franchise','Breathwork Hotline','Dating App','Matchmaking Service','Co-Living Commune','Electric Scooter Fleet','Gig-Work Platform','On-Demand Apology Service','Crypto Hedge Fund','Buy-Now-Pay-Later App','NFT Marketplace','Blockchain Toaster','Smart Fridge','Wi-Fi Toothbrush','Pet Influencer Agency','Haunted Vending Machine','Ghost Kitchen','Meditation App','Productivity App','Sleep-Tracking Pillow','Rsum Embellisher','Wedding-Planning Startup','Funeral-Planning Startup','Personal-Brand Consultancy','Robot Bartender','AI Therapist','GPT Plumber','Sentient Juicer'];
export const AUDIENCES = ['for Cats','for Divorced Dads','for Toddlers','for Billionaires','for the Recently Deceased','for Houseplants','for Insomniacs','for Cult Leaders','for Ghosts','for Influencers','for Lonely Astronauts','for Disgraced CEOs','for Sentient Roombas','for Crypto Widows','for Doomsday Preppers','for Reply Guys','for Tired Millennials','for Anxious Dogs','for Burnt-Out Monks','for HR Departments','for Conspiracy Theorists','for Unpaid Interns','for Pigeons','for Vampires','for Middle Managers','for People Who Hate People','for Emotionally Unavailable Men','for Haunted Houses','for Failed Influencers','for Gen Z','for Goblins','for People Mid-Divorce','for Retired Clowns','for Sentient Calendars','for Tax Evaders','for Beige Enthusiasts','for Three Raccoons in a Trenchcoat','for Ex-Crypto Bros','for Sleep-Deprived Parents','for Aspiring Cult Founders','for People Who Peaked in 2017','for Competitive Nappers','for Disillusioned Wizards'];
// Parodies of well-known platforms  full product concepts, dropped in occasionally
export const PLATFORM_PARODIES = [
  { name: 'LinkedOut',           desc: 'Professional networking where everyone is unemployed and posting about it. #blessed #opentowork' },
  { name: 'Tinder for Audits',   desc: 'Swipe right on an IRS agent. It\'s a match  and you owe back taxes.' },
  { name: 'Uber for Dread',      desc: 'A calm stranger drives you nowhere while you quietly question every life choice.' },
  { name: 'Slacker',             desc: 'Team chat where nine people watch one person type "" for an hour.' },
  { name: 'Zoomf',              desc: 'Video calls that should\'ve been emails. Now with worse audio and a frozen face.' },
  { name: 'AirBnBoo',            desc: 'Stay somewhere magical. The 3am footsteps are, per the listing, "a feature."' },
  { name: 'OnlyFunds',           desc: 'Subscribe to a VC and watch your money disappear, personally and intimately.' },
  { name: 'X (Formerly Worse)',  desc: 'A town square, if the square were on fire and run entirely by one guy.' },
  { name: 'Spotifry',            desc: 'Stream music that pays artists in "exposure" and small amounts of weather.' },
  { name: 'BossTok',             desc: 'An infinite scroll of your manager doing little dances about synergy.' },
  { name: 'Reddit for Cats',     desc: 'Nine million communities, all of them downvoting you, a cat, specifically.' },
  { name: 'DoorDash for Feelings', desc: 'Emotional support delivered in 30 minutes or your existential sadness is free.' },
  { name: 'BeReal-ish',          desc: 'Be authentic at a random moment  right after 45 minutes of careful retakes.' },
  { name: 'Threadbare',          desc: 'A Twitter clone that launched the same week as nine other Twitter clones.' },
  { name: 'GitHub for Crimes',   desc: 'Version-control your alibi. Now with branches, and a very nervous legal team.' },
  { name: 'Yelp for People',     desc: 'Rate your friends 15 stars. Statistically, nobody is above a 3.2.' },
  { name: 'Notionn\'t',          desc: 'A workspace so flexible you spend 100% of your time configuring it and 0% working.' },
  { name: 'Robinhoodwink',       desc: 'Commission-free trading. You are not the customer  you are the product AND the loss.' },
  { name: 'Postmates-Ex',        desc: 'On-demand delivery of things you immediately regret ordering.' },
  { name: 'Substackable',        desc: 'A newsletter platform where 11,000 writers all explain the same news to each other.' },
  { name: 'Discordn\'t',         desc: 'A chat app with 412 channels, 0 of which are the one you need right now.' },
  { name: 'Fivrr',              desc: 'Hire a stranger to do anything for $5. The thing is usually "regret".' },
  { name: 'Calendlyish',         desc: 'Scheduling software that finds the one time slot that ruins everyone\'s week.' },
  { name: 'Patreonsie',          desc: 'Pay creators monthly to keep promising the thing is "coming this fall".' },
  { name: 'WeWork-ish',          desc: 'Beanbags, cold brew, and a valuation held together entirely by adjectives.' },
  { name: 'Clubhouse 2',         desc: 'A voice app that was the future for exactly one (1) quarter of 2021.' },
  { name: 'Venmoooo',            desc: 'Send money to friends and broadcast it publicly, for reasons nobody can explain.' },
  { name: 'Peletonn',            desc: 'A $2,400 clothes rack that occasionally yells at you about your cadence.' },
  { name: 'Duolingdon\'t',       desc: 'A language app whose owl will find you. It knows you skipped Tuesday.' },
  { name: 'Stack Overflown',     desc: 'Ask a coding question, get marked duplicate of a 2009 thread with no answer.' },
];

// Weirder, higher-potential products unlocked by research (tier 2+)
export const PRODUCT_NOUNS_ADV = ['Vertically-Integrated Mayonnaise Conglomerate', 'Sovereign Crypto Micronation', 'Subscription-Based Oxygen Utility', 'Direct-to-Consumer Religion', 'Franchised Personality Cult', 'Emotion Futures Exchange', 'Lab-Grown Influencer Farm', 'Carbon-Neutral Ponzi Scheme', 'Self-Driving Mattress Fleet', 'Series-Z Megachurch', 'Fully-Automated Luxury HOA', 'Planetary Loyalty Program', 'Recursive Startup Incubator', 'Self-Aware Spreadsheet', 'Decentralized Weather Cartel', 'Synthetic Nostalgia Refinery', 'Algorithmic Astrology Hedge Fund', 'Tokenized National Park', 'Vertically-Farmed Influencer Hatchery', 'Outsourced Conscience Marketplace', 'Subscription Gravity Provider', 'Generative Apology Foundry', 'Pre-Owned Memory Exchange', 'Frictionless Guilt Logistics Network'];
export const TWISTS = ['that learned everything from Reddit','powered entirely by unpaid interns','with a crypto wallet bolted on for no reason','that only communicates in memes','built on data it absolutely should not have','but it\'s secretly 400 contractors in a basement','that gaslights you for engagement','with no off switch and no refunds','banned in three countries and one county fair','that the founder does not understand either','running on one overheating laptop','with a business plan traced from stolen fan-fiction','that subtweets its own paying users','with a "trust me bro" privacy policy','that demands equity from its customers','that reports you to HR','powered by vibes and venture debt','that dispenses confidently wrong legal advice','optimized purely for outrage','that\'s technically a pyramid scheme','that the founder is now trying to flee','with a manifesto where the roadmap should be','that quietly mines crypto on your phone','that only works during the demo','that won an award before it shipped','that A/B tests your grief','with a terms-of-service longer than the Bible','that was a hackathon project nobody killed in time','held together by a single intern named Greg','that escalates everything to a group chat','that the board insists is "basically AGI"','that turns off if you say the word "refund"','currently being investigated by a podcast','that monetizes your sleep without telling you','with a roadmap drawn entirely on a napkin','that emails your ex on your behalf','that is one lawsuit away from a documentary'];

//  Helpers 
function randRange([min, max]) { return min + Math.random() * (max - min); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function ri(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/** Roll a fresh hot category, never repeating the one currently trending. */
function pickTrend(state) {
  const cur = state.marketTrend && state.marketTrend.id;
  const c = pick(MARKET_CATEGORIES.filter(x => x.id !== cur));
  return { id: c.id, label: c.label, icon: c.icon, mrrBonus: CONFIG.TREND_MRR_BONUS };
}

/**
 * Generate a fresh, cursed product idea from the word banks.
 * Matches the PRODUCT_IDEAS shape (so it drops into dev/ship logic),
 * plus hidden `ethical`/`scam` flavor used to weight the run's ending.
 */
/**
 * Product potential tier from research  higher = weirder, more lucrative ideas.
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

function tuneProductEconomics(idea, state) {
  const copy = { ...idea };
  const tier = copy.tier ?? (state ? getProductTier(state) : 0);
  if (!copy._econTuned) {
    const tierLift = 1 + tier * 0.18;
    copy.mrr = Math.round(copy.mrr * CONFIG.PRODUCT_MRR_MULT + CONFIG.PRODUCT_MRR_BONUS * tierLift);
    copy._econTuned = true;
  }
  return copy;
}

export function fmtMoney(n) {
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e9) return `${sign}$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(n)}`;
}

//  Game State 
export class GameState {
  constructor() {
    Object.defineProperty(this, 'activeProduct', {
      configurable: true,
      enumerable: true,
      get: () => (this.activeProducts && this.activeProducts[0]) || null,
      set: (value) => { this.activeProducts = value ? [value] : []; },
    });
    this.reset();
  }

  reset() {
    this.cash     = CONFIG.STARTING_CASH;
    this.hype     = 10;
    this.time     = 0;
    this.paused   = false;
    this.gameOver = false;
    this.won      = false;

    // Two-phase game: you start in a quiet "stealth" garage (calm, cheap, no
    // VCs, no chaos). Your FIRST product launch flips `live` to true  that's
    // when burn jumps, the press notices you, disasters begin, and VCs appear.
    this.live     = false;

    // Company identity (set at startGame via viral.js) + comedy layer
    this.companyName  = 'STEALTH STARTUP';
    this.companyPitch = '';
    this.founderHandle = 'founder';
    this.lastTweet    = '';
    this.peakValuation = 0;

    this.cooldowns = { launch: 0, pitch: 0, caffeine: 0, pivot: 0, update: 0, crunch: 0, marketing: 0, pizza: 0 };

    this.fires       = [];  // { id, timer, maxTimer, fireObject }
    this.prDisasters = [];  // { id, title, desc, timer, maxTimer, severity }
    this.rackDown    = new Array(CONFIG.NUM_RACKS).fill(true); // offline/destroyed servers

    // Live-game systems: a rotating market trend and the occasional rival clone
    this.marketTrend     = null;  // { id, label, icon, mrrBonus }  current hot category
    this.competitorClone = null;  // { product, rival, mrrMult, timer }  active knockoff

    // Debt financing
    this.debt     = 0;   // total principal owed (bank loans + peddlers)
    this.loanBurn = 0;   // $/s interest added to burn rate
    this.launchBuff = 0; // temporary success bonus from decision events
    this.morale   = CONFIG.MORALE_START;

    // Office starts empty. The first desk you buy/place becomes the founder's
    // workstation; employeeId -1 marks it as yours and not hireable.
    this.desks = [];

    this.employees = [];

    // Products: develop  ready  launch (live)
    this.activeProducts  = [];    // { idea, progress, devMode, quality, bugs }  currently developing
    this.readyProducts   = [];    // { idea, quality, bugs }  developed, not yet launched
    this.shippedProducts = [];    // launched products with live ops state

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
    this._nextBoardTime   = randRange(CONFIG.BOARD_INTERVAL);
    this._nextAcqTime     = randRange(CONFIG.ACQUISITION_CHECK);
    this._nextTrendTime   = randRange(CONFIG.TREND_INTERVAL);
    this._nextCloneTime   = randRange(CONFIG.CLONE_INTERVAL);
    this._nextPoachTime   = randRange(CONFIG.POACH_INTERVAL);
    this._nextMemeTime    = randRange(CONFIG.MEME_INTERVAL);
    this._nextRegulatorTime = randRange(CONFIG.REGULATOR_INTERVAL);
    this._acquisitionOffered = false;

    this.stats = {
      launches: 0, pitches: 0, firesKilled: 0, caffeinations: 0, pivots: 0,
      hires: 0, productsShipped: 0, peakHype: 0,
    };

    this._eventIdCounter = 0;
    this._entityIdCounter = 0;
  }

  nextEventId()  { return ++this._eventIdCounter; }
  nextEntityId() { return ++this._entityIdCounter; }
}

//  Construction / Tech Modifiers 
/**
 * Aggregate all facility + research effects into a single modifier object.
 * Multipliers (dev, mrr, energyDecay, fireDamage, fireInterval, prSeverity)
 * default to 1; additive bonuses (hypeAura, pitch, shipHype, upkeep) to 0.
 * tierUnlocked gates which facility tiers can be built.
 */
export function getModifiers(state) {
  const m = {
    dev: 1, mrr: 1, energyDecay: 1, fireDamage: 1, fireInterval: 1, prSeverity: 1,
    hypeAura: 0, pitch: 0, shipHype: 0, success: 0, upkeep: 0, tierUnlocked: 1,
  };
  // Effects scale with facility level: +X% multipliers grow, reductions deepen,
  // flat bonuses stack. Research always applies at level 1.
  const INCREASE = ['dev', 'mrr', 'fireInterval'];
  const REDUCE   = ['energyDecay', 'fireDamage', 'prSeverity'];
  const ADD      = ['hypeAura', 'pitch', 'shipHype', 'success'];
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

  // Server infrastructure: offline/destroyed racks throttle dev speed & revenue.
  // You begin with zero online racks, so the first server is an intentional buy.
  const down = (state.rackDown || []).filter(d => d).length;
  const working = CONFIG.NUM_RACKS - down;
  const devServerMult = working >= CONFIG.NUM_RACKS ? 1.15 : working === 1 ? 0.75 : 0;
  const revenueServerMult = working >= CONFIG.NUM_RACKS ? 1.18 : working === 1 ? 1 : 0;
  m.dev *= devServerMult;
  m.mrr *= revenueServerMult;
  m.serverWorking = working;
  m.serverMult = revenueServerMult;
  m.devServerMult = devServerMult;
  return m;
}

//  Derived Values 
export function getEmployeeDevPower(state, emp) {
  if (emp.burnedOut) return 0;
  if (emp.atDesk === false) return 0;                 // away from desk (on a break)  not working
  if (emp.energy < CONFIG.WORK_ENERGY_MIN) return 0;  // too tired  needs caffeine to work
  const role = ROLES[emp.role];
  const p    = PERSONALITIES[emp.personality];
  const desk = state.desks.find(d => d.id === emp.deskId);
  const computerMult = (desk && desk.hasComputer) ? 1 : CONFIG.NO_COMPUTER_PENALTY;
  // Caffeinated (high energy) works FASTER: ranges ~0.35 (drained)  ~1.35 (full).
  const energyMult = 0.35 + emp.energy;
  // A happy, low-stress, well-traited employee ships more; a miserable one drags.
  return role.dev * (p.devMult ?? 1) * energyMult * computerMult * getEmployeeProductivity(state, emp);
}

//  People layer: traits, mood, title, productivity
const ROLE_TITLES = { eng: 'Engineer', design: 'Designer', growth: 'Growth Hacker' };
const RANK_PREFIX = ['Junior ', '', 'Senior ', 'Lead ', 'Principal ', 'Head of '];

/** Aggregate an employee's trait modifiers. dev/energyMult multiply; rest sum. */
export function traitEff(emp) {
  const out = { dev: 1, energyMult: 1, stress: 0, teamHappy: 0, hypeAura: 0, xp: 1, leak: 0 };
  for (const id of (emp.traits || [])) {
    const t = TRAIT_BY_ID[id]; if (!t || !t.eff) continue;
    if (t.eff.dev) out.dev *= t.eff.dev;
    if (t.eff.energyMult) out.energyMult *= t.eff.energyMult;
    if (t.eff.xp) out.xp *= t.eff.xp;
    if (t.eff.stress) out.stress += t.eff.stress;
    if (t.eff.teamHappy) out.teamHappy += t.eff.teamHappy;
    if (t.eff.hypeAura) out.hypeAura += t.eff.hypeAura;
    if (t.eff.leak) out.leak = Math.max(out.leak, t.eff.leak);
  }
  return out;
}

/** A 0.6..1.4 multiplier on this employee's output, from mood + traits. */
export function getEmployeeProductivity(state, emp) {
  const happiness = emp.happiness ?? CONFIG.EMP_HAPPY_START;
  const stress    = emp.stress ?? CONFIG.EMP_STRESS_START;
  const mood = happiness - stress * 0.6;               // ~ -? .. 100
  let m = 1 + (mood - 66) * 0.005;                     // mood 66 -> 1.0
  m *= traitEff(emp).dev;
  return clamp(m, 0.6, 1.4);
}

/** Derived mood bucket for the UI. */
export function getEmployeeMood(emp) {
  if (emp.burnedOut) return { id: 'burnt', label: 'Burned out', emoji: '\u{1F635}', tone: 'bad' };
  const lowE = (emp.energy ?? 1) < CONFIG.WORK_ENERGY_MIN;
  const s = (emp.happiness ?? 70) - (emp.stress ?? 20) * 0.6 - (lowE ? 20 : 0);
  if (s >= 78) return { id: 'thriving', label: 'Thriving',  emoji: '\u{1F929}', tone: 'great' };
  if (s >= 60) return { id: 'happy',    label: 'Happy',     emoji: '\u{1F642}', tone: 'good' };
  if (s >= 42) return { id: 'fine',     label: 'Fine',      emoji: '\u{1F610}', tone: 'mid' };
  if (s >= 24) return { id: 'stressed', label: 'Stressed',  emoji: '\u{1F61F}', tone: 'warn' };
  return { id: 'miserable', label: 'Miserable', emoji: '\u{1F62B}', tone: 'bad' };
}

/** Rank index from accumulated experience. */
export function rankFromXp(xp) {
  const t = [0, 45, 120, 250, 460, 760];
  let r = 0; for (let i = 0; i < t.length; i++) if (xp >= t[i]) r = i;
  return r;
}

/** "Senior Engineer", "Head of Growth Hacker", etc. */
export function getEmployeeTitle(emp) {
  const role = ROLE_TITLES[emp.role] || 'Operator';
  const r = clamp(emp.rank ?? 0, 0, RANK_PREFIX.length - 1);
  return (RANK_PREFIX[r] + role).trim();
}

/** Team-wide mood summary for the HUD header. */
export function getTeamMoodSummary(state) {
  const emps = state.employees || [];
  if (!emps.length) return { avgHappy: 0, avgStress: 0, label: 'No team yet', emoji: '\u{1F4C4}', burned: 0, count: 0 };
  let h = 0, s = 0, burned = 0;
  for (const e of emps) { h += e.happiness ?? 70; s += e.stress ?? 20; if (e.burnedOut) burned++; }
  const avgHappy = Math.round(h / emps.length), avgStress = Math.round(s / emps.length);
  const score = avgHappy - avgStress * 0.6 - burned * 8;
  const label = score >= 70 ? 'Buzzing' : score >= 52 ? 'Good vibes' : score >= 36 ? 'Tense' : 'On the edge';
  const emoji = score >= 70 ? '\u{1F525}' : score >= 52 ? '\u{1F642}' : score >= 36 ? '\u{1F605}' : '\u{1F6A8}';
  return { avgHappy, avgStress, label, emoji, burned, count: emps.length };
}

/**
 * The whole company reacts to a decision or event. Small, clamped, readable
 * deltas to happiness/stress/loyalty, plus a transient kick so the change
 * "pops" before it settles back toward the ambient target.
 */
export function teamReact(state, kind, opts = {}) {
  const all = state.employees || [];
  const bump = (e, dH, dS, dL) => {
    if (!e) return;
    e.happiness = clamp((e.happiness ?? 70) + dH, 0, 100);
    e.stress    = clamp((e.stress ?? 20) + dS, 0, 100);
    e.loyalty   = clamp((e.loyalty ?? 55) + dL, 0, 100);
    if (dH > 0) e.moodBoost   = Math.max(e.moodBoost || 0, dH * 0.5);
    if (dS > 0) e.stressSpike = Math.max(e.stressSpike || 0, dS * 0.5);
  };
  switch (kind) {
    case 'launch_hit':     for (const e of all) bump(e, 13, -8, 3); break;
    case 'launch_flop':    for (const e of all) bump(e, -9, 10, -2); break;
    case 'viral':          for (const e of all) bump(e, 14, -6, 2); break;
    case 'funding':        for (const e of all) bump(e, 9, -3, 4); break;
    case 'office_upgrade': for (const e of all) bump(e, 10, -4, 4); break;
    case 'pizza':          for (const e of all) bump(e, 12, -10, 1); break;
    case 'caffeine':       for (const e of all) bump(e, 3, -4, 0); break;
    case 'crunch':         for (const e of all) if (!e.burnedOut) bump(e, -4, 12, 0); break;
    case 'fire':           for (const e of all) bump(e, -3, 12, 0); break;
    case 'pr':             for (const e of all) bump(e, -6, 9, -1); break;
    case 'layoff':         for (const e of all) bump(e, -10, 16, -14); break;
    case 'promote':        bump(opts.who, 14, -6, 18); break;
    case 'raise':          bump(opts.who, 8, -2, 12); break;
    case 'poach_kept':     bump(opts.who, 8, 0, 15); break;
    default: break;
  }
}

const GOSSIP_BONDS = {
  friend: [
    "{A} and {B} have started finishing each other's standups. it's sweet. it's also slowing standup.",
    "{A} defended {B} in a code review so hard that legal got cc'd.",
    "{A} and {B} are doing a two-person book club. the book is the company wiki.",
  ],
  rival: [
    "{A} and {B} are in a passive-aggressive PR-comment war again. the PR was a typo fix.",
    "{A} scheduled a meeting titled 'alignment' that is just to annoy {B}.",
    "{A} and {B} both claim they invented the feature. neither remembers what it does.",
  ],
  mentor: [
    "{A} is mentoring {B}. productivity up, billable lunches up more.",
    "{B} now copies {A}'s exact Slack punctuation. it has gone too far.",
  ],
  crush: [
    "pretty sure {A} has a crush on {B}. the whole office knows. {B} does not.",
    "{A} has reorganized their calendar entirely around {B}'s coffee runs.",
  ],
};
const GOSSIP_SOLO = {
  bad:  ['{A} updated their LinkedIn headline to "Open to opportunities 👀".', '{A} took a "quick walk" ninety minutes ago.', '{A} has started replying to messages with a single period.'],
  warn: ['{A} sighed so loudly in standup that two other people apologized.', '{A} is rage-refactoring something that worked perfectly fine.'],
  mid:  ['{A} is quietly building something in a branch named "do-not-merge".', '{A} brought a plant to their desk. a statement of permanence, or hope.'],
  good: ['{A} brought in donuts unprompted. morale +5, blood sugar +40.', '{A} fixed the office speaker and is now insufferable about it.'],
  great:['{A} is so happy they volunteered to fix the printer. nobody asked. nobody dared stop them.'],
};
function makeGossip(state) {
  const emps = state.employees || [];
  if (!emps.length) return null;
  const withBond = emps.filter(x => (x.bonds || []).length);
  if (withBond.length && Math.random() < 0.55) {
    const a = pick(withBond);
    const b = pick(a.bonds);
    const other = emps.find(x => x.id === b.withId);
    if (other) {
      const bank = GOSSIP_BONDS[b.type] || GOSSIP_BONDS.friend;
      return { text: pick(bank).replace(/\{A\}/g, a.name).replace(/\{B\}/g, other.name), who: a.name, type: b.type };
    }
  }
  const e = pick(emps);
  const tone = getEmployeeMood(e).tone;
  const bank = GOSSIP_SOLO[tone] || GOSSIP_SOLO.mid;
  return { text: pick(bank).replace(/\{A\}/g, e.name), who: e.name, type: 'mood' };
}

/**
 * Per-tick people simulation: drift mood/stress/loyalty toward ambient targets
 * shaped by office, facilities, traits, bonds and workload; grow experience;
 * surface quits and office gossip. Called from updateGame.
 */
function updateTeamMood(state, dt, mods, events) {
  const emps = state.employees;
  if (!emps || !emps.length) return;

  const officeBonus  = (state.officeTier || 0) * 4;
  const facilityCalm = mods.energyDecay < 1 ? 8 : 0;          // espresso / break room
  const facilityHappy = facilityCalm * 0.6 + (mods.hypeAura > 0 ? 2 : 0);
  const liveStress   = state.live ? 6 : 0;
  const fireStress   = (state.fires ? state.fires.length : 0) * 14;
  const prStress     = (state.prDisasters ? state.prDisasters.length : 0) * 8;
  const runway       = getRunwaySeconds(state);
  const runwayStress = (isFinite(runway) && runway < 40) ? 16 : 0;
  const crunchStress = getActiveProducts(state).some(ap => ap.devMode === 'fast') ? 8 : 0;

  let auraHappy = 0;
  for (const o of emps) if (!o.burnedOut) auraHappy += traitEff(o).teamHappy;

  const quitters = [];
  for (const e of emps) {
    if (e.burnedOut) {
      e.stress    = clamp((e.stress ?? 20) + 20 * dt, 0, 100);
      e.happiness = clamp((e.happiness ?? 70) - 8 * dt, 0, 100);
      continue;
    }
    const te = traitEff(e);
    let bondHappy = 0;
    for (const b of (e.bonds || [])) {
      const other = emps.find(x => x.id === b.withId);
      if (!other) continue;
      bondHappy += bondMeta(b.type).good ? (other.burnedOut ? 0 : 4) : -4;
    }
    const lowE = e.energy < CONFIG.WORK_ENERGY_MIN;
    const happyTarget  = 58 + officeBonus + facilityHappy + (auraHappy - te.teamHappy) + bondHappy
                       + te.teamHappy + (lowE ? -16 : 0) - ((e.stress ?? 20) - 20) * 0.18;
    const stressTarget = clamp(14 + liveStress + fireStress + prStress + runwayStress + crunchStress
                       + te.stress - facilityCalm, 0, 100);

    e.happiness = clamp(e.happiness + (happyTarget - e.happiness) * Math.min(1, dt * CONFIG.EMP_HAPPY_DRIFT) + (e.moodBoost || 0) * dt, 0, 100);
    e.stress    = clamp(e.stress + (stressTarget - e.stress) * Math.min(1, dt * CONFIG.EMP_STRESS_DRIFT) + (e.stressSpike || 0) * dt, 0, 100);
    e.moodBoost   = (e.moodBoost || 0) * Math.max(0, 1 - dt * 0.5);
    e.stressSpike = (e.stressSpike || 0) * Math.max(0, 1 - dt * 0.5);

    e.tenure = (e.tenure || 0) + dt;
    const loyalTarget = clamp(34 + ((e.happiness ?? 70) - 50) * 0.5 + Math.min(20, e.tenure * 0.05), 0, 100);
    e.loyalty = clamp((e.loyalty ?? 55) + (loyalTarget - e.loyalty) * Math.min(1, dt * CONFIG.EMP_LOYALTY_DRIFT), 0, 100);

    if (getEmployeeDevPower(state, e) > 0) {
      e.experience = (e.experience || 0) + CONFIG.EMP_XP_PER_SEC * te.xp * dt;
      const nr = rankFromXp(e.experience);
      if (nr > (e.rank ?? 0)) { e.rank = nr; events.push({ type: 'emp_levelup', employee: e, title: getEmployeeTitle(e) }); }
    }

    if (state.live && emps.length > 1 && e.happiness < CONFIG.EMP_QUIT_HAPPY && e.loyalty < CONFIG.EMP_QUIT_LOYALTY) {
      e.quitWatch = (e.quitWatch || 0) + dt;
      if (e.quitWatch > CONFIG.EMP_QUIT_WATCH && Math.random() < dt * 0.06) quitters.push(e);
    } else {
      e.quitWatch = Math.max(0, (e.quitWatch || 0) - dt * 0.5);
    }
  }

  if (quitters.length) {
    const q = quitters[0];
    removeEmployee(state, q);
    events.push({ type: 'employee_quit', employee: q });
    teamReact(state, 'layoff');
  }

  state._nextGossipTime = (state._nextGossipTime ?? randRange(CONFIG.GOSSIP_INTERVAL)) - dt;
  if (state._nextGossipTime <= 0) {
    state._nextGossipTime = randRange(CONFIG.GOSSIP_INTERVAL);
    const g = makeGossip(state);
    if (g) events.push({ type: 'team_gossip', gossip: g });
  }
}

export function getFounderDesk(state) {
  return state.desks.find(d => d.employeeId === -1) || null;
}

export function getActiveProducts(state) {
  if (Array.isArray(state.activeProducts)) return state.activeProducts;
  return state.activeProduct ? [state.activeProduct] : [];
}

export function getDevelopmentLaneCount(state) {
  const staffedDesks = state.employees.filter(e => !e.burnedOut && e.atDesk !== false).length;
  return Math.min(4, 1 + Math.floor(staffedDesks / 2));
}

function getRawTeamDevPower(state) {
  // No work gets done while a server is on fire  put it out first.
  if (state.fires && state.fires.length > 0) return 0;
  // No server, no build. The garage needs at least one humming rack.
  if ((getModifiers(state).serverWorking || 0) <= 0) return 0;
  // The founder only works while seated at their desk; employees per their own rules.
  const founderDesk = getFounderDesk(state);
  const founderDev = state.founderAtDesk && founderDesk && founderDesk.hasComputer ? CONFIG.FOUNDER_DEV : 0;
  const base = founderDev + state.employees.reduce((s, e) => s + getEmployeeDevPower(state, e), 0);
  const moraleMult = clamp(0.72 + ((state.morale ?? CONFIG.MORALE_START) / 190), 0.65, 1.22);
  return base * getModifiers(state).dev * moraleMult;
}

export function getTeamDevPower(state) {
  const active = getActiveProducts(state);
  const mode = active[0] ? (DEV_MODES[active[0].devMode || 'balanced'] || DEV_MODES.balanced) : DEV_MODES.balanced;
  return getRawTeamDevPower(state) * mode.speed;
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
  // Stealth garage is cheap; going live turns on the real cost of doing business.
  // Once live, fixed costs creep upward - every minute of "scale" invents a new invoice.
  const ramp = state.live
    ? Math.min(CONFIG.BURN_RAMP_CAP, 1 + (state.liveSeconds || 0) / 60 * CONFIG.BURN_RAMP_PER_MIN)
    : 1;
  const base = (state.live ? CONFIG.BASE_BURN_PER_SEC : CONFIG.PRE_LAUNCH_BURN) * ramp;
  const productBurn = state.shippedProducts.reduce((s, p) => s + productOpsBurn(p), 0);
  return base + getSalaryBurn(state) + getModifiers(state).upkeep + (state.loanBurn || 0) + productBurn;
}

/** Normalize text to space-delimited lowercase tokens (splits camelCase). */
function normalizeText(s) {
  return ' ' + String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ') + ' ';
}

/** Classify a product into a market category by keyword (cached on the idea). */
export function productCategory(idea) {
  if (!idea) return 'other';
  if (idea._cat) return idea._cat;
  const hay = normalizeText(`${idea.name || ''} ${idea.desc || ''}`);
  let found = 'other';
  for (const c of MARKET_CATEGORIES) {
    if (c.keys.some(k => hay.includes(` ${k} `))) { found = c.id; break; }
  }
  idea._cat = found;
  return found;
}

export function getProductFreshness(p) {
  return p && p.freshness != null ? p.freshness : 1;
}

export function getAvgFreshness(state) {
  if (!state.shippedProducts.length) return 1;
  return state.shippedProducts.reduce((s, p) => s + getProductFreshness(p), 0) / state.shippedProducts.length;
}

export function getProductHealth(p) {
  const debt = p?.techDebt ?? 0;
  const bugs = p?.bugs ?? 0;
  const quality = p?.quality ?? 70;
  const outage = p?.outageTimer ?? 0;
  return clamp(100 - debt * 0.65 - bugs * 2.2 + (quality - 70) * 0.25 - (outage > 0 ? 35 : 0), 0, 100);
}

function productOpsBurn(p) {
  return (p?.featureBurn || 0) + ((p?.outageTimer || 0) > 0 ? 18 : 0);
}

/**
 * MRR a single shipped product earns *before* the global hype/facility multipliers.
 * Folds together the three live-game systems: product aging (freshness), the
 * current market trend (a bonus for the hot category), and a rival clone (a
 * penalty on the one product being knocked off).
 */
export function productEffectiveMRR(state, p) {
  if ((p.outageTimer || 0) > 0) return 0;
  let m = p.idea.mrr * getProductFreshness(p);
  m *= p.price ?? 1;
  m *= p.userBase ?? 1;
  m *= 1 + ((p.featureMrrBonus || 0) / Math.max(1, p.idea.mrr));
  m *= clamp(1 - (p.techDebt || 0) * CONFIG.TECH_DEBT_MRR_PENALTY, 0.45, 1.08);
  m *= clamp(1 - (p.bugs || 0) * CONFIG.BUG_MRR_PENALTY, 0.45, 1.03);
  m *= clamp(1 + ((p.quality || 70) - 70) / 150, 0.6, 1.35);   // quality genuinely drives sales
  const trend = state.marketTrend;
  if (trend && productCategory(p.idea) === trend.id) m *= 1 + trend.mrrBonus;
  if (state.competitorClone && state.competitorClone.product === p) m *= state.competitorClone.mrrMult;
  return m;
}

export function getMRR(state) {
  const base = state.shippedProducts.reduce((s, p) => s + productEffectiveMRR(state, p), 0);
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

//  Product Investment & Launch Odds 
/**
 * Up-front cash to begin a project. Scales with build effort (devPoints) and
 * the revenue you're aiming for (mrr)  i.e. with the project's ambition.
 */
export function computeInvestment(idea) {
  return Math.round(
    CONFIG.INVEST_BASE
    + (idea.devPoints || 0) * CONFIG.INVEST_PER_DEVPOINT
    + (idea.mrr || 0) * CONFIG.INVEST_PER_MRR
  );
}

/**
 * Probability a launch succeeds (glowing reviews, full MRR) rather than flops.
 * Higher ambition (more investment) raises the odds; so do engineers on staff
 * and certain research/facilities. Rolled at launch time, not at start, so
 * hiring up before you ship genuinely helps.
 */
export function computeSuccessChance(state, ambition = 1) {
  let c = CONFIG.SUCCESS_BASE + (ambition - 1) * CONFIG.SUCCESS_AMBITION_SLOPE;
  const engs = state.employees.filter(e => !e.burnedOut && e.role === 'eng').length;
  c += Math.min(CONFIG.SUCCESS_ENG_CAP, engs * CONFIG.SUCCESS_PER_ENG);
  c += getModifiers(state).success || 0;
  return clamp(c, CONFIG.SUCCESS_MIN, CONFIG.SUCCESS_MAX);
}

//  Candidate / Product Generation 
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
    candidates.push({ name, role, personality, salary, traits: rollTraits() });
  }
  return candidates;
}

export function generateProductChoices(state, count = 3) {
  const used = new Set(state.shippedProducts.map(p => p.idea.name));
  for (const p of state.readyProducts || []) used.add(p.idea.name);
  for (const ap of getActiveProducts(state)) used.add(ap.idea.name);

  const choices = [];
  let guard = 0;
  const target = Math.max(count, count + 5);
  while (choices.length < target && guard++ < 80) {
    let idea;
    // ~25% of the time offer a hand-tuned classic; otherwise generate fresh.
    if (Math.random() < 0.2) {
      const pool = PRODUCT_IDEAS.filter(p => !used.has(p.name));
      idea = pool.length ? pick(pool) : generateProceduralProduct(state);
    } else {
      idea = generateProceduralProduct(state);
    }
    idea = tuneProductEconomics(idea, state);
    if (used.has(idea.name)) continue;
    used.add(idea.name);
    choices.push(idea);
  }
  const cash = Math.max(1, state.cash || 1);
  return choices
    .sort((a, b) => {
      const score = (idea) => {
        const invest = computeInvestment(idea);
        const affordable = invest <= cash ? 120 : -80;
        const roi = (idea.mrr || 1) / Math.max(1, invest);
        const quick = 90 / Math.max(30, idea.devPoints || 90);
        const hype = (idea.hype || 0) / 30;
        return affordable + roi * 900 + quick * 30 + hype * 12;
      };
      return score(b) - score(a);
    })
    .slice(0, count);
}

//  Pitch Mechanics 
export function getPitchBuzzwords(count = 12) {
  const shuffled = [...BUZZWORDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function calcPitchQuality(state, selectedBuzzwords) {
  selectedBuzzwords = Array.isArray(selectedBuzzwords) ? selectedBuzzwords : (selectedBuzzwords?.words || []);
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
  const words = Array.isArray(selectedBuzzwords) ? selectedBuzzwords : (selectedBuzzwords?.words || []);
  const claims = Array.isArray(selectedBuzzwords) ? [] : (selectedBuzzwords?.claims || []);
  const round = FUNDING_ROUNDS[state.roundIndex] || null;
  const lieRisk = claims.reduce((s, c) => s + (c.risk || 0), 0);
  const claimBoost = claims.reduce((s, c) => s + (c.boost || 0), 0);
  const caught = lieRisk > 0 && Math.random && false; // preview never rolls; delivery rolls in actionDeliverPitch
  const quality = calcPitchQuality(state, words) + claimBoost;
  if (!round) return { round: null, quality, meets: false, willClose: false, projected: 0 };

  const meets = state.shippedProducts.length >= round.reqProducts
             && state.hype >= round.reqHype;
  const willClose = meets && quality >= 1.05;
  const projected = willClose
    ? Math.round(round.amount * Math.min(1.5, 0.7 + quality * 0.3))
    : Math.round(round.amount * 0.06 * quality);

  return { round, quality, meets, willClose, projected, lieRisk, caught };
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

//  Quirk Events 
function applyQuirk(state, emp, events) {
  const p = PERSONALITIES[emp.personality];
  switch (p.quirk) {
    case 'crunch': {
      if (!state.activeProduct) return;
      state.activeProduct.progress += 15;
      emp.energy = Math.max(0.05, emp.energy - 0.25);
      events.push({ type: 'quirk', employee: emp, tone: 'warning',
        text: ` ${emp.name} entered hyperfocus. +15 dev progress, energy tanked.` });
      break;
    }
    case 'meditate': {
      for (const e of state.employees) e.energy = Math.min(1, e.energy + 0.1);
      events.push({ type: 'quirk', employee: emp, tone: 'success',
        text: ` ${emp.name} led a breathing exercise. Team +10% energy.` });
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
        text: ` ${emp.name} launched an unauthorized token. PR is melting.` });
      break;
    }
    case 'steal': {
      const others = state.employees.filter(e => e !== emp && !e.burnedOut);
      if (!others.length) return;
      const victim = pick(others);
      victim.energy = Math.max(0.05, victim.energy - 0.2);
      emp.energy    = Math.min(1, emp.energy + 0.2);
      events.push({ type: 'quirk', employee: emp, tone: 'warning',
        text: ` ${emp.name} stole ${victim.name}'s espresso. ${victim.name} is fading.` });
      break;
    }
    case 'viral': {
      state.hype = clamp(state.hype + 8, 0, CONFIG.HYPE_MAX);
      events.push({ type: 'quirk', employee: emp, tone: 'success',
        text: ` ${emp.name}'s post went viral. +8 Hype.` });
      break;
    }
    case 'drain_team': {
      for (const e of state.employees) {
        if (e !== emp && !e.burnedOut) e.energy = Math.max(0.05, e.energy - 0.12);
      }
      events.push({ type: 'quirk', employee: emp, tone: 'warning',
        text: ` ${emp.name} started a reply-all war. Team energy drained.` });
      break;
    }
    case 'silent_ship': {
      if (!state.activeProduct) return;
      state.activeProduct.progress += 10;
      events.push({ type: 'quirk', employee: emp, tone: 'success',
        text: ` ${emp.name} silently pushed 40 commits overnight. +10 dev progress.` });
      break;
    }
  }
}

//  Game Update Logic 
export function updateGame(state, dt) {
  if (state.paused || state.gameOver || state.won) return [];

  const events = [];
  state.time += dt;
  const mods = getModifiers(state);

  //  Cooldowns 
  for (const key of Object.keys(state.cooldowns)) {
    if (state.cooldowns[key] > 0) {
      state.cooldowns[key] = Math.max(0, state.cooldowns[key] - dt);
    }
  }

  //  Employee Energy / Burnout 
  let burnoutCount = 0;
  for (const emp of state.employees) {
    const p = PERSONALITIES[emp.personality];
    if (!emp.burnedOut) {
      emp.energy = Math.max(0, emp.energy - CONFIG.ENERGY_DECAY_PER_SEC * (p.energyMult ?? 1) * mods.energyDecay * dt);
      if (emp.energy <= 0) {
        emp.burnedOut = true;
        state.morale = clamp((state.morale ?? CONFIG.MORALE_START) - CONFIG.MORALE_BURNOUT_HIT, 0, 100);
        events.push({ type: 'burnout', employee: emp });
      }
    }
    if (emp.burnedOut) burnoutCount++;
  }

  //  People: mood, stress, loyalty, growth, quits and office gossip
  updateTeamMood(state, dt, mods, events);

  //  Hype
  // In stealth (pre-launch) hype is dormant  it doesn't bleed away while
  // nobody knows you exist. Going live turns on decay, drains, and the grind
  // of keeping the world's attention. Passive auras still apply either way.
  let hypeDelta = getHypeAura(state);
  if (state.live) {
    hypeDelta -= CONFIG.HYPE_DECAY_PER_SEC;
    hypeDelta -= burnoutCount * CONFIG.BURNOUT_HYPE_DRAIN;
    for (const pr of state.prDisasters) hypeDelta -= CONFIG.PR_HYPE_DRAIN_PER_SEC * pr.severity;
  }
  state.hype = clamp(state.hype + hypeDelta * dt, 0, CONFIG.HYPE_MAX);

  //  Morale  recovers slowly when the company is not actively crunching.
  const activeProducts = getActiveProducts(state);
  const activeMoraleDrain = activeProducts.reduce((sum, ap) => {
    const mode = DEV_MODES[ap.devMode || 'balanced'] || DEV_MODES.balanced;
    return sum + Math.min(0, mode.moralePerSec || 0);
  }, 0);
  const moraleDelta = (activeProducts.length ? activeMoraleDrain : CONFIG.MORALE_RECOVER_PER_SEC) - burnoutCount * 0.035;
  state.morale = clamp((state.morale ?? CONFIG.MORALE_START) + moraleDelta * dt, 0, 100);

  //  Product Development  "ready to launch" (does NOT auto-launch) 
  if (activeProducts.length) {
    const rawPower = getRawTeamDevPower(state);
    const lanePower = rawPower / Math.max(1, activeProducts.length);
    for (let i = activeProducts.length - 1; i >= 0; i--) {
      const ap = activeProducts[i];
    const mode = DEV_MODES[ap.devMode || 'balanced'] || DEV_MODES.balanced;
      ap.progress += lanePower * mode.speed * dt;
    ap.quality = clamp((ap.quality ?? 68) + mode.qualityPerSec * dt * 10, 25, 100);
    ap.bugs = clamp((ap.bugs ?? 0) + mode.bugPerSec * dt * 10, 0, 60);
      if (ap.progress >= ap.idea.devPoints) {
      const product = { idea: ap.idea, quality: Math.round(ap.quality), bugs: Math.round(ap.bugs) };
      state.readyProducts.push(product);
        activeProducts.splice(i, 1);
      events.push({ type: 'product_ready', product });
      }
    }
  }

  //  Cash Flow 
  const net = getNetCashFlow(state);
  state.cash += net * dt;

  //  Auto-repay debt from surplus (half of positive cash flow) 
  if (state.debt > 0 && net > 0 && state.cash > 0) {
    const repay = Math.min(state.debt, state.cash, net * 0.5 * dt);
    if (repay > 0) {
      state.loanBurn *= (state.debt - repay) / state.debt; // interest scales down with principal
      state.debt -= repay;
      state.cash -= repay;
      if (state.debt < 1) { state.debt = 0; state.loanBurn = 0; }
    }
  }

  //  Active Fire Timers 
  for (let i = state.fires.length - 1; i >= 0; i--) {
    const fire = state.fires[i];
    fire.timer -= dt;
    if (fire.timer <= 0) {
      // The fire burns out  that server rack is destroyed (you must buy a new one)
      const idx = fire.rackIdx ?? ((fire.fireObject && fire.fireObject.position3d.x < 0) ? 0 : 1);
      let destroyed = false;
      if (state.rackDown && !state.rackDown[idx]) { state.rackDown[idx] = true; destroyed = true; }
      events.push({ type: 'fire_damage', fire, rackIdx: idx, destroyed });
      state.fires.splice(i, 1);
      if (fire.fireObject) fire.fireObject.extinguish(window._gameScene);
    }
  }

  //  Active PR Timers 
  for (let i = state.prDisasters.length - 1; i >= 0; i--) {
    const pr = state.prDisasters[i];
    pr.timer -= dt;
    if (pr.timer <= 0) {
      events.push({ type: 'pr_resolved', pr });
      state.prDisasters.splice(i, 1);
    }
  }

  //  Random Events (only once you're LIVE) 
  // The stealth garage is calm by design: no server fires, no PR disasters,
  // no shady peddlers, no team drama. All of it switches on at first launch.
  if (state.live) {
    //  Product Aging: shipped products go stale over time (ship updates to refresh) 
    for (const p of state.shippedProducts) {
      if (p.freshness == null) p.freshness = 1;
      p.freshness = Math.max(CONFIG.FRESH_FLOOR, p.freshness - CONFIG.AGING_PER_SEC * dt);
      p.techDebt = clamp((p.techDebt ?? 0) + CONFIG.TECH_DEBT_PER_SEC * (1 + (p.bugs || 0) / 30) * dt, 0, 100);
      if (p.outageTimer > 0) {
        p.outageTimer = Math.max(0, p.outageTimer - dt);
        if (p.outageTimer <= 0) events.push({ type: 'product_recovered', product: p });
      }

      // Pricing is a live tradeoff: higher prices raise ARPU but slowly bleed users.
      const price = p.price ?? 1;
      const targetDemand = clamp(1.28 - (price - 0.7) * 0.72 + Math.max(0, (p.quality || 70) - 70) / 220, 0.42, 1.35);
      p.userBase = (p.userBase ?? 1) + (targetDemand - (p.userBase ?? 1)) * Math.min(1, dt * 0.045);

      // High debt/bugs can knock a product offline.
      if (!p.outageTimer) {
        const risk = Math.pow((p.techDebt || 0) / 100, 1.65) * (1 + (p.bugs || 0) / 18) * CONFIG.CRASH_CHECK_PER_SEC * dt;
        if (Math.random() < risk) {
          p.outageTimer = randRange([8, 18]);
          p.techDebt = clamp((p.techDebt || 0) + 8, 0, 100);
          p.bugs = clamp((p.bugs || 0) + 3, 0, 60);
          state.hype = clamp(state.hype - 8, 0, CONFIG.HYPE_MAX);
          events.push({ type: 'product_crash', product: p });
        }
      }
    }

    //  Feature Roadmap: shipped products can keep the team busy post-launch.
    const roadmapProducts = state.shippedProducts.filter(p => p.featureQueue && p.featureQueue.length);
    if (roadmapProducts.length && (getModifiers(state).serverWorking || 0) > 0 && !state.fires.length) {
      const share = (getTeamDevPower(state) * CONFIG.FEATURE_DEV_MULT * dt) / roadmapProducts.length;
      for (const p of roadmapProducts) {
        const f = p.featureQueue[0];
        f.progress = (f.progress || 0) + share;
        if (f.progress >= f.dev) {
          p.featureQueue.shift();
          p.featureMrrBonus = (p.featureMrrBonus || 0) + f.mrrBoost;
          p.featureBurn = (p.featureBurn || 0) + f.burn;
          p.quality = clamp((p.quality || 70) + (f.id === 'stability' ? 8 : 2), 0, 100);
          if (f.id === 'stability') p.techDebt = Math.max(0, (p.techDebt || 0) - 18);
          if (Math.random() < f.bugRisk) p.bugs = clamp((p.bugs || 0) + randRange([3, 9]), 0, 60);
          state.hype = clamp(state.hype + f.hype, 0, CONFIG.HYPE_MAX);
          events.push({ type: 'product_feature_ready', product: p, feature: f });
        }
      }
    }

    //  Market Trend: a new hot category rotates in every ~minute 
    state._nextTrendTime -= dt;
    if (state._nextTrendTime <= 0) {
      state._nextTrendTime = randRange(CONFIG.TREND_INTERVAL);
      state.marketTrend = pickTrend(state);
      events.push({ type: 'market_trend', trend: state.marketTrend });
    }

    //  Competitor Clone: a rival knocks off your best product, bleeding its MRR 
    if (state.competitorClone) {
      state.competitorClone.timer -= dt;
      if (state.competitorClone.timer <= 0) {
        const faded = state.competitorClone;
        state.competitorClone = null;
        events.push({ type: 'clone_faded', clone: faded });
      }
    } else {
      state._nextCloneTime -= dt;
      if (state._nextCloneTime <= 0) {
        state._nextCloneTime = randRange(CONFIG.CLONE_INTERVAL);
        if (state.shippedProducts.length >= 2 && !state.paused && state._majorGap <= 0) {
          const clone = buildCompetitorClone(state);
          if (clone) {
            state.competitorClone = clone;
            events.push({ type: 'competitor_clone', clone });
            state._majorGap = randRange(CONFIG.MAJOR_EVENT_GAP);
          }
        }
      }
    }

    // Pace decision-modal events so they never stack on top of each other.
    state._majorGap = (state._majorGap ?? 0) - dt;

    //  Event Spawning: Fires 
    state._nextFireTime -= dt;
    if (state._nextFireTime <= 0) {
      events.push({ type: 'spawn_fire' });
      state._nextFireTime = randRange(CONFIG.FIRE_SPAWN_INTERVAL) * mods.fireInterval;
    }

    //  Event Spawning: PR Disasters 
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

    //  Peddler Offers 
    state._nextPeddlerTime -= dt;
    if (state._nextPeddlerTime <= 0) {
      state._nextPeddlerTime = randRange(CONFIG.PEDDLER_INTERVAL);
      if (!state.paused && state._majorGap <= 0) { events.push({ type: 'peddler', deal: pick(PEDDLER_DEALS) }); state._majorGap = randRange(CONFIG.MAJOR_EVENT_GAP); }
    }

    state._nextBoardTime -= dt;
    if (state._nextBoardTime <= 0) {
      state._nextBoardTime = randRange(CONFIG.BOARD_INTERVAL);
      const pool = availableBoardDilemmas(state);
      if (!state.paused && pool.length && state._majorGap <= 0) { events.push({ type: 'board_dilemma', dilemma: pick(pool) }); state._majorGap = randRange(CONFIG.MAJOR_EVENT_GAP); }
    }

    state._nextAcqTime -= dt;
    if (!state._acquisitionOffered && state._nextAcqTime <= 0) {
      if (state.shippedProducts.length >= 3 && getValuation(state) >= 180000 && state._majorGap <= 0) {
        state._acquisitionOffered = true;
        events.push({ type: 'acquisition_offer', offer: buildAcquisitionOffer(state) });
        state._majorGap = randRange(CONFIG.MAJOR_EVENT_GAP);
      } else {
        state._nextAcqTime = randRange(CONFIG.ACQUISITION_CHECK);
      }
    }

    //  Personality Quirks
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

    //  Talent Poaching: a rival tries to steal your best person
    state._nextPoachTime -= dt;
    if (state._nextPoachTime <= 0) {
      state._nextPoachTime = randRange(CONFIG.POACH_INTERVAL);
      if (!state.paused && state._majorGap <= 0 && state.employees.filter(e => !e.burnedOut).length >= 1) {
        const offer = buildPoachOffer(state);
        if (offer) { events.push({ type: 'talent_poach', offer }); state._majorGap = randRange(CONFIG.MAJOR_EVENT_GAP); }
      }
    }

    //  Viral Meme Moment: a shipped product randomly becomes a meme
    state._nextMemeTime -= dt;
    if (state._nextMemeTime <= 0) {
      state._nextMemeTime = randRange(CONFIG.MEME_INTERVAL);
      if (!state.paused && state._majorGap <= 0 && state.shippedProducts.length) {
        const moment = buildMemeMoment(state);
        if (moment) { events.push({ type: 'meme_moment', moment }); state._majorGap = randRange(CONFIG.MAJOR_EVENT_GAP); }
      }
    }

    //  Regulator: once you matter, the government notices
    state._nextRegulatorTime -= dt;
    if (state._nextRegulatorTime <= 0) {
      state._nextRegulatorTime = randRange(CONFIG.REGULATOR_INTERVAL);
      if (!state.paused && state._majorGap <= 0 && state.shippedProducts.length >= 2 && getValuation(state) >= 120000) {
        events.push({ type: 'regulator', probe: buildRegulatorProbe(state) });
        state._majorGap = randRange(CONFIG.MAJOR_EVENT_GAP);
      }
    }
  }

  //  Out-of-money lifeline: when you are nearly broke and bleeding, the world
  //  offers a way out  a bank if you have traction, a shady peddler if you do not.
  state._lifelineCd = (state._lifelineCd ?? randRange(CONFIG.LIFELINE_COOLDOWN)) - dt;
  {
    const net = getNetCashFlow(state);
    const runway = getRunwaySeconds(state);
    const desperate = state.cash < CONFIG.LIFELINE_CASH && net < 0 &&
      (state.cash < 0 || (isFinite(runway) && runway < CONFIG.LIFELINE_RUNWAY));
    if (desperate && state._lifelineCd <= 0 && !state.paused && !state.gameOver) {
      state._lifelineCd = randRange(CONFIG.LIFELINE_COOLDOWN);
      const hasTraction = state.shippedProducts.length >= 1 && getValuation(state) > 60000;
      if (hasTraction) {
        const loan = LOANS[Math.min(LOANS.length - 1, state.shippedProducts.length >= 3 ? 1 : 0)];
        events.push({ type: 'lifeline', kind: 'bank', loan });
      } else {
        events.push({ type: 'lifeline', kind: 'peddler', deal: pick(PEDDLER_DEALS) });
      }
    }
  }

  //  Stats / Lose Condition
  state.stats.peakHype = Math.max(state.stats.peakHype, state.hype);
  state.peakValuation = Math.max(state.peakValuation, getValuation(state));
  if (state.live) state.liveSeconds = (state.liveSeconds || 0) + dt;
  // Feed-reaction hype budget trickles back (~1 reaction per 12s).
  state._feedReactBudget = Math.min(3, (state._feedReactBudget ?? 3) + dt * 0.08);

  //  Repo clock: running cash-negative starts a countdown. The deeper in the
  //  red, the faster the repo men work. Climb back above $0 and they leave
  //  (disappointed). Hit the hard DEBT_LIMIT and it's over immediately.
  if (state.cash < 0 && !state.gameOver && !state.won) {
    const depth = Math.min(1, -state.cash / -CONFIG.DEBT_LIMIT);
    const drain = 1 + depth * CONFIG.REPO_ACCEL;
    state.repoTimer = (state.repoTimer ?? CONFIG.REPO_GRACE) - dt * drain;
    state._repoWarnT = (state._repoWarnT ?? 0) - dt;
    if (state._repoWarnT <= 0 && state.repoTimer > 0) {
      state._repoWarnT = 8;
      events.push({ type: 'repo_warning', secondsLeft: Math.max(0, state.repoTimer) });
    }
    if (state.repoTimer <= 0) {
      state.gameOver = true;
      state.gameOverCause = 'repo';
      events.push({ type: 'game_over' });
    }
  } else if (state.repoTimer != null && state.cash >= 0) {
    state.repoTimer = null;
    state._repoWarnT = 0;
    if (!state.gameOver && !state.won) events.push({ type: 'repo_saved' });
  }

  if (state.cash <= CONFIG.DEBT_LIMIT && !state.gameOver) {
    state.gameOver = true;
    state.gameOverCause = 'debt';
    events.push({ type: 'game_over' });
  }

  // Product-era progression: ship + raise to unlock bigger frontiers.
  if (state._eraSurfaced == null) {
    state._eraSurfaced = getUnlockedEra(state);
  } else {
    const _curEra = getUnlockedEra(state);
    if (_curEra > state._eraSurfaced) {
      for (let _e = state._eraSurfaced + 1; _e <= _curEra; _e++) events.push({ type: 'era_unlock', era: PRODUCT_ERAS[_e] });
      state._eraSurfaced = _curEra;
    }
  }

  return events;
}

//  Player Actions 

/**
 * Buy a new desk (next free slot).
 */
export function actionBuildDesk(state, position = null) {
  if (state.desks.length >= state.deskSlots) {
    return { success: false, reason: 'Office is full  expand the office for more desk slots.' };
  }
  if (state.cash < CONFIG.DESK_COST) {
    return { success: false, reason: `Need ${fmtMoney(CONFIG.DESK_COST)} for a desk.` };
  }
  state.cash -= CONFIG.DESK_COST;
  const isFounderDesk = !getFounderDesk(state);
  const desk = {
    id: state.nextEntityId(),
    slot: state.desks.length,
    hasComputer: false,
    employeeId: isFounderDesk ? -1 : null,
  };
  if (position) {
    desk.x = position.x;
    desk.z = position.z;
  }
  state.desks.push(desk);
  return { success: true, desk, cost: CONFIG.DESK_COST };
}

/**
 * Buy a computer for a specific desk. When no target is supplied, falls back
 * to the old occupied-desk preference for compatibility.
 */
export function actionBuyComputer(state, deskId = null) {
  if (!state.desks.length) {
    return { success: false, reason: 'Buy and place a desk first.' };
  }
  const openDesks = state.desks.filter(d => !d.hasComputer);
  if (!openDesks.length) {
    return { success: false, reason: 'Every desk already has a computer.' };
  }
  const desk = deskId == null
    ? [...openDesks].sort((a, b) => (b.employeeId !== null) - (a.employeeId !== null))[0]
    : state.desks.find(d => d.id === deskId);
  if (!desk) {
    return { success: false, reason: 'Click a placed desk to install the computer.' };
  }
  if (desk.hasComputer) {
    return { success: false, reason: 'That desk already has a computer. Pick another desk.' };
  }
  if (state.cash < CONFIG.COMPUTER_COST) {
    return { success: false, reason: `Need ${fmtMoney(CONFIG.COMPUTER_COST)} for a computer.` };
  }
  state.cash -= CONFIG.COMPUTER_COST;
  desk.hasComputer = true;
  return { success: true, desk, cost: CONFIG.COMPUTER_COST };
}

/**
 * Hire a candidate  needs a free desk and the signing bonus.
 */
export function actionHireCandidate(state, candidate) {
  const desk = state.desks.find(d => d.employeeId === null);
  if (!desk) {
    return { success: false, reason: 'No free employee desk. Buy and place another desk first.' };
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
    // people layer
    traits: (candidate.traits && candidate.traits.length) ? candidate.traits.slice() : rollTraits(),
    happiness: CONFIG.EMP_HAPPY_START + ri(-6, 8),
    stress:    CONFIG.EMP_STRESS_START + ri(-6, 8),
    loyalty:   CONFIG.EMP_LOYALTY_START + ri(-8, 8),
    experience: 0,
    rank: 0,
    tenure: 0,
    bonds: [],
    moodBoost: 0,    // transient happiness kick from recent events (decays)
    stressSpike: 0,  // transient stress kick (decays)
    quitWatch: 0,    // seconds spent miserable + disloyal
  };
  desk.employeeId = employee.id;
  state.employees.push(employee);
  formBonds(state, employee);
  state.stats.hires++;

  return { success: true, employee, desk, cost: CONFIG.HIRE_SIGNING_BONUS };
}

/**
 * Start developing a product idea. You pay the up-front investment now; the
 * ambition you chose is locked in and decides the launch odds later.
 */
export function actionStartProduct(state, idea) {
  const active = getActiveProducts(state);
  const lanes = getDevelopmentLaneCount(state);
  if (active.length >= lanes) {
    return {
      success: false,
      reason: active.length > 1
        ? `All ${lanes} development lanes are busy. Hire more people or finish a product first.`
        : `Already developing ${active[0]?.idea.name}. Hire 2 employees to unlock a second lane.`,
    };
  }
  const founderDesk = getFounderDesk(state);
  if (!founderDesk) {
    return { success: false, reason: 'Buy and place your founder desk first.' };
  }
  if (!founderDesk.hasComputer) {
    return { success: false, reason: 'Buy a computer for your founder desk before development can start.' };
  }
  if (!state.founderAtDesk) {
    return { success: false, reason: 'Sit at your founder desk before development can start.' };
  }
  if ((getModifiers(state).serverWorking || 0) <= 0) {
    return { success: false, reason: 'Buy and place a server before development can start.' };
  }
  const investment = computeInvestment(idea);
  if (state.cash < investment) {
    return { success: false, reason: `Need ${fmtMoney(investment)} to fund ${idea.name}. Lower the ambition or raise cash.` };
  }
  state.cash -= investment;
  idea.ambition = idea.ambition ?? 1;
  idea.investment = investment;
  const alloc = idea.devAllocation || {};
  const quality = clamp(
    50
      + (alloc.engineering || 0) * 4
      + (alloc.infrastructure || 0) * 2.5
      + (alloc.compliance || 0) * 2
      - (alloc.magic || 0) * 1.2,
    30,
    100
  );
  const bugs = clamp(
    12
      + (alloc.magic || 0) * 2.2
      - (alloc.engineering || 0) * 1.8
      - (alloc.infrastructure || 0) * 1.2
      - (alloc.compliance || 0),
    0,
    50
  );
  state.activeProducts.push({ idea, progress: 0, devMode: 'balanced', quality, bugs });
  return { success: true, idea, investment, cost: investment };
}

export function actionSetDevMode(state, modeId, index = 0) {
  const active = getActiveProducts(state);
  const product = active[index] || active[0];
  if (!product) return { success: false, reason: 'No active product in development.' };
  if (!DEV_MODES[modeId]) return { success: false, reason: 'Unknown development mode.' };
  product.devMode = modeId;
  return { success: true, mode: DEV_MODES[modeId], product };
}

export function actionResolveCrunchSprint(state, score = 0.5, index = 0) {
  const active = getActiveProducts(state);
  const product = active[index] || active[0];
  if (!product) return { success: false, reason: 'Start developing a product first.' };
  if (state.cooldowns.crunch > 0) return { success: false, reason: `Crunch cooldown: ${state.cooldowns.crunch.toFixed(1)}s` };
  const s = clamp(score, 0, 1);
  const progress = Math.round(8 + s * 30);
  const bugDelta = Math.round((1 - s) * 11 - s * 4);   // a clean sprint actually removes bugs
  const qualityDelta = Math.round((s - 0.4) * 24);     // the sprint genuinely moves quality
  const moraleHit = Math.round(3 + (1 - s) * 9);
  product.progress += progress;
  product.bugs = clamp((product.bugs || 0) + bugDelta, 0, 60);
  product.quality = clamp((product.quality || 68) + qualityDelta, 20, 100);
  state.morale = clamp((state.morale ?? CONFIG.MORALE_START) - moraleHit, 0, 100);
  for (const emp of state.employees) {
    if (!emp.burnedOut) emp.energy = Math.max(0.02, emp.energy - (0.08 + (1 - s) * 0.1));
  }
  state.cooldowns.crunch = CONFIG.CD_CRUNCH;
  teamReact(state, 'crunch');
  return { success: true, score: s, progress, bugDelta, qualityDelta, moraleHit, product };
}

/**
 * Launch a developed ("ready") product  it goes live, earns MRR, and
 * generates a Hype burst. This is the only way products start making money.
 */
export function computeLaunchPlanEffects(plan = {}) {
  const reliability = Math.max(0, Math.min(CONFIG.LAUNCH_POLISH_POINTS, plan.reliability || 0));
  const marketing   = Math.max(0, Math.min(CONFIG.LAUNCH_POLISH_POINTS, plan.marketing || 0));
  const legal       = Math.max(0, Math.min(CONFIG.LAUNCH_POLISH_POINTS, plan.legal || 0));
  return {
    reliability,
    marketing,
    legal,
    successBonus: reliability * CONFIG.LAUNCH_RELIABILITY_BONUS + legal * CONFIG.LAUNCH_LEGAL_BONUS,
    hypeBonus: marketing * CONFIG.LAUNCH_MARKETING_HYPE,
    flopMrrBonus: legal * 0.04,
    userBaseBonus: marketing * 0.07,     // marketing buys launch-day users
    bugReduction: reliability * 1.6,     // reliability ships cleaner
    scamReduction: legal * 3,            // legal lowers scandal exposure
  };
}

export function actionLaunchProduct(state, index, launchPlan = {}) {
  const product = state.readyProducts[index];
  if (!product) return { success: false, reason: 'Nothing ready to launch  develop a product first.' };
  state.readyProducts.splice(index, 1);

  //  THE BIG BANG  the first launch wakes the whole world up. From here on
  // burn jumps, the press circles, disasters strike and VCs come knocking.
  const firstLaunch = !state.live;
  if (firstLaunch) {
    state.live = true;
    // Start the chaos clocks fresh, so nothing pounces the instant you go live.
    state._nextFireTime    = randRange(CONFIG.FIRE_SPAWN_INTERVAL);
    state._nextPRTime      = randRange(CONFIG.PR_SPAWN_INTERVAL);
    state._nextPeddlerTime = randRange(CONFIG.PEDDLER_INTERVAL);
    state._nextQuirkTime   = randRange(CONFIG.QUIRK_INTERVAL);
    state._nextBoardTime   = randRange(CONFIG.BOARD_INTERVAL);
    state._nextAcqTime     = randRange(CONFIG.ACQUISITION_CHECK);
    state._nextCloneTime   = randRange(CONFIG.CLONE_INTERVAL);
    state._nextPoachTime   = randRange(CONFIG.POACH_INTERVAL);
    state._nextMemeTime    = randRange(CONFIG.MEME_INTERVAL);
    state._nextRegulatorTime = randRange(CONFIG.REGULATOR_INTERVAL);
    state._nextTrendTime   = 4; // the first hot category lands shortly after you go live
  }

  //  Did it land? Ambition (investment) + team + research set the odds. 
  const ambition = product.idea.ambition ?? 1;
  const planEffects = computeLaunchPlanEffects(launchPlan);
  const chance   = clamp(
    computeSuccessChance(state, ambition)
      + planEffects.successBonus
      + (state.launchBuff || 0)
      + ((product.quality ?? 68) - 66) / 130
      - (product.bugs || 0) / 150,
    CONFIG.SUCCESS_MIN,
    CONFIG.SUCCESS_MAX
  );
  const success  = Math.random() < chance;
  if (!success) {
    // A flop still ships  it just earns a fraction of its intended MRR.
    const flopMult = Math.min(0.75, CONFIG.FLOP_MRR_MULT + planEffects.flopMrrBonus);
    product.idea.mrr = Math.max(1, Math.round(product.idea.mrr * flopMult));
    product.flopped  = true;
  }
  state.launchBuff = 0;

  product.shelfIdx = state.shippedProducts.length;
  product.freshness = 1; // brand new  earns full MRR until it ages
  product.quality = product.quality ?? 68;
  product.bugs = clamp((product.bugs ?? 0) - planEffects.bugReduction, 0, 60);
  if (product.idea) product.idea.scam = Math.max(0, (product.idea.scam || 0) - planEffects.scamReduction);
  // Critics: a continuous review score from quality, bugs, marketing and whether it landed.
  const _q = product.quality;
  const _devMkt = (product.idea && product.idea.devAllocation && product.idea.devAllocation.marketing) || 0;
  const reviewScore = clamp(0.28 + (_q - 50) / 120 - product.bugs / 110 + planEffects.marketing * 0.03 + (success ? 0.18 : -0.22), 0, 1);
  product.reviewScore = reviewScore;
  product.techDebt = Math.max(0, 12 - Math.round(product.quality / 12) + product.bugs);
  product.price = 1;
  // Launch-day audience: great reviews + marketing => more users => more sales from day one.
  product.userBase = clamp(0.62 + reviewScore * 0.95 + planEffects.userBaseBonus + _devMkt * 0.04, 0.5, 2.5);
  product.featureMrrBonus = 0;
  product.featureBurn = 0;
  product.featureQueue = [];
  product.outageTimer = 0;
  product.brand = productBrand(product.idea && product.idea.name, product.idea && product.idea.industry);
  state.shippedProducts.push(product);
  state.stats.productsShipped++;

  const mods = getModifiers(state);
  const hypeMult = success ? 1 : CONFIG.FLOP_HYPE_MULT;
  const burst = Math.round(
    (Math.min(45, 14 + product.idea.hype + (product.idea.absurdity - 1) * 12 + planEffects.hypeBonus)) * hypeMult + mods.shipHype
  );
  state.hype = clamp(state.hype + burst, 0, CONFIG.HYPE_MAX);

  // The team feels every launch: a hit lifts the whole company, a flop stings.
  teamReact(state, success ? 'launch_hit' : 'launch_flop');

  return { success: true, product, hypeGained: burst, reviewGood: success, reviewScore, flopped: !success, firstLaunch, launchPlan: planEffects, chance };
}

/**
 * Deliver a VC pitch for the current funding round.
 * Closing a round requires meeting its product/hype requirements AND a
 * good buzzword quality score. Otherwise the VCs pass and toss bridge money.
 */
export function actionDeliverPitch(state, selectedBuzzwords, deliveryScore = 1) {
  if (state.cooldowns.pitch > 0) {
    return { success: false, reason: `Cooldown: ${state.cooldowns.pitch.toFixed(1)}s` };
  }
  if (state.gameOver || state.won) return { success: false };
  if (state.roundIndex >= FUNDING_ROUNDS.length) {
    return { success: false, reason: 'All rounds raised. You already won?' };
  }

  const words = Array.isArray(selectedBuzzwords) ? selectedBuzzwords : (selectedBuzzwords?.words || []);
  const claims = Array.isArray(selectedBuzzwords) ? [] : (selectedBuzzwords?.claims || []);
  const est = estimatePitch(state, { words, claims });
  const lieRisk = claims.reduce((s, c) => s + (c.risk || 0), 0);
  // Delivery minigame ("Read the Room") nudges the effective pitch quality.
  const dMult = 0.85 + Math.max(0, Math.min(1, deliveryScore)) * 0.35;   // 0.85 .. 1.20
  const effQuality = est.quality * dMult;
  const willClose = est.meets && effQuality >= 1.05;
  const projected = willClose
    ? Math.round(est.round.amount * Math.min(1.5, 0.7 + effQuality * 0.3))
    : Math.round(est.round.amount * 0.06 * effQuality);
  state.cooldowns.pitch = CONFIG.CD_PITCH;
  state.stats.pitches++;

  if (lieRisk > 0 && Math.random() < lieRisk) {
    state.hype = clamp(state.hype - 12, 0, CONFIG.HYPE_MAX);
    state.morale = clamp((state.morale ?? CONFIG.MORALE_START) - 5, 0, 100);
    return { success: true, closed: false, raised: 0, round: est.round, caught: true, reason: 'The VC caught the bluff. Meeting ended instantly.' };
  }

  if (willClose) {
    state.cash        += projected;
    state.totalRaised += projected;
    state.hype         = clamp(state.hype + 18, 0, CONFIG.HYPE_MAX);
    const closedRound  = est.round;
    state.roundIndex++;

    const won = state.roundIndex >= FUNDING_ROUNDS.length;
    if (won) state.won = true;

    return { success: true, closed: true, raised: projected, round: closedRound, won };
  }

  // VCs pass  small bridge check out of pity (or boredom)
  state.cash        += projected;
  state.totalRaised += projected;
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

  return { success: true, closed: false, raised: projected, round: est.round, reason };
}

export function actionSetProductPrice(state, index, price) {
  const p = state.shippedProducts[index];
  if (!p) return { success: false, reason: 'Unknown product.' };
  p.price = clamp(price, 0.7, 1.55);
  return { success: true, product: p, price: p.price };
}

export function actionRefactorProduct(state, index) {
  const p = state.shippedProducts[index];
  if (!p) return { success: false, reason: 'Unknown product.' };
  const debt = p.techDebt || 0;
  const cost = Math.round(CONFIG.REFACTOR_BASE_COST + debt * CONFIG.REFACTOR_DEBT_COST + (p.bugs || 0) * 260);
  if (state.cash < cost) return { success: false, reason: `Need ${fmtMoney(cost)} for a refactor sprint.` };
  state.cash -= cost;
  p.techDebt = Math.max(0, debt - 34);
  p.bugs = Math.max(0, (p.bugs || 0) - 8);
  p.quality = clamp((p.quality || 70) + 5, 0, 100);
  p.freshness = Math.min(1, (p.freshness || 1) + 0.18);
  state.morale = clamp((state.morale ?? CONFIG.MORALE_START) + 3, 0, 100);
  return { success: true, product: p, cost };
}

export function actionQueueFeature(state, index, featureId) {
  const p = state.shippedProducts[index];
  if (!p) return { success: false, reason: 'Unknown product.' };
  const f = FEATURE_OPTIONS.find(x => x.id === featureId);
  if (!f) return { success: false, reason: 'Unknown feature.' };
  if ((p.featureQueue || []).length >= 3) return { success: false, reason: 'Roadmap is already packed. Ship something first.' };
  if (state.cash < f.cost) return { success: false, reason: `Need ${fmtMoney(f.cost)} to queue ${f.name}.` };
  state.cash -= f.cost;
  p.featureQueue = p.featureQueue || [];
  p.featureQueue.push({ ...f, progress: 0 });
  p.techDebt = clamp((p.techDebt || 0) + 4, 0, 100);
  return { success: true, product: p, feature: f, cost: f.cost };
}

export function actionVersionPushProduct(state, index) {
  const p = state.shippedProducts[index];
  if (!p) return { success: false, reason: 'Unknown product.' };
  const cost = CONFIG.VERSION_PUSH_COST + Math.round((p.bugs || 0) * 180);
  if (state.cash < cost) return { success: false, reason: `Need ${fmtMoney(cost)} for a version push.` };
  state.cash -= cost;
  const risk = clamp(0.18 + (p.techDebt || 0) / 180 + (p.bugs || 0) / 90 - (p.quality || 70) / 420, 0.08, 0.72);
  const bigWin = Math.random() > risk;
  if (bigWin) {
    const boost = Math.round(p.idea.mrr * randRange([0.18, 0.42]));
    p.featureMrrBonus = (p.featureMrrBonus || 0) + boost;
    p.freshness = 1;
    p.quality = clamp((p.quality || 70) + 4, 0, 100);
    state.hype = clamp(state.hype + 18, 0, CONFIG.HYPE_MAX);
    return { success: true, product: p, cost, bigWin, mrrBoost: boost, hype: 18 };
  }
  p.outageTimer = randRange([10, 22]);
  p.techDebt = clamp((p.techDebt || 0) + 12, 0, 100);
  p.bugs = clamp((p.bugs || 0) + 7, 0, 60);
  state.hype = clamp(state.hype - 10, 0, CONFIG.HYPE_MAX);
  return { success: true, product: p, cost, bigWin, outage: p.outageTimer, hype: -10 };
}

export function actionResolvePRResponse(state, prId, choice, score = null) {
  const pr = state.prDisasters.find(x => x.id === prId);
  if (!pr) return { success: false, reason: 'That PR disaster already faded.' };
  const table = {
    apology: { label: 'Apology Thread', severity: -0.35, hype: 5, morale: 2, timer: -7 },
    meme:    { label: 'Meme It',        severity: 0.15,  hype: 14, morale: -3, timer: -3 },
    lawyer:  { label: 'Legalese',       severity: -0.55, hype: -4, morale: 0, timer: -9, cost: 3500 },
  };
  const pick = table[choice] || table.apology;
  if (pick.cost && state.cash < pick.cost) return { success: false, reason: `Need ${fmtMoney(pick.cost)} for legal damage control.` };
  if (pick.cost) state.cash -= pick.cost;
  // A minigame score (0..1) scales how well the response lands; null = legacy flat effect.
  const eff = score == null ? 1 : 0.55 + 0.9 * score;            // botched 0.55x .. nailed 1.45x
  const sevDelta = pick.severity < 0 ? pick.severity * eff : pick.severity;
  const hypeDelta = Math.round(pick.hype * (score == null ? 1 : 0.6 + 0.8 * score));
  pr.severity = Math.max(0.15, pr.severity + sevDelta);
  pr.timer = Math.max(1, pr.timer + pick.timer * (pick.timer < 0 ? eff : 1));
  state.hype = clamp(state.hype + hypeDelta, 0, CONFIG.HYPE_MAX);
  state.morale = clamp((state.morale ?? CONFIG.MORALE_START) + pick.morale, 0, 100);
  return { success: true, pr, response: pick, cost: pick.cost || 0, hypeDelta };
}

/**
 * Caffeinate employees  costs cash, restores energy.
 * Caffeine Gremlins get double restore.
 */
export function actionCaffeinate(state, pourScore = null) {
  if (state.cooldowns.caffeine > 0) {
    return { success: false, reason: `Cooldown: ${state.cooldowns.caffeine.toFixed(1)}s` };
  }
  if (state.cash < CONFIG.CAFFEINE_COST) {
    return { success: false, reason: `Need ${fmtMoney(CONFIG.CAFFEINE_COST)} for the coffee run.` };
  }
  if (state.paused || state.gameOver || state.won) return { success: false };

  // A well-poured cup restores more; a botched pour is mostly foam.
  const pourMult = pourScore == null ? 1 : 0.55 + pourScore * 0.7;
  let restored = 0;
  for (const emp of state.employees) {
    if (emp.burnedOut || emp.energy < 0.85) {
      const mult = PERSONALITIES[emp.personality].caffeineMult ?? 1;
      emp.energy = Math.min(1.0, emp.energy + CONFIG.CAFFEINE_RESTORE * mult * pourMult);
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
  teamReact(state, 'caffeine');

  return { success: true, restoredCount: restored, cost: CONFIG.CAFFEINE_COST };
}

/**
 * Pivot  clears all PR disasters at a cash cost.
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
 * Take a bank loan  instant cash now, permanent interest added to burn.
 */
export function actionTakeLoan(state, id) {
  const loan = LOANS.find(x => x.id === id);
  if (!loan) return { success: false, reason: 'Unknown loan.' };
  state.cash    += loan.cash;
  state.debt    += loan.cash;
  state.loanBurn += loan.interest;
  return { success: true, loan };
}

export function actionMarketingPost(state, score = 1) {
  if (state.cooldowns.marketing > 0) {
    return { success: false, reason: `Marketing cooldown: ${state.cooldowns.marketing.toFixed(1)}s` };
  }
  if (state.paused || state.gameOver || state.won) return { success: false };
  if (state.cash < CONFIG.MARKETING_COST) {
    return { success: false, reason: `Need ${fmtMoney(CONFIG.MARKETING_COST)} to run a marketing post.` };
  }

  const productCount = state.shippedProducts.length;
  const activeCount = getActiveProducts(state).length + state.readyProducts.length;
  const base = state.live ? CONFIG.MARKETING_HYPE_LIVE : CONFIG.MARKETING_HYPE_BASE;
  const tractionBonus = Math.min(8, productCount * 2 + activeCount);
  // Skill-scaled by the Go Viral minigame: a great push ~1.65x, a weak one ~0.5x.
  // (Replaces the old random swing so hype is steadier and earned.)
  const sc = Math.max(0, Math.min(1, score));
  const skillMult = 0.5 + sc * 1.15;
  const viralBonus = sc >= 0.85 ? 6 : 0;
  const hypeDelta = Math.max(3, Math.round((base + tractionBonus) * skillMult + viralBonus));

  state.cash -= CONFIG.MARKETING_COST;
  state.hype = clamp(state.hype + hypeDelta, 0, CONFIG.HYPE_MAX);
  state.cooldowns.marketing = CONFIG.CD_MARKETING;

  return { success: true, cost: CONFIG.MARKETING_COST, hypeDelta, live: state.live, productCount };
}

/**
 * Accept a peddler's shady offer  fast cash, with strings (debt / hype hit).
 */
export function actionAcceptPeddler(state, deal) {
  if (!deal) return { success: false };
  state.cash += deal.cash || 0;
  state.debt += deal.debt || 0;
  if (deal.hype) state.hype = clamp(state.hype + deal.hype, 0, CONFIG.HYPE_MAX);
  return { success: true, deal };
}

export function buildAcquisitionOffer(state) {
  const valuation = getValuation(state);
  const traction = state.shippedProducts.length * 0.04 + Math.min(0.18, state.hype / 600);
  const multiplier = 0.78 + traction + Math.random() * 0.28;
  const amount = Math.round(Math.max(90000, valuation * multiplier) / 1000) * 1000;
  const acquirers = ['Macrohard', 'SalesHorse', 'Pear', 'Amazong', 'MegaSoft Ventures'];
  return {
    amount,
    valuation,
    acquirer: pick(acquirers),
    text: `They love the traction, fear the roadmap, and want the whole mess for ${fmtMoney(amount)}.`,
  };
}

export function actionAcceptAcquisition(state, offer) {
  if (!offer || offer.amount <= 0) return { success: false };
  state.cash += offer.amount;
  state.totalRaised += offer.amount;
  state.peakValuation = Math.max(state.peakValuation, offer.amount, getValuation(state));
  state.won = true;
  state.exitType = 'acquisition';
  return { success: true, offer };
}

export function actionDeclineAcquisition(state) {
  state.hype = clamp(state.hype + 6, 0, CONFIG.HYPE_MAX);
  return { success: true, hype: 6 };
}

export function actionResolveBoardDilemma(state, dilemma, optionIndex) {
  const option = dilemma?.options?.[optionIndex];
  if (!option) return { success: false, reason: 'Unknown board option.' };
  const effect = option.effect || {};
  const cashDelta = effect.cash || 0;
  const hypeDelta = effect.hype || 0;
  state.cash += cashDelta;
  if (hypeDelta) state.hype = clamp(state.hype + hypeDelta, 0, CONFIG.HYPE_MAX);
  if (effect.energyHit) {
    for (const emp of state.employees) {
      if (!emp.burnedOut) emp.energy = Math.max(0.03, emp.energy - effect.energyHit);
    }
  }
  if (effect.launchBuff) state.launchBuff = (state.launchBuff || 0) + effect.launchBuff;

  let spawnedPr = null;
  if (effect.pr) {
    const template = pick(PR_DISASTERS);
    const duration = randRange(CONFIG.PR_DURATION);
    spawnedPr = {
      id: state.nextEventId(),
      title: template.title,
      desc: template.desc,
      timer: duration,
      maxTimer: duration,
      severity: template.severity,
    };
    state.prDisasters.push(spawnedPr);
  }

  return {
    success: true,
    dilemma,
    option,
    cashDelta,
    hypeDelta,
    cost: cashDelta < 0 ? -cashDelta : 0,
    spawnedPr,
  };
}

//  Shared: spawn a PR disaster (used by board, regulator, meme blowback)
function makePRDisaster(state, opts = {}) {
  const template = opts.template || pick(PR_DISASTERS);
  const duration = randRange(CONFIG.PR_DURATION);
  const pr = {
    id: state.nextEventId(),
    title: opts.title || template.title,
    desc: opts.desc || template.desc,
    timer: duration, maxTimer: duration,
    severity: (opts.severity != null ? opts.severity : template.severity) * getModifiers(state).prSeverity,
  };
  state.prDisasters.push(pr);
  return pr;
}

/** Remove an employee from the team and free their desk. */
function removeEmployee(state, emp) {
  const desk = state.desks.find(d => d.employeeId === emp.id);
  if (desk) desk.employeeId = null;
  state.employees = state.employees.filter(e => e !== emp);
  return desk ? desk.id : null;
}

//  Talent Poaching: a rival tries to steal your best person
const POACH_RIVALS = ['a FAANG recruiter', 'a stealth-mode rival', 'a crypto exchange', 'a defense-tech unicorn',
  'your biggest competitor', 'a YC darling with a frog logo', 'a SPAC with no actual product', 'a "web5" cult'];

export function buildPoachOffer(state) {
  const pool = state.employees.filter(e => !e.burnedOut);
  if (!pool.length) return null;
  // Target the most valuable contributor (raw output + pitch/hype value).
  let target = pool[0], best = -Infinity;
  for (const e of pool) {
    const v = getEmployeeDevPower(state, e) + (PERSONALITIES[e.personality].pitchBonus || 0) * 2
            + (ROLES[e.role].hypeAura || 0) + (PERSONALITIES[e.personality].hypeAura || 0);
    if (v > best) { best = v; target = e; }
  }
  const rival = pick(POACH_RIVALS);
  const counterCost = Math.max(4500, Math.round(target.salary * 130 / 500) * 500);
  return {
    employeeId: target.id, name: target.name, rival, counterCost,
    text: `${rival} is waving a huge offer at ${target.name} (${ROLES[target.role].label}). Counter it, buy them off with a title, or wave goodbye.`,
  };
}

export function actionResolvePoach(state, offer, choice) {
  const emp = state.employees.find(e => e.id === offer.employeeId);
  if (!emp) return { success: false, reason: 'They already cleared out their desk.' };

  if (choice === 'counter') {
    if (state.cash < offer.counterCost) return { success: false, reason: `Need ${fmtMoney(offer.counterCost)} to match the offer.` };
    state.cash -= offer.counterCost;
    emp.energy = Math.min(1, emp.energy + 0.25);
    emp.burnedOut = false;
    emp.salary = Math.round(emp.salary * 1.12); // the raise is permanent burn
    state.morale = clamp((state.morale ?? CONFIG.MORALE_START) + 4, 0, 100);
    state.hype = clamp(state.hype + 4, 0, CONFIG.HYPE_MAX);
    return { success: true, choice, cost: offer.counterCost, kept: true, deskId: null,
      note: `${emp.name} stays - for a 12% raise (+${fmtMoney(Math.round(emp.salary - emp.salary / 1.12))}/s salary) and a new title.` };
  }

  if (choice === 'promote') {
    // Free, but a gamble: a fancy title keeps them ~62% of the time.
    if (Math.random() < 0.62) {
      emp.energy = Math.min(1, emp.energy + 0.12);
      state.morale = clamp((state.morale ?? CONFIG.MORALE_START) + 2, 0, 100);
      return { success: true, choice, cost: 0, kept: true, deskId: null,
        note: `${emp.name} is dazzled by the title "Chief ${ROLES[emp.role].label} Officer" and stays. For now.` };
    }
    const deskId = removeEmployee(state, emp);
    state.hype = clamp(state.hype - 6, 0, CONFIG.HYPE_MAX);
    state.morale = clamp((state.morale ?? CONFIG.MORALE_START) - 6, 0, 100);
    return { success: true, choice, cost: 0, kept: false, deskId,
      note: `A title is not equity, and equity is not money. ${emp.name} left for ${offer.rival} anyway.` };
  }

  // walk
  const deskId = removeEmployee(state, emp);
  state.morale = clamp((state.morale ?? CONFIG.MORALE_START) - 4, 0, 100);
  return { success: true, choice: 'walk', cost: 0, kept: false, deskId,
    note: `${emp.name} leaves for ${offer.rival}. Their desk is empty and so are you, slightly.` };
}

//  Viral Meme Moment: a product randomly becomes a meme
const MEME_FORMATS = ['is now a TikTok sound', 'got turned into a cursed reaction GIF', 'is a copypasta now',
  'became an ironic Gen-Z catchphrase', 'is trending for all the wrong reasons', 'got a 9-hour video essay'];

export function buildMemeMoment(state) {
  if (!state.shippedProducts.length) return null;
  const p = pick(state.shippedProducts);
  const format = pick(MEME_FORMATS);
  const merchCash = Math.round(Math.max(6000, getMRR(state) * 60 + state.hype * 220) / 500) * 500;
  return {
    productName: p.idea.name, productRef: p, format, merchCash,
    text: `${p.idea.name} ${format}. The internet has noticed you - briefly, loudly, unpredictably.`,
  };
}

export function actionResolveMeme(state, moment, choice) {
  if (choice === 'lean') {
    // Big hype, but a real chance the bit curdles into a PR mess.
    state.hype = clamp(state.hype + 22, 0, CONFIG.HYPE_MAX);
    let spawnedPr = null;
    if (Math.random() < 0.4) {
      spawnedPr = makePRDisaster(state, { title: 'MEME BACKFIRE', desc: 'Leaning into the bit aged like milk.', severity: 1.1 });
    }
    return { success: true, choice, cost: 0, hypeDelta: 22, spawnedPr,
      note: spawnedPr ? `You posted the meme yourself. It curdled. Now there's a PR fire.` : `You lean all the way in. +22 Hype and zero dignity. Worth it.` };
  }
  if (choice === 'merch') {
    state.cash += moment.merchCash;
    state.hype = clamp(state.hype + 8, 0, CONFIG.HYPE_MAX);
    return { success: true, choice, cost: 0, cashGain: moment.merchCash, hypeDelta: 8,
      note: `You slap the meme on a hoodie within the hour. +${fmtMoney(moment.merchCash)}, +8 Hype.` };
  }
  // classy
  state.hype = clamp(state.hype + 6, 0, CONFIG.HYPE_MAX);
  state.morale = clamp((state.morale ?? CONFIG.MORALE_START) + 4, 0, 100);
  return { success: true, choice: 'classy', cost: 0, hypeDelta: 6,
    note: `You stay above it with a tasteful, slightly smug statement. +6 Hype, team morale up.` };
}

//  Regulator: once you matter, the government notices
const REGULATORS = ['The FTC', 'A Senate Subcommittee', 'The SEC', 'A State Attorney General', 'The EU (via fax)', 'A very persistent journalist with subpoena energy'];

export function buildRegulatorProbe(state) {
  const who = pick(REGULATORS);
  const lawyerCost = Math.round(Math.max(9000, getValuation(state) * 0.02) / 500) * 500;
  const bribeCost  = Math.round(Math.max(16000, getValuation(state) * 0.045) / 500) * 500;
  return {
    who, lawyerCost, bribeCost,
    text: `${who} has "a few pointed questions" about how exactly your product makes money. Choose your defense.`,
  };
}

export function actionResolveRegulator(state, probe, choice) {
  if (choice === 'lawyer') {
    if (state.cash < probe.lawyerCost) return { success: false, reason: `Need ${fmtMoney(probe.lawyerCost)} to retain real lawyers.` };
    state.cash -= probe.lawyerCost;
    const hasLegal = state.facilities.includes('legal');
    state.hype = clamp(state.hype + (hasLegal ? 5 : 2), 0, CONFIG.HYPE_MAX);
    return { success: true, choice, cost: probe.lawyerCost, spawnedPr: null,
      note: hasLegal ? `Your Legal Department buries ${probe.who} in counter-paperwork. Handled.` : `Expensive lawyers make ${probe.who} go away. For now.` };
  }
  if (choice === 'bribe') {
    if (state.cash < probe.bribeCost) return { success: false, reason: `Need ${fmtMoney(probe.bribeCost)} for the "consulting fee".` };
    state.cash -= probe.bribeCost;
    // Usually works. Sometimes it becomes its own, much worse scandal.
    if (Math.random() < 0.72) {
      state.hype = clamp(state.hype + 6, 0, CONFIG.HYPE_MAX);
      return { success: true, choice, cost: probe.bribeCost, spawnedPr: null,
        note: `A discreet "consulting fee" makes the whole thing evaporate. You feel powerful and unwell.` };
    }
    state.hype = clamp(state.hype - 14, 0, CONFIG.HYPE_MAX);
    const spawnedPr = makePRDisaster(state, { title: 'BRIBERY EXPOSED', desc: `The "consulting fee" to ${probe.who} leaked.`, severity: 1.5 });
    return { success: true, choice, cost: probe.bribeCost, spawnedPr,
      note: `The bribe leaked. This is now a much bigger, much more federal problem.` };
  }
  // stonewall: free, but risky
  if (Math.random() < 0.55) {
    state.hype = clamp(state.hype - 10, 0, CONFIG.HYPE_MAX);
    const spawnedPr = makePRDisaster(state, { title: 'STONEWALLED', desc: `${probe.who} did not enjoy "no comment".`, severity: 1.3 });
    return { success: true, choice: 'stonewall', cost: 0, spawnedPr,
      note: `You stonewall. ${probe.who} responds with a press conference and your home address (kidding).` };
  }
  state.hype = clamp(state.hype + 7, 0, CONFIG.HYPE_MAX);
  return { success: true, choice: 'stonewall', cost: 0, spawnedPr: null,
    note: `You testify with total confidence and zero knowledge. Somehow, it works. +7 Hype.` };
}

/**
 * Build a competitor-clone event targeting your best-earning product.
 */
export function buildCompetitorClone(state) {
  if (!state.shippedProducts.length) return null;
  let target = state.shippedProducts[0];
  let best = -Infinity;
  for (const p of state.shippedProducts) {
    const m = p.idea.mrr * getProductFreshness(p);
    if (m > best) { best = m; target = p; }
  }
  const rival = `${pick(NAME_PRE)}${pick(NAME_SUF)}`;
  return {
    product: target,
    rival,
    mrrMult: CONFIG.CLONE_MRR_MULT,
    timer: CONFIG.CLONE_RIDE_DURATION,
    text: `${rival} just shipped a shameless knockoff of ${target.idea.name}. Until you respond, its MRR bleeds ${Math.round((1 - CONFIG.CLONE_MRR_MULT) * 100)}%.`,
  };
}

/**
 * Respond to a competitor clone: 'outhype' | 'lawyer' | 'pivot' clear it for
 * cash; 'ride' leaves it bleeding until its timer runs out on its own.
 */
export function actionResolveClone(state, choice) {
  const clone = state.competitorClone;
  if (!clone) return { success: false, reason: 'No active clone.' };

  if (choice === 'ride') {
    return { success: true, choice: 'ride', cost: 0, hypeDelta: 0, cleared: false,
      note: `You ignore ${clone.rival}. The MRR keeps bleeding  for now.` };
  }

  let cost = 0, hypeDelta = 0, note = '';
  if (choice === 'outhype') {
    cost = CONFIG.CLONE_OUTHYPE_COST; hypeDelta = 14;
    note = `You bury ${clone.rival} under a marketing blitz.`;
  } else if (choice === 'lawyer') {
    const hasLegal = state.facilities.includes('legal');
    cost = Math.round(CONFIG.CLONE_LAWYER_COST * (hasLegal ? 0.5 : 1));
    hypeDelta = 6;
    note = hasLegal ? `Your Legal Dept drowns ${clone.rival} in paperwork.` : `You lawyer up. ${clone.rival} gets a cease-and-desist.`;
  } else if (choice === 'pivot') {
    cost = CONFIG.CLONE_PIVOT_COST; hypeDelta = 4;
    note = `You out-build ${clone.rival} with a fresh release.`;
  } else {
    return { success: false, reason: 'Unknown response.' };
  }

  if (state.cash < cost) return { success: false, reason: `Need ${fmtMoney(cost)} to respond.` };
  state.cash -= cost;
  if (hypeDelta) state.hype = clamp(state.hype + hypeDelta, 0, CONFIG.HYPE_MAX);
  if (choice === 'pivot' && clone.product) clone.product.freshness = 1; // a differentiating release
  state.competitorClone = null;
  return { success: true, choice, cost, hypeDelta, cleared: true, note };
}

/**
 * Ship updates across the portfolio  refresh every product to full MRR.
 * Counters product aging; the core "keep shipping or decay" maintenance loop.
 */
export function actionShipUpdate(state) {
  if (state.cooldowns.update > 0) {
    return { success: false, reason: `Cooldown: ${state.cooldowns.update.toFixed(1)}s` };
  }
  if (!state.shippedProducts.length) {
    return { success: false, reason: 'No live products to update yet.' };
  }
  if (!state.shippedProducts.some(p => getProductFreshness(p) < 0.995)) {
    return { success: false, reason: 'Every product is already fresh.' };
  }
  const cost = CONFIG.UPDATE_COST_BASE + CONFIG.UPDATE_COST_PER_PRODUCT * state.shippedProducts.length;
  if (state.cash < cost) {
    return { success: false, reason: `Need ${fmtMoney(cost)} to ship updates.` };
  }
  state.cash -= cost;
  for (const p of state.shippedProducts) p.freshness = 1;
  state.hype = clamp(state.hype + CONFIG.UPDATE_HYPE, 0, CONFIG.HYPE_MAX);
  state.cooldowns.update = CONFIG.CD_UPDATE;
  return { success: true, cost, refreshed: state.shippedProducts.length, hypeDelta: CONFIG.UPDATE_HYPE };
}

/**
 * Expand the office to the next tier  unlocks more desk slots.
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
  teamReact(state, 'office_upgrade');
  return { success: true, tier: next, cost: next.cost };
}

/**
 * Buy or replace a server rack. The first one unlocks product development.
 */
export function actionBuyServer(state) {
  const idx = (state.rackDown || []).findIndex(d => d);
  if (idx === -1) return { success: false, reason: 'All servers are operational.' };
  if (state.cash < CONFIG.SERVER_COST) {
    return { success: false, reason: `Need ${fmtMoney(CONFIG.SERVER_COST)} for a new server.` };
  }
  state.cash -= CONFIG.SERVER_COST;
  state.rackDown[idx] = false;
  return { success: true, rackIdx: idx, cost: CONFIG.SERVER_COST };
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
    return { success: false, reason: `Locked  research Tier-${f.tier} facilities first.` };
  }
  if (state.cash < f.cost) {
    return { success: false, reason: `Need ${fmtMoney(f.cost)} to build the ${f.name}.` };
  }
  state.cash -= f.cost;
  state.facilities.push(id);
  state.facilityLevels[id] = 1;
  return { success: true, facility: f, cost: f.cost };
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
    return { success: false, reason: 'Locked  finish the prerequisites first.' };
  }
  if (state.cash < n.cost) {
    return { success: false, reason: `Need ${fmtMoney(n.cost)} for R&D.` };
  }
  state.cash -= n.cost;
  state.research.push(nodeId);
  return { success: true, node: n, cost: n.cost };
}

/**
 * Extinguish a server fire. `quality` (0..1) is the Firefight QTE score  how
 * many error bubbles the founder popped. A clean clear (1.0) pays the most Hype.
 */
export function actionExtinguishFire(state, fireId, quality = 1) {
  const idx = state.fires.findIndex(f => f.id === fireId);
  if (idx === -1) return { success: false };

  const fire = state.fires[idx];
  state.fires.splice(idx, 1);
  state.stats.firesKilled++;
  const q = clamp(quality, 0, 1);
  const clean = q >= 0.999;
  const speedBonus = fire.timer > CONFIG.FIRE_DURATION * 0.5 ? 5 : 2;
  const bonus = Math.round(speedBonus * (0.4 + 0.6 * q)) + (clean ? 3 : 0);
  state.hype = clamp(state.hype + bonus, 0, CONFIG.HYPE_MAX);

  return { success: true, hypeBonus: bonus, clean, quality: q };
}

//  People actions: a morale band-aid and a career ladder

/** Company-wide pizza. Absurdly effective. Cheap, on a cooldown. */
export function actionPizzaParty(state) {
  if (state.cooldowns.pizza > 0) return { success: false, reason: `Pizza cooldown: ${state.cooldowns.pizza.toFixed(1)}s` };
  if (!state.employees.length) return { success: false, reason: 'No team to feed yet. Hire someone first.' };
  if (state.cash < CONFIG.PIZZA_COST) return { success: false, reason: `Need ${fmtMoney(CONFIG.PIZZA_COST)} for company-wide pizza.` };
  state.cash -= CONFIG.PIZZA_COST;
  state.cooldowns.pizza = CONFIG.CD_PIZZA;
  teamReact(state, 'pizza');
  return { success: true, cost: CONFIG.PIZZA_COST, count: state.employees.length };
}

/** Promote an employee: title bump + permanent raise, big loyalty/happiness lift. */
export function actionPromoteEmployee(state, empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return { success: false, reason: 'No such employee.' };
  if ((emp.rank ?? 0) >= 5) return { success: false, reason: `${emp.name} already runs the place.` };
  const bonus = Math.round(emp.salary * 6);
  if (state.cash < bonus) return { success: false, reason: `Need ${fmtMoney(bonus)} to promote ${emp.name}.` };
  state.cash -= bonus;
  emp.rank = (emp.rank ?? 0) + 1;
  emp.salary = Math.round(emp.salary * (1 + CONFIG.PROMOTE_RAISE));
  const thresh = [0, 45, 120, 250, 460, 760];
  emp.experience = Math.max(emp.experience || 0, thresh[Math.min(emp.rank, thresh.length - 1)]);
  teamReact(state, 'promote', { who: emp });
  return { success: true, cost: bonus, employee: emp, title: getEmployeeTitle(emp) };
}


//  Product Eras  start small (garage apps), end on the frontier (space, defense).
// Unlocked by products shipped OR funding round reached. Each era reskins the
// develop modal's three picks and scales the economics up.
export const PRODUCT_ERAS = [
  {
    id: 'garage', name: 'Garage Apps', reqProducts: 0, reqRound: 0, mrrMult: 1, devMult: 1,
    industries: [
      { key: 'AI', color: '#4D6BFF', icon: 'AI', names: ['Synapse', 'Promptly', 'Cortex', 'NeuralNote'] },
      { key: 'Social', color: '#8B5CF6', icon: '@', names: ['Yapp', 'Clout', 'Bleat', 'Mood'] },
      { key: 'Gaming', color: '#FF4D9D', icon: 'GM', names: ['PixelPit', 'RageQuit', 'LootLoop', 'Respawn'] },
      { key: 'Finance', color: '#FF9A1F', icon: '$', names: ['CoinFlip', 'YieldVibe', 'FOMOFlow', 'SpendBuddy'] },
      { key: 'Health', color: '#28C7D8', icon: '+', names: ['ZenLeaf', 'PulsePal', 'CalmWave', 'VitaMind'] },
      { key: 'Robotics', color: '#19C37D', icon: 'RB', names: ['Botly', 'ServoSnack', 'RoboPal', 'TinTen'] },
    ],
    buzzwords: ['Blockchain', 'Quantum', 'Metaverse', 'AGI', 'Web4', 'Crypto'],
    audiences: ['Investors', 'Influencers', 'Kids', 'Pets', 'Boomers', 'Students'],
  },
  {
    id: 'scaleup', name: 'Scale-Up Platforms', reqProducts: 1, reqRound: 1, mrrMult: 1.6, devMult: 1.25,
    industries: [
      { key: 'SaaS', color: '#4D6BFF', icon: 'SA', names: ['StackFlow', 'OpsGenie', 'SyncMesh', 'DataDrip'] },
      { key: 'AdTech', color: '#FF4D9D', icon: 'AD', names: ['ClickStorm', 'AdMancer', 'FunnelFox', 'PixelBid'] },
      { key: 'FinTech', color: '#FF9A1F', icon: 'FT', names: ['LedgerX', 'NeoBanq', 'CardlessCo', 'PayMancer'] },
      { key: 'Logistics', color: '#19C37D', icon: 'LG', names: ['ShipMesh', 'CrateAI', 'PalletPilot', 'LastMileX'] },
      { key: 'HealthTech', color: '#28C7D8', icon: 'HT', names: ['CareCloud', 'MediMesh', 'ClinIQ', 'VitalsAI'] },
      { key: 'Creator', color: '#8B5CF6', icon: 'CR', names: ['CreatorOS', 'PatronPay', 'ClipFarm', 'SubStackr'] },
    ],
    buzzwords: ['AI-Native', 'Vertical', 'Agentic', 'Onchain', 'Realtime', 'Edge'],
    audiences: ['Enterprises', 'SMBs', 'Creators', 'Developers', 'Hospitals', 'Governments'],
  },
  {
    id: 'deeptech', name: 'Deep Tech', reqProducts: 3, reqRound: 2, mrrMult: 2.6, devMult: 1.6,
    industries: [
      { key: 'Quantum', color: '#4D6BFF', icon: 'QC', names: ['QubitWorks', 'EntangleAI', 'SpookyOS', 'CoherentCo'] },
      { key: 'Chips', color: '#19C37D', icon: 'CH', names: ['SiliconForge', 'WaferWorks', 'NanoFab', 'TapeoutAI'] },
      { key: 'AGI', color: '#8B5CF6', icon: 'GI', names: ['Prometheus', 'Oracle9', 'MindForge', 'GodModeAI'] },
      { key: 'XR', color: '#FF4D9D', icon: 'XR', names: ['HoloDeck', 'MetaLens', 'PhantomUI', 'SpecsCo'] },
      { key: 'Cyber', color: '#28C7D8', icon: 'CY', names: ['ZeroDay', 'SentinelX', 'RedTeamAI', 'HoneyTrap'] },
      { key: 'Robotics+', color: '#FF9A1F', icon: 'RX', names: ['Atlas Works', 'GraspAI', 'SwarmCo', 'HumanoidX'] },
    ],
    buzzwords: ['Photonic', 'Neuromorphic', 'Sovereign', 'Autonomous', 'Post-Quantum', 'Zero-Trust'],
    audiences: ['Megacorps', 'Governments', 'Labs', 'Hyperscalers', 'Defense', 'Universities'],
  },
  {
    id: 'science', name: 'Science & Biotech', reqProducts: 5, reqRound: 3, mrrMult: 4, devMult: 2,
    industries: [
      { key: 'Biotech', color: '#19C37D', icon: 'BT', names: ['HelixWorks', 'CRISPRco', 'CellForge', 'GeneMancer'] },
      { key: 'Fusion', color: '#FF9A1F', icon: 'FU', names: ['StarCage', 'Tokamak Co', 'IgnitionX', 'PlasmaWorks'] },
      { key: 'Climate', color: '#28C7D8', icon: 'CL', names: ['CarbonVault', 'SkyScrub', 'TerraCool', 'GeoMesh'] },
      { key: 'Neurotech', color: '#8B5CF6', icon: 'NT', names: ['CortexLink', 'MindBridge', 'WetwareOS', 'SynapseX'] },
      { key: 'Materials', color: '#4D6BFF', icon: 'MT', names: ['GrapheneCo', 'MetaMaterial', 'SelfHealX', 'AeroGelle'] },
      { key: 'Longevity', color: '#FF4D9D', icon: 'LV', names: ['ForeverYoung', 'TeloMancer', 'ResetBio', 'AgelessAI'] },
    ],
    buzzwords: ['Programmable', 'Synthetic', 'Closed-Loop', 'Self-Healing', 'Gene-Edited', 'Room-Temp'],
    audiences: ['Governments', 'Pharma', 'Billionaires', 'Nations', 'Cartels', 'Humanity'],
  },
  {
    id: 'space', name: 'Space', reqProducts: 7, reqRound: 4, mrrMult: 6, devMult: 2.5,
    industries: [
      { key: 'Satellites', color: '#4D6BFF', icon: 'ST', names: ['OrbitMesh', 'ConstellAI', 'LEOworks', 'SkyNetCo'] },
      { key: 'Rockets', color: '#FF9A1F', icon: 'RK', names: ['BoosterCo', 'ReusableX', 'EscapeVel', 'ThrustMancer'] },
      { key: 'Asteroid Mining', color: '#19C37D', icon: 'AM', names: ['RockHopper', 'CoreDriller', 'BeltCo', 'OreOrbit'] },
      { key: 'Orbital Data', color: '#28C7D8', icon: 'OD', names: ['VacuumCloud', 'OrbitalDB', 'GravWell', 'DownlinkX'] },
      { key: 'Space Tourism', color: '#FF4D9D', icon: 'SX', names: ['ZeroGresort', 'OrbitClub', 'ApogeeCo', 'BillionaireBus'] },
      { key: 'Lunar', color: '#8B5CF6', icon: 'LU', names: ['MoonBase', 'RegolithCo', 'LunaFarm', 'CraterWorks'] },
    ],
    buzzwords: ['Reusable', 'In-Orbit', 'Sub-Orbital', 'Interplanetary', 'Cislunar', 'Hypersonic'],
    audiences: ['Governments', 'Billionaires', 'Nations', 'Colonists', 'Megacorps', 'Humanity'],
  },
  {
    id: 'frontier', name: 'Frontier & Defense', reqProducts: 9, reqRound: 5, mrrMult: 9, devMult: 3,
    industries: [
      { key: 'Autonomous Defense', color: '#FF4D5E', icon: 'DF', names: ['AegisAI', 'SentinelOS', 'GuardianX', 'WarMind'] },
      { key: 'Drones', color: '#FF9A1F', icon: 'DR', names: ['SwarmCo', 'SkyReaper', 'LoiterAI', 'DroneMesh'] },
      { key: 'Surveillance', color: '#8B5CF6', icon: 'SV', names: ['PanoptiCo', 'AllSeeingAI', 'EyeNet', 'TraceMancer'] },
      { key: 'Cyberwar', color: '#28C7D8', icon: 'CW', names: ['BlackICE', 'LogicBomb', 'KillSwitch', 'GhostProtocol'] },
      { key: 'AGI Labs', color: '#4D6BFF', icon: 'AG', names: ['Singularity', 'Basilisk', 'OmniMind', 'LastInventionCo'] },
      { key: 'Nuclear', color: '#19C37D', icon: 'NU', names: ['ChainReaction', 'CritMass', 'HalfLifeCo', 'FalloutAI'] },
    ],
    buzzwords: ['Autonomous', 'Hypersonic', 'Sovereign', 'Lethal', 'Classified', 'Dual-Use'],
    audiences: ['Militaries', 'Nations', 'Agencies', 'Warlords', 'Coalitions', 'Humanity'],
  },
];

/** Highest era unlocked by products shipped OR funding round reached. */
export function getUnlockedEra(state) {
  const shipped = (state.shippedProducts || []).length;
  const round = state.roundIndex || 0;
  let era = 0;
  for (let i = 0; i < PRODUCT_ERAS.length; i++) {
    const e = PRODUCT_ERAS[i];
    if (shipped >= e.reqProducts || round >= e.reqRound) era = i;
  }
  return era;
}
export function getEra(state) { return PRODUCT_ERAS[getUnlockedEra(state)]; }


/* ===== Inbox proposals: openable, funny, different every run ===== */
const _pVCs = ['Redwood Ventures', 'Sequsoia Capital', 'Andreessen Horrorwitz', 'Tiger Globule', 'SoftBonk Vision', 'Y Combinatorium', "Founders Fundn't", 'Lightspeeed Partners', 'Benchpress Capital'];
const _pInfluencers = ['@CryptoChad', '@GrowthGoblin', '@SaaStradamus', '@TheHustleHusk', '@VCsBeLike', '@ToTheMoonBoi'];
const _pBuyers = ['MegaCorp', 'Globotech', 'Oracorp', 'Amazoom', 'Meta-Meta', 'Hooli'];
function _pri(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function _ppick(a) { return a[Math.floor(Math.random() * a.length)]; }

export const PROPOSALS = [
  (st) => { const vc = _ppick(_pVCs), amt = _pri(15, 45) * 1000, pct = _pri(6, 18); return {
    source: 'em', who: 'Investor Update', handle: vc, cta: 'Review proposal', accentLabel: 'TERM SHEET',
    pitch: `${vc} is "very excited" about your traction. They'll wire ${fmtMoney(amt)} for ${pct}% and a board seat they will never attend.`,
    accept: { cash: amt, hype: 6, outcome: `Took ${fmtMoney(amt)} from ${vc}. You now have a boss who DMs "quick q" at 2am.` },
    decline:{ hype: 3, outcome: `You ghosted ${vc}. Your cap table is grateful; your runway is not.` } }; },
  (st) => { const who = _ppick(_pInfluencers), reach = _pri(40, 900), cost = _pri(2, 6) * 1000; return {
    source: 'x', who: who, handle: `${reach}K followers`, cta: 'See the deal', accentLabel: 'COLLAB',
    pitch: `${who} will shill ${st.companyName || 'you'} to ${reach}K followers for ${fmtMoney(cost)} and "good vibes". 80% of the followers are also ${who}.`,
    accept: { hype: _pri(12, 18), cash: -cost, outcome: `${who} posted. 12 sales, 4,000 new haters, 1 vague legal threat. Hype is up.` },
    decline:{ outcome: `You passed on ${who}. They subtweet you within the hour. Engagement, technically.` } }; },
  (st) => { const buyer = _ppick(_pBuyers), amt = _pri(80, 260) * 1000; return {
    source: 'em', who: 'Acquisition Offer', handle: buyer, cta: 'Read the term sheet', accentLabel: 'BUYOUT',
    pitch: `${buyer} wants to acqui-hire you for ${fmtMoney(amt)}. Your product gets "sunset" in 90 days; your title becomes "Senior Vibe Engineer II".`,
    accept: { cash: amt, hype: -8, morale: -12, outcome: `Sold to ${buyer}. The team got hoodies. You got a 4-year vesting cliff.` },
    decline:{ hype: 10, outcome: `You told ${buyer} no. Independent, principled, and gloriously broke.` } }; },
  (st) => { const n = _pri(1, 4), settle = _pri(8, 20) * 1000; return {
    source: 'em', who: 'Legal Notice', handle: 'a firm with three surnames', cta: 'Open the letter', accentLabel: 'LAWSUIT',
    pitch: `A class action claims your app "emotionally damaged" ${n}M users. Settle quietly for ${fmtMoney(settle)}, or fight it loudly in the press.`,
    accept: { cash: -settle, outcome: `Settled. The NDA is airtight. The Reddit megathread is not.` },
    decline:{ hype: -_pri(4, 10), outcome: `You're fighting it. Discovery is about to become a YouTube documentary.` } }; },
  (st) => { const bots = _pri(1, 5), cost = _pri(10, 30) * 1000; return {
    source: 'x', who: 'A Man With A Van', handle: 'definitely-real-users.biz', cta: 'Inspect the offer', accentLabel: 'GROWTH',
    pitch: `Buy ${bots}M "users" for ${fmtMoney(cost)}. They are bots, but enthusiastic ones, and your charts will look absolutely incredible.`,
    accept: { hype: _pri(8, 16), cash: -cost, outcome: `Numbers go up! Engagement is now 8,000 accounts all named some variant of "Brad".` },
    decline:{ outcome: `You declined the bots. Your growth chart remains tragically, beautifully honest.` } }; },
  (st) => { const cost = _pri(1, 4) * 1000; return {
    source: 'pc', who: 'Podcast Invite', handle: 'All-In-On-Ourselves', cta: 'RSVP', accentLabel: 'PR',
    pitch: `Come on the pod to "tell your story" (read a 90-minute ad). Great exposure. Exposure, notably, does not pay the AWS bill.`,
    accept: { hype: _pri(6, 12), cash: -cost, outcome: `You went on. Said "at the end of the day" 31 times. Somehow, hype is up.` },
    decline:{ outcome: `You skipped the pod. They booked a competitor instead. That one stings.` } }; },
  // ---- shady crypto / scam offers (the peddler, now in your feed) ----
  (st) => { const up = _pri(20, 90) * 1000, debt = _pri(30, 70) * 1000, ticker = (st.companyName || 'COIN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'MOON'; return {
    source: 'x', who: '@CryptoChad', handle: 'founder, $' + ticker + ' (unaudited)', cta: 'Inspect the offer', accentLabel: 'DEFINITELY LEGAL',
    pitch: `Launch $${ticker} with us. We front ${fmtMoney(up)} in "liquidity" (a coin you cannot sell). When it moons you win. When it rugs, well, you were early.`,
    accept: { cash: up, debt, hype: _pri(6, 14), outcome: `$${ticker} is live. It moons for 4 minutes, then becomes a cautionary Netflix documentary.` },
    decline:{ hype: 2, outcome: `You passed on $${ticker}. It rugs 900 strangers instead. You sleep fine.` } }; },
  (st) => { const cost = _pri(6, 18) * 1000; return {
    source: 'x', who: '@NFTVisionary', handle: '5,000 apes strong', cta: 'See the drop', accentLabel: 'WEB3',
    pitch: `Mint a "utility" NFT collection tied to ${st.companyName || 'your app'}. Costs ${fmtMoney(cost)} in gas and dignity. The utility is that you own a JPEG of a sad monkey.`,
    accept: { cash: -cost, hype: _pri(8, 16), outcome: `The drop sold out in 3 minutes to 9 wallets, all yours. Floor price: emotional damage.` },
    decline:{ outcome: `You skipped the mint. The monkeys find a new founder by dinner.` } }; },
  (st) => { const up = _pri(35, 80) * 1000, debt = _pri(55, 120) * 1000; return {
    source: 'em', who: 'Sovereign Wealth "Fund"', handle: 'a prince, allegedly', cta: 'Open the wire details', accentLabel: 'LOAN SHARK',
    pitch: `A "family office" (one man, one cousin, one yacht) wires ${fmtMoney(up)} against "the upside." The term sheet is one paragraph and one threat.`,
    accept: { cash: up, debt, outcome: `The wire clears. So does your peace of mind. Dimitri now has "quick questions" at 2am.` },
    decline:{ hype: 3, outcome: `You declined the prince. He forwards the email to nine other founders within the hour.` } }; },
];

let _pidSeq = 0;
function _newPid() { return 'prop' + (++_pidSeq) + '_' + Math.floor(Math.random() * 1e4).toString(36); }
/** Roll a fresh proposal instance (with a unique pid). */
export function rollProposal(state) {
  const p = _ppick(PROPOSALS)(state);
  p.pid = _newPid();
  return p;
}

/* Shady personas that "slide into your DMs" with a peddler deal. */
const _pScammers = ['A Man With A Van', 'Dimitri (no last name)', '@GrowthGoblin', 'a guy named Sal',
  'The Liquidity Guy', 'a "growth agency"', 'a man with a clipboard', 'your cousin\'s crypto friend'];
/**
 * Turn a raw PEDDLER_DEAL into an openable feed proposal, so shady offers arrive
 * in the feed as a card you must CLICK to accept  no more interrupting modal.
 */
export function peddlerProposal(state, deal) {
  const shady   = /crypto|coin|token|SPAC|exchange|checkmark|bots|"users"/i.test(deal.text);
  const loan    = (deal.debt || 0) > 0;
  const p = {
    source: loan ? 'em' : 'x',
    who: loan ? 'A "family office"' : _ppick(_pScammers),
    handle: loan ? 'terms in Comic Sans' : (shady ? 'definitely-real.biz' : 'no questions asked'),
    cta: 'Inspect the offer', accentLabel: loan ? 'LOAN SHARK' : (shady ? 'DEFINITELY LEGAL' : 'SHADY DEAL'),
    pitch: deal.text,
    accept: { cash: deal.cash || 0, debt: deal.debt || 0, hype: deal.hype || 0,
      outcome: `Deal done: +${fmtMoney(deal.cash || 0)}${deal.debt ? `, +${fmtMoney(deal.debt)} debt` : ''}${deal.hype ? `, ${deal.hype > 0 ? '+' : ''}${deal.hype} Hype` : ''}. No refunds, no receipts.` },
    decline: { outcome: 'You leave the offer on read. The peddler shrugs and finds another founder.' },
    pid: _newPid(),
  };
  return p;
}
/** Apply a proposal's accept/decline effects. Returns the outcome line + deltas. */
export function actionResolveProposal(state, proposal, accept) {
  const eff = (accept ? proposal.accept : proposal.decline) || {};
  let spent = 0;
  if (eff.cash) { state.cash += eff.cash; if (eff.cash < 0) spent = -eff.cash; }
  if (eff.debt) state.debt = (state.debt || 0) + eff.debt;
  if (eff.hype) state.hype = clamp((state.hype || 0) + eff.hype, 0, CONFIG.HYPE_MAX);
  if (eff.morale != null) state.morale = clamp((state.morale ?? CONFIG.MORALE_START) + eff.morale, 0, 100);
  return { success: true, outcome: eff.outcome || '', cash: eff.cash || 0, hype: eff.hype || 0, spent };
}
