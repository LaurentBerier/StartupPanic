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
  scene.background = new THREE.Color(0xf4ece0);
  // Subtle fog for depth
  scene.fog = new THREE.FogExp2(0xf4ece0, 0.032);

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
  // ACESFilmic tone mapping for high-gloss PBR feel
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputEncoding      = THREE.sRGBEncoding;

  //  Lighting 
  setupLighting();

  //  Resize Handling 
  window.addEventListener('resize', onResize);

  return { scene, camera, renderer };
}

function setupLighting() {
  // Ambient IBL-style light for the bright SaaS-pop backdrop
  ambientLight = new THREE.AmbientLight(0xfff2e0, 1.0);
  scene.add(ambientLight);

  // Primary directional light  cool white, top-front
  directionalLight = new THREE.DirectionalLight(0xffe6c2, 1.55);
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
  directionalLight.shadow.bias          = -0.001;
  scene.add(directionalLight);

  // Rim light  indigo from below-back to keep silhouettes crisp
  rimLight = new THREE.DirectionalLight(0x4d6bff, 0.35);
  rimLight.position.set(-5, -2, -8);
  scene.add(rimLight);

  // Secondary fill  warm amber from side (suggests desk lamp / screen glow)
  const fillLight = new THREE.PointLight(0xffb84d, 0.85, 22);
  fillLight.position.set(-3, 2, -2);
  scene.add(fillLight);

  // Subtle hemisphere for sky/ground gradient
  const hemiLight = new THREE.HemisphereLight(0xfff4e6, 0xe6d6bf, 0.40);
  scene.add(hemiLight);
}

/**
 * Add a dynamic fire point light to the scene.
 * Returns a handle to remove it later.
 */
export function addFireLight(position) {
  const light = new THREE.PointLight(0xff6600, 2.0, 6);
  light.position.copy(position);
  light.position.y += 0.5;
  scene.add(light);
  fireLights.push(light);

  // Flicker animation data
  light.userData.baseIntensity = 2.0;
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
