/**
 * gameObjects.js  All 3D game entity classes for Startup Panic Simulator.
 *
 * Every object uses a root THREE.Group so gameplay code stays stable
 * when real GLB assets replace placeholders.
 *
 * ASSET SLOT CONSTANTS: search for "ASSET_SLOT" to find where real
 * GLB models should be loaded.
 */

const THREE = window.THREE;

//  Color Constants (Style Guide) 
export const COLORS = {
  obsidianDeep:   0x0A0A0A,
  obsidianMid:    0x1F1F1F,
  obsidianLight:  0x2C2C2C,
  border:         0x3A3A3A,
  border2:        0x4F4F4F,
  text:           0xE0E0E0,
  cyan:           0x00FFFF,
  magenta:        0xFF00FF,
  amber:          0xFFB300,
  error:          0xFF4C4C,
  success:        0x4CFF4C,
  white:          0xFFFFFF,
  silver:         0xCCCCCC,
  chrome:         0xBBBBCC,
  glass:          0x88CCFF,
};

//  Shared Materials Cache 
const matCache = {};
function cachedMat(key, factory) {
  if (!matCache[key]) matCache[key] = factory();
  return matCache[key];
}

function obsidianMat(color = COLORS.obsidianMid) {
  return new THREE.MeshStandardMaterial({
    color, metalness: 0.85, roughness: 0.15,
    envMapIntensity: 1.2,
  });
}
function chromeMat() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.chrome, metalness: 0.95, roughness: 0.05,
  });
}
function glassMat(opacity = 0.3) {
  return new THREE.MeshStandardMaterial({
    color: COLORS.glass, metalness: 0.3, roughness: 0.4,
    transparent: true, opacity,
    side: THREE.DoubleSide,
  });
}
function glowMat(color, emissiveIntensity = 1) {
  return new THREE.MeshStandardMaterial({
    color, emissive: new THREE.Color(color),
    emissiveIntensity,
    metalness: 0.5, roughness: 0.3,
  });
}

// 
//  PLATFORM  Office Diorama Base
// 
export class OfficePlatform {
  constructor() {
    // ASSET_SLOT: office_diorama_platform  replace with GLB
    this.root = new THREE.Group();
    this._build();
  }

  _build() {
    const root = this.root;
    const concrete = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.0, roughness: 0.95 });

    // The procedural floor (main slab + inner desk floor) and walls (back + two
    // sides, the roll-up garage door, and the sleek-office glass panels) that
    // used to be built here have been removed  the real environment now comes in
    // from level.json (Garage_Floor.glb + Garage_Wall_*.glb), and the old concrete
    // boxes only clipped through it. What remains is the corner support pillars
    // (hidden under the real floor) and the loose garage props further below.

    const pillarMat = concrete(0x222020);
    for (const [px, pz] of [[-4.5,3.5],[-4.5,-3.5],[4.5,3.5],[4.5,-3.5]]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), pillarMat);
      pillar.position.set(px, -1.7, pz); root.add(pillar);
    }

    //  Garage props (only visible at tier 0). Dropped ~0.4 to rest on the real
    //  Garage_Floor.glb surface (y -0.39) now that the old temp floor (y 0.01,
    //  which these were placed on) is gone  otherwise they'd float.
    this.garageGroup = new THREE.Group(); this.garageGroup.position.y = -0.40; root.add(this.garageGroup);
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20),
      new THREE.MeshStandardMaterial({ color: 0x1b1814, roughness: 1 }));
    stain.rotation.x = -Math.PI / 2; stain.position.set(1.7, 0.222, 1.7); this.garageGroup.add(stain);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3f, metalness: 0, roughness: 1 });
    for (const b of [{ x:-4.2,z:3.1,s:0.5,r:0.3 },{ x:-3.7,z:3.35,s:0.34,r:-0.4 },{ x:4.2,z:3.2,s:0.45,r:0.2 }]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(b.s, b.s, b.s), boxMat);
      box.position.set(b.x, 0.21 + b.s / 2, b.z); box.rotation.y = b.r; box.castShadow = true;
      this.garageGroup.add(box);
    }

    root.position.y = -0.2;
    this.setTier(0);
  }

  /**
   * Track the expansion tier. The procedural floor/walls that used to recolour
   * per tier (and the sleek-office glass accents) are gone now that the real
   * environment is supplied by level.json; this just keeps the loose garage props
   * to the garage tier.
   */
  setTier(n) {
    this.tier = n;
    if (this.garageGroup) this.garageGroup.visible = (n === 0);
  }

  addToScene(scene) { scene.add(this.root); }
}

// 
//  COMPANY SIGN  a wall panel showing the startup's name (CanvasTexture text)
// 
export function makeCompanySign(name, tier = 0) {
  const root = new THREE.Group();
  const handdrawn = tier === 0;

  // Backing board  cardboard in the garage, dark panel once you've grown
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.95, 0.1),
    new THREE.MeshStandardMaterial({ color: handdrawn ? 0x9c7a45 : 0x14141a, metalness: handdrawn ? 0 : 0.3, roughness: handdrawn ? 1 : 0.7 })
  );
  root.add(board);

  if (!handdrawn) {
    const armMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.5 });
    for (const ax of [-1.4, 1.4]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), armMat);
      arm.position.set(ax, 0.3, -0.18); root.add(arm);
    }
  }

  // Canvas-rendered text (no font assets needed)
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  if (handdrawn) {
    // Scrawled-on-cardboard look
    ctx.fillStyle = '#b9925a'; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 40; i++) ctx.fillRect(Math.sin(i * 12.9) * 512 + 512, (i * 37) % 256, 60, 2); // faint grain
    // wobbly marker border
    ctx.strokeStyle = '#3a2f24'; ctx.lineWidth = 7; ctx.beginPath();
    const pts = [[40,40],[990,28],[1000,224],[28,234]];
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= pts.length; i++) { const p = pts[i % pts.length]; ctx.lineTo(p[0], p[1]); }
    ctx.stroke();
    // marker name in a handwriting font
    let fs = 130;
    const font = (s) => `bold ${s}px "Segoe Script", "Bradley Hand", "Comic Sans MS", cursive`;
    ctx.font = font(fs);
    while (ctx.measureText(name).width > 900 && fs > 30) { fs -= 6; ctx.font = font(fs); }
    ctx.fillStyle = '#22324a'; // blue marker ink
    ctx.save(); ctx.translate(512, 138); ctx.rotate(-0.025);
    ctx.fillText(name, 0, 0);
    // hand-drawn underline scribble
    ctx.strokeStyle = '#7a2b2b'; ctx.lineWidth = 6; ctx.beginPath();
    ctx.moveTo(-fs * name.length * 0.22, fs * 0.45);
    ctx.quadraticCurveTo(0, fs * 0.6, fs * name.length * 0.22, fs * 0.42);
    ctx.stroke(); ctx.restore();
  } else {
    // Polished neon logo
    ctx.fillStyle = '#0c0c12'; ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 8; ctx.strokeRect(12, 12, 1000, 232);
    ctx.fillStyle = '#00ffff';
    let fs = 120;
    ctx.font = `900 ${fs}px "Segoe UI", Arial, sans-serif`;
    while (ctx.measureText(name).width > 920 && fs > 28) { fs -= 6; ctx.font = `900 ${fs}px "Segoe UI", Arial, sans-serif`; }
    ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 24;
    ctx.fillText(name, 512, 134);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, 0.875),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  panel.position.z = 0.06;
  root.add(panel);

  root.userData.canvas = cv;
  root.userData.tex = tex;
  // Mounted flush on the back garage wall mesh (inner face ~z=-4.49,
  // wall top ~y=2.42) so the board reads as bolted to the wall.
  root.position.set(0, 1.9, -4.43);
  return root;
}

