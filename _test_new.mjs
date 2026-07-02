// Headless verification of the new roadmap systems (run with: node _test_new.mjs)
import {
  GameState, CONFIG, updateGame, getMRR, productCategory, getProductFreshness, getAvgFreshness,
  actionShipUpdate, buildCompetitorClone, actionResolveClone, actionExtinguishFire,
  productEffectiveMRR,
} from './js/gameLogic.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL:', msg); } };
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// Build a live game with two shipped products of known categories.
function liveGame() {
  const s = new GameState();
  s.live = true;
  s.hype = 100; // hypeMult = FLOOR + SCALE = 1.3 -> isolate; we mostly compare ratios
  s.rackDown = [false, false]; // both servers online so serverMult = 1
  // Neutral product-ops fields so productEffectiveMRR's quality/debt/bug/price
  // multipliers are all exactly 1 (quality 70 -> 1 + (70-70)/150 = 1.0), which
  // isolates the trend/clone math this suite is actually checking.
  const mk = (name, desc, mrr) => ({ idea: { name, desc, mrr, hype: 10, absurdity: 1 }, freshness: 1, shelfIdx: 0, quality: 70, bugs: 0, techDebt: 0, price: 1, userBase: 1, featureMrrBonus: 0, outageTimer: 0 });
  s.shippedProducts = [
    mk('BlockchainForCats', 'Decentralized litter-box token protocol', 300),
    mk('Goat Yoga On-Demand', 'A goat is dispatched in 30 minutes', 200),
  ];
  s.shippedProducts[1].shelfIdx = 1;
  return s;
}

console.log('— Market trends —');
{
  ok(productCategory({ name: 'BlockchainForCats', desc: 'token' }) === 'crypto', 'crypto classified');
  ok(productCategory({ name: 'Goat Yoga On-Demand', desc: 'dispatched in 30 minutes' }) === 'delivery', 'delivery classified');
  ok(productCategory({ name: 'ToastGPT', desc: 'a smart toaster' }) === 'ai', 'ai classified');

  const s = liveGame();
  const baseMRR = getMRR(s);
  s.marketTrend = { id: 'crypto', label: 'Crypto', icon: '🪙', mrrBonus: CONFIG.TREND_MRR_BONUS };
  const trendMRR = getMRR(s);
  ok(trendMRR > baseMRR, 'crypto trend raises MRR while a crypto product is live');
  // only the crypto product (300) should get +40%; expected per-product base sum = 300*1.4 + 200 = 620 vs 500
  const effCrypto = productEffectiveMRR(s, s.shippedProducts[0]);
  ok(approx(effCrypto, 300 * 1.4), `crypto product effective base = ${effCrypto} (want 420)`);
  const effGoat = productEffectiveMRR(s, s.shippedProducts[1]);
  ok(approx(effGoat, 200), `non-matching product unaffected = ${effGoat} (want 200)`);
}

console.log('— Product aging —');
{
  const s = liveGame();
  const before = getMRR(s);
  // simulate 60s of aging in 0.1s steps
  for (let i = 0; i < 600; i++) updateGame(s, 0.1);
  const aged = getAvgFreshness(s);
  ok(aged < 1 && aged >= CONFIG.FRESH_FLOOR, `freshness decayed to ${aged.toFixed(3)} (floor ${CONFIG.FRESH_FLOOR})`);
  ok(getMRR(s) < before, 'aged MRR is lower than fresh MRR');
  // freshness must never drop below the floor even after a long neglect
  for (let i = 0; i < 4000; i++) updateGame(s, 0.1);
  ok(getProductFreshness(s.shippedProducts[0]) >= CONFIG.FRESH_FLOOR - 1e-9, 'freshness clamps at floor');

  // ship-update restores
  s.cash = 100000; s.cooldowns.update = 0;
  const r = actionShipUpdate(s);
  ok(r.success && getAvgFreshness(s) === 1, 'actionShipUpdate refreshes all products');
  ok(r.cost === CONFIG.UPDATE_COST_BASE + CONFIG.UPDATE_COST_PER_PRODUCT * 2, `update cost scales with count = ${r.cost}`);
  const r2 = actionShipUpdate(s);
  ok(!r2.success, 'updating when fresh + on cooldown is rejected');
}

console.log('— Competitor clone —');
{
  const s = liveGame();
  const clone = buildCompetitorClone(s);
  ok(clone && clone.product === s.shippedProducts[0], 'clone targets the best-earning product');
  s.competitorClone = clone;
  const eff = productEffectiveMRR(s, s.shippedProducts[0]);
  ok(approx(eff, 300 * CONFIG.CLONE_MRR_MULT), `cloned product MRR bleeds to ${eff} (want ${300 * CONFIG.CLONE_MRR_MULT})`);
  ok(approx(productEffectiveMRR(s, s.shippedProducts[1]), 200), 'non-cloned product unaffected by clone');

  // ride it out -> clone fades after its timer
  s.competitorClone.timer = 0.05;
  const evs = updateGame(s, 0.1);
  ok(s.competitorClone === null && evs.some(e => e.type === 'clone_faded'), 'ignored clone fades after timer');

  // lawyer up clears it for cash (and is cheaper with a Legal Dept)
  s.competitorClone = buildCompetitorClone(s);
  s.cash = 100000;
  const noLegal = actionResolveClone(s, 'lawyer');
  ok(noLegal.success && noLegal.cost === CONFIG.CLONE_LAWYER_COST && s.competitorClone === null, 'lawyer-up clears clone at full price');

  s.competitorClone = buildCompetitorClone(s);
  s.facilities = ['legal'];
  const withLegal = actionResolveClone(s, 'lawyer');
  ok(withLegal.cost === Math.round(CONFIG.CLONE_LAWYER_COST * 0.5), `legal dept halves cost = ${withLegal.cost}`);

  // pivot refreshes the cloned product
  s.competitorClone = buildCompetitorClone(s);
  s.competitorClone.product.freshness = 0.6;
  const piv = actionResolveClone(s, 'pivot');
  ok(piv.success && s.shippedProducts[0].freshness === 1, 'pivot response ships a fresh release');
}

console.log('— Firefight QTE quality —');
{
  const mkFire = () => ({ s: Object.assign(new GameState(), { hype: 50, fires: [{ id: 1, timer: CONFIG.FIRE_DURATION, maxTimer: CONFIG.FIRE_DURATION }] }) });
  const a = mkFire().s; const ra = actionExtinguishFire(a, 1, 0);
  const b = mkFire().s; const rb = actionExtinguishFire(b, 1, 1);
  ok(ra.success && rb.success, 'extinguish succeeds at any quality');
  ok(rb.hypeBonus > ra.hypeBonus, `clean clear pays more hype (${rb.hypeBonus} > ${ra.hypeBonus})`);
  ok(rb.clean === true && ra.clean === false, 'clean flag tracks a full clear');
  // default quality (back-compat) still works
  const c = mkFire().s; ok(actionExtinguishFire(c, 1).success, 'default quality still extinguishes');
}

console.log('— Early-game gate sanity (Phase 0 unchanged) —');
{
  const s = new GameState();
  ok(s.cooldowns.update === 0, 'new update cooldown exists on fresh state');
  ok(s.marketTrend === null && s.competitorClone === null, 'live systems dormant in stealth');
  // stealth burn still bleeds; no trend/clone events fire pre-launch
  const evs = updateGame(s, 1);
  ok(!evs.some(e => e.type === 'market_trend' || e.type === 'competitor_clone'), 'no live events in stealth');
  ok(s.cash < CONFIG.STARTING_CASH, 'cash bleeds in stealth (pre-launch burn)');
}

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
