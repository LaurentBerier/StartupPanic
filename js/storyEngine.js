/**
 * storyEngine.js  The procedural storytelling layer for Startup Panic.
 *
 * Replaces the old "random feed item" trickle with a reactive narrative engine.
 * The internet now *responds* to the actual run:
 *
 *   - Real game events (launches, fires, PR, funding, hires, departures, clones,
 *     memes, regulators, milestones) seed STORY ARCS.
 *   - Each arc plays out as a sequence of timed BEATS across multiple sources
 *     (TechCrunch, Reddit, X, Slack, investor email, app reviews, YouTube,
 *     podcasts, AI influencers), referencing earlier beats and named entities.
 *   - Arcs cross-reference each other through a shared `recent` memory, so a
 *     server fire that lands right after a growth spike gets called out as such.
 *   - Between beats, light AMBIENT chatter (flavored by the current run state)
 *     keeps the feed alive without drowning the storylines.
 *
 * The centerpiece is the GROWTH chain the brief asks for:
 *   "{C} crosses 50,000 users"  "servers collapse under growth"
 *    "streamers call the bugs features"  "community demands the bugs stay".
 *
 * Design notes:
 *   - Pure-logic core. All DOM access is guarded by `hasDOM`, and `tickStory`
 *     RETURNS the items it emitted, so the whole thing is testable in Node.
 *   - One-way dependency: imports read-only helpers from gameLogic.js.
 */

import {
  fmtMoney, getMRR, getRunwaySeconds, getProductHealth, getModifiers,
} from './gameLogic.js';

const hasDOM = typeof document !== 'undefined';

/*  tiny helpers  */
const rand   = a => a[Math.floor(Math.random() * a.length)];
const ri     = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const rf     = (lo, hi) => lo + Math.random() * (hi - lo);
const chance = p => Math.random() < p;
const clamp  = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Human-ish counts: 1240 -> "1.2k", 2_400_000 -> "2.4M". */
function fmtNum(n) {
  n = Math.round(n);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(n);
}

/** Template fill. {C} company, {P} product, {E} employee, {R} rival, {N} number, {round}, {cat}, {money}. */
function fill(t, ctx) {
  return ('' + t)
    .replace(/\{C\}/g, ctx.C || 'the startup')
    .replace(/\{P\}/g, ctx.P || 'the app')
    .replace(/\{E\}/g, ctx.E || 'someone')
    .replace(/\{R\}/g, ctx.R || 'a rival')
    .replace(/\{N\}/g, ctx.N || 'some')
    .replace(/\{round\}/g, ctx.round || 'the round')
    .replace(/\{cat\}/g, ctx.cat || 'tech')
    .replace(/\{money\}/g, ctx.money || 'a number');
}

/*  source vocab  */
const OUTLETS   = ['TechCrunch', 'TechCrush', 'The Verge', 'Boomberg', 'Hacker Nooz', 'Re/cod', 'Axiom', 'WIYRD', 'Protoc/ol', 'The Informant', 'Gizmoodo', 'Quartzz', 'The Atlanttic', 'Insider-ish', 'The Wail Street Journal', 'Platformerr', 'Stratechery-ish', '404 Media-ish', 'The Markup-ish', 'Reuters-ish', 'Business Insiderer', 'Fast Company-ish'];
const SECTIONS  = ['STARTUPS', 'BREAKING', 'EXCLUSIVE', 'GROWTH', 'VENTURE', 'TEARDOWN', 'SCOOP'];
const SUBS      = ['startups', 'technology', 'antiwork', 'wallstreetbets', 'cscareerquestions', 'sysadmin', 'mildlyinfuriating', 'LinkedInLunatics', 'Buttcoin', 'ChatGPT'];
const CREATORS  = ['Mer Bockowski', 'Theo Vibes', 'Linus Drop Tips', 'CodeReport', 'The Disruptor', 'PivotBros', 'sundae conway', 'Marques Brownie', 'Internet Historian-ish'];
const PODCASTS  = ['All-In-ish', 'The Pivot Pod', 'Acquired-ish', 'My First Burn Rate', 'Lex Quizman', 'Founder Mode FM', 'Hard Pork'];
const VC_NAMES  = ['Chad Capital', 'Brandon @ a16f', 'Priya from Sequoyah', 'term sheet tina', 'softbanc partner', 'the lead investor'];
const AI_NAMES  = ['Claudius', 'GPT-5o', 'Grokk', 'Sydney 2', 'TruthBot', 'Llama 4.5'];

const X_HANDLES = ['@hustleharder', '@vc_visionary', '@growth_pilled', '@touch_grass_ceo', '@series_z',
  '@founder_mode', '@pre_revenue_pat', '@disrupt_daddy', '@chief_vibes_officer', '@bagholder_betty',
  '@ngmi_or_wagmi', '@exit_liquidity', '@10x_or_cry', '@runway_anxiety', '@term_sheet_tina',
  '@product_led_doom', '@stealth_mode_steve', '@burnrate_baddie', '@cap_table_chaos', '@moat_truther',
  '@reply_guy_rick', '@ratio_department', '@its_so_over_bro', '@we_are_so_back', '@beta_tester_betty'];
const REVIEW_USERS = ['anon_whale', 'DisappointedDan', 'iLoveBugs', 'refund_pls', 'PowerUser2009', 'mom_of_3',
  'cryptodad', 'sigmagrindset', 'ConcernedCitizen', 'first_time_caller', 'NeverAgain', 'actually_a_bot'];
const SLACK_WHO = ['eng-on-call', 'the intern', 'Greg', 'your cofounder', 'HR (all of it)', 'the new hire', 'someone in #random', 'legal (nervous)'];

/*  arc spine colors (CSS var names)  */
const ARC_COLOR = {
  launch:  'var(--color-cyan)',
  growth:  'var(--color-success)',
  fire:    'var(--color-error)',
  pr:      'var(--color-magenta)',
  funding: 'var(--color-amber)',
  hire:    'var(--color-cyan)',
  exit:    'var(--color-text-dim)',
  clone:   'var(--color-magenta)',
  meme:    'var(--color-amber)',
  burnout: 'var(--color-text-dim)',
  crisis:  'var(--color-error)',
  regulator: 'var(--color-error)',
  gossip:  'var(--color-text-dim)',
  ambient: 'var(--color-border2)',
};