/**
 * A glowing floor ring + floating arrow marking the founder's desk
 * ("sit here to work / develop"). The arrow can be toggled when seated.
 */
export function makeDeskMarker() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.03, 8, 32),
    new THREE.MeshStandardMaterial({ color: COLORS.cyan, emissive: new THREE.Color(COLORS.cyan), emissiveIntensity: 0.9 })
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.24, 4),
    new THREE.MeshStandardMaterial({ color: COLORS.amber, emissive: new THREE.Color(COLORS.amber), emissiveIntensity: 1.1 })
  );
  arrow.rotation.x = Math.PI; arrow.position.y = 0.95; g.add(arrow);
  g.userData.ring = ring;
  g.userData.arrow = arrow;
  return g;
}

// 
//  OFFICE FURNITURE
// 
export class OfficeFurniture {
  constructor() {
    // ASSET_SLOT: minimal_office_furniture  replace with GLB
    this.root = new THREE.Group();
    this._build();
  }

  _build() {
    // Central desk/chair/monitors removed  the only workstation is the
    // founder's DeskStation on the left. Server racks stay (fires need them).
    this._buildServerRacks();
  }

  _buildDesk() {
    const g = new THREE.Group();

    // Smaller rough wooden workbench top (no high-tech glass)
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.08, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x4a3520, metalness: 0.0, roughness: 0.85 })
    );
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);

    // Matte metal legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x4f4f57, metalness: 0.5, roughness: 0.6 });
    const legGeo = new THREE.BoxGeometry(0.07, 0.8, 0.07);
    for (const [lx, lz] of [[-0.8, -0.36], [-0.8, 0.36], [0.8, -0.36], [0.8, 0.36]]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, -0.44, lz);
      g.add(leg);
    }

    g.position.set(0, 0.62, 0);
    this.root.add(g);
  }

  _buildChair() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.2, roughness: 0.8 });
    const metalM = new THREE.MeshStandardMaterial({ color: 0x4f4f57, metalness: 0.5, roughness: 0.6 });

    // Seat (smaller)
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.09, 0.45), mat));

    // Back
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.06), mat);
    back.position.set(0, 0.32, -0.2);
    back.rotation.x = 0.1;
    g.add(back);

    // Base pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8), metalM);
    pole.position.y = -0.2;
    g.add(pole);

    // 5-star base (smaller)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.26, 0.05, 5), metalM);
    base.position.y = -0.38;
    g.add(base);

    g.position.set(0, 0.33, 1.15);
    this.root.add(g);
  }

  _buildServerRacks() {
    // Two low, flat server units sitting flat on the floor  fires spawn here
    const rackMat = obsidianMat(0x111111);
    const rackPositions = [
      { x: -3.5, z: -2.5, name: 'rack_left'  },
      { x:  3.5, z: -2.5, name: 'rack_right' },
    ];

    this.serverRacks = [];

    for (const cfg of rackPositions) {
      const rack = new THREE.Group();
      rack.name = cfg.name;

      // Flat low chassis (1.0 w  0.34 h  0.7 d), bottom resting on the floor
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.34, 0.7), rackMat.clone());
      body.castShadow = body.receiveShadow = true;
      rack.add(body);
      rack.userData.body = body;

      // Vent stripes across the top
      const stripeMat = new THREE.MeshStandardMaterial({ color: COLORS.border, metalness: 0.7, roughness: 0.3 });
      for (let i = 0; i < 4; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.06), stripeMat);
        stripe.position.set(0, 0.18, -0.22 + i * 0.14);
        rack.add(stripe);
      }

      // LED indicator row across the front face
      const ledMat = new THREE.MeshStandardMaterial({
        color: COLORS.success, emissive: new THREE.Color(COLORS.success), emissiveIntensity: 1,
      });
      rack.userData.ledMat = ledMat;
      rack.userData.leds = [];
      for (let i = 0; i < 4; i++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), ledMat.clone());
        led.position.set(-0.3 + i * 0.16, 0.0, 0.36);
        rack.add(led);
        rack.userData.leds.push(led);
      }

      rack.position.set(cfg.x, 0.17, cfg.z); // center at 0.17  sits flat on the floor
      this.serverRacks.push(rack);
      this.root.add(rack);
    }
  }

  _buildAccentTables() {
    const smallMat = obsidianMat(0x0E0E0E);
    const tableConfigs = [
      { x: -2.5, z: 1.5, w: 1.0, d: 0.7 },
      { x:  2.5, z: 1.5, w: 1.0, d: 0.7 },
    ];
    for (const cfg of tableConfigs) {
      const g = new THREE.Group();
      const topMesh = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w, 0.06, cfg.d), smallMat.clone()
      );
      topMesh.castShadow = true;
      g.add(topMesh);
      // Legs
      for (const [lx, lz] of [[-cfg.w/2+0.06, -cfg.d/2+0.06], [cfg.w/2-0.06, -cfg.d/2+0.06],
                               [-cfg.w/2+0.06,  cfg.d/2-0.06], [cfg.w/2-0.06,  cfg.d/2-0.06]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.5,6), chromeMat());
        leg.position.set(lx, -0.28, lz);
        g.add(leg);
      }
      g.position.set(cfg.x, 0.53, cfg.z);
      this.root.add(g);
    }
  }

  _buildMonitors() {
    const monMat = obsidianMat(0x0A0A0A);
    const screenMat = new THREE.MeshStandardMaterial({
      color: COLORS.obsidianDeep,
      emissive: new THREE.Color(0x001133),
      emissiveIntensity: 0.8,
    });

    const monConfigs = [
      { x: -0.7, z: -0.3, ry: 0    },
      { x:  0.7, z: -0.3, ry: 0    },
    ];
    this.monitors = [];

    for (const cfg of monConfigs) {
      const g = new THREE.Group();
      // Screen
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.03), monMat.clone());
      g.add(screen);
      const display = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.01), screenMat.clone());
      display.position.z = 0.02;
      g.add(display);
      this.monitors.push({ screen, display, mat: display.material });

      // Stand
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), chromeMat());
      stand.position.y = -0.35;
      g.add(stand);

      // Base
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.2), obsidianMat());
      base.position.y = -0.46;
      g.add(base);

      g.position.set(cfg.x, 0.97, cfg.z);
      g.rotation.y = cfg.ry;
      this.root.add(g);
    }
  }

  /**
   * Toggle a server rack between operational and destroyed (fire damage).
   * Down racks tilt and turn their LEDs red.
   */
  setRackDown(idx, down) {
    const rack = this.serverRacks && this.serverRacks[idx];
    if (!rack) return;
    rack.visible = !down;
    const col = down ? COLORS.error : COLORS.success;
    for (const led of (rack.userData.leds || [])) {
      led.material.color.set(col);
      led.material.emissive.set(col);
      led.material.emissiveIntensity = down ? 0.5 : 1;
    }
    if (rack.userData.body) rack.userData.body.material.color.setHex(down ? 0x070707 : 0x111111);
  }

  /**
   * Animate monitor screens (data scrolling effect via emissive color shift).
   */
  updateMonitors(time) {
    if (!this.monitors) return;
    for (let i = 0; i < this.monitors.length; i++) {
      const m = this.monitors[i];
      const pulse = 0.6 + 0.2 * Math.sin(time * 1.2 + i * Math.PI);
      m.mat.emissiveIntensity = pulse;
      // Subtle hue shift between cyan-blue
      const r = 0, g2 = Math.floor(17 + 50 * pulse), b = Math.floor(51 + 100 * pulse);
      m.mat.emissive.setRGB(r/255, g2/255, b/255);
    }
  }

  addToScene(scene) { scene.add(this.root); }
}

