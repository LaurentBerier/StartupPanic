/**
 * scene.js  Three.js scene, camera, renderer, and lighting setup for Startup Panic Simulator.
 * Bright SaaS-pop backdrop, PBR lighting, tone mapping, resize handling.
 */

// THREE is loaded globally via <script src="js/lib/three.min.js">
const THREE = window.THREE;

//  Constants
const FOV          = 55;
const NEAR         = 0.1;
const FAR          = 200;
const CAMERA_POS   = { x: 0, y: 7, z: 12 };
const CAMERA_LOOK  = { x: 0, y: 0, z: 0 };

// Lighting dials  one place to fix brightness/washout. Lower `exposure` or
// `envFill` if the scene looks blown out; raise them if it looks flat/dark.
// `physicallyCorrect` switches point lights (fill + fire) to real inverse-square
// falloff so they stop flooding the room with flat light.
//
// The look we're chasing is the warm, saturated, high-contrast "SaaS-pop" of the
// key art: a strong golden key light, deep coloured shadows (orange<->teal
// separation), and neon pink/cyan spilling off the walls. The two biggest levers
// away from the old "grey and flat" render are (1) a dark, *coloured* background
// gradient instead of a light warm-grey flat fill  a light backdrop crushes
// contrast  and (2) the neon accent lights that inject saturated colour.
const LIGHTING = {
  exposure:          1.18,       // filmic exposure  a touch brighter for punch
  physicallyCorrect: true,       // inverse-square falloff for point lights
  // Background is a vertical gradient (makeGradientBackground). A deep indigo
  // void over a warm plum floor makes the warmly-lit office pop instead of
  // dissolving into flat grey the way the old light warm-grey fill did.
  bgTop:             0x141020,    // deep indigo void (top of the gradient)
  bgBottom:          0x3a2a30,    // warm plum-brown bounce (floor of the gradient)
  fog:               0x241a26,    // mid tone so the horizon blends into the void
  ambient:           0.16,        // low + COOL so shadows stay coloured, not muddy
  directional:       2.15,        // strong warm KEY  the main contrast driver
  rim:               0.55,        // vivid blue back-rim for crisp silhouettes
  fillCandela:       9.0,         // warm desk-lamp fill (candela, physicallyCorrect)
  hemi:              0.45,        // warm sky / cool ground -> orange-teal shadows
  envFill:           0.5,         // 0..1 luminance of the procedural env map (IBL)
  // Neon spill  coloured accent point lights that wash the walls the way the
  // pink/cyan signs would if they cast light. This is what makes the room read
  // "colourful" up close, and it's independent of any future bloom pass.
  neonPink:          0xff2d78,
  neonCyan:          0x22d3ff,
  neonCandela:       7.5,
  // Bloom (post-process). `threshold` keeps the glow on the bright emissive bits
  // (neon signs, screens, the AI core) so the whole room doesn't fog up; raise it
  // if too much blooms, lower it to catch dimmer emissives. `strength`/`radius`
  // control how far/soft the glow spreads.
  bloomStrength:     0.9,
  bloomRadius:       0.55,
  bloomThreshold:    0.78,
};

//  Module State 
let scene, camera, renderer, composer, bloomPass;
let ambientLight, directionalLight, rimLight;
let fireLights = [];  // Dynamic point lights for active fire events

export function getScene()    { return scene; }
export function getCamera()   { return camera; }
export function getRenderer() { return renderer; }
export function getFireLights() { return fireLights; }

//  Initialize 
export function initScene(canvas) {
  //  Scene 
  scene = new THREE.Scene();
  // Coloured vertical gradient behind the diorama (deep indigo -> warm plum).
  // A dark, saturated backdrop is the single biggest lift away from the old flat
  // grey: it lets the warmly-lit office read with real contrast and pushes colour
  // back into the frame.
  scene.background = makeGradientBackground();
  // Subtle fog for depth, tuned to a mid tone of the gradient so the horizon
  // fades into the void without banding.
  scene.fog = new THREE.FogExp2(LIGHTING.fog, 0.03);

  //  Camera 
  camera = new THREE.PerspectiveCamera(
    FOV,
    canvas.clientWidth / canvas.clientHeight,
    NEAR,
    FAR
  );
  camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z);
  camera.lookAt(CAMERA_LOOK.x, CAMERA_LOOK.y, CAMERA_LOOK.z);

  //  Renderer 
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  // Physically-correct lights: point/spot lights fall off with inverse-square
  // distance instead of flooding the room flatly. Directional/ambient/hemi are
  // largely unaffected; point lights (fill + fire) are tuned in candela below.
  renderer.physicallyCorrectLights = LIGHTING.physicallyCorrect;
  // ACESFilmic tone mapping for high-gloss PBR feel
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LIGHTING.exposure;
  renderer.outputEncoding      = THREE.sRGBEncoding;

  //  Lighting
  setupLighting();

  //  Image-based lighting (procedural env map  no HDRI fetch)
  setupEnvironment();

  //  Post-processing (bloom) so the emissive neon actually glows
  setupComposer();

  //  Resize Handling
  window.addEventListener('resize', onResize);

  return { scene, camera, renderer };
}

