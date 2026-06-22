# Startup Panic Gameplay and Mechanics

This document describes the current gameplay design and rule set for Startup Panic. It is meant to be useful for design, balancing, implementation, and QA.

Startup Panic is a satirical 3D office tycoon about founding a cursed startup, shipping absurd products, managing cash and hype, surviving operational disasters, and climbing the funding ladder before the company collapses.

## Design Goals

- Make the player feel like a founder making constant trade-offs under pressure.
- Keep the early game calm, readable, and goal-driven.
- Make the first product launch feel like the moment the company enters the real world.
- Turn the midgame into a funny, escalating mess of money, hype, people, servers, and bad decisions.
- Reward growth through shipped products, team scaling, facilities, research, and funding.
- Avoid passive waiting by giving the player product, hiring, build, funding, and event decisions.

## Win and Loss Conditions

### Win Conditions

The player wins by reaching one of the successful exit states:

- Close the Series C funding round.
- Accept an acquisition offer when one appears.

The ending screen then summarizes the run and selects an ending flavor based on the company state, including valuation, hype, products shipped, team state, and product ethics/scam signals.

### Loss Condition

The player loses when cash falls below the debt floor.

- Debt limit: `-$75,000`.
- Cash can go negative temporarily.
- When cash reaches or passes the debt limit, the run ends.

## Main Player Loop

1. Name the startup from the start screen.
2. Enter the 3D office.
3. Buy or replace infrastructure as needed.
4. Start developing a product.
5. Keep the founder and team working.
6. Launch the product.
7. Earn MRR from launched products.
8. Use money to hire, build, research, and launch more products.
9. Use hype and shipped products to pitch funding rounds.
10. Survive disasters, employee burnout, board decisions, shady offers, and competitor pressure.
11. Reach Series C, accept acquisition, or go bankrupt.

## Game Phases

Startup Panic has two major phases: Stealth and Live.

### Phase 1: Stealth

Stealth is the pre-launch phase. The company exists, but the market has not noticed it yet.

Key rules:

- Starting cash: `$30,000`.
- Pre-launch burn: `$50/s`.
- The garage starts empty: no desk, no computer, and no online server.
- The first bought and placed desk becomes the founder workstation.
- Development requires founder desk + founder computer + at least one online server.
- VC pitching is locked before the first product launch.
- Major live events are disabled.
- The feed is quiet compared with the live phase.
- The main goal is to buy enough infrastructure, develop a first product, and launch before the runway disappears.

The intended feeling is quiet pressure. The player is not being attacked yet, but every purchase shortens runway.

### Phase 2: Live

Live begins on the first successful or failed product launch. The first launch flips `state.live` to true.

Key rules:

- Base burn jumps to `$125/s`.
- VC pitching unlocks.
- Hype begins decaying.
- Random live events begin spawning.
- PR disasters, server fires, peddlers, board dilemmas, employee quirks, and acquisition checks can appear.
- The social/news feed becomes active.
- Product MRR becomes the center of survival.

The intended feeling is a big bang: the company goes from quiet garage project to public mess.

## Controls

The exact UI may change, but the current control model is:

- WASD or arrow keys: move the founder through the office.
- Click floor: move/interact depending on target.
- Click desk/chair: sit or interact with work station.
- Mouse drag: rotate camera.
- Mouse wheel: zoom camera.
- Click fires: help extinguish server fires.
- Action bar buttons: open buy/place, hire, research, develop, launch, pitch, caffeine, pivot, loan, and product ops actions.

## Core Resources

### Cash

Cash is the primary survival resource.

Cash changes continuously:

```text
cash += netCashFlow * dt
```

The player spends cash on:

- Servers.
- Product investment.
- Desks.
- Computers.
- Hires.
- Facilities.
- Facility upgrades.
- Research.
- Caffeine.
- Pivots.
- Clone responses.
- Some board choices.

The player gains cash from:

- Product MRR over time.
- Funding rounds.
- Acquisition.
- Peddler deals.
- Bank loans.
- Some board choices.