// 
//  MERCURY AI CORE  Liquid mercury sphere with custom shader displacement
// 
export class MercuryAICore {
  constructor() {
    // ASSET_SLOT: mercury_ai_core  replace with GLB + retain shader wrapper
    this.root = new THREE.Group();
    this._time = 0;
    this._hypeLevel = 0;    // 0..1 drives visual intensity
    this._stressLevel = 0;  // 0..1 drives displacement
    this.scaleSpring = { value: 1, velocity: 0, target: 1, k: 200, d: 25 };
    this._build();
  }

  _build() {
    // High-res sphere for smooth displacement
    const geo = new THREE.SphereGeometry(0.75, 64, 64);

    // Custom ShaderMaterial for liquid mercury effect
    const mercuryShader = {
      uniforms: {
        uTime:        { value: 0 },
        uHype:        { value: 0 },
        uStress:      { value: 0 },
        uCyanColor:   { value: new THREE.Color(COLORS.cyan) },
        uBaseColor:   { value: new THREE.Color(0xAAAAAA) },
        uEnvColor:    { value: new THREE.Color(0x1a2030) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uHype;
        uniform float uStress;

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vDisplace;

        // Simple noise function
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        void main() {
          vNormal   = normalMatrix * normal;
          vPosition = position;

          // Layered noise for liquid sloshing
          float speed1 = uTime * 0.8;
          float speed2 = uTime * 1.3;
          float n1 = noise(position * 2.5 + vec3(speed1, speed1 * 0.7, 0.0));
          float n2 = noise(position * 4.0 + vec3(0.0, speed2, speed2 * 0.5));
          float n3 = noise(position * 7.0 - vec3(speed1 * 0.3, 0.0, speed2 * 0.4));

          float displace = n1 * 0.12 + n2 * 0.06 + n3 * 0.02;
          displace *= (1.0 + uStress * 1.5);  // More turbulent under stress
          vDisplace = displace;

          vec3 displaced = position + normal * displace;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uHype;
        uniform float uStress;
        uniform vec3  uCyanColor;
        uniform vec3  uBaseColor;
        uniform vec3  uEnvColor;

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vDisplace;

        void main() {
          // Fake environment reflection using normal
          vec3 n = normalize(vNormal);

          // Fresnel effect (rim glow)
          vec3 viewDir = normalize(vec3(0.0, 0.5, 1.0) - vPosition);
          float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);

          // Base metallic color  silver-gray
          vec3 base = uBaseColor * (0.5 + 0.5 * n.y);

          // Env reflection tint
          vec3 envRefl = mix(uEnvColor, vec3(0.8, 0.9, 1.0), max(n.y, 0.0));
          base = mix(base, envRefl, 0.4);

          // Cyan inner glow (intensifies with hype)
          float glowStrength = 0.2 + uHype * 0.8 + uStress * 0.5;
          vec3 glow = uCyanColor * glowStrength * (0.5 + vDisplace * 3.0);

          // Combine
          vec3 color = base + glow * fresnel * 1.5 + glow * 0.15;

          // Add magenta flash under high stress
          if (uStress > 0.7) {
            float stressGlow = (uStress - 0.7) / 0.3;
            color += vec3(1.0, 0.0, 1.0) * stressGlow * 0.3 * fresnel;
          }

          // Subtle hype-pulse brightness
          float hypePulse = 1.0 + uHype * 0.3 * sin(uTime * 4.0);
          color *= hypePulse;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.FrontSide,
    };

    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial(mercuryShader));
    this.mesh.castShadow = true;
    this.root.add(this.mesh);

    // Inner glow sphere (emissive, slightly smaller)
    const innerGeo = new THREE.SphereGeometry(0.65, 32, 32);
    const innerMat = new THREE.MeshStandardMaterial({
      color: COLORS.cyan,
      emissive: new THREE.Color(COLORS.cyan),
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.2,
    });
    this.innerGlow = new THREE.Mesh(innerGeo, innerMat);
    this.root.add(this.innerGlow);
    this.innerGlowMat = innerMat;

    // Position above desk level
    this.root.position.set(0, 1.8, -0.5);
  }

  /**
   * Set hype level (0..1)  drives cyan glow intensity.
   */
  setHype(level) {
    this._hypeLevel = Math.max(0, Math.min(1, level));
  }

  /**
   * Set stress level (0..1)  drives surface turbulence and magenta flash.
   */
  setStress(level) {
    this._stressLevel = Math.max(0, Math.min(1, level));
  }

  /**
   * Trigger a surge animation (successful pitch/launch).
   */
  surge() {
    this.scaleSpring.target = 1.35;
    this.scaleSpring.velocity = 2.0;
    setTimeout(() => { this.scaleSpring.target = 1.0; }, 400);
  }

  /**
   * Trigger a contraction (bad event).
   */
  contract() {
    this.scaleSpring.target = 0.75;
    setTimeout(() => { this.scaleSpring.target = 1.0; }, 600);
  }

  update(dt, time) {
    this._time = time;

    // Update shader uniforms
    const uni = this.mesh.material.uniforms;
    uni.uTime.value   = time;
    uni.uHype.value   = this._hypeLevel;
    uni.uStress.value = this._stressLevel;

    // Spring scale
    const sp = this.scaleSpring;
    const force = -sp.k * (sp.value - sp.target) - sp.d * sp.velocity;
    sp.velocity += force * dt;
    sp.value    += sp.velocity * dt;
    this.root.scale.setScalar(sp.value);

    // Idle float animation
    this.root.position.y = 1.8 + Math.sin(time * 0.8) * 0.05;
    this.root.rotation.y = time * 0.3;

    // Inner glow pulse
    const glowPulse = 0.15 + this._hypeLevel * 0.5 + 0.1 * Math.sin(time * 3);
    this.innerGlowMat.emissiveIntensity = glowPulse;
    this.innerGlowMat.opacity = 0.1 + this._hypeLevel * 0.25;
  }

  addToScene(scene) { scene.add(this.root); }
}

// 
//  SERVER FIRE  Physical fire placeholder on a server rack
// 
export class ServerFire {
  constructor(position) {
    this.root       = new THREE.Group();
    this.position3d = position.clone();
    this.active     = true;
    this._time      = 0;
    this._particles = [];
    this._build();
  }

  _build() {
    // Fire particle system using Points
    const count    = 60;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);

    // Initialize particles scattered upward
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.random() * 0.2;
      positions[i*3]   = Math.cos(angle) * r;
      positions[i*3+1] = Math.random() * 0.8;
      positions[i*3+2] = Math.sin(angle) * r;

      // Warm fire colors: amber -> orange -> red
      const t = Math.random();
      colors[i*3]   = 1.0;
      colors[i*3+1] = t * 0.5;
      colors[i*3+2] = 0;

      sizes[i] = 8 + Math.random() * 16;

      this._particles.push({
        offset: Math.random() * Math.PI * 2,
        speed:  0.8 + Math.random() * 0.8,
        r:      r,
        angle:  angle,
        life:   Math.random(),
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const fireMat = new THREE.PointsMaterial({
      size:            0.15,
      vertexColors:    true,
      transparent:     true,
      opacity:         0.85,
      depthWrite:      false,
      blending:        THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.firePoints  = new THREE.Points(geometry, fireMat);
    this.fireGeo     = geometry;
    this._positions  = positions;
    this._colors     = colors;

    this.root.add(this.firePoints);

    // Glowing base indicator (red box on rack)
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLORS.error,
      emissive: new THREE.Color(COLORS.error),
      emissiveIntensity: 2,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.2), baseMat);
    this.root.add(base);

    // Click hitbox (invisible box for raycasting)
    const hitGeo = new THREE.BoxGeometry(0.8, 1.2, 0.6);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitbox  = new THREE.Mesh(hitGeo, hitMat);
    this.hitbox.position.y = 0.4;
    this.hitbox.userData.isFire = true;
    this.hitbox.userData.fire   = this;
    this.root.add(this.hitbox);

    this.root.position.copy(this.position3d);
    this.root.position.y += 0.25; // sit the flames on the low, flat server unit
  }

  update(dt, time) {
    this._time = time;
    const pos  = this._positions;
    const col  = this._colors;
    const parts = this._particles;

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.life  += dt * p.speed;
      if (p.life > 1) {
        p.life  = 0;
        p.angle = Math.random() * Math.PI * 2;
        p.r     = Math.random() * 0.2;
      }

      // Rise and sway
      const sway = Math.sin(time * 3 + p.offset) * 0.05;
      pos[i*3]   = Math.cos(p.angle) * p.r * (1 - p.life * 0.5) + sway;
      pos[i*3+1] = p.life * 0.9;
      pos[i*3+2] = Math.sin(p.angle) * p.r * (1 - p.life * 0.5);

      // Color: amber at base, fade to dark at top
      const t    = p.life;
      col[i*3]   = 1.0 - t * 0.2;
      col[i*3+1] = (1 - t) * 0.5;
      col[i*3+2] = 0;
      this.fireGeo.attributes.color.array[i*3+3] = 1 - t; // 'opacity' encoded
    }

    this.fireGeo.attributes.position.needsUpdate = true;
    this.fireGeo.attributes.color.needsUpdate    = true;
  }

  addToScene(scene) { scene.add(this.root); }

  extinguish(scene) {
    this.active = false;
    scene.remove(this.root);
  }
}

// 
//  HYPE CONFETTI  Particle burst on successful actions
// 
export class HypeConfetti {
  constructor(origin, scene) {
    this.root   = new THREE.Group();
    this._scene = scene;
    this._age   = 0;
    this._done  = false;
    this._build(origin);
    scene.add(this.root);
  }

  _build(origin) {
    const count    = 80;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);

    // Accent colors: cyan, magenta, amber
    const palette = [
      [0, 1, 1],      // cyan
      [1, 0, 1],      // magenta
      [1, 0.7, 0],    // amber
      [0.8, 0.9, 1],  // light blue
    ];

    this._velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i*3]   = origin.x;
      positions[i*3+1] = origin.y;
      positions[i*3+2] = origin.z;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i*3]   = col[0];
      colors[i*3+1] = col[1];
      colors[i*3+2] = col[2];