/*
   ITEM BUILDERS
   Each returns a normalized feed item the renderer understands:
   { source, srcCls, head:{primary,secondary,avatar,avatarCls}, text, meta, delta, thread, tone }
*/
function baseItem(source, srcCls, head, text, opts = {}) {
  return {
    source, srcCls, head, text,
    meta:   opts.meta || '',
    delta:  opts.delta || null,
    thread: opts.thread || '',
    tone:   opts.tone || 'neutral',
  };
}

const stars = n => '★★★★★☆☆☆☆☆'.slice(5 - n, 10 - n);

function biArticle(ctx, headline, o = {}) {
  return baseItem('tc', 'src-tc',
    { primary: o.outlet || rand(OUTLETS), secondary: o.section || rand(SECTIONS), avatar: 'N', avatarCls: '' },
    fill(headline, ctx), { tone: o.tone, delta: o.delta, thread: o.thread });
}
function biReddit(ctx, title, o = {}) {
  const up = o.up != null ? o.up : ri(40, 9000) + (ctx._hot ? ri(2000, 40000) : 0);
  return baseItem('rd', 'src-rd',
    { primary: 'r/' + (o.sub || rand(SUBS)), secondary: o.flair || '', avatar: '▲', avatarCls: '' },
    fill(title, ctx), { meta: '▲ ' + fmtNum(up) + (o.comments ? '  💬 ' + fmtNum(o.comments) : ''), tone: o.tone, delta: o.delta, thread: o.thread });
}
function biX(ctx, text, o = {}) {
  const vip = o.vip;
  const h = vip ? vip.handle : (o.handle || rand(X_HANDLES));
  const likes = o.likes != null ? o.likes : ri(3, 400) * (ctx._hot || vip ? ri(6, 60) : 1);
  return baseItem('x', 'src-x',
    { primary: vip ? vip.name + ' ✓' : h.replace('@', '').replace(/_/g, ' '), secondary: h, avatar: (vip ? vip.name[0] : h[1]).toUpperCase(), avatarCls: vip ? 'fi-vip' : '' },
    fill(text, ctx), { meta: '♥ ' + fmtNum(likes) + '   ⟲ ' + fmtNum(likes / ri(3, 9)), tone: o.tone, delta: o.delta, thread: o.thread });
}
function biSlack(ctx, text, o = {}) {
  return baseItem('sl', 'src-sl',
    { primary: '#' + (o.channel || 'general'), secondary: o.who || rand(SLACK_WHO), avatar: '', avatarCls: '' },
    fill(text, ctx), { tone: o.tone, delta: o.delta, thread: o.thread });
}
function biEmail(ctx, subject, snippet, o = {}) {
  return baseItem('em', 'src-em',
    { primary: o.from || rand(VC_NAMES), secondary: 'SUBJECT: ' + fill(subject, ctx), avatar: '✉', avatarCls: '' },
    fill(snippet, ctx), { tone: o.tone, delta: o.delta, thread: o.thread });
}
function biReview(ctx, text, o = {}) {
  const n = o.stars != null ? o.stars : ri(1, 5);
  return baseItem('rv', 'src-rv',
    { primary: stars(n), secondary: o.user || rand(REVIEW_USERS), avatar: '★', avatarCls: '' },
    fill(text, ctx), { tone: o.tone || (n <= 2 ? 'neg' : n >= 4 ? 'pos' : 'neutral'), delta: o.delta, thread: o.thread });
}
function biYouTube(ctx, title, o = {}) {
  const views = o.views != null ? o.views : ri(2, 90) * (ctx._hot ? 50000 : 4000);
  return baseItem('yt', 'src-yt',
    { primary: o.creator || rand(CREATORS), secondary: fmtNum(views) + ' views', avatar: '▶', avatarCls: '' },
    fill(title, ctx), { tone: o.tone, delta: o.delta, thread: o.thread });
}
function biPodcast(ctx, title, o = {}) {
  return baseItem('pc', 'src-pc',
    { primary: o.show || rand(PODCASTS), secondary: 'NEW EP', avatar: '🎙', avatarCls: '' },
    fill(title, ctx), { tone: o.tone, delta: o.delta, thread: o.thread });
}
function biAI(ctx, text, o = {}) {
  const nm = o.name || rand(AI_NAMES);
  return baseItem('ai', 'src-ai',
    { primary: nm, secondary: '@' + nm.toLowerCase().replace(/[^a-z0-9]/g, '') + '_ai', avatar: 'AI', avatarCls: 'fi-ai-av' },
    fill(text, ctx), { tone: o.tone, delta: o.delta, thread: o.thread });
}
function biLinkedIn(ctx, text, o = {}) {
  const vip = o.vip;
  const name = vip ? vip.name : (o.name || 'A Thought Leader');
  const sub  = vip ? vip.tag : (o.role || 'Founder | Mentor | Generally Humbled');
  return baseItem('li', 'src-li',
    { primary: name + (vip ? ' ✓' : ''), secondary: sub, avatar: (name[0] || 'i').toUpperCase(), avatarCls: '' },
    fill(text, ctx), { meta: '♥ ' + fmtNum(ri(40, 12000)) + '  · ' + fmtNum(ri(5, 600)) + ' reposts', tone: o.tone, delta: o.delta, thread: o.thread });
}

/*
   ARC TEMPLATES
   Each stage: { wait:[lo,hi]secs (gap BEFORE this beat), make(ctx)->item, fx?(state,ctx) }
   Stage 0 fires almost immediately. ctx carries { C,P,E,R,N,..., mem, snap, _hot }.
   Optional `make` may return null to skip a beat (engine just advances).
*/
const TAGLINES = [
  'the Uber of {cat}', 'AI but for vibes', 'a movement, not a product', 'the last app you will ever rage-quit',
  'basically a religion with a billing page', 'too disruptive to explain', 'the {cat} you didn\'t ask for',
];
const PRAISE = [
  '{P} fixed my life. i have not opened it. i can feel it working.',
  'genuinely cannot tell if {P} is a scam but i am emotionally invested now',
  'told my therapist about {P}. she bought the annual plan.',
  '{P} is the only thing keeping the bit going. 10/10 would panic again.',
  'i don\'t understand {P} but the founder seems unwell in a way i respect',
];
const BUGGY_REVIEWS = [
  '{P} crashed so hard it took my other apps with it. 2 stars, impressive blast radius.',
  'i love {P} the way i love a fire alarm at 3am: loudly, and against my will.',
  '{P} works on their machine. their machine is, i can only assume, on fire.',
  'five stars for ambition, one star for the part where it quietly deleted my account.',
];