function setupLighting() {
  // Flat ambient is kept low now that the procedural environment map
  // (setupEnvironment) supplies most of the soft fill + reflections. A high
  // ambient term washes out PBR contrast, so this just lifts the deepest
  // shadows rather than flattening everything. Tinted COOL so the fill in
  // shadow reads teal against the warm key  the orange<->teal separation that
  // keeps the render from going grey.
  ambientLight = new THREE.AmbientLight(0xb9c7ff, LIGHTING.ambient);
  scene.add(ambientLight);

  // Primary directional KEY  warm golden, raking in low from the door side so
  // props cast long, shaped shadows instead of being flatly top-lit. This is the
  // main contrast driver, so it's much stronger than the old near-fill value.
  directionalLight = new THREE.DirectionalLight(0xffd39a, LIGHTING.directional);
  directionalLight.position.set(5, 8.5, 6.5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width  = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near   = 0.1;
  directionalLight.shadow.camera.far    = 40;
  directionalLight.shadow.camera.left   = -10;
  directionalLight.shadow.camera.right  = 10;
  directionalLight.shadow.camera.top    = 10;
  directionalLight.shadow.camera.bottom = -10;
  // bias removes surface acne; normalBias (ported from Polliniate3's rig)
  // pushes the sample along the normal to kill peter-panning / contact gaps
  // on the curved GLB props without widening the bias enough to cause acne.
  directionalLight.shadow.bias          = -0.0006;
  directionalLight.shadow.normalBias    = 0.025;
  scene.add(directionalLight);

  // Rim light  vivid blue from below-back to keep silhouettes crisp and add a
  // cool coloured edge that separates the characters from the warm interior.
  rimLight = new THREE.DirectionalLight(0x3f6bff, LIGHTING.rim);
  rimLight.position.set(-5, -1, -8);
  scene.add(rimLight);

  // Secondary fill  warm amber from side (suggests desk lamp / screen glow).
  // decay:2 = physically-correct inverse-square falloff, so it lights nearby
  // desks without flooding the whole room (intensity is candela now).
  const fillLight = new THREE.PointLight(0xffb04d, LIGHTING.fillCandela, 22, 2);
  fillLight.position.set(-3, 2, -2);
  scene.add(fillLight);

  // Hemisphere sky/ground gradient: warm "sky" over a COOL teal "ground" bounce.
  // The cool ground term is deliberate  it tints the undersides and shadowed
  // floor teal, reinforcing the orange<->teal separation instead of the old
  // uniform warm-grey wash.
  const hemiLight = new THREE.HemisphereLight(0xffe6c2, 0x24405e, LIGHTING.hemi);
  scene.add(hemiLight);

  // Neon spill  saturated pink off the left wall, cyan off the right, at sign
  // height. The emissive neon meshes can't cast light on their own (and there's
  // no bloom pass yet), so these accent lights are what actually paint colour
  // onto the room and props. Inverse-square + a short range keeps each colour
  // local to its side of the office.
  const pinkNeon = new THREE.PointLight(LIGHTING.neonPink, LIGHTING.neonCandela, 12, 2);
  pinkNeon.position.set(-4.8, 3.2, -3.2);
  scene.add(pinkNeon);

  const cyanNeon = new THREE.PointLight(LIGHTING.neonCyan, LIGHTING.neonCandela, 12, 2);
  cyanNeon.position.set(4.8, 3.2, -3.2);
  scene.add(cyanNeon);
}

/**
 * Vertical gradient backdrop as a CanvasTexture. Deep indigo void at the top
 * fading to a warm plum-brown at the floor line  a dark, saturated background
 * that makes the lit diorama pop (a light flat backdrop was the main reason the
 * old render looked washed-out and grey).
 */
function makeGradientBackground() {
  const canvas  = document.createElement('canvas');
  canvas.width  = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const top = new THREE.Color(LIGHTING.bgTop);
  const bot = new THREE.Color(LIGHTING.bgBottom);
  const hex = (c) => `rgb(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)})`;

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0.0, hex(top));
  grad.addColorStop(0.62, hex(top.clone().lerp(bot, 0.55)));
  grad.addColorStop(1.0, hex(bot));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding    = THREE.sRGBEncoding;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Image-based lighting via a procedural gradient environment map.
 *
 * Ported from Polliniate3's lighting.js (createGradientEnvironmentTexture):
 * instead of fetching an HDRI, we paint a soft gradient onto a canvas, treat it
 * as an equirectangular sky, and run it through PMREMGenerator to get a proper
 * roughness-aware IBL map. Assigning it to scene.environment gives every
 * MeshStandardMaterial (the office props + imported GLBs) real reflections and
 * specular fill  the single biggest lift for the PBR look  with no asset load.
 *
 * Palette is warm SaaS-pop (cream "sky", warm-grey "ground") to match the
 * backdrop, plus a soft overhead highlight that reads as a softbox reflection
 * in glossy surfaces (screens, desks, the AI core).
 */
function setupEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const equirect = createGradientEnvironmentTexture();
  const envRT = pmrem.fromEquirectangular(equirect);
  scene.environment = envRT.texture;

  // PMREM has copied the data into envRT; the source + generator are no longer
  // needed (the render target itself stays alive as scene.environment).
  equirect.dispose();
  pmrem.dispose();
}