      // Random burst velocity
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      const speed = 2 + Math.random() * 4;
      this._velocities.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.cos(phi)) * speed * 1.5,
        Math.sin(phi) * Math.sin(theta) * speed,
      ));
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    this._geo = geometry;
    this._pos = positions;

    const mat = new THREE.PointsMaterial({
      size:            0.12,
      vertexColors:    true,
      transparent:     true,
      depthWrite:      false,
      blending:        THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this._mat   = mat;
    this._points = new THREE.Points(geometry, mat);
    this.root.add(this._points);
  }

  update(dt) {
    this._age += dt;
    if (this._age > 2.5) {
      this._done = true;
      this._scene.remove(this.root);
      return;
    }

    const t   = this._age / 2.5;
    const pos = this._pos;
    const vel = this._velocities;

    for (let i = 0; i < vel.length; i++) {
      // Apply gravity
      vel[i].y -= 4 * dt;
      pos[i*3]   += vel[i].x * dt;
      pos[i*3+1] += vel[i].y * dt;
      pos[i*3+2] += vel[i].z * dt;
    }

    this._geo.attributes.position.needsUpdate = true;
    this._mat.opacity = 1 - t;
  }

  get done() { return this._done; }
}

// 
//  STEAM PUFF  extinguish FX (white/blue burst + flash). Shares confetti API.
// 
export class SteamPuff {
  constructor(origin, scene) {
    this.root = new THREE.Group();
    this._scene = scene; this._age = 0; this._done = false;
    const count = 46;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    this._vel = [];
    for (let i = 0; i < count; i++) {
      pos[i*3] = origin.x; pos[i*3+1] = origin.y; pos[i*3+2] = origin.z;
      const g = 0.75 + Math.random() * 0.25;
      col[i*3] = g; col[i*3+1] = g; col[i*3+2] = 1.0; // white-blue steam
      const a = Math.random() * Math.PI * 2; const sp = 0.4 + Math.random() * 1.4;
      this._vel.push(new THREE.Vector3(Math.cos(a) * sp * 0.7, 1.4 + Math.random() * 1.6, Math.sin(a) * sp * 0.7));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this._geo = geo; this._pos = pos;
    this._mat = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false, sizeAttenuation: true });
    this.root.add(new THREE.Points(geo, this._mat));
    this._flashMat = new THREE.MeshBasicMaterial({ color: 0xd6f2ff, transparent: true, opacity: 0.85 });
    this._flash = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), this._flashMat);
    this._flash.position.copy(origin);
    this.root.add(this._flash);
    scene.add(this.root);
  }
  update(dt) {
    this._age += dt;
    if (this._age > 1.2) { this._done = true; this._scene.remove(this.root); return; }
    const t = this._age / 1.2;
    for (let i = 0; i < this._vel.length; i++) {
      this._vel[i].y -= 1.0 * dt;
      this._pos[i*3]   += this._vel[i].x * dt;
      this._pos[i*3+1] += this._vel[i].y * dt;
      this._pos[i*3+2] += this._vel[i].z * dt;
    }
    this._geo.attributes.position.needsUpdate = true;
    this._mat.opacity = 0.92 * (1 - t);
    this._flash.scale.setScalar(0.3 + t * 1.4);
    this._flashMat.opacity = 0.85 * (1 - t);
  }
  get done() { return this._done; }
}