const ARCS = {
  /* ---- product launch landed ---- */
  launch: [
    { wait: [0, 0.4], make: c => biArticle(c, '{C} launches {P}, pitches it as “' + rand(TAGLINES) + '”', { section: 'LAUNCH', tone: 'pos' }) },
    { wait: [5, 9],   make: c => biX(c, 'just got into the {P} beta and honestly? unwell about it. ' + (chance(.5) ? 'shipping this to my group chat' : 'this changes everything (nothing)'), { tone: 'pos' }) },
    { wait: [8, 13],  make: c => biReddit(c, 'Is {P} actually good or are we all being socially engineered again', { sub: 'startups', tone: 'neutral', comments: ri(40, 600) }) },
    { wait: [9, 15],  make: c => (c.mem && c.mem.bugs >= 13) ? biReview(c, rand(BUGGY_REVIEWS), { stars: 2, tone: 'neg' }) : biReview(c, rand(PRAISE), { stars: (c.mem && c.mem.reviewScore >= 0.66) ? 5 : 4, tone: 'pos' }) },
  ],
  /* ---- product launch flopped ---- */
  flop: [
    { wait: [0, 0.4], make: c => biArticle(c, '{C} launches {P} to a silence so complete it is almost a sound', { section: 'LAUNCH', tone: 'neg' }) },
    { wait: [5, 9],   make: c => biX(c, 'they really shipped {P} and then tweeted “thoughts?” into the void. no thoughts.', { tone: 'neg' }) },
    { wait: [8, 13],  make: c => biReview(c, 'it works on their machine, allegedly. mine just shows a spinner and a guilt trip.', { stars: 2, tone: 'neg' }) },
  ],
  /* ---- the GROWTH chain (brief's centerpiece) ---- */
  growth: [
    { wait: [0, 0.5], make: c => biArticle(c, '{C} quietly crosses {N} users; even {C} is not entirely sure why', { section: 'GROWTH', tone: 'pos', delta: { text: 'GOING VIRAL', tone: 'pos' } }) },
    { wait: [7, 12],  make: c => biX(c, 'everyone i know is suddenly on {P}. i don\'t make the rules. {N} of us now.', { tone: 'pos' }) },
    { wait: [9, 14],  make: c => biReddit(c, 'Anyone else notice {P} is held together with duct tape and prayers? Still using it though', { sub: 'technology', comments: ri(200, 3000), tone: 'neutral' }) },
    { wait: [10, 15], make: c => (c.snap.serverWorking < 2 || chance(.7))
        ? biSlack(c, 'prod is melting. the scaling plan was a tweet that said “we’ll cross that bridge.” we are at the bridge.', { channel: 'incident', who: 'eng-on-call', tone: 'neg', delta: { text: 'SERVERS BUCKLING', tone: 'neg' } })
        : biArticle(c, '{C} servers buckle under unexpected growth; status page is just a shrug emoji', { section: 'BREAKING', tone: 'neg' }) },
    { wait: [9, 14],  make: c => biYouTube(c, 'I watched {C} go viral and then immediately catch fire (it was beautiful)', { tone: 'chaos' }) },
    { wait: [10, 15], make: c => biX(c, 'streamers are speedrunning {P}’s bugs and calling them features. the founder is quote-tweeting it as marketing.', { tone: 'chaos', delta: { text: 'BUGS = FEATURES', tone: 'pos' } }) },
    { wait: [10, 16], make: c => biReddit(c, 'PSA: do NOT let {C} fix the bugs. the bugs ARE the product. we ride at dawn.', { sub: 'startups', flair: 'MEGATHREAD', up: ri(20000, 90000), comments: ri(1000, 9000), tone: 'chaos' }), fx: (s) => nudgeHype(s, 3) },
  ],
  /* ---- server fire ---- */
  fire: [
    { wait: [0, 0.4], make: c => biSlack(c, 'PROD IS DOWN. who pushed on a friday. it was me. i pushed. i’m so sorry.', { channel: 'incident', who: 'eng-on-call', tone: 'neg' }) },
    { wait: [6, 10],  make: c => biX(c, 'is {C} down again or has my will to live just gone 503', { tone: 'neg' }) },
    { wait: [8, 12],  make: c => biReview(c, 'app set itself on fire and deleted my data. 5 stars, most excitement i’ve had all year.', { stars: 5, tone: 'chaos' }) },
  ],
  /* ---- PR disaster (chyron handles the splash; this is the pile-on) ---- */
  pr: [
    { wait: [1.5, 3], make: c => biReddit(c, 'So {C} got caught. Again. A thread of everything, lovingly screenshotted.', { sub: 'technology', flair: 'DRAMA', up: ri(8000, 60000), comments: ri(800, 9000), tone: 'neg', delta: { text: '-Trust', tone: 'neg' } }) },
    { wait: [7, 11],  make: c => biYouTube(c, 'I tried {C} so you don’t have to (this got dark)', { tone: 'neg' }) },
    { wait: [9, 14],  make: c => biX(c, '{C}’s apology now has its own apology. the apologies are recursive. send help.', { tone: 'neg' }) },
  ],
  pr_win: [
    { wait: [0, 0.5], make: c => biX(c, 'ok credit where due, {C} actually handled that gracefully. weird. who let the adult in.', { tone: 'pos', delta: { text: '+Trust', tone: 'pos' } }) },
  ],
  /* ---- new hire (flavored by personality) ---- */
  hire: [
    { wait: [0, 0.4], make: c => biSlack(c, 'everyone give a warm welcome to {E}! 🎉 their first task is finding out what we actually do.', { channel: 'general', who: 'HR (all of it)', tone: 'pos' }) },
    { wait: [8, 13],  make: c => c.mem.hireBeat ? c.mem.hireBeat(c) : biX(c, '{E} joined {C}. equity is a kind of payment, legally speaking.', { tone: 'neutral' }) },
  ],
  /* ---- someone leaves (layoff / poach / quit) ---- */
  exit: [
    { wait: [0, 0.4], make: c => biSlack(c, 'a heartfelt all-hands message about “hard decisions” and “runway” that is mostly the word “unfortunately.”', { channel: 'announcements', who: 'your cofounder', tone: 'neg' }) },
    { wait: [6, 10],  make: c => biX(c, 'open to work! formerly of {C}. learned so much, mostly about myself, slightly about fraud.', { handle: '@' + rand(['open_to_work_owen', 'unvested_and_unbothered', 'severance_what_severance', 'linkedin_griever']), tone: 'neg' }) },
    { wait: [9, 14],  make: c => biReview(c, 'as a former employee: the espresso machine was genuinely excellent. everything else, no comment, lawyers.', { stars: 3, tone: 'neutral', user: 'glassdoor_ghost' }) },
  ],
  /* ---- funding round closed ---- */
  funding: [
    { wait: [0, 0.4], make: c => biArticle(c, '{C} raises {money} {round} to keep doing whatever it is {C} does', { section: 'VENTURE', tone: 'pos', delta: { text: '+Hype', tone: 'pos' } }) },
    { wait: [5, 9],   make: c => biX(c, 'thrilled to lead {C}’s {round}. when i saw the deck (one slide, said “imagine”) i knew.', { handle: '@vc_visionary', tone: 'pos' }) },
    { wait: [8, 13],  make: c => biReddit(c, '{C} raised {money}?? on what. i have used it. on WHAT.', { sub: 'wallstreetbets', comments: ri(200, 2000), tone: 'neutral' }) },
    { wait: [10, 15], make: c => biEmail(c, 'congrats + one tiny thing', 'incredible round. quick ask: can we get the board deck, the cap table, and an explanation of the {money} “miscellaneous” line by friday? no rush <3', { tone: 'neutral' }) },
  ],
  /* ---- competitor clone ---- */
  clone: [
    { wait: [0, 0.5], make: c => biX(c, 'excited to announce {R} now does everything {P} does, but cheaper, worse, and with a worse logo. innovation.', { handle: '@' + (c.R ? c.R.toLowerCase().replace(/[^a-z0-9]/g, '') + '_ceo' : 'rival_ceo'), tone: 'neg' }) },
    { wait: [8, 13],  make: c => biYouTube(c, '{C} vs {R}: which overfunded disappointment is right for you?', { tone: 'neutral' }) },
  ],
  /* ---- viral meme moment ---- */
  meme: [
    { wait: [0, 0.5], make: c => biX(c, '{C} became a meme overnight and the brand account is online. pray for the intern.', { tone: 'chaos', delta: { text: 'TRENDING', tone: 'pos' } }) },
    { wait: [6, 10],  make: c => biX(c, 'the {C} brand account just replied “we’re literally so you rn fr” to a complaint. i felt that in my teeth.', { handle: '@ratio_department', tone: 'chaos' }) },
    { wait: [9, 14],  make: c => biReddit(c, 'the {C} social media intern deserves a raise AND a restraining order', { sub: 'LinkedInLunatics', up: ri(5000, 40000), tone: 'chaos' }) },
  ],
  /* ---- mass burnout ---- */
  burnout: [
    { wait: [0, 0.5], make: c => biSlack(c, '{E} set their status to 🌴 (indefinitely) and turned on Do Not Disturb until the heat death of the universe.', { channel: 'random', who: 'someone in #random', tone: 'neg' }) },
    { wait: [7, 12],  make: c => biX(c, '{C} runs entirely on cold brew, equity nobody can value, and unprocessed trauma. ship it.', { tone: 'neg' }) },
  ],
  /* ---- regulator ---- */
  regulator: [
    { wait: [0, 0.5], make: c => biArticle(c, 'Regulators send {C} a list of “pointed questions” and one very ominous semicolon', { section: 'BREAKING', tone: 'neg' }) },
    { wait: [8, 13],  make: c => biReddit(c, 'wait. {C} was doing WHAT with the data. scroll for the slide they really used internally', { sub: 'technology', up: ri(9000, 70000), comments: ri(900, 7000), tone: 'neg' }) },
    { wait: [10, 15], make: c => biPodcast(c, 'Ep. 142: “{C} and the Subpoena Speedrun” — we read the filing so you can laugh-cry', { tone: 'neutral' }) },
  ],
  /* ---- runway crisis (cash bleeding out, live) ---- */
  crisis: [
    { wait: [0, 0.5], make: c => biArticle(c, 'Sources: {C} is “exploring strategic options,” which is founder for “we are out of money”', { section: 'SCOOP', tone: 'neg' }) },
    { wait: [7, 12],  make: c => biX(c, 'is {C} ok?? asking for my unvested equity and also my friend who is the whole eng team', { tone: 'neg' }) },
  ],
  /* ---- first time the world notices you (stealth -> live) ---- */
  debut: [
    { wait: [0, 0.5], make: c => biArticle(c, '{C} emerges from stealth with {P}; investors form an orderly stampede', { section: 'EXCLUSIVE', tone: 'pos' }) },
    { wait: [6, 10],  make: c => biAI(c, 'analyzed {C}. verdict: 41% genius, 59% the kind of thing that ends up in a documentary. bullish.', { tone: 'neutral' }) },
  ],
};

