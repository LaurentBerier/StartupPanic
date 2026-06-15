/**
 * tween.js — Lightweight tween/spring utility for Pre-Revenue
 * No skeletal animations: all motion via lerp, spring, and easing functions.
 */

// ─── Easing Functions ─────────────────────────────────────────────────────────
export const Ease = {
  linear:       t => t,
  inQuad:       t => t * t,
  outQuad:      t => t * (2 - t),
  inOutQuad:    t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t,
  outCubic:     t => (--t)*t*t+1,
  inOutCubic:   t => t < 0.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1,
  outElastic:   t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10*t) * Math.sin((t*10 - 0.75) * (2*Math.PI/3)) + 1;
  },
  outBounce:    t => {
    if (t < 1/2.75)       return 7.5625*t*t;
    if (t < 2/2.75)       return 7.5625*(t-=1.5/2.75)*t+0.75;
    if (t < 2.5/2.75)     return 7.5625*(t-=2.25/2.75)*t+0.9375;
    return 7.5625*(t-=2.625/2.75)*t+0.984375;
  },
};

// ─── Active Tweens Pool ───────────────────────────────────────────────────────
const activeTweens = new Set();

/**
 * Create and start a tween.
 * @param {object} opts
 * @param {number}   opts.from      - start value
 * @param {number}   opts.to        - end value
 * @param {number}   opts.duration  - ms
 * @param {function} opts.ease      - easing fn, default Ease.outQuad
 * @param {function} opts.onUpdate  - (value) called each frame
 * @param {function} [opts.onDone]  - called when complete
 * @returns {{ cancel: function }} handle to cancel tween
 */
export function tween({ from, to, duration, ease = Ease.outQuad, onUpdate, onDone }) {
  const handle = {
    from, to, duration,
    ease, onUpdate, onDone,
    elapsed: 0,
    done: false,
    cancel() { this.done = true; activeTweens.delete(this); }
  };
  activeTweens.add(handle);
  return handle;
}

/**
 * Tween a THREE.Vector3 or any object with x/y/z from one state to another.
 */
export function tweenVec3(target, toVec, duration, ease = Ease.outQuad, onDone) {
  const fromX = target.x, fromY = target.y, fromZ = target.z;
  return tween({
    from: 0, to: 1, duration, ease,
    onUpdate(t) {
      target.x = fromX + (toVec.x - fromX) * t;
      target.y = fromY + (toVec.y - fromY) * t;
      target.z = fromZ + (toVec.z - fromZ) * t;
    },
    onDone
  });
}

/**
 * Simple spring simulation (damped harmonic oscillator).
 * Update each frame with spring.update(dt).
 * Read spring.value and spring.velocity.
 */
export class Spring {
  constructor({ stiffness = 180, damping = 22, value = 0, target = 0 } = {}) {
    this.stiffness  = stiffness;
    this.damping    = damping;
    this.value      = value;
    this.velocity   = 0;
    this.target     = target;
  }

  update(dt) {
    const force = -this.stiffness * (this.value - this.target)
                  - this.damping  * this.velocity;
    this.velocity += force * dt;
    this.value    += this.velocity * dt;
    return this.value;
  }

  get settled() {
    return Math.abs(this.value - this.target) < 0.001
        && Math.abs(this.velocity) < 0.001;
  }
}

/**
 * Update all active tweens. Call once per frame with delta time in seconds.
 */
export function updateTweens(dt) {
  const dtMs = dt * 1000;
  for (const t of activeTweens) {
    if (t.done) { activeTweens.delete(t); continue; }
    t.elapsed += dtMs;
    const progress = Math.min(t.elapsed / t.duration, 1);
    const value = t.from + (t.to - t.from) * t.ease(progress);
    t.onUpdate(value);
    if (progress >= 1) {
      t.done = true;
      activeTweens.delete(t);
      if (t.onDone) t.onDone();
    }
  }
}

/**
 * Promise-based tween helper.
 */
export function tweenAsync(opts) {
  return new Promise(resolve => tween({ ...opts, onDone: resolve }));
}

/**
 * Smooth interpolation shorthand.
 */
export function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * Clamp a value between min and max.
 */
export function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