// 
//  DESK STATIONS  buildable workstations where hired employees sit
// 
export const DESK_SLOT_POSITIONS = [
  { x: -3.6, z: -1.0 }, { x: -2.2, z: -1.0 },
  { x: -3.6, z:  0.6 }, { x: -2.2, z:  0.6 },
  { x: -3.6, z:  2.2 }, { x: -2.2, z:  2.2 },
  // unlocked by office expansion (center columns)
  { x: -0.9, z: -1.0 }, { x:  0.5, z: -1.0 },
  { x: -0.9, z:  0.6 }, { x:  0.5, z:  0.6 },
  { x: -0.9, z:  2.2 }, { x:  0.5, z:  2.2 },
];

export const CHARACTER_PALETTE = [
  0x00FFFF, 0xFF00FF, 0xFFB300, 0x4CFF4C, 0x8A7CFF, 0xFF7A4C,
];

// Uniform scale applied to every character so people read at a believable
// size next to desks (0.55) and walls. Feet sit at local y=-0.22, so a
// standing walker's base y must be 0.22 * CHARACTER_SCALE.
export const CHARACTER_SCALE = 1.35;
export const CHARACTER_STAND_Y = 0.22 * CHARACTER_SCALE;

/**
 * Small low-poly person. Used for employees (colored hoodie)
 * and VCs (dark suit + tie).
 */
export class EmployeeCharacter {
  constructor({ color = COLORS.cyan, suit = false, walker = false, scale = CHARACTER_SCALE } = {}) {
    this.root    = new THREE.Group();
    this._energy = 1.0;
    this._burned = false;
    this._walker = walker;
    this._walkTarget = null;
    this._onArrive = null;
    this._scale = scale;
    this._walkSpeed = 1.7 * Math.sqrt(scale);
    this._legPhase = 0;
    this._legs = null;
    this._plumb = null;
    this._build(color, suit, walker);
    this.root.scale.setScalar(scale);
  }

  _build(color, suit, walker) {
    const bodyColor = suit ? 0x1A1A22 : color;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor, metalness: 0.3, roughness: 0.6,
      emissive: new THREE.Color(suit ? 0x000000 : color),
      emissiveIntensity: suit ? 0 : 0.12,
    });
    this.bodyMat = bodyMat;

    // Torso
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.32, 10), bodyMat);
    body.position.y = 0.16;
    body.castShadow = true;
    this.root.add(body);

    // Head
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xE8C9A8, metalness: 0.1, roughness: 0.7,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), headMat);
    head.position.y = 0.43;
    head.castShadow = true;
    this.root.add(head);

    // Arms (typing pose: angled forward)
    const armGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, bodyMat);
      arm.position.set(side * 0.12, 0.22, 0.08);
      arm.rotation.x = -1.1;
      arm.rotation.z = side * 0.25;
      this.root.add(arm);
    }

    if (suit) {
      // VC tie
      const tieMat = new THREE.MeshStandardMaterial({
        color: COLORS.magenta, emissive: new THREE.Color(COLORS.magenta),
        emissiveIntensity: 0.5,
      });
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.02), tieMat);
      tie.position.set(0, 0.24, 0.115);
      this.root.add(tie);
    } else if (!walker) {
      // Energy halo above the head: green  amber  red
      this.energyMat = new THREE.MeshStandardMaterial({
        color: COLORS.success,
        emissive: new THREE.Color(COLORS.success),
        emissiveIntensity: 1.2,
      });
      this.energyRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.07, 0.012, 8, 20), this.energyMat
      );
      this.energyRing.rotation.x = Math.PI / 2;
      this.energyRing.position.y = 0.6;
      this.root.add(this.energyRing);
    }

    if (walker) {
      // Legs (swing from the hip while walking)
      this._legs = [];
      const legGeo = new THREE.CylinderGeometry(0.038, 0.03, 0.22, 6);
      for (const side of [-1, 1]) {
        const legGroup = new THREE.Group();
        const legMesh = new THREE.Mesh(legGeo, bodyMat);
        legMesh.position.y = -0.11;
        legMesh.castShadow = true;
        legGroup.add(legMesh);
        legGroup.position.set(side * 0.055, 0.0, 0);
        this.root.add(legGroup);
        this._legs.push(legGroup);
      }
      // Sims-style plumbob: a floating green diamond marking the player
      const plumbMat = new THREE.MeshStandardMaterial({
        color: COLORS.success, emissive: new THREE.Color(COLORS.success), emissiveIntensity: 1.4,
      });
      this._plumb = new THREE.Mesh(new THREE.OctahedronGeometry(0.085), plumbMat);
      this._plumb.position.y = 0.78;
      this.root.add(this._plumb);
    }
  }

  /** Send this character walking to a floor position (x,z). */
  walkTo(x, z, onArrive = null) {
    this._walkTarget = { x, z };
    this._onArrive = onArrive;
  }

  /** Follow a list of {x,z} waypoints (from the pathfinder), then call onArrive. */
  walkPath(points, onArrive = null) {
    if (!points || !points.length) { this._path = null; if (onArrive) onArrive(); return; }
    this._path = points.slice();
    this._pathArrive = onArrive;
    this._advancePath();
  }
  _advancePath() {
    if (!this._path || !this._path.length) {
      this._path = null;
      const cb = this._pathArrive; this._pathArrive = null;
      if (cb) cb();
      return;
    }
    const pt = this._path.shift();
    this.walkTo(pt.x, pt.z, () => this._advancePath());
  }

  /** Quick sit-down / stand-up at the desk. */
  sit()   { this._sitTarget = 1; }
  stand() { this._sitTarget = 0; }

  isWalking() { return !!this._walkTarget; }

  /** Advance walking movement. Call with dt each frame for walkers. */
  updateWalk(dt) {
    if (!this._walkTarget) {
      if (this._legs) { this._legs[0].rotation.x = 0; this._legs[1].rotation.x = 0; }
      return;
    }
    const p = this.root.position;
    const dx = this._walkTarget.x - p.x;
    const dz = this._walkTarget.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.06) {
      p.x = this._walkTarget.x; p.z = this._walkTarget.z;
      this._walkTarget = null;
      if (this._legs) { this._legs[0].rotation.x = 0; this._legs[1].rotation.x = 0; }
      if (this._onArrive) { const cb = this._onArrive; this._onArrive = null; cb(); }
      return;
    }
    const step = Math.min(dist, this._walkSpeed * dt);
    const nx = p.x + (dx / dist) * step;
    const nz = p.z + (dz / dist) * step;

    // Basic collision: try full move, then slide along X, then along Z, else give up
    const R = 0.28 * this._scale;
    const blocked = (x, z) => (this.obstacles || []).some(o => Math.hypot(x - o.x, z - o.z) < o.r + R);
    if (!blocked(nx, nz)) { p.x = nx; p.z = nz; }
    else if (!blocked(nx, p.z)) { p.x = nx; }
    else if (!blocked(p.x, nz)) { p.z = nz; }
    else { this._walkTarget = null; if (this._legs) { this._legs[0].rotation.x = 0; this._legs[1].rotation.x = 0; } const cb = this._onArrive; this._onArrive = null; if (cb) cb(); return; }

    this.root.rotation.y = Math.atan2(dx, dz);
    this._legPhase += dt * 9;
    const a = Math.sin(this._legPhase) * 0.5;
    this._legs[0].rotation.x = a;
    this._legs[1].rotation.x = -a;
  }

  setEnergy(level, burnedOut = false) {
    if (!this.energyMat) return;
    this._energy = Math.max(0, Math.min(1, level));
    this._burned = burnedOut;

    const c = new THREE.Color();
    if (burnedOut) {
      c.set(0x444444);
    } else if (this._energy > 0.5) {
      c.lerpColors(new THREE.Color(COLORS.amber), new THREE.Color(COLORS.success), (this._energy - 0.5) / 0.5);
    } else {
      c.lerpColors(new THREE.Color(COLORS.error), new THREE.Color(COLORS.amber), this._energy / 0.5);
    }
    this.energyMat.color.set(c);
    this.energyMat.emissive.set(c);
    this.energyMat.emissiveIntensity = burnedOut ? 0.2 : 1.0 + (1 - this._energy);
  }

  /** Trigger a brief celebratory jump (launches, funding, era unlocks). */
  cheer(dur = 1.5) { this._cheerT = dur; }
  /** 0 = miserable/slumped, 1 = thriving/lively. Drives liveliness + posture. */
  setMood(m) { this._mood = Math.max(0, Math.min(1, m)); }

  update(time, seed = 0) {
    const dt = this._lastT == null ? 0 : Math.max(0, Math.min(0.1, time - this._lastT));
    this._lastT = time;
    if (this._cheerT > 0) this._cheerT -= dt;
    const cheering = this._cheerT > 0;
    const mood = this._mood == null ? 0.6 : this._mood;   // 0 sad .. 1 thriving
    const baseY = this._baseY || 0;
    const sitTarget = this._sitTarget || 0;
    this._sitAmt = (this._sitAmt || 0) + (sitTarget - (this._sitAmt || 0)) * Math.min(1, dt * 9);
    const sit = this._sitAmt;

    // Typing bob (livelier when happy) + occasional hop; cheering = real jumping.
    const s = this._scale || 1;
    const bob = this._burned ? 0 : Math.sin(time * 4 + seed * 1.7) * (0.008 * (0.6 + mood));
    let hop;
    if (cheering) hop = Math.abs(Math.sin(time * 11 + seed)) * 0.2;
    else hop = this._burned ? 0 : Math.pow(Math.max(0, Math.sin(time * 0.9 + seed * 2.3)), 16) * (0.10 + mood * 0.12);
    this.root.position.y = baseY + (bob + hop - 0.11 * sit) * s;

    // Posture: burnout slumps hardest, stress/unhappiness slumps a little, cheering leans back.
    const stressSlump = (!this._burned && mood < 0.45) ? (0.45 - mood) * 0.5 : 0;
    this.root.rotation.x = (this._burned ? 0.35 : (cheering ? -0.12 : stressSlump)) + 0.16 * sit;
    this.root.rotation.z = this._burned ? Math.sin(time * 20 + seed) * 0.01 : 0;

    if (this.energyRing) this.energyRing.rotation.z = time * 0.8;
    if (this._plumb) {
      this._plumb.rotation.y = time * 2.2;
      this._plumb.position.y = 0.82 + Math.sin(time * 2.5) * 0.03;
    }
  }

  setBasePosition(x, y, z) {
    this._baseY = y;
    this.root.position.set(x, y, z);
  }
}

