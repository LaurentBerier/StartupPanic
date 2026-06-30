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
const LIGHTING = {
  exposure:          1.0,        // was 1.2  tone-mapping exposure
  physicallyCorrect: true,       // inverse-square falloff for point lights
  background:        0xbcb4a8,    // was 0xf4ece0  the bright cream backdrop was
                                  // the main "everything's washed out" cause; a
                                  // warm grey keeps the clean look but lets props read.
  ambient:           0.22,        // flat fill  keep low so PBR contrast survives
  directional:       1.25,        // key light
  rim:               0.30,
  fillCandela:       7.0,         // fill point light (candela, since physicallyCorrect)
  hemi:              0.40,
  envFill:           0.55,        // 0..1 luminance of the procedural env map (IBL)
};

//  Module State 
let scene, camera, renderer, composer;
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
  scene.background = new THREE.Color(LIGHTING.background);
  // Subtle fog for depth (matches the backdrop so the horizon doesn't band).
  scene.fog = new THREE.FogExp2(LIGHTING.background, 0.032);

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

  //  Resize Handling
  window.addEventListener('resize', onResize);

  return { scene, camera, renderer };
}

function setupLighting() {
  // Flat ambient is kept low now that the procedural environment map
  // (setupEnvironment) supplies most of the soft fill + reflections. A high
  // ambient term washes out PBR contrast, so this just lifts the deepest
  // shadows rather than flattening everything.
  ambientLight = new THREE.AmbientLight(0xfff2e0, LIGHTING.ambient);
  scene.add(ambientLight);

  // Primary directional light  cool white, top-front
  directionalLight = new THREE.DirectionalLight(0xffe6c2, LIGHTING.directional);
  directionalLight.position.set(4, 10, 6);
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

  // Rim light  indigo from below-back to keep silhouettes crisp
  rimLight = new THREE.DirectionalLight(0x4d6bff, LIGHTING.rim);
  rimLight.position.set(-5, -2, -8);
  scene.add(rimLight);

  // Secondary fill  warm amber from side (suggests desk lamp / screen glow).
  // decay:2 = physically-correct inverse-square falloff, so it lights nearby
  // desks without flooding the whole room (intensity is candela now).
  const fillLight = new THREE.PointLight(0xffb84d, LIGHTING.fillCandela, 22, 2);
  fillLight.position.set(-3, 2, -2);
  scene.add(fillLight);

  // Hemisphere sky/ground gradient (warm "sky", cooler warm-grey "ground").
  const hemiLight = new THREE.HemisphereLight(0xfff4e6, 0xd9c3a3, LIGHTING.hemi);
  scene.add(hemiLight);
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
  // Scale a warm reference colour toward black by (1 - f).
  const warm = (r, g, b) => `rgb(${lerp(0, r, f)},${lerp(0, g, f)},${lerp(0, b, f)})`;

  // Vertical zenith->ground gradient (warm; brightness driven by envFill).
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0.00, warm(254, 249, 240)); // zenith  warm key
  grad.addColorStop(0.42, warm(244, 236, 220)); // upper band
  grad.addColorStop(0.55, warm(233, 220, 198)); // horizon  warm cream
  grad.addColorStop(1.00, warm(150, 136, 112)); // ground  warm grey bounce
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
}

/**
 * Render one frame.
 */
export function renderFrame() {
  renderer.render(scene, camera);
}
