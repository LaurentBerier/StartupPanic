# STARTUP PANIC — Roadmap

Where the game goes next. The north star: **always engaging, funny, and surprising.** Every addition should give the player something to *react to or decide on*, land a joke, and vary run-to-run so no two playthroughs feel the same.

Status legend: ✅ done · 🔜 next · 🧪 idea/backlog

---

## ✅ Recently shipped
- **Three new live events** — **Talent Poaching** (counter-offer / promote / let them walk), **Viral Meme Moment** (lean in / drop merch / stay classy), and **Regulator Subpoena** (lawyer up / "consulting fee" / stonewall), all wired through the decision-modal harness with their own spawn timers and consequences.
- **Minigame juice pass** — Crunch Sprint got a combo meter + live S–D grade + momentum; Firefight got streak "OUT!" pops and a touch more grace; the VC pitch now has a **live "VC mood" meter** that reacts to every buzzword/claim.
- **Screen juice** — impact **screen shake** on big moments (launch, server loss, PR, crash, game over), floating **+$ / +Hype** gain feedback, and a **Hype-meter spike flash**.
- **Comedy expansion** — much larger banks across products, parodies, twists, audiences, PR disasters, peddlers, board dilemmas, the feed, founder tweets, and endings, so runs repeat far less.
- **Two-phase beginning flow** — a calm "stealth" garage (cheap burn, no chaos, no VCs, silent feed) that flips to "live" on the **first launch** (`state.live`), with a `goLiveBigBang()` moment. Huge before/after contrast.
- **Investment & ambition** — fund a project up front; ambitious projects cost more but launch more reliably. Launches roll success vs. a 35%-MRR flop.
- **Rebalance** — tuned burn / hype→MRR curve so one product is closer to break-even and growth is the path forward.