### Burn

Burn is the outgoing cost per second.

```text
burnRate = baseBurn + salaries + facilityUpkeep + loanInterest
```

Base burn:

- Stealth: `$50/s`.
- Live: `$125/s`.

Salary burn comes from hired employees. Facility upkeep comes from built facilities. Loan interest comes from active bank loans.

### MRR

MRR is the revenue per second produced by launched products.

Despite the name, the current implementation treats MRR as a per-second cashflow value for gameplay speed.

```text
MRR = productRevenueSum * hypeMultiplier * modifierMultiplier * serverMultiplier
```

Product revenue only comes from shipped products. Products that are still in development do not earn.

### Net Cash Flow

Net cash flow is shown in the top-right bankroll HUD.

```text
netCashFlow = MRR - burnRate
```

If net cash flow is positive, the company is profitable and runway is effectively infinite. If it is negative, runway counts down based on current cash.

### Runway

Runway is the estimated time until bankruptcy at the current net cash flow.

```text
if netCashFlow >= 0:
  runway = infinity
else:
  runway = cash / -netCashFlow
```

When runway drops below `45s`, visual panic effects begin intensifying.

### Hype

Hype is a public attention meter from 0 to 100.

Hype affects:

- Product revenue.
- Funding round eligibility.
- Some event and ending flavor.

Hype multiplier:

```text
hypeMultiplier = 0.85 + 0.65 * (hype / 100)
```

At 0 hype, products still earn 85% of base revenue. At 100 hype, products earn 150% of base revenue.

Once live, hype decays:

```text
hypeDeltaPerSecond = -1.9
```

Additional hype drain comes from:

- Burned-out employees.
- Active PR disasters.

Hype can increase from:

- Launches.
- Product updates.
- Funding wins.
- Some board decisions.
- Some peddler deals.
- Firefighting bonuses.
- Employee personalities.
- Facilities and research.

### Valuation

Valuation is a derived number used for pitch flavor and acquisition logic.

```text
valuation = totalRaised * 3 + MRR * 1200 + hype * 25000
```

Valuation rises with capital raised, revenue, and hype.

## Office and Infrastructure

### Desks

Desks create employee capacity.

- Starting desk slots: 8.
- Desk cost: `$3,000` (cheap furniture - a seat / hiring capacity).
- The garage starts with 0 placed desks.
- The first placed desk is reserved for the founder.
- Employees require a free desk.
- Employee hiring requires an additional free desk beyond the founder workstation.

### Computers

Computers restore full productivity at a desk.

- Computer cost: `$5,000` (a real dev workstation).
- A computer can only be bought after at least one desk exists.
- The first computer should go on the founder workstation so development can begin.
- Desk without computer productivity multiplier: `0.5`.
- Desk with computer productivity multiplier: `1.0`.

### Servers

Servers are required for product development and revenue.

- Server rack count: 2.
- Server cost: `$7,000` (real infrastructure - the priciest of the buy trio).
- The company starts with all racks offline.
- Buying a server brings one offline rack online.
- Server fires can destroy online racks.

Server multipliers:

```text
0 online servers:
  dev multiplier = 0
  revenue multiplier = 0

1 online server:
  dev multiplier = 0.75
  revenue multiplier = 1.0

2 online servers:
  dev multiplier = 1.15
  revenue multiplier = 1.18
```

Strategic impact:

- First server unlocks product development.
- Second server improves development and revenue.
- Destroyed servers must be replaced or the business slows down.

### Office Expansion

Office expansion increases desk capacity.

Current tiers:

- Garage: 8 slots.
- Real Office: 12 slots, cost `$30,000`.
- Whole Floor: 16 slots, cost `$100,000`.

## Team System

The team consists of the founder and hired employees.

### Founder

The founder contributes development only while seated at the founder desk.

```text
founderDev = 1.5
```

The founder is intentionally valuable early because the first product can be built without hiring.

### Employees

Employees have:

- Name.
- Role.
- Personality.
- Salary per second.
- Desk assignment.
- Energy.
- Burnout state.
- At-desk state.

Employees contribute only when:

- They are at their desk.
- They are not burned out.
- Their energy is at least `0.18`.
- A working server exists.

### Roles

Roles define baseline output and salary range.

| Role | Dev | Hype Aura | Salary Range |
| --- | ---: | ---: | ---: |
| Engineer | 1.2 | 0 | `$45-70/s` |
| Designer | 0.8 | 0.15 | `$35-55/s` |
| Growth Hacker | 0.35 | 0.45 | `$30-50/s` |

Engineers are best for shipping. Designers add some passive hype. Growth hackers add more hype but less development speed.

### Personalities

Personalities modify employees and create random quirk events.

| Personality | Main Mechanical Identity |
| --- | --- |
| Co-Founder | Stable, small hype aura, not hireable as a normal candidate. |
| 10X Engineer | Huge dev speed, burns energy very quickly. |
| Zen Master | Slow but almost never burns out. |
| Crypto Bro | Pitch quality bonus, may trigger PR/token chaos. |
| Caffeine Gremlin | Strong dev, burns hot, coffee is extra effective. |
| LinkedIn Influencer | Low dev, high hype aura. |
| Drama Magnet | Strong output, can drain team energy. |
| Quiet Genius | High dev, moderate energy use, ships quietly. |

### Energy and Burnout

Employee energy decays over time.

```text
energy -= 0.016 * personalityEnergyMult * energyDecayModifier * dt
```

Rules:

- Below `0.18`, an employee is too tired to work.
- At 0, an employee burns out.
- Burned-out employees stop contributing.
- Each burned-out employee drains hype by `1.2/s` while live.

### Caffeine

Caffeine is an emergency recovery action.

- Cost: `$400`.
- Cooldown: `10s`.
- Restore amount: `0.65`, modified by personality.
- Clears burnout for affected employees.

## Development System

The player can start one active product at a time.

Starting a product:

- Requires at least one online server.
- Costs an upfront investment.
- Creates an active product with progress from 0 to required dev points.

Development progress:

```text
progress += teamDevPower * dt
```

Team dev power:

```text
teamDevPower =
  (founder contribution + employee contribution)
  * serverDevMultiplier
  * facilityDevModifiers
  * researchDevModifiers
```

If a server fire is active, team dev power is 0.

While a product is developing, the player can change the team tactic:

- Balanced: normal speed, low bug growth, small quality gain.
- Fast: higher speed, lower quality, more bugs, morale drain.
- Polish: slower speed, higher quality, fewer bugs, slight morale recovery.

The player can also run a Crunch Sprint minigame. Good timing adds a large progress burst with fewer bugs. Bad timing still adds progress, but hurts quality, morale, and employee energy.

When progress reaches the required dev points, the product becomes ready to launch. The player must launch it manually.

## Product System

Products are intentionally absurd startup ideas. They have:

- Name.
- Description.
- Dev points.
- Base revenue.
- Hype value.
- Absurdity.
- Category.
- Optional ethics/scam signals.

Products can come from:

- Hand-authored classic ideas.
- Procedural word banks.
- Platform parody generation.
- Higher-potential pools unlocked by research.

### Product Categories

Categories are used by market trends and product flavor:

- AI.
- Crypto / Web3.
- Social.
- On-Demand.
- Subscription.
- Wellness.
- Other.

### Product Potential Scaling

Product ideas are tuned by:

```text
tunedMRR = baseIdeaMRR * 1.6 + 120 * tierLift
```

Research can increase the product tier and create larger opportunities.

### Product Freshness

After launch, products age while the company is live.

```text
freshness -= 0.004 * dt
freshness cannot go below 0.5
```

Freshness affects product revenue. A neglected product still earns at least 50% of its original value.

### Product Ops Dashboard

Shipped products are now active systems, not passive MRR printers. Each live product has:

- Tech debt, which rises over time and lowers MRR.
- Bugs, which lower MRR and increase outage risk.
- Quality, which improves launch odds and live revenue.
- Pricing, which raises revenue per user but can slowly reduce the user base.
- User base, which responds over time to pricing and quality.
- Roadmap queue, where features add MRR or hype but can add burn and bugs.
- Outage timer, during which the product earns zero MRR.

Product Ops actions:

- Refactor Sprint: costs cash, lowers tech debt and bugs, improves quality and freshness.
- Queue Feature: pays upfront to add a roadmap item. The team completes queued features over time.
- Version Push: costs cash and rolls risk. A good push adds MRR and hype; a bad push causes an outage, bugs, and tech debt.
- Pricing Dial: adjusts price between discount growth and premium extraction.

### Market Trends

The logic supports rotating market trends.

- Trend interval: about `40-70s`.
- Matching category revenue bonus: `+40%`.

When a product matches the current trend, its effective MRR is multiplied by `1.4`.

Implementation note: trend logic exists in `gameLogic.js`. Event surfacing should be verified in `main.js` and the HUD before relying on this as fully player-facing.

### Competitor Clones

The logic supports competitor clone events.

- Clone interval: about `80-130s`.
- Cloned product MRR multiplier: `0.6`.
- Clone duration if ignored: `50s`.

Player responses:

- Out-hype them: costs `$9,000`, adds hype.
- Lawyer up: costs `$14,000`, halved with Legal Department.
- Pivot/differentiate: costs `$7,000`, adds smaller hype.

Implementation note: clone logic exists in `gameLogic.js`. Event handling and UI surfacing should be verified before treating it as fully complete.

### Product Updates

The logic supports shipping updates across the live portfolio.

Update rules:

- Cooldown: `16s`.
- Cost: `$2,500 + $1,500 * shippedProductCount`.
- Restores freshness on shipped products.
- Adds `+6` hype.

Implementation note: `actionShipUpdate` exists and the action button exists in markup. Wiring should be verified in `main.js`.

## Product Investment

Starting a product costs cash upfront.

Investment formula:

```text
investment = 900 + devPoints * 70 + mrr * 3.5
```

Ambition modifies the product before investment is shown:

```text
displayedMRR *= ambition
displayedHype *= ambition
displayedDevPoints *= ambition
```

Ambition range:

- Minimum: `0.5x`.
- Normal: `1.0x`.
- Maximum: `2.0x`.

Design intent:

- Low ambition is cheaper but riskier and smaller.
- High ambition costs more but is more likely to land and can generate stronger revenue.

## Launch System

Launching is a major commitment. A product must be fully developed before it can launch.

### First Launch

The first launch:

- Ships the first product.
- Switches the company from Stealth to Live.
- Unlocks VC pitching.
- Starts live event timers.
- Starts hype decay.
- Triggers the big public reveal moment.

### Launch Day Polish

Before launch, the player spends 5 polish points across:

- Reliability.
- Marketing.
- Legal.

Effects:

```text
Reliability:
  +3.5 percentage points success chance per point

Marketing:
  +3 hype per point

Legal:
  +1.8 percentage points success chance per point
  +0.04 flop MRR multiplier per point
```

### Launch Success Chance

Base formula:

```text
successChance =
  0.66
  + (ambition - 1.0) * 0.26
  + engineerBonus
  + facilitySuccessBonus
  + researchSuccessBonus
  + launchPolishBonus
```

Engineer bonus:

```text
engineerBonus = min(0.12, activeEngineerCount * 0.04)
```

Chance clamp:

```text
successChance = clamp(successChance, 0.35, 0.95)
```

### Hit Launch

If launch succeeds:

- Product ships.
- Product keeps full intended MRR.
- Product adds a large hype burst.
- Product is added to shipped products.
- Product starts with full freshness.

### Flop Launch

If launch fails:

- Product still ships.
- Product earns reduced MRR.
- Product adds a smaller hype burst.
- The feed/headline tone mocks the launch.

Flop revenue:

```text
flopMRRMultiplier = min(0.75, 0.58 + legalPoints * 0.04)
```

Flop hype:

```text
flopHypeMultiplier = 0.4
```

## Funding and VC Pitching

Funding is locked until at least one product has launched.

Funding rounds:

| Round | Amount | Required Products | Required Hype |
| --- | ---: | ---: | ---: |
| Pre-Seed | `$50,000` | 1 | 25 |
| Seed | `$150,000` | 2 | 35 |
| Series A | `$400,000` | 3 | 50 |
| Series B | `$1,000,000` | 4 | 60 |
| Series C | `$2,500,000` | 6 | 75 |

Pitching:

- Cooldown: `22s`.
- The player chooses 3 buzzwords.
- Buzzwords have quality multipliers and categories.
- Diversity improves the pitch.
- Legendary/high-value buzzwords can add a bonus.
- Employee personalities and facilities can improve quality.
- Product absurdity can improve quality.

Pitch quality components:

```text
pitchQuality =
  averageBuzzwordMultiplier
  * diversityBonus
  * legendaryBonus
  + personalityPitchBonuses
  + absurdityBonus
  + facilityPitchBonus
```

Diversity bonus:

- 3 categories: `1.35x`.
- 2 categories: `1.15x`.
- 1 category: no diversity bonus.

Round closes if:

```text
requirementsMet && pitchQuality >= 1.05
```

If the round closes:

```text
funding = roundAmount * min(1.5, 0.7 + pitchQuality * 0.3)
```

Effects:

- Cash increases by funding amount.
- Total raised increases.
- Hype increases by 18.
- Round index advances.
- Closing Series C wins the game.

If the round fails:

- The company may receive small bridge money.
- Hype increases by 4.
- The pitch result explains the failure.

## Construction and Facilities

Facilities are optional office objects that cost cash and add upkeep. Their effects are aggregated into global modifiers.

### Tier 1 Facilities

| Facility | Cost | Upkeep | Effect |
| --- | ---: | ---: | --- |
| Espresso Bar | `$9,000` | `$6/s` | Team burns out 30% slower. |
| GPU Cluster | `$18,000` | `$14/s` | +35% team dev speed. |
| Neon Brand Wall | `$12,000` | `$8/s` | +0.8 passive hype/s. |
| Growth Dashboard | `$15,000` | `$10/s` | +18% MRR. |
| Fire Suppression | `$11,000` | `$7/s` | Fire damage halved, fires 40% rarer. |

### Tier 2 Facilities

Tier 2 rooms require the appropriate research unlock.

| Facility | Cost | Upkeep | Effect |
| --- | ---: | ---: | --- |
| Server Room | `$45,000` | `$22/s` | +25% dev speed, fire damage -40%. |
| Break Room | `$38,000` | `$18/s` | Burnout -45%, +0.3 hype/s. |
| War Room | `$42,000` | `$20/s` | +0.4 pitch quality. |
| Cafeteria | `$40,000` | `$19/s` | Burnout -35%, +8% MRR. |

### Tier 3 Facilities

Tier 3 rooms require the later facility research unlock.

| Facility | Cost | Upkeep | Effect |
| --- | ---: | ---: | --- |
| R&D Lab | `$75,000` | `$34/s` | +30% dev speed, +12% MRR, +8 percentage points launch success. |
| Legal Department | `$65,000` | `$30/s` | PR disasters 55% less severe. |
| Private Data Center | `$95,000` | `$42/s` | +40% dev speed, fires 60% rarer. |

### Facility Upgrades

Facilities can be upgraded up to level 3.

- Max level: 3.
- Upgrades strengthen effects and increase upkeep.
- Upgrade cost and exact scaling are implemented in `gameLogic.js`.

## Research

Research costs cash and permanently unlocks or improves systems.