/**
 * A buildable desk station: desk + chair, optional computer,
 * optional employee character.
 */
export class DeskStation {
  constructor(slotIndex, hasComputer = false, position = null) {
    this.root      = new THREE.Group();
    this.slotIndex = slotIndex;
    this.character = null;
    this._build();
    this.monitorGroup.visible = hasComputer;

    const slot = position || DESK_SLOT_POSITIONS[slotIndex % DESK_SLOT_POSITIONS.length];
    this.root.position.set(slot.x, 0, slot.z);
  }

  _build() {
    const root = this.root;

    // Desk top
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.6), obsidianMat(0x0D0D0D));
    top.position.y = 0.55;
    top.castShadow = top.receiveShadow = true;
    root.add(top);

    // Cyan edge strip on the desk
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.012, 0.02),
      new THREE.MeshStandardMaterial({
        color: COLORS.cyan, emissive: new THREE.Color(COLORS.cyan), emissiveIntensity: 0.6,
      })
    );
    strip.position.set(0, 0.585, 0.3);
    root.add(strip);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.05, 0.55, 0.05);
    const legMat = chromeMat();
    for (const [lx, lz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 0.275, lz);
      root.add(leg);
    }

    // Chair (behind desk, +z side)
    const chairMat = obsidianMat(0x111111);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), chairMat);
    seat.position.set(0, 0.32, 0.65);
    root.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.05), chairMat);
    back.position.set(0, 0.55, 0.85);
    root.add(back);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), legMat);
    pole.position.set(0, 0.16, 0.65);
    root.add(pole);

    // Computer (monitor + base)  hidden until purchased
    this.monitorGroup = new THREE.Group();
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.025), obsidianMat(0x0A0A0A));
    this.monitorGroup.add(screen);
    this.displayMat = new THREE.MeshStandardMaterial({
      color: COLORS.obsidianDeep,
      emissive: new THREE.Color(0x002244),
      emissiveIntensity: 0.9,
    });
    const display = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.26, 0.01), this.displayMat);
    display.position.z = 0.018;
    this.monitorGroup.add(display);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), legMat);
    stand.position.y = -0.21;
    this.monitorGroup.add(stand);
    // Monitor sits on the back edge of the desk facing the chair (+z)
    this.monitorGroup.position.set(0, 0.78, -0.18);
    root.add(this.monitorGroup);
  }

  addComputer() {
    this.monitorGroup.visible = true;
  }

  setEmployee(colorIdx) {
    if (this.character) this.root.remove(this.character.root);
    this.character = new EmployeeCharacter({
      color: CHARACTER_PALETTE[colorIdx % CHARACTER_PALETTE.length],
    });
    // Seated on the chair, facing the monitor (-z)
    this.character.setBasePosition(0, 0.36, 0.55);
    this.character.root.rotation.y = Math.PI;
    this.root.add(this.character.root);
  }

  clearEmployee() {
    if (this.character) { this.root.remove(this.character.root); this.character = null; }
  }

  setEnergy(level, burnedOut) {
    if (this.character) this.character.setEnergy(level, burnedOut);
  }

  setMood(m) { if (this.character) this.character.setMood(m); }
  cheer(dur) { if (this.character) this.character.cheer(dur); }

  update(time, seed = 0) {
    if (this.monitorGroup.visible) {
      const pulse = 0.6 + 0.25 * Math.sin(time * 1.4 + seed * 2.1);
      this.displayMat.emissiveIntensity = pulse;
    }
    if (this.character) this.character.update(time, seed);
  }

  addToScene(scene) { scene.add(this.root); }
}