## 🔜 In progress — UI/UX rebrand
- Refresh the branding from the dark "obsidian/glitch" look to **"Playful SaaS Pop"** — a bright/light, rounded, saturated, sticker-y theme (a parody of a real startup's brand site). Token-driven via `css/style.css :root` + one trailing override block that flips the dark frosted surfaces to white; plus a lightened 3D scene backdrop for cohesion. *(Direction chosen; detailed step plan written.)*

---

## 🔜 Phase 0 — Early-game economy rework (next up)
**Intent:** "calm" pre-launch = **no chaos** (no disasters/feed/VCs), but **not free**. Cash should bleed steadily until the first launch, so stealth has a quiet ticking clock and a clear first objective. Preserves the calm→big-bang contrast; adds stakes to the calm. *Amends the shipped beginning flow.*

- **No server at start → buy one to build.** Start with **zero working servers** (refactor `rackDown[]` → a working-server *count*). `getTeamDevPower` returns 0 and `actionStartProduct` is blocked until you own ≥1 server (toast: *"Rack up a server before you can build."*). `actionBuyServer` buys the **first** server (`SERVER_COST`), not just fire replacements; `serverMult` already scales dev/MRR by count. First real spend of every run.
- **Cash bleeds until first launch.** `PRE_LAUNCH_BURN` $12 → **~$50/s** (gentle clock, ~10 min base runway on $30k). Stealth stays calm; launch is still the only pre-launch income and `state.live` raises burn to the live rate — now a jump *from a draining baseline*.
- **Every purchase visibly burns cash.** All buys already deduct; reinforce the *feel* with a floating **"–$X"** cash-hit + cash readout flash on every spend (server, desk, computer, hire, facility, research, product investment). Pre-launch cash is **strictly monotonic-down** — every purchase is a runway decision. *(Decision: one-time purchase cost only — no new ongoing infra upkeep beyond existing facility upkeep.)*
- **Tune the trio together:** `STARTING_CASH` · `PRE_LAUNCH_BURN (~$50)` · `SERVER_COST` · first-product `INVEST_*`, so a focused player can buy a server → fund + build a modest product → launch before the runway bites, while a dawdler runs dry. Verify headlessly (intended path survives; "do nothing" loses in a fair window).

---

## Build sequence
```
Phase 0  Early-game economy rework  (server gate · ~$50/s pre-launch bleed · spend-feel)
Phase A  Decision-modal harness + Launch Day minigame + Acquisition Offer + Board Dilemmas
Phase B  Market trends · product aging · competitor clone
Phase C  Firefight QTE · pitch objection round · decision-event pack
Phase D  Ethics/reputation meter · multiple win paths · replay · audio
```
Two reusable harnesses built in Phase A — a generic **decision modal** and a **status/buff system** folded into `getModifiers` — make Phases B–D mostly content, not engineering.

---

## The three big engagement pillars

### 1. Minigames — turn passive moments into active ones
Short, skill-or-decision interactions so the player is *doing*, not just watching meters.

- 🔜 **Launch Day** — replace the pure RNG flop roll with a quick "ship it" panel: spend limited polish points across **Reliability / Marketing / Legal** to nudge the odds. Keeps the investment mechanic, adds agency.
- 🔜 **Firefight QTE** — extinguishing a server fire becomes a tiny whack-a-mole of popping error bubbles against the clock (bigger reward for a clean clear).
- ✅ **Pitch mood meter** — a live VC "mood meter" reacts to each buzzword/claim (skeptical → FOMO). 🧪 still open: a timed **objection round** (a partner asks a brutal question; pick your deflection).
- 🧪 **Crunch rhythm** — a tap-to-code burst that adds dev progress fast but drains energy.
- 🧪 **Due diligence** — before a big round, a "find the skeleton" redaction/hidden-object beat in the data room.

### 2. Interactive events — forks, not just numbers
Events that demand a *choice* with real trade-offs (and shape the ending).

- 🔜 **Acquisition offer** — a megacorp offers to buy you mid-run. Take the exit now, or gamble on a bigger outcome. A genuine fork.
- 🔜 **Competitor clone** — a rival ships a knockoff of your hit; your MRR bleeds until you respond (out-hype / pivot / lawyer up).
- 🔜 **Board dilemmas** — periodic multiple-choice gut-punches (layoffs vs morale, ethics vs MRR) that branch toward different endings.
- ✅ **Talent poaching** — a competitor tries to hire your best employee; counter-offer (cost), promote (gamble), or let them walk.
- ✅ **Regulator / subpoena** — interactive: "consulting fee" (bribe), lawyer-up, or stonewall, each with consequences.
- ✅ **Viral meme moment** — your product becomes a meme; lean in (hype spike + PR-backfire risk), drop merch (cash), or stay classy.
- 🧪 **Ransomware / outage / influencer drama** — fast decisions under pressure.

### 3. More gameplay depth — systems that create stories
- 🔜 **Market trends** — a rotating "hot category" buffs matching products this week, rewarding players who read the market (and surfacing the existing buzzword/category data).
- 🔜 **Product aging** — shipped products slowly decay in MRR unless you ship updates; prevents idle, keeps the loop alive.
- 🧪 **Ethics/reputation meter** — surface the hidden `ethical`/`scam` product stats as a visible axis that gates deals and steers endings.
- 🧪 **Multiple win paths** — IPO vs Acquisition vs quiet Profitability vs Cult, each with its own ending card.
- 🧪 **Team chemistry** — rivalries, culture, and morale on top of raw energy.
- 🧪 **Replayability** — daily seeded challenge, achievements, difficulty/prestige modes.

---

## Always-on polish backlog (🧪)
- **Audio** — music + SFX (currently silent); the single biggest "juice" upgrade.
- **Onboarding** — a light guided first run that teaches the stealth→launch arc.
- **Launch cinematics** — make the big-bang moment even bigger.
- **Accessibility** — colorblind-safe palette pass, reduced-motion option, key remap.

---

## How to add content (quick reference)
- **New product flavor:** extend the banks in `gameLogic.js` (`PRODUCT_NOUNS`, `AUDIENCES`, `TWISTS`, `PLATFORM_PARODIES`).
- **New random event:** add a spawn timer + `events.push({type})` in `updateGame` (gate behind `state.live`), handle it in `processGameEvents` (main.js), and add a modal in `ui.js` if it needs a decision.
- **New facility/research:** add to `FACILITIES`/`RESEARCH` with an `eff` block — `getModifiers` picks it up automatically.
- **New funny text:** `viral.js` banks (feed, headlines, tweets, endings).

Keep balance knobs in `CONFIG` and verify logic headlessly in Node (see README).