| Research | Tier | Cost | Requirement | Effect |
| --- | ---: | ---: | --- | --- |
| Bribe the Inspector | 1 | `$14,000` | None | Unlock Tier 2 rooms. |
| Monetize Your Soul | 1 | `$16,000` | None | +20% MRR. |
| Replace IDEs w/ Vibes | 1 | `$18,000` | None | +15% dev speed. |
| Ship First, Test Never | 2 | `$70,000` | Replace IDEs w/ Vibes | +25% dev speed, +6 launch hype, +5 percentage points launch success. |
| Manufacture FOMO | 2 | `$80,000` | Monetize Your Soul | +30% MRR, +0.4 hype/s. |
| Annex the Parking Lot | 2 | `$90,000` | Bribe the Inspector | Unlock Tier 3 facilities. |
| Outsource Everything | 3 | `$220,000` | Ship First, Test Never | +40% dev speed. |
| Summon Infinite Servers | 3 | `$260,000` | Manufacture FOMO | +50% MRR, fires 50% rarer. |
| Pivot to Everything | 4 | `$850,000` | Outsource Everything and Summon Infinite Servers | +60% dev speed, +50% MRR, +1.0 hype/s. |

Research also increases product potential by unlocking more ambitious product pools.

## Live Events

Live events begin only after the first product launch.

### Server Fires

Server fires target online racks.

Rules:

- Spawn interval: about `42-75s`, modified by fire prevention effects.
- Duration: `13s`.
- Team dev power is 0 while a server fire is active.
- If unresolved, the target rack can be destroyed.
- Destroyed racks reduce development and revenue until replaced.

Player interaction:

- Click/interact with fire to extinguish.
- Extinguishing quickly can award extra hype.

### PR Disasters

PR disasters drain hype while active.

Rules:

- Spawn interval: about `30-55s`.
- Duration: about `15-30s`.
- Hype drain: `3.0/s * severity`.
- Legal Department reduces severity.

### Employee Quirks

Quirks are personality-driven events.

Examples:

- Crypto Bro may create PR chaos.
- Drama Magnet may drain team energy.
- Quiet Genius may quietly ship progress.
- Influencer or co-founder personalities may create viral hype.

Quirk interval:

```text
16-30s
```

### Peddlers

Peddlers offer fast money with questionable trade-offs.

Peddler interval:

```text
45-80s
```

Possible effects:

- Instant cash.
- Added debt.
- Hype gain.
- Hype loss.

Peddlers are optional. Declining has no major penalty.

### Board Dilemmas

Board dilemmas are decision events with cash, hype, team, or PR consequences.

Board interval:

```text
58-92s
```

Current examples:

- Layoffs: take cash but lose hype and hurt team energy, or protect the team at a cash cost.
- Privacy/data: sell data for cash and hype with PR risk, or pay for a cleaner path.
- Quality: patch properly at cost, or call it beta and risk reputational damage.

### Talent Poaching

A rival tries to hire your most valuable employee.

- Spawn interval: about `70-120s` (live; needs at least one non-burned-out employee).
- Counter the offer: pay a cash counter (scaled to salary); they stay and take a permanent 12% raise.
- Promote, no raise: free, but a gamble (~62% they stay flattered, otherwise they leave).
- Let them walk: lose the employee and free their desk; small morale hit.

### Viral Meme Moment

A shipped product randomly becomes a meme.

- Spawn interval: about `58-98s` (live; needs at least one shipped product).
- Lean in: `+22` hype, but a ~40% chance the bit curdles into a PR disaster.
- Drop merch: instant cash (scaled to MRR + hype) and `+8` hype.
- Stay classy: `+6` hype and a small morale lift.

### Regulator Subpoena

Once the company matters, a regulator comes knocking.

- Spawn interval: about `88-150s` (live; needs at least 2 shipped products and valuation >= `$120,000`).
- Lawyer up: cash cost scaled to valuation; safe (a Legal Department makes it land harder).
- "Consulting fee" (bribe): bigger cash cost; usually works, but ~28% chance it leaks into a severe PR disaster.
- Stonewall: free, but ~55% chance it spawns a PR disaster instead.

### Acquisition Offers

Acquisition offers can appear once the company is live and valuable enough.

