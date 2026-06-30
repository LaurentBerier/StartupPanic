/**
 * level-bridge.js  Startup Panic level adapter for the three.js Editor.
 *
 * The editor's File > "Save Level" / "Import Level" menu items load this module
 * (probed at /tools/level-bridge.js) and call the exported saveLevel(editor) /
 * importLevel(editor).
 *
 * Storage format: a plain three.js scene JSON (THREE.Scene.toJSON()), written to
 * level.json at the game root. The running game (js/levelLoader.js) polls that
 * file, parses it with THREE.ObjectLoader, and lifts the scene's children onto
 * the procedural office inside the __editorLevel group. So whatever you arrange
 * here  including imported GLB props  shows up in the game within ~3 seconds.
 *
 * Same origin as the game (served by serve.py), so /api/save-level and
 * /level.json resolve with no CORS.
 */

const SAVE_URL = '/api/save-level';
const LEVEL_URL = '/level.json';

// Texture optimization. THREE's scene.toJSON() embeds every texture as a raw
// base64 data URL  GLB props drag in 2K/4K PNGs that bloat level.json to 100MB+.
// Before saving we downscale each image to TEX_MAX_SIZE and re-encode: JPEG for
// opaque maps (huge win), PNG kept only when the image actually has alpha (so
// cutout/transparency textures survive). Tune these if props look too soft.
const TEX_MAX_SIZE = 1024;   // longest edge, px
const TEX_JPEG_QUALITY = 0.82;

// The editor exposes THREE on window (see editor/index.html). Use it so this
// adapter does not depend on the importmap resolving a bare 'three' specifier.
function getTHREE() {
	const THREE = (typeof window !== 'undefined') ? window.THREE : null;
	if (!THREE || !THREE.ObjectLoader) {
		throw new Error('THREE is not available on window  open this from the three.js Editor.');
	}
	return THREE;
}

function countMeshes(object) {
	let n = 0;
	object.traverse((o) => { if (o.isMesh) n++; });
	return n;
}

/** Does a decoded image have any non-opaque pixel? (decides JPEG vs PNG.) */
function imageHasAlpha(img, w, h) {
	const c = document.createElement('canvas');
	c.width = w; c.height = h;
	const ctx = c.getContext('2d');
	ctx.drawImage(img, 0, 0, w, h);
	const data = ctx.getImageData(0, 0, w, h).data;
	for (let i = 3; i < data.length; i += 4) {
		if (data[i] < 250) return true;
	}
	return false;
}

/** Downscale + re-encode one base64 data URL. Returns a (usually) smaller one. */
function recompressDataUrl(dataUrl) {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			const scale = Math.min(1, TEX_MAX_SIZE / Math.max(img.width, img.height));
			const w = Math.max(1, Math.round(img.width * scale));
			const h = Math.max(1, Math.round(img.height * scale));
			const c = document.createElement('canvas');
			c.width = w; c.height = h;
			c.getContext('2d').drawImage(img, 0, 0, w, h);
			// Keep PNG only when alpha matters; otherwise JPEG (much smaller).
			const out = imageHasAlpha(img, w, h)
				? c.toDataURL('image/png')
				: c.toDataURL('image/jpeg', TEX_JPEG_QUALITY);
			resolve(out);
		};
		img.onerror = () => resolve(null);
		img.src = dataUrl;
	});
}

/**
 * Shrink the embedded textures in a serialized scene in place.
 * Returns { before, after } byte estimates for the images block.
 */
async function optimizeTextures(json) {
	const images = json && json.images;
	if (!Array.isArray(images) || images.length === 0) return { before: 0, after: 0 };
	let before = 0, after = 0;
	for (const im of images) {
		let url = im.url;
		if (Array.isArray(url)) url = url[0];          // cube textures: skip (rare here)
		if (typeof url !== 'string' || !url.startsWith('data:image/')) continue;
		before += url.length;
		const next = await recompressDataUrl(url);
		// Only adopt the result if it actually shrank.
		if (next && next.length < url.length) {
			im.url = next;
			after += next.length;
		} else {
			after += url.length;
		}
	}
	return { before, after };
}

// Menubar.File -> "Save Level". Serializes the editor scene and POSTs it so the
// dev server writes level.json on disk. Reload is NOT needed: the game polls it.
export async function saveLevel(editor) {
	let json;
	try {
		json = editor.scene.toJSON();
	} catch (e) {
		alert('Save failed while serializing the scene: ' + e.message);
		console.error(e);
		return;
	}

	// Shrink embedded textures before sending (GLB props would otherwise bloat
	// level.json to 100MB+). Non-fatal: on any error we save the unoptimized JSON.
	let tex = { before: 0, after: 0 };
	try {
		tex = await optimizeTextures(json);
	} catch (e) {
		console.warn('[level] texture optimization skipped:', e && e.message);
	}

	try {
		const payload = JSON.stringify(json);
		const resp = await fetch(SAVE_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: payload,
		});
		let body = null;
		try { body = await resp.json(); } catch (_) { /* ignore body parse */ }
		if (!resp.ok || (body && body.ok === false)) {
			const detail = (body && (body.detail || body.error)) || ('HTTP ' + resp.status);
			throw new Error(detail);
		}

		const objs = editor.scene.children.length;
		const meshes = countMeshes(editor.scene);
		const mb = (n) => (n / 1e6).toFixed(1) + ' MB';
		const texLine = tex.before > 0
			? '\nTextures: ' + mb(tex.before) + '  ' + mb(tex.after) +
			  ' (file ~' + mb(payload.length) + ').'
			: '';
		alert(
			'Saved to game (level.json): ' + objs + ' top-level object(s), ' +
			meshes + ' mesh(es).' + texLine +
			'\n\nThe running game updates within ~3 seconds  no page reload needed.'
		);
	} catch (e) {
		alert('Save to game failed: ' + e.message +
			'\n\nIs the game running via serve.bat / serve.py on this port?');
		console.error(e);
	}
}

// Menubar.File -> "Import Level". Loads level.json back into the editor so you
// can keep editing the layout the game is currently running.
export async function importLevel(editor) {
	const THREE = getTHREE();

	let json;
	try {
		const resp = await fetch(LEVEL_URL + '?t=' + Date.now(), { cache: 'no-store' });
		if (!resp.ok) throw new Error('HTTP ' + resp.status);
		json = await resp.json();
	} catch (e) {
		alert('Import failed: could not read level.json (' + e.message + ').');
		console.error(e);
		return;
	}

	if (!json || !json.object) {
		alert('Nothing to import yet  level.json is empty.\n\n' +
			'Arrange the office here, then File > Save Level to create it.');
		return;
	}

	let parsed;
	try {
		parsed = new THREE.ObjectLoader().parse(json);
	} catch (e) {
		alert('Import failed: level.json is not valid scene JSON (' + e.message + ').');
		console.error(e);
		return;
	}

	// Replace the current scene contents with the imported objects.
	editor.clear();
	const children = (parsed.isScene && parsed.children) ? parsed.children.slice() : [parsed];
	for (const child of children) {
		editor.addObject(child);
	}

	alert('Imported level.json: ' + children.length + ' top-level object(s).');
}
