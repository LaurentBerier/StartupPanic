/**
 * pathfind.js  Tiny grid A* with line-of-sight smoothing for the office floor.
 *
 * Pure logic, no THREE  the founder uses this to walk AROUND desks, servers and
 * facilities instead of getting wedged against them. Testable in Node.
 *
 * findPath(start, goal, obstacles, bounds, opts) -> [{x,z}, ...] waypoints
 *   start/goal : { x, z }
 *   obstacles  : [{ x, z, r }]   (r = blocking radius)
 *   bounds     : { minX, maxX, minZ, maxZ }
 *   opts       : { cell=0.4, agentR=0.3 }
 * Returns waypoints from just after `start` through `goal` (start excluded).
 */

function segClear(a, b, obstacles, agentR) {
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(2, Math.ceil(dist / 0.14));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    for (const o of obstacles) {
      if (Math.hypot(x - o.x, z - o.z) < o.r + agentR) return false;
    }
  }
  return true;
}

/** Greedily drop intermediate waypoints reachable in a straight clear line. */
function losSmooth(pts, obstacles, agentR) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !segClear(out[out.length - 1], pts[j], obstacles, agentR)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

export function findPath(start, goal, obstacles = [], bounds, opts = {}) {
  const cell   = opts.cell   || 0.4;
  const agentR = opts.agentR != null ? opts.agentR : 0.3;
  const b = bounds || { minX: -4.5, maxX: 4.5, minZ: -3.5, maxZ: 3.5 };

  const cols = Math.max(1, Math.ceil((b.maxX - b.minX) / cell));
  const rows = Math.max(1, Math.ceil((b.maxZ - b.minZ) / cell));
  const idx  = (c, r) => r * cols + c;
  const cx   = c => b.minX + (c + 0.5) * cell;
  const cz   = r => b.minZ + (r + 0.5) * cell;
  const toCol = x => Math.max(0, Math.min(cols - 1, Math.floor((x - b.minX) / cell)));
  const toRow = z => Math.max(0, Math.min(rows - 1, Math.floor((z - b.minZ) / cell)));

  // Precompute blocked cells.
  const blocked = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cx(c), z = cz(r);
      let bk = false;
      for (const o of obstacles) {
        if (Math.hypot(x - o.x, z - o.z) < o.r + agentR) { bk = true; break; }
      }
      blocked[idx(c, r)] = bk;
    }
  }

  const nearestFree = (c, r) => {
    if (!blocked[idx(c, r)]) return [c, r];
    for (let rad = 1; rad < Math.max(cols, rows); rad++) {
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          if (!blocked[idx(nc, nr)]) return [nc, nr];
        }
      }
    }
    return [c, r];
  };

  let [sc, sr] = nearestFree(toCol(start.x), toRow(start.z));
  let [gc, gr] = nearestFree(toCol(goal.x),  toRow(goal.z));

  // A* over the grid (8-connected, no diagonal corner-cutting).
  const startIdx = idx(sc, sr), goalIdx = idx(gc, gr);
  const g = new Map([[startIdx, 0]]);
  const came = new Map();
  const open = new Map([[startIdx, Math.hypot(sc - gc, sr - gr)]]);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = false, guard = 0;

  while (open.size && guard++ < cols * rows * 4) {
    let bestIdx = -1, bestF = Infinity;
    for (const [k, f] of open) if (f < bestF) { bestF = f; bestIdx = k; }
    open.delete(bestIdx);
    if (bestIdx === goalIdx) { found = true; break; }
    const cc = bestIdx % cols, cr = (bestIdx - (bestIdx % cols)) / cols;
    for (const [dc, dr] of dirs) {
      const nc = cc + dc, nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (blocked[idx(nc, nr)]) continue;
      if (dc !== 0 && dr !== 0 && (blocked[idx(cc + dc, cr)] || blocked[idx(cc, cr + dr)])) continue;
      const ng = g.get(bestIdx) + (dc !== 0 && dr !== 0 ? 1.41421 : 1);
      const ni = idx(nc, nr);
      if (!g.has(ni) || ng < g.get(ni)) {
        g.set(ni, ng);
        came.set(ni, bestIdx);
        open.set(ni, ng + Math.hypot(nc - gc, nr - gr));
      }
    }
  }

  // Reconstruct grid path.
  const grid = [];
  let cur = goalIdx;
  if (found || came.has(cur)) {
    while (cur !== startIdx && came.has(cur)) {
      const c = cur % cols, r = (cur - (cur % cols)) / cols;
      grid.push({ x: cx(c), z: cz(r) });
      cur = came.get(cur);
    }
    grid.reverse();
  }
  // Always finish on the real goal so the founder reaches the exact target.
  grid.push({ x: goal.x, z: goal.z });

  const smoothed = losSmooth([{ x: start.x, z: start.z }, ...grid], obstacles, agentR);
  smoothed.shift(); // drop the start point
  return smoothed.length ? smoothed : [{ x: goal.x, z: goal.z }];
}