/**
 * Bloom post-processing chain (EffectComposer -> RenderPass -> UnrealBloomPass).
 *
 * The emissive neon signs, monitors and AI core can't cast light or glow on their
 * own; the bloom pass bleeds their bright pixels outward, which is what sells the
 * "glowing neon" look of the key art. The threshold keeps the glow on the bright
 * emissive bits so the whole warmly-lit room doesn't smear.
 *
 * The r129 post-processing scripts are loaded as globals in index.html; if they
 * failed to load we quietly fall back to direct rendering (renderFrame() below).
 */
function setupComposer() {
  if (typeof THREE.EffectComposer !== 'function' ||
      typeof THREE.UnrealBloomPass  !== 'function' ||
      typeof THREE.RenderPass       !== 'function') {
    console.warn('[scene] Post-processing scripts unavailable  bloom disabled.');
    composer = null;
    return;
  }

  const size = new THREE.Vector2();
  renderer.getSize(size);

  composer = new THREE.EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x, size.y);
  composer.addPass(new THREE.RenderPass(scene, camera));

  bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    LIGHTING.bloomStrength,
    LIGHTING.bloomRadius,
    LIGHTING.bloomThreshold,
  );
  composer.addPass(bloomPass); // last pass -> EffectComposer renders it to screen
}

/** Warm gradient sky as an equirectangular CanvasTexture (no HDRI fetch). */
function createGradientEnvironmentTexture() {
  const canvas = document.createElement('canvas');
  canvas.width  = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Overall IBL luminance. Kept well below white so the env map adds soft
  // reflections + fill WITHOUT washing the scene out (the bug we just fixed).
  const f = LIGHTING.envFill;
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  // Scale a reference colour toward black by (1 - f).
  const col = (r, g, b) => `rgb(${lerp(0, r, f)},${lerp(0, g, f)},${lerp(0, b, f)})`;

  // Vertical zenith->ground gradient. Warm, more saturated "sky" up top fading to
  // a COOL teal ground bounce: glossy props (screens, desks, the AI core) now get
  // warm reflections on their tops and cool ones underneath, which reads far
  // richer than the old uniform warm-grey and matches the light rig's warm<->cool
  // separation.
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0.00, col(255, 236, 205)); // zenith  warm golden key
  grad.addColorStop(0.42, col(250, 214, 176)); // upper band  warmer/saturated
  grad.addColorStop(0.55, col(232, 190, 158)); // horizon  warm amber
  grad.addColorStop(1.00, col(60,  92,  120)); // ground  cool teal bounce
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Soft overhead highlight -> reads as a softbox reflection on glossy props.
  // Alpha scales with envFill so the hotspot never blows out on its own.
  const hi = ctx.createRadialGradient(
    canvas.width * 0.5, canvas.height * 0.26, 0,
    canvas.width * 0.5, canvas.height * 0.26, canvas.height * 0.5,
  );
  hi.addColorStop(0.0, `rgba(255,255,255,${(0.35 * f).toFixed(3)})`);
  hi.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = hi;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping  = THREE.EquirectangularReflectionMapping;
  tex.encoding = THREE.sRGBEncoding;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Add a dynamic fire point light to the scene.
 * Returns a handle to remove it later.
 */
export function addFireLight(position) {
  // decay:2 for physically-correct inverse-square falloff; base intensity is in
  // candela now, so it's higher than the old flat value but stays local to the fire.
  const baseIntensity = 9.0;
  const light = new THREE.PointLight(0xff6600, baseIntensity, 6, 2);
  light.position.copy(position);
  light.position.y += 0.5;
  scene.add(light);
  fireLights.push(light);

  // Flicker animation data
  light.userData.baseIntensity = baseIntensity;
  light.userData.phase = Math.random() * Math.PI * 2;
  return light;
}

export function removeFireLight(light) {
  const idx = fireLights.indexOf(light);
  if (idx !== -1) fireLights.splice(idx, 1);
  scene.remove(light);
}

/**
 * Animate fire lights (flicker). Call each frame.
 */
export function updateFireLights(time) {
  for (const light of fireLights) {
    const phase = light.userData.phase;
    // Multi-frequency flicker for organic fire feel
    const flicker = 1.0
      + 0.3 * Math.sin(time * 8.0  + phase)
      + 0.2 * Math.sin(time * 13.7 + phase * 2)
      + 0.1 * Math.sin(time * 23.1 + phase * 3);
    light.intensity = light.userData.baseIntensity * flicker;
  }
}

/**
 * Update camera aspect on resize.
 */
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (composer)  composer.setSize(w, h);
  if (bloomPass) bloomPass.setSize(w, h);
}

/**
 * Render one frame. Routes through the bloom composer when available, otherwise
 * falls back to a plain renderer pass.
 */
export function renderFrame() {
  if (composer) composer.render();
  else          renderer.render(scene, camera);
}