// 
//  PRODUCT SHOWCASE  shipped absurd products float along the back wall
// 
function productGeometry(shape) {
  switch (shape) {
    case 'sphere':       return new THREE.SphereGeometry(0.16, 24, 18);
    case 'cone':         return new THREE.ConeGeometry(0.16, 0.3, 6);
    case 'cylinder':     return new THREE.CylinderGeometry(0.13, 0.13, 0.28, 16);
    case 'octahedron':   return new THREE.OctahedronGeometry(0.18);
    case 'icosahedron':  return new THREE.IcosahedronGeometry(0.18);
    case 'torus':        return new THREE.TorusGeometry(0.13, 0.055, 12, 24);
    case 'dodecahedron': return new THREE.DodecahedronGeometry(0.18);
    default:             return new THREE.BoxGeometry(0.26, 0.26, 0.26);
  }
}

export class ProductShowcase {
  constructor() {
    this.root     = new THREE.Group();
    this.products = [];
    this._buildShelf();
  }

  _buildShelf() {
    // Thin glowing ledge along the back-right wall
    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.04, 0.4),
      obsidianMat(0x141414)
    );
    ledge.position.set(2.6, 0.85, -3.4);
    ledge.castShadow = true;
    this.root.add(ledge);

    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.01, 0.02),
      new THREE.MeshStandardMaterial({
        color: COLORS.magenta, emissive: new THREE.Color(COLORS.magenta), emissiveIntensity: 0.7,
      })
    );
    glow.position.set(2.6, 0.88, -3.2);
    this.root.add(glow);
  }

  addProduct(idx, brand) {
    const colorHex = (brand && brand.color) || CHARACTER_PALETTE[idx % CHARACTER_PALETTE.length];
    const color = new THREE.Color(colorHex);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color.clone(),
      emissiveIntensity: 0.7,
      metalness: 0.6, roughness: 0.25,
      transparent: true, opacity: 0.95,
    });
    const cube = new THREE.Mesh(productGeometry(brand && brand.shape), mat);
    const x = 1.15 + (idx % 6) * 0.55;
    const y = 1.15 + Math.floor(idx / 6) * 0.5;
    cube.position.set(x, y, -3.4);
    cube.userData.baseY = y;
    cube.userData.seed  = idx * 1.37;
    this.root.add(cube);
    this.products.push(cube);
  }

  reset() {
    for (const p of this.products) this.root.remove(p);
    this.products = [];
  }

  update(time) {
    for (const p of this.products) {
      p.rotation.y = time * 0.6 + p.userData.seed;
      p.rotation.x = Math.sin(time * 0.4 + p.userData.seed) * 0.2;
      p.position.y = p.userData.baseY + Math.sin(time * 1.1 + p.userData.seed) * 0.04;
    }
  }

  addToScene(scene) { scene.add(this.root); }
}

// 
//  FACILITIES  buildable devices & rooms placed around the office
// 
const FACILITY_SPOTS = {
  espresso:   { x: -1.0, z:  3.2 },
  gpu:        { x:  3.7, z: -0.6 },
  neon:       { x: -2.6, z: -3.86 },
  dashboard:  { x: -0.6, z: -3.86 },
  sprinkler:  { x:  0.0, z: -1.2 },
  serverroom: { x:  3.4, z: -2.4 },
  breakroom:  { x: -3.6, z:  3.1 },
  warroom:    { x:  2.1, z: -0.7 },
  lab:        { x:  1.3, z:  3.0 },
  legal:      { x: -3.7, z: -2.9 },
  cafeteria:  { x:  2.8, z:  3.0 },
  datacenter: { x:  1.8, z: -3.0 },
};

function emissiveMat(color, i = 0.7) {
  return new THREE.MeshStandardMaterial({
    color, emissive: new THREE.Color(color), emissiveIntensity: i,
    metalness: 0.5, roughness: 0.3,
  });
}

function buildRoomZone(root, { w = 1.6, d = 1.6, color = COLORS.cyan }) {
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.04, d),
    new THREE.MeshStandardMaterial({ color: COLORS.obsidianLight, metalness: 0.6, roughness: 0.4 })
  );
  pad.position.y = 0.02; pad.receiveShadow = true; root.add(pad);

  const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.012, d + 0.03), emissiveMat(color, 0.6));
  rim.position.y = 0.05; root.add(rim);

  const gm = glassMat(0.16); gm.color.set(color);
  gm.emissive = new THREE.Color(color); gm.emissiveIntensity = 0.05;
  const wallB = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.04), gm.clone()); wallB.position.set(0, 0.37, -d / 2); root.add(wallB);
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, d), gm.clone()); wallL.position.set(-w / 2, 0.37, 0); root.add(wallL);
}

function signPost(color, y = 0.95) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, y, 6), chromeMat());
  post.position.y = y / 2; g.add(post);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.03), emissiveMat(color, 0.9));
  sign.position.y = y; g.add(sign);
  return g;
}

/**
 * Build a 3D representation for a facility id, positioned at its office spot.
 * Returns a THREE.Group (add to scene). Geometry is procedural/placeholder.
 */