Current rough requirements:

- At least 3 shipped products.
- Valuation at least `$180,000`.
- Acquisition timer has elapsed.

Player choices:

- Accept: win immediately via acquisition.
- Decline: gain hype and continue toward a bigger outcome.

### Market Trends, Clones, and Updates

The logic layer contains market trends, competitor clones, and product updates. These mechanics should be considered part of the intended gameplay, but their current UI/event wiring should be verified before QA treats them as fully surfaced.

## Debt and Emergency Money

### Bank Loans

Bank loans provide cash now in exchange for ongoing interest.

| Loan | Cash | Interest |
| --- | ---: | ---: |
| Microloan | `$20,000` | `$28/s` |
| Bridge Loan | `$60,000` | `$95/s` |
| Venture Debt | `$150,000` | `$260/s` |

Debt principal is gradually repaid from positive net cash flow. The implementation repays debt from part of surplus cash flow, reducing loan pressure over time.

### Peddler Debt

Some peddler deals add debt-like obligations or immediate risk. These are intentionally worse and funnier than normal financing.

## Pivot

Pivot is a recovery action.

- Cost: `$8,000`.
- Cooldown: `45s`.
- Clears or mitigates certain bad states.
- Used as a thematic reset button when the current direction has become cursed.

Pivot is also used as a response path for competitor clone pressure.

## UI and HUD Mechanics

### Onboarding

The empty-garage start uses a small HUD checklist until the first product is started. It guides the player through:

- Buy and place the founder desk.
- Add a computer.
- Buy and place a server.
- Sit at the founder desk.
- Develop the first product.

The checklist is state-driven, so steps mark complete only when the actual game state satisfies them. It hides once the player starts the first product.

### Top Bankroll HUD

The top-right money display should show:

- Total cash.
- Net cash flow per second.
- Runway.

The value should fluctuate continuously because cash updates every frame based on net cash flow.

### Hype HUD

The hype HUD shows current hype from 0 to 100. It should make launch spikes, decay, PR drain, and burnout effects visible.

### Funding HUD

Funding HUD should show:

- Current round.
- Progress toward product and hype requirements.
- Valuation.

### Product Progress Card

The development progress card should show:

- Active product name.
- Progress percent.
- Team speed.
- Blockers, such as no server or active fire.

### Employee Chips

Employee chips should show:

- Name.
- Role/personality.
- Energy.
- Burnout state.
- Whether the employee is actively contributing.

### Feed and Alerts

The feed provides comedy, world response, and useful event context.

Alerts are split between:

- Central alerts for important warnings and errors.
- Toasts for smaller info and success messages.
- Chyrons for major satirical news moments.

## Balance Constants Quick Reference

### Economy

```text
STARTING_CASH = 30000
PRE_LAUNCH_BURN = 50
BASE_BURN_PER_SEC = 125
MRR_HYPE_FLOOR = 0.85
MRR_HYPE_SCALE = 0.65
DEBT_LIMIT = -75000
```

### Product and Launch

```text
PRODUCT_MRR_MULT = 1.6
PRODUCT_MRR_BONUS = 120
INVEST_BASE = 900
INVEST_PER_DEVPOINT = 70
INVEST_PER_MRR = 3.5
SUCCESS_BASE = 0.66
SUCCESS_AMBITION_SLOPE = 0.26
SUCCESS_PER_ENG = 0.04
SUCCESS_ENG_CAP = 0.12
SUCCESS_MIN = 0.35
SUCCESS_MAX = 0.95
FLOP_MRR_MULT = 0.58
FLOP_HYPE_MULT = 0.4
LAUNCH_POLISH_POINTS = 5
```

### Hype

```text
HYPE_MAX = 100
HYPE_DECAY_PER_SEC = 1.9
HYPE_LAUNCH_BURST = 18
```

### Team

