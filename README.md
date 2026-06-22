# STARTUP PANIC

A satirical **3D office-tycoon** built in vanilla JS + [three.js](https://threejs.org/). Found an absurd startup, ship cursed products (*Uber for Dread*, *DoorDash for Feelings*, *BlockchainForCats*), keep the hype up and the cash alive, and bluff your way up the funding ladder from Pre-Seed to a Series C exit — before the server fires, PR disasters, and burnout bury you.

It's one self-contained web game: open `index.html` (served), no build step.

---

## Run it

```bash
# Windows
serve.bat              # serves the repo root at http://localhost:8741

# or any static server
npx http-server . -p 8741
```

Then open the served URL. Requires a WebGL-capable browser.

---

## The core loop

```
  STEALTH (calm)                         LIVE (chaos)
  ───────────────         🚀            ─────────────────────────
  sit at desk            LAUNCH          burn jumps · press circles
  fund a product   ──►  (the big   ──►   disasters strike · VCs open
  build it solo          bang)           keep launching · raise rounds
                                         climb Pre-Seed → Series C → WIN
```

1. **BUILD** your first server, then walk the founder to their desk (click the floor) and **DEVELOP** a product.
2. Set its **AMBITION** — a bigger investment up front buys a bigger product *and* better odds it lands.
3. The team **builds** it (founder always works while seated; hires speed it up).
4. **LAUNCH** it. The first launch is the turning point of the whole run (see below).
5. Once live: **PITCH TO VC** with buzzwords to close funding rounds, **BUILD/RESEARCH** to grow, and survive the chaos.
6. Close **Series C** to win. Hit the debt floor, get cancelled, or burn the team out, and you get a flavored obituary.

### The two-phase arc — calm, then big bang
The opening is deliberately quiet so the launch lands like a punch.

| | **Stealth** (pre‑launch) | **Live** (after first launch) |
|---|---|---|
| Burn | `$50/s` (garage rent + ticking clock) | `$140/s` (AWS, real rent) |
| Disasters | none | fires, PR, peddlers, quirks all switch on |
| Hype | dormant (no decay) | decays ~1.9/s, drained by PR/burnout |
| VCs / funding | locked | every round opens (needs ≥1 shipped product) |
| The Feed | a near-silent trickle | a torrent |

A one-way `state.live` flag flips on the **first launch** (`actionLaunchProduct`), triggering the `goLiveBigBang()` moment: a takeover alert, a TechCrush chyron, a feed flurry, and confetti.

### Investment & ambition (risk/reward)
Starting a project costs cash **up front** (`computeInvestment`). A more ambitious (pricier) project is bigger *and* more likely to succeed at launch (`computeSuccessChance`):

| Ambition | ~Invest | ~Success | Feel |
|---|---|---|---|
| 0.5× | low | ~53% | scrappy gamble — often flops, barely sustains you |
| 1.0× | med | ~66% | median |
| 1.5× | high | ~79% | a solid bet |
| 2.0× | highest | ~92% | well-funded, safe, expensive |

Engineers on staff (+4% each, capped) and certain research/facilities raise the odds. A launch **rolls** success: a hit earns full MRR + a big hype burst; a **flop** still ships but earns only 35% MRR with a small hype bump and a mocking headline.

---

## Economy at a glance

- **Cash** — bankrupt below `CONFIG.DEBT_LIMIT` (`-$75k`); negative cash is survivable, briefly.
- **Hype** — multiplies live revenue and gates funding rounds. Revenue leans hard on it (`MRR = base × (FLOOR + SCALE·hype) × modifiers`), so a low-hype product can go cash-flow negative. Decays once live.
- **MRR** — only shipped products earn. One median product barely carries a small team; growth (more products, sustained hype) is the way up.
- **Burn** — base + salaries + facility upkeep + loan interest. Jumps at launch.

Most balance lives in `CONFIG` at the top of `js/gameLogic.js`. The highest-leverage knobs:
`STARTING_CASH`, `PRE_LAUNCH_BURN`, `BASE_BURN_PER_SEC`, `MRR_HYPE_FLOOR/SCALE`, the `INVEST_*` and `SUCCESS_*` families, and `FUNDING_ROUNDS`.

---

## Systems

- **Office** — desks (capacity), computers (no computer = half speed), office tiers for more slots.
- **Hiring** — candidates have a **role** (eng/design/growth) and a **personality** (10x Engineer combusts, Crypto Bro launches rogue tokens, Zen Master never burns out, …). Salaries burn per second.
- **Construction & Research** — `FACILITIES` (Tier‑1 devices → Tier‑3 rooms) and a `RESEARCH` tech tree; `getModifiers()` aggregates their effects into the economy. Research also unlocks weirder, higher-potential products.
- **Disasters (live only)** — server fires destroy racks (throttling dev + MRR until replaced), PR disasters drain hype, shady **peddlers** offer fast cash with nasty strings.
- **Comedy layer** (`js/viral.js`) — procedural company identity, founder-tweet popups, TechCrush/CNNN disaster chyrons, a live social/news feed, and weighted flavored endings with a shareable obituary card.

---

## Project layout

```
index.html            # markup: menus, HUD, modals, how-to-play
css/style.css         # all styling, driven by :root design tokens + accent classes
js/
  main.js             # bootstrap, game loop, event orchestration, input/raycast
  gameLogic.js        # GameState, CONFIG, economy, actions, updateGame  (the rules)
  ui.js               # HUD + all modals (develop, launch, hire, build, research, pitch…)
  viral.js            # comedy/identity/feed/endings layer
  gameObjects.js      # three.js entities (office, desks, racks, fires, facilities, avatar)
  scene.js            # renderer, camera, lights
  cameraControls.js   # orbit/zoom/WASD
  environment.js      # ambient particles/grid/orbs
  tween.js            # springs, tweens, clamp
  lib/three.min.js    # three.js
```

---

## Notes for contributors

- **No framework, no build.** ES modules loaded directly; `THREE` is global via `lib/three.min.js`.
- **Verification quirk:** `index.html` is a continuous WebGL + CSS animation loop, so static screenshots time out. Verify gameplay logic by running `js/gameLogic.js` headlessly in Node (it's mostly pure), and inspect runtime via the debug globals `window._gameState` / `window._gameScene` / `window._player`.
- See **[ROADMAP.md](ROADMAP.md)** for where this is going next.