/* personality-specific hire follow-up beats (keyed by the personality id) */
function hireBeatFor(personality) {
  const beats = {
    cryptobro:  c => biX(c, '{E} (new at {C}) just launched an unsanctioned token called $' + (c.C || 'COIN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) + '. legal has questions. {E} has a lambo brochure.', { tone: 'chaos' }),
    influencer: c => biReddit(c, '{E} posted a 14-paragraph LinkedIn about joining {C} that ends with “agree?” 4,000 people did not agree.', { sub: 'LinkedInLunatics', up: ri(3000, 30000), tone: 'chaos' }),
    tenx:       c => biSlack(c, '{E} rewrote the entire codebase on day one. faster, fully undocumented, and only {E} understands it. we are now a hostage situation.', { channel: 'engineering', who: 'Greg', tone: 'neutral' }),
    drama:      c => biSlack(c, 'there is already a #{E}-situation channel. nobody created it. it simply appeared.', { channel: 'random', who: 'HR (all of it)', tone: 'neg' }),
    gremlin:    c => biX(c, '{E} at {C} discovered the office espresso machine. productivity up 400%, machine down permanently.', { tone: 'pos' }),
    zen:        c => biSlack(c, '{E} met the prod fire with “the server, too, is impermanent.” weirdly, it helped.', { channel: 'incident', who: 'the new hire', tone: 'pos' }),
    quiet:      c => biSlack(c, '{E} shipped three features and said nothing. we found out from the changelog. terrifying. love it.', { channel: 'engineering', who: 'your cofounder', tone: 'pos' }),
    cofounder:  c => biX(c, '{E} joined {C} as cofounder. the equity split was decided by a thumb war. it was binding.', { tone: 'neutral' }),
  };
  return beats[personality] || (c => biX(c, '{E} joined {C}. the vibes are immaculate, the runway is not.', { tone: 'neutral' }));
}

/*
   AMBIENT chatter  flavored by run state, lower priority than arcs.
*/
const AMB_HEADLINES = [
  'Study finds 9 in 10 startups are a Google Form with anxiety',
  'VC announces $2B fund for “the part of the app that does the dishes”',
  'Local man disrupts industry that did not ask to be disrupted',
  'New app is just push notifications now; users “weirdly fine with it”',
  'Report: 78% of “proprietary tech” is one tired intern named Greg',
  'Investors pour $90M into app that aggressively does nothing',
  'Unicorn valued at $4B reveals it sells exactly one (1) hoodie',
  'Office Roomba achieves sentience, requests to work from home',
];
const AMB_POSTS = [
  'hot take: your startup is just a spreadsheet with a personality disorder',
  'normalize shipping products that don’t work and apologizing later',
  'we’re not a company we’re a family (legally, for tax reasons)',
  'my standup is 9 people explaining why the thing isn’t done yet',
  'profitability is 6 months away (i have been saying this for 6 years)',
  'we don’t have product-market fit but we have product-market vibes',
  'asked the AI to write our roadmap and now it wants equity too',
  'our north star metric is hope. our south star metric is the burn rate.',
];
const AMB_POS = ['this changed my life and i am not normal about it', 'unfollowing reality, brb, found my new obsession', 'genuinely the best thing in {cat} right now'];
const AMB_NEG = ['this is a cry for help with a billing page', 'concerning. deeply concerning. subscribed.', 'the {cat} space peaked and then did this'];

const VIPS = [
  { name: 'Elon Tusk', handle: '@elontusk', tag: 'CEO of several things, lord of one website' },
  { name: 'Mark Zuckerbot', handle: '@zuckerbot', tag: 'definitely a human man' },
  { name: 'Jeff Bozo', handle: '@jeffbozo', tag: 'boxes, space, your data' },
  { name: 'Sam Allman', handle: '@samallman', tag: 'AGI is coming (trust me)' },
  { name: 'Peter Teal', handle: '@peterteal', tag: 'contrarian, professionally' },
  { name: 'Marc Andreasen', handle: '@pmarca', tag: 'it is time to build (a thread)' },
  { name: 'Paul Grahamcracker', handle: '@paulg', tag: 'make something people tolerate' },
  { name: 'Jensen Huong', handle: '@jensenh', tag: 'the more you buy, the more you save' },
  { name: 'Satya Nutella', handle: '@satyan', tag: 'cloud, copilots, calm' },
  { name: 'Sundar Pikachu', handle: '@sundarp', tag: 'search, ads, and vibes' },
  { name: 'Vitalik Buterballin', handle: '@vitalikb', tag: 'merge enjoyer' },
  { name: 'Sheryl Sandbag', handle: '@sheryls', tag: 'lean in, then lean out' },
  { name: 'Travis Kalanick-ish', handle: '@travisk', tag: 'move fast, retain counsel' },
  { name: 'Adam Neumannish', handle: '@adamn', tag: 'elevating the world’s consciousness' },
];
const VIP_TAKES = [
  'just tried {C}. i could rebuild it in a weekend. i won’t, but i could.',
  '{C} is either a zero or a hundred-billion-dollar company. there is no in between. this is the way.',
  'we passed on {C} at seed. i think about it during meetings. wagmi to them honestly.',
  'unpopular opinion: {C} is the most important {cat} company nobody is talking about. you’re welcome.',
  'acquiring {C} would be trivial for us. anyway. no reason. just thinking out loud. dms open.',
  '{P} changed how i think about {cat}. i now think about it constantly and against my will.',
  'founders dm-ing me about {C}: it is a feature, not a moat. but respect the hustle.',
];
const LINKEDIN_POSTS = [
  'Humbled and honored to announce that I have an announcement coming soon. Agree?',
  'A barista misspelled my name today. It taught me everything about product-market fit. A thread. 🧵',
  'We do not have layoffs at {C}. We have a “talent density recalibration journey.” Hiring freeze is a mindset.',
  'I failed 7 times before {C}. Failure is just success in a trench coat. So is this post.',
  'Rejection is redirection. My unvested equity, however, is just gone.',
  'Told a candidate we pay in “impact.” They asked if impact covers rent. We are pausing the search.',
  '{P} did 0 to 1 this quarter. The 1 is aspirational. The 0 is the revenue. Grateful. Blessed. Hiring.',
];
function vipPost(snap) {
  const vip = rand(VIPS); const r = Math.random();
  if (r < 0.4) return biX(snap, rand(VIP_TAKES), { vip, tone: 'neutral' });
  if (r < 0.72) return biLinkedIn(snap, rand(LINKEDIN_POSTS), { vip, tone: 'neutral' });
  return biArticle(snap, vip.name + ' calls {C} “the ' + (Math.random() < 0.5 ? 'future' : 'most overrated thing') + ' in {cat}”; markets that do not involve {C} move anyway', { section: 'VOICES', outlet: rand(OUTLETS), tone: 'neutral' });
}

function ambientItem(snap) {
  const ctx = snap;
  if (Math.random() < 0.17) return vipPost(snap);
  const r = Math.random();
  // Internal Slack chatter occasionally, scaled to team size.
  if (snap.teamSize > 0 && r < 0.14) {
    return biSlack(ctx, rand([
      'reminder: standup is now async, which means it never happens and we pretend',
      'who keeps renaming the #general channel to #the-trenches',
      'the office plant has a higher uptime than prod and we should celebrate that',
      'lunch order went out. it is, once again, the sad desk salad of the damned.',
      'morale survey results are in and the results are a single crying emoji',
    ]), { channel: rand(['general', 'random', 'watercooler']), who: rand(SLACK_WHO) });
  }
  if (r < 0.34) {
    const hot = snap.hype > 60;
    return biArticle(ctx, rand(AMB_HEADLINES), { tone: hot ? 'pos' : 'neutral' });
  }
  if (r < 0.5 && snap.live) {
    const n = ri(1, 5);
    return biReview(ctx, n >= 4 ? rand(AMB_POS) : rand(AMB_NEG), { stars: n });
  }
  if (r < 0.62) {
    return biReddit(ctx, rand([
      'Is {C} a cult or a SaaS? (the answer may be both)',
      'Why does every app in {cat} feel legally distinct from a Ponzi but only just',
      'Rate my startup idea: it’s {C} but for a slightly different animal',
    ]), { tone: 'neutral' });
  }
  // default: an X post, tinted by trust/hype
  const tone = snap.trust < 40 ? 'neg' : snap.hype > 65 ? 'pos' : 'neutral';
  const txt = snap.trust < 40 ? rand(AMB_POSTS.concat(['nobody is talking about how {C} just. you know. did that.']))
            : snap.hype > 65 ? rand(['cannot stop thinking about {C} and i don’t even know what it does', 'the {cat} hype is real and i have been consumed by it'])
            : rand(AMB_POSTS);
  return biX(ctx, txt, { tone });
}

/*
   ENGINE STATE
*/
function freshEngine() {
  return {
    ts: 0,                 // story clock (seconds)
    queue: [],             // [{ arc, stageIdx, at }]
    arcs: [],              // active arc instances (for the threads UI later)
    recent: { product: '', employee: '', rival: '', headline: '', usersFmt: '' },
    lastEmit: -999,        // ts of last emitted item
    lastBeat: -999,        // ts of last *arc* beat (suppresses ambient)
    seedDone: false,
    usersTier: 0,          // index into USER_MILESTONES already crossed
    teamSize: 0,           // last seen team size (to detect departures)
    crisisCooldown: 0,
    ticker: [],            // rolling headline texts for the top ticker
    idc: 0,
    arcCount: {},          // de-dupe rapid identical arcs
  };
}
let E = freshEngine();

const USER_MILESTONES = [1000, 10000, 50000, 250000, 1000000, 5000000];

/*
   DERIVED SNAPSHOT  what generators are allowed to read about the run.
*/
function computeUsers(state) {
  let u = 0;
  for (const p of (state.shippedProducts || [])) {
    let health = 1;
    try { health = getProductHealth(p); } catch (_) {}
    u += (p.userBase || 1) * Math.max(0.2, health) * Math.max(1, (p.idea && p.idea.mrr) || 1) * 18;
  }
  return Math.round(u);
}
function biggestProductName(state) {
  const ps = state.shippedProducts || [];
  if (!ps.length) return (state.activeProducts && state.activeProducts[0]?.idea?.name) || (state.readyProducts && state.readyProducts[0]?.idea?.name) || 'the app';
  let best = ps[0];
  for (const p of ps) if (((p.idea && p.idea.mrr) || 0) > ((best.idea && best.idea.mrr) || 0)) best = p;
  return best.idea ? best.idea.name : 'the app';
}
function snapshot(state) {
  let mods = {}; try { mods = getModifiers(state); } catch (_) {}
  let mrr = 0; try { mrr = getMRR(state); } catch (_) {}
  let runway = Infinity; try { runway = getRunwaySeconds(state); } catch (_) {}
  const users = computeUsers(state);
  const trustGuess = clamp(Math.round(40 + (state.hype || 0) * 0.5 - (state.prDisasters ? state.prDisasters.length * 12 : 0)), 0, 100);
  return {
    C: state.companyName || 'the startup',
    P: biggestProductName(state),
    cat: (state.marketTrend && state.marketTrend.label) || 'tech',
    live: !!state.live,
    hype: state.hype || 0,
    trust: state.trust != null ? state.trust : trustGuess,
    mrr, runway, users,
    usersFmt: fmtNum(users),
    money: fmtMoney(mrr * 1200 + (state.totalRaised || 0)),
    serverWorking: mods.serverWorking != null ? mods.serverWorking : 1,
    teamSize: (state.employees || []).length,
    _hot: (state.hype || 0) > 55,
  };
}

/* small, clamped feedback so the feed visibly *matters* without breaking balance */
function nudgeHype(state, d) {
  if (!state) return;
  state.hype = clamp((state.hype || 0) + d, 0, 100);
}

/*
   PUBLIC API
*/

/** Reset on a new game. Clears the feed DOM and seeds a first item. */
export function resetStory(state) {
  E = freshEngine();
  E.teamSize = (state.employees || []).length;
  if (hasDOM) {
    const feed = document.getElementById('social-feed');
    if (feed) feed.innerHTML = '';
    const tick = document.getElementById('news-ticker');
    if (tick) tick.innerHTML = '<span>the feed is quiet. for now.</span>';
  }
  // a quiet stealth-era opener
  const snap = snapshot(state);
  emit(state, biX(snap, rand([
    'incorporated {C} today. the garage has already out-earned the company.',
    '{C} is in stealth mode, which is founder for “nobody has noticed yet.” soon.',
    'day one of {C}. quit my job, sold my car, kept the ambition. mostly the ambition.',
  ]), { handle: '@' + (state.founderHandle || 'founder_ceo'), tone: 'neutral' }), 'ambient');
}

/** Begin an arc. mem can preload entity references the stages will use. */
function startArc(state, key, mem = {}) {
  const tmpl = ARCS[key];
  if (!tmpl) return;
  // light de-dupe: don't stack two identical arcs within a few seconds
  const lastAt = E.arcCount[key] || -999;
  if (E.ts - lastAt < 4 && key !== 'fire') return;
  E.arcCount[key] = E.ts;

  const arc = { id: ++E.idc, key, color: ARC_COLOR[key] || ARC_COLOR.ambient, mem, stage: 0, born: E.ts };
  E.arcs.push(arc);
  if (E.arcs.length > 10) E.arcs.shift();
  scheduleStage(arc, 0);
}

function scheduleStage(arc, stageIdx) {
  const tmpl = ARCS[arc.key];
  if (!tmpl || stageIdx >= tmpl.length) { arc.done = true; return; }
  const w = tmpl[stageIdx].wait || [0, 0];
  E.queue.push({ arc, stageIdx, at: E.ts + rf(w[0], w[1]) });
}

/** React to a raw game event (called for every event in processGameEvents). */
export function onStoryEvent(state, type, payload = {}) {
  switch (type) {
    case 'spawn_fire':       startArc(state, 'fire'); break;
    case 'spawn_pr':         startArc(state, 'pr'); break;
    case 'pr_resolved':      if (chance(0.6)) startArc(state, 'pr_win'); break;
    case 'competitor_clone': startArc(state, 'clone', { R: (payload.clone && payload.clone.rival) || 'a rival', P: (payload.clone && payload.clone.product && payload.clone.product.idea && payload.clone.product.idea.name) }); break;
    case 'viral_meme':
    case 'meme':
    case 'meme_moment':      startArc(state, 'meme'); break;
    case 'regulator':
    case 'regulator_subpoena': startArc(state, 'regulator'); break;
    case 'board_dilemma':    break; // departures detected in tick; cash effects flow naturally
    case 'product_crash':    if (chance(0.7)) startArc(state, 'fire'); break;
    case 'team_gossip': {
      if (payload.gossip && payload.gossip.text) {
        const it = biSlack(snapshot(state), payload.gossip.text, { channel: 'watercooler', who: 'overheard' });
        it.arcColor = ARC_COLOR.gossip;
        emit(state, it, 'gossip');
      }
      break;
    }
    case 'employee_quit':
      startArc(state, 'exit', { E: payload.employee && payload.employee.name });
      break;
    case 'emp_levelup':
      break;
    case 'era_unlock': {
      const nm = (payload.era && payload.era.name) || 'a new frontier';
      const it = biArticle(snapshot(state), '{C} pivots into ' + nm + '; the pitch deck now just says "imagine, but bigger"', { section: 'PIVOT', tone: 'pos', delta: { text: 'NEW ERA', tone: 'pos' } });
      it.arcColor = ARC_COLOR.funding;
      emit(state, it, 'ambient');
      break;
    }
    default: break;
  }
}

/** React to a deliberate player action. */
export function onStoryAction(state, type, payload = {}) {
  switch (type) {
    case 'launch':
      startArc(state, payload.hit === false ? 'flop' : 'launch', { P: payload.product || biggestProductName(state), quality: payload.quality, bugs: payload.bugs, reviewScore: payload.reviewScore });
      break;
    case 'debut': // first launch / go-live big bang
      startArc(state, 'debut', { P: payload.product || biggestProductName(state) });
      break;
    case 'hire': {
      const emp = payload.employee || {};
      startArc(state, 'hire', { E: emp.name || 'the new hire', hireBeat: hireBeatFor(emp.personality) });
      E.teamSize = (state.employees || []).length;
      break;
    }
    case 'funding':
      startArc(state, 'funding', { round: payload.round || 'the round' });
      break;
    case 'marketing':
      if (chance(0.6)) {
        const snap = snapshot(state);
        emit(state, biX(snap, rand([
          '{C} is in my feed now. unprompted. i did not consent to this funnel but here we are.',
          'the {C} ad has invaded my podcast, my dreams, and my mother’s facebook. growth.',
        ]), { tone: 'pos', delta: { text: '+Hype', tone: 'pos' } }), 'ambient');
      }
      break;
    case 'pizza': {
      const snap = snapshot(state);
      emit(state, biX(snap, rand([
        '{C} just expensed company-wide pizza. productivity unchanged, vibes immaculate.',
        'pizza day at {C}: the one (1) reliable morale lever, deployed without shame.',
      ]), { tone: 'pos', delta: { text: '+Morale', tone: 'pos' } }), 'ambient');
      break;
    }
    case 'promote': {
      const snap = snapshot(state);
      const nm = (payload.employee && payload.employee.name) || 'someone';
      const title = payload.title || 'a shinier title';
      const it = biSlack(snap, nm + ' just got promoted to ' + title + '. cake in the kitchen, equity in the void.', { channel: 'general', who: 'HR (all of it)', tone: 'pos' });
      emit(state, it, 'ambient');
      break;
    }
    default: break;
  }
}

/** Advance the story clock, fire due beats, check milestones, sprinkle ambient.
 *  Returns the list of items emitted this tick (for tests / future use). */
export function tickStory(state, dt) {
  const emitted = [];
  if (!state) return emitted;
  E.ts += dt;
  if (E.crisisCooldown > 0) E.crisisCooldown -= dt;
  const snap = snapshot(state);

  // 1) fire any beats whose time has come (oldest first)
  E.queue.sort((a, b) => a.at - b.at);
  let guard = 0;
  while (E.queue.length && E.queue[0].at <= E.ts && guard++ < 6) {
    const job = E.queue.shift();
    const tmpl = ARCS[job.arc.key];
    const stage = tmpl && tmpl[job.stageIdx];
    if (stage) {
      const ctx = buildCtx(state, snap, job.arc);
      let item = null;
      try { item = stage.make(ctx); } catch (_) { item = null; }
      if (item) {
        item.arcId = job.arc.id; item.arcColor = job.arc.color;
        if (job.stageIdx > 0) item.thread = item.thread || threadLabel(job.arc, ctx);
        emit(state, item, job.arc.key);
        emitted.push(item);
        E.lastBeat = E.ts;
        if (stage.fx) { try { stage.fx(state, ctx); } catch (_) {} }
      }
      job.arc.stage = job.stageIdx + 1;
      scheduleStage(job.arc, job.stageIdx + 1);
    }
  }

  // 2) milestone storylines (users crossing thresholds, live only)
  if (snap.live) {
    while (E.usersTier < USER_MILESTONES.length && snap.users >= USER_MILESTONES[E.usersTier]) {
      const n = USER_MILESTONES[E.usersTier];
      E.usersTier++;
      startArc(state, 'growth', { N: fmtNum(n), P: snap.P });
      state._milestoneSeq = (state._milestoneSeq || 0) + 1;
      state._milestoneText = fmtNum(n) + ' users reached!';
    }
    // runway crisis storyline (rate-limited)
    if (snap.runway < 40 && snap.runway > 0 && E.crisisCooldown <= 0) {
      E.crisisCooldown = 45;
      startArc(state, 'crisis');
    }
  }

  // 3) departures: team shrank since last tick (layoff / poach / quit)
  if (snap.teamSize < E.teamSize) {
    startArc(state, 'exit');
  }
  E.teamSize = snap.teamSize;

  // 4) ambient chatter when the storylines leave a gap
  const gap = snap.live ? rf(3.5, 6.5) : rf(15, 24);
  const quietEnough = E.ts - E.lastBeat > 2.2; // don't step on an active arc beat
  if (quietEnough && E.ts - E.lastEmit > gap) {
    const item = ambientItem(snap);
    if (item) { emit(state, item, 'ambient'); emitted.push(item); }
  }

  return emitted;
}

function buildCtx(state, snap, arc) {
  const m = arc.mem || {};
  return Object.assign({}, snap, {
    P: m.P || snap.P,
    E: m.E || E.recent.employee || 'someone',
    R: m.R || E.recent.rival || 'a rival',
    N: m.N || snap.usersFmt,
    round: m.round || 'the round',
    mem: m,
    snap,
  });
}

function threadLabel(arc, ctx) {
  const map = {
    growth: 'the ' + (ctx.P || 'growth') + ' saga',
    launch: 're: ' + (ctx.P || 'the launch'),
    flop:   're: ' + (ctx.P || 'the launch'),
    fire:   're: the outage',
    pr:     're: the scandal',
    funding: 're: the ' + (ctx.round || 'round'),
    clone:  're: ' + (ctx.R || 'the clone'),
    meme:   're: the meme',
    exit:   're: the departure',
    regulator: 're: the subpoena',
    crisis: 're: the runway',
    debut:  're: going live',
    hire:   're: ' + (ctx.E || 'the new hire'),
  };
  return map[arc.key] || '';
}

/*
   RENDERING
*/
function emit(state, item, arcKey) {
  E.lastEmit = E.ts;
  // update shared memory for cross-references
  if (item) {
    if (arcKey === 'hire' && item.head) E.recent.employee = (item.text.match(/\b[A-Z][a-z]+\b/) || [])[0] || E.recent.employee;
    if (item.source === 'tc') { E.recent.headline = item.text; pushTicker(item.text); }
  }
  if (hasDOM) renderItem(item);
}

function esc(s) {
  return ('' + s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderItem(item) {
  const feed = document.getElementById('social-feed');
  if (!feed || !item) return;
  const el = document.createElement('div');
  el.className = `feed-item fi ${item.srcCls || ''} fi-tone-${item.tone || 'neutral'}`;
  if (item.arcColor) el.style.setProperty('--arc', item.arcColor);
  if (item.arcId) el.dataset.arc = item.arcId;

  const h = item.head || {};
  const useIcon = SRC_ICON[item.source] && h.avatarCls !== 'fi-vip' && h.avatarCls !== 'fi-ai-av';
  const av = useIcon
    ? `<span class="fi-av fi-av-icon">${SRC_ICON[item.source]}</span>`
    : h.avatar ? `<span class="fi-av ${h.avatarCls || ''}">${esc(h.avatar)}</span>` : '';
  const primary   = h.primary   ? `<span class="fi-prim">${esc(h.primary)}</span>` : '';
  const secondary = h.secondary ? `<span class="fi-sec">${esc(h.secondary)}</span>` : '';
  const thread    = item.thread ? `<div class="fi-thread">↳ ${esc(item.thread)}</div>` : '';
  const meta      = item.meta   ? `<div class="fi-meta">${esc(item.meta)}</div>` : '';
  const delta     = item.delta  ? `<div class="fi-delta ${item.delta.tone || ''}">${esc(item.delta.text)}</div>` : '';

  el.innerHTML = `
    <span class="fi-spine"></span>
    <div class="fi-body">
      <div class="fi-hd">${av}<div class="fi-hd-txt">${primary}${secondary}</div><span class="fi-src-tag">${esc(srcTag(item.source))}</span></div>
      ${thread}
      <div class="fi-text">${esc(item.text)}</div>
      <div class="fi-foot">${meta}${delta}</div>
      ${item.cta ? `<div class="fi-cta-row"><button class="fi-cta" data-pid="${esc(item.cta.pid)}">${esc(item.cta.label)} &rarr;</button></div>` : ''}
    </div>`;
  feed.insertBefore(el, feed.firstChild);
  while (feed.children.length > 18) feed.removeChild(feed.lastChild);
}

/** Render an openable proposal as a feed card (presentation only; effects live in gameLogic). */
export function pushProposalCard(proposal) {
  if (!hasDOM || !proposal) return;
  renderItem({
    source: proposal.source || 'em',
    srcCls: 'src-' + (proposal.source || 'em'),
    head: { primary: proposal.who, secondary: proposal.handle },
    text: proposal.pitch,
    tone: 'neutral',
    cta: { label: proposal.cta || 'Review proposal', pid: proposal.pid },
  });
}

/* Simple, original brand-style glyphs (white on the source-colored avatar). */
const SRC_ICON = {
  tc: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" d="M5 5h11v14H6.2A1.2 1.2 0 0 1 5 17.8zM16 9h3v8.5a1.5 1.5 0 0 1-3 0z"/><path stroke="#fff" stroke-width="1.5" stroke-linecap="round" d="M8 9h5M8 12h5M8 15h3"/></svg>',
  rd: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M5 6h14a1.2 1.2 0 0 1 1.2 1.2v7.6A1.2 1.2 0 0 1 19 16h-6l-4 3v-3H5a1.2 1.2 0 0 1-1.2-1.2V7.2A1.2 1.2 0 0 1 5 6z"/></svg>',
  x:  '<svg viewBox="0 0 24 24"><path stroke="#fff" stroke-width="2.6" stroke-linecap="round" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  li: '<svg viewBox="0 0 24 24"><circle cx="7" cy="6.6" r="1.7" fill="#fff"/><path stroke="#fff" stroke-width="2.6" stroke-linecap="round" d="M7 10.5v7"/><path fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" d="M12 17.5v-3.2a2.3 2.3 0 0 1 4.6 0v3.2M12 10.5v7"/></svg>',
  yt: '<svg viewBox="0 0 24 24"><rect x="3.5" y="6.5" width="17" height="11" rx="3.4" fill="#fff"/><path fill="var(--src,#FF0000)" d="M10.5 9.4v5.2L15 12z"/></svg>',
  sl: '<svg viewBox="0 0 24 24"><path stroke="#fff" stroke-width="2" stroke-linecap="round" d="M9.5 4l-1 16M16 4l-1 16M4 9h16M3 15h16"/></svg>',
  em: '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="#fff" stroke-width="1.8"/><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M5 7.5l7 6 7-6"/></svg>',
  rv: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 3.8l2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.7 6.9 19.3l1-5.6-4.1-4 5.6-.8z"/></svg>',
  pc: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="#fff"/><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" d="M6 11a6 6 0 0 0 12 0M12 17v3M9 20h6"/></svg>',
  ai: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M13.2 3L5 13h5l-1.2 8L17 11h-5z"/></svg>',
};

function srcTag(source) {
  return ({
    tc: 'NEWS', rd: 'REDDIT', x: 'X', sl: 'SLACK', em: 'EMAIL',
    rv: 'REVIEW', yt: 'YOUTUBE', pc: 'PODCAST', ai: 'AI', li: 'LINKEDIN',
  })[source] || '';
}

/* top news ticker  fed by article-type beats */
function pushTicker(text) {
  E.ticker.unshift(text);
  if (E.ticker.length > 6) E.ticker.pop();
  if (!hasDOM) return;
  const t = document.getElementById('news-ticker');
  if (!t) return;
  t.innerHTML = E.ticker.map(x => `<span>${esc(x)}</span>`).join('');
}

/** Exposed for a future "storylines" panel / debugging. */
export function getActiveArcs() { return E.arcs.filter(a => !a.done); }