```text
FOUNDER_DEV = 1.5
ENERGY_DECAY_PER_SEC = 0.016
WORK_ENERGY_MIN = 0.18
BURNOUT_HYPE_DRAIN = 1.2
CAFFEINE_COST = 400
CAFFEINE_RESTORE = 0.65
```

### Infrastructure

```text
DESK_SLOTS = 8
DESK_COST = 3000
COMPUTER_COST = 5000
NO_COMPUTER_PENALTY = 0.5
SERVER_COST = 7000
NUM_RACKS = 2
FACILITY_MAX_LEVEL = 3
```

### Events

```text
FIRE_DURATION = 13
FIRE_SPAWN_INTERVAL = 42-75
PR_DURATION = 15-30
PR_SPAWN_INTERVAL = 30-55
QUIRK_INTERVAL = 16-30
PEDDLER_INTERVAL = 45-80
BOARD_INTERVAL = 58-92
ACQUISITION_CHECK = 95-145
CLONE_INTERVAL = 80-130
POACH_INTERVAL = 70-120
MEME_INTERVAL = 58-98
REGULATOR_INTERVAL = 88-150
```

### Aging, Trends, and Clone Pressure

```text
TREND_INTERVAL = 40-70
TREND_MRR_BONUS = 0.4
AGING_PER_SEC = 0.004
FRESH_FLOOR = 0.5
UPDATE_COST_BASE = 2500
UPDATE_COST_PER_PRODUCT = 1500
UPDATE_HYPE = 6
CLONE_MRR_MULT = 0.6
CLONE_RIDE_DURATION = 50
```

## Implementation Map

Core files:

- `index.html`: menu, HUD, modals, action buttons, start/end screens.
- `css/style.css`: visual styling and design tokens.
- `js/main.js`: boot, game loop, UI event handlers, 3D interaction, event orchestration.
- `js/gameLogic.js`: main gameplay state, economy, actions, constants, and update rules.
- `js/ui.js`: HUD rendering and modal rendering.
- `js/viral.js`: company identity, feed, headlines, ending flavor, share cards.
- `js/gameObjects.js`: 3D office objects, desks, servers, employees, fires, facilities.
- `js/scene.js`: renderer, scene, camera, lighting.
- `js/cameraControls.js`: movement, camera orbit, and zoom.
- `js/environment.js`: ambient scene effects.
- `js/tween.js`: tweening, springs, and utility math.

## Current Implementation Notes

These are important for QA and future development:

- The intended game arc is Stealth -> First Launch -> Live Chaos -> Funding/Exit.
- The economy is now continuous: cash should visibly fluctuate from net cash flow.
- Products can generate enough MRR to matter, especially with hype and upgrades.
- Servers now matter earlier because no server means no development.
- Market trends, product aging, product updates, and competitor clone systems exist in the logic layer.
- Trend/clone/update surfacing should be verified in `main.js` before balancing around them.
- The README and roadmap may contain encoding-damaged characters; this document is intentionally ASCII-only.

## QA Checklist

Use this list when testing a run:

1. Start screen allows company name editing.
2. Random name button changes the company name.
3. Launch Company starts the game.
4. Cash begins at `$30,000`.
5. Cash ticks down in stealth at about `$50/s`.
6. Product development is blocked with no online server.
7. Buying a server costs `$5,000` and unlocks development.
8. Starting a product deducts investment immediately.
9. Founder contributes only while seated.
10. Product progress reaches ready state.
11. Launch Product opens Launch Day polish choices.
12. First launch flips the game live.
13. MRR appears after product launch.
14. Top-right cash fluctuates continuously from net cash flow.
15. Pitch to VC is locked before first launch and available after.
16. Funding requirements match the current round.
17. Hype decays after going live.
18. Server fires pause development and can destroy racks.
19. PR disasters drain hype while active.
20. Employees lose energy and can burn out.
21. Caffeine restores exhausted or burned-out employees.
22. Build, hire, research, loan, and pivot actions spend or change resources correctly.
23. Bankruptcy triggers at or below `-$75,000`.
24. Series C triggers a win.
25. Acquisition acceptance triggers a win.
