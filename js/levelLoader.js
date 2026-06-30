/**
 * levelLoader.js  Dynamic level link with the three.js Editor.
 *
 * Workflow:
 *   1. Open the three.js Editor (served by serve.bat on its own port).
 *   2. Build / arrange your office layout and new assets there.
 *   3. File > Export Scene, and save it as  level.json  in the StartupPanic folder.
 *   4. The running game polls level.json and live-reloads the layout within a
 *      couple of seconds  no page refresh needed.
 *
 * The exported objects are added into a dedicated group (__editorLevel) on top of
 * the procedural office, so the game keeps working even with no level.json present.
 * Everything here is guarded: if THREE is missing, the file 404s, or the JSON is
 * bad, we silently keep the procedural office.
 */

let _group = null;
let _lastText = '';
let _THREE = null;
let _timer = null;

/** Attach the editor level link to a scene. Safe to call once after scene setup. */
export function initLevelLink(scene, pollMs = 2500) {
  if (typeof window === 'undefined' || !scene) return;
  _THREE = window.THREE;
  if (!_THREE || !_THREE.ObjectLoader || !_THREE.Group) return;   // need three.js
  _group = new _THREE.Group();
  _group.name = '__editorLevel';
  scene.add(_group);
  load();
  if (_timer) clearInterval(_timer);
  _timer = setInterval(load, pollMs);
}

async function load() {
  if (typeof fetch === 'undefined' || !_group) return;
  let text;
  try {
    const res = await fetch('level.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;                 // no level.json yet -> keep procedural office
    text = await res.text();
  } catch (e) { return; }                // offline / file:// -> ignore
  if (!text || text === _lastText) return;   // unchanged since last poll
  _lastText = text;
  try {
    const json = JSON.parse(text);
    if (!json || !json.object) {            // empty placeholder {} -> nothing to load yet
      while (_group.children.length) _group.remove(_group.children[0]);
      return;
    }
    const obj = new _THREE.ObjectLoader().parse(json);
    while (_group.children.length) _group.remove(_group.children[0]);
    // If the export is a whole Scene, lift its children in; otherwise add the object.
    if (obj && obj.isScene && obj.children) {
      for (const child of obj.children.slice()) _group.add(child);
    } else if (obj) {
      _group.add(obj);
    }
    const n = _group.children.length;
    console.log('[level] loaded editor layout from level.json (' + n + ' top-level object' + (n === 1 ? '' : 's') + ')');
  } catch (e) {
    console.warn('[level] level.json is not valid three.js scene JSON yet:', e && e.message);
  }
}