export function buildFacility(id) {
  const spot = FACILITY_SPOTS[id] || { x: 0, z: 0 };
  const root = new THREE.Group();

  switch (id) {
    case 'espresso': {
      const counter = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.4), obsidianMat(0x141414));
      counter.position.y = 0.25; counter.castShadow = true; root.add(counter);
      const machine = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.25), chromeMat());
      machine.position.set(0, 0.65, 0); root.add(machine);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.02), emissiveMat(COLORS.success, 1));
      led.position.set(0, 0.7, 0.13); root.add(led);
      break;
    }
    case 'gpu': {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.4), obsidianMat(0x0E0E12));
      tower.position.y = 0.6; tower.castShadow = true; root.add(tower);
      for (let i = 0; i < 5; i++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.02), emissiveMat(COLORS.cyan, 1.4));
        led.position.set(0, 0.25 + i * 0.2, 0.21); root.add(led);
      }
      break;
    }
    case 'neon': {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.04), emissiveMat(COLORS.magenta, 1.3));
      sign.position.set(0, 1.3, 0); root.add(sign);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.02), emissiveMat(COLORS.cyan, 1));
      bar.position.set(0, 1.02, 0.02); root.add(bar);
      break;
    }
    case 'dashboard': {
      const screen = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.04), obsidianMat(0x0A0A0A));
      screen.position.set(0, 1.25, 0); root.add(screen);
      const disp = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.52, 0.01), emissiveMat(COLORS.cyan, 0.7));
      disp.position.set(0, 1.25, 0.025); root.add(disp);
      for (let i = 0; i < 4; i++) {
        const h = 0.1 + i * 0.08;
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.005), emissiveMat(COLORS.success, 1));
        b.position.set(-0.3 + i * 0.2, 1.06 + h / 2, 0.03); root.add(b);
      }
      break;
    }
    case 'sprinkler': {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 8), chromeMat());
      pipe.rotation.z = Math.PI / 2; pipe.position.set(0, 2.3, 0); root.add(pipe);
      for (const px of [-1, 0, 1]) {
        const noz = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 8), emissiveMat(COLORS.cyan, 0.8));
        noz.position.set(px, 2.2, 0); root.add(noz);
      }
      break;
    }
    case 'serverroom': {
      buildRoomZone(root, { w: 1.8, d: 1.8, color: COLORS.cyan });
      for (const dx of [-0.45, 0.45]) {
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.3), obsidianMat(0x101016));
        rack.position.set(dx, 0.5, -0.4); root.add(rack);
        for (let i = 0; i < 4; i++) {
          const l = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.02), emissiveMat(COLORS.success, 1.2));
          l.position.set(dx, 0.25 + i * 0.2, -0.24); root.add(l);
        }
      }
      root.add(signPost(COLORS.cyan));
      break;
    }
    case 'breakroom': {
      buildRoomZone(root, { w: 1.6, d: 1.6, color: COLORS.amber });
      const couch = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.4), obsidianMat(0x16160F));
      couch.position.set(0, 0.2, -0.3); root.add(couch);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.1), obsidianMat(0x16160F));
      back.position.set(0, 0.35, -0.5); root.add(back);
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), emissiveMat(COLORS.success, 0.4));
      plant.position.set(0.5, 0.4, 0.4); root.add(plant);
      root.add(signPost(COLORS.amber));
      break;
    }
    case 'warroom': {
      buildRoomZone(root, { w: 1.6, d: 1.4, color: COLORS.amber });
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 20), glassMat(0.4));
      table.position.y = 0.6; root.add(table);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), chromeMat());
      pole.position.y = 0.3; root.add(pole);
      root.add(signPost(COLORS.amber));
      break;
    }
    case 'lab': {
      buildRoomZone(root, { w: 1.5, d: 1.5, color: COLORS.success });
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.35), obsidianMat(0x0E140E));
      bench.position.set(0, 0.25, -0.3); root.add(bench);
      const beaker = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.25, 12), glassMat(0.5));
      beaker.position.set(0, 0.62, -0.3); root.add(beaker);
      const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 12), emissiveMat(COLORS.success, 1));
      liquid.position.set(0, 0.56, -0.3); root.add(liquid);
      root.add(signPost(COLORS.success));
      break;
    }
    case 'legal': {
      buildRoomZone(root, { w: 1.5, d: 1.5, color: COLORS.amber });
      const desk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.4), obsidianMat(0x141414));
      desk.position.set(0, 0.25, -0.3); root.add(desk);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.02), chromeMat());
      beam.position.set(0, 0.85, -0.3); root.add(beam);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), chromeMat());
      stand.position.set(0, 0.7, -0.3); root.add(stand);
      for (const dx of [-0.22, 0.22]) {
        const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12), emissiveMat(COLORS.amber, 0.6));
        pan.position.set(dx, 0.78, -0.3); root.add(pan);
      }
      root.add(signPost(COLORS.amber));
      break;
    }
    case 'cafeteria': {
      buildRoomZone(root, { w: 1.7, d: 1.5, color: COLORS.amber });
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.4), obsidianMat(0x16140E));
      counter.position.set(0, 0.25, -0.4); root.add(counter);
      for (const dx of [-0.3, 0, 0.3]) {
        const tray = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.18), emissiveMat(COLORS.amber, 0.5));
        tray.position.set(dx, 0.54, -0.4); root.add(tray);
      }
      root.add(signPost(COLORS.amber));
      break;
    }
    case 'datacenter': {
      buildRoomZone(root, { w: 1.9, d: 1.7, color: COLORS.cyan });
      for (const dx of [-0.55, 0, 0.55]) {
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.25, 0.32), obsidianMat(0x0C0C14));
        rack.position.set(dx, 0.62, -0.45); root.add(rack);
        for (let i = 0; i < 5; i++) {
          const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.02), emissiveMat(COLORS.cyan, 1.3));
          l.position.set(dx, 0.25 + i * 0.22, -0.28); root.add(l);
        }
      }
      root.add(signPost(COLORS.cyan));
      break;
    }
    default: {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), emissiveMat(COLORS.cyan, 0.6));
      box.position.y = 0.25; root.add(box);
    }
  }

  root.position.set(spot.x, 0, spot.z);
  return root;
}

// 
//  PITCH ROOM  VC meeting corner. VCs materialize when you pitch.
// 
export class PitchRoom {
  constructor() {
    this.root = new THREE.Group();
    this.vcs  = [];
    this._build();
    this.root.position.set(3.3, 0, 2.0);
  }

  _build() {
    const root = this.root;

    // Round glass table
    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.05, 24),
      glassMat(0.45)
    );
    tableTop.material.emissive = new THREE.Color(COLORS.amber);
    tableTop.material.emissiveIntensity = 0.08;
    tableTop.position.y = 0.72;
    tableTop.castShadow = true;
    root.add(tableTop);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 10), chromeMat());
    pole.position.y = 0.36;
    root.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.04, 16), obsidianMat(0x101010));
    base.position.y = 0.02;
    root.add(base);

    // Floating holo pitch screen above the table
    this.holoMat = new THREE.MeshStandardMaterial({
      color: COLORS.cyan,
      emissive: new THREE.Color(COLORS.cyan),
      emissiveIntensity: 0.5,
      transparent: true, opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.holo = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), this.holoMat);
    this.holo.position.set(0, 1.45, 0);
    this.holo.rotation.y = -Math.PI / 4;
    root.add(this.holo);

    // VC chairs on the far side (+x, away from the office)
    const chairMat = obsidianMat(0x16161C);
    const chairSpots = [
      { x: 0.85, z: -0.4, ry: -Math.PI / 2 - 0.3 },
      { x: 0.85, z:  0.4, ry: -Math.PI / 2 + 0.3 },
    ];
    this._chairSpots = chairSpots;

    for (const spot of chairSpots) {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), chairMat);
      seat.position.y = 0.34;
      g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.05), chairMat);
      back.position.set(0, 0.58, 0.2);
      g.add(back);
      g.position.set(spot.x, 0, spot.z);
      g.rotation.y = spot.ry;
      root.add(g);
    }

    // Glowing amber floor ring marking the pitch zone
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.015, 8, 48),
      new THREE.MeshStandardMaterial({
        color: COLORS.amber, emissive: new THREE.Color(COLORS.amber), emissiveIntensity: 0.6,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    root.add(ring);

    // VC avatars (hidden until a pitch starts)
    for (let i = 0; i < 2; i++) {
      const vc = new EmployeeCharacter({ suit: true });
      const spot = chairSpots[i];
      vc.setBasePosition(spot.x, 0.38, spot.z);
      vc.root.rotation.y = spot.ry;
      vc.root.visible = false;
      this.vcs.push(vc);
      root.add(vc.root);
    }
  }

  showVCs() {
    for (const vc of this.vcs) vc.root.visible = true;
    this.holoMat.emissiveIntensity = 1.2;
    this.holoMat.opacity = 0.55;
  }

  hideVCs() {
    for (const vc of this.vcs) vc.root.visible = false;
    this.holoMat.emissiveIntensity = 0.5;
    this.holoMat.opacity = 0.35;
  }

  update(time) {
    this.holo.rotation.y = -Math.PI / 4 + Math.sin(time * 0.5) * 0.1;
    for (let i = 0; i < this.vcs.length; i++) {
      if (this.vcs[i].root.visible) this.vcs[i].update(time, i * 3.1);
    }
  }

  addToScene(scene) { scene.add(this.root); }
}
