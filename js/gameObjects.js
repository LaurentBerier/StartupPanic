/**
 * gameObjects.js — All 3D game entity classes for AI Startup Panic Simulator.
 *
 * Every object uses a root THREE.Group so gameplay code stays stable
 * when real GLB assets replace placeholders.
 *
 * ASSET SLOT CONSTANTS: search for "ASSET_SLOT" to find where real
 * GLB models should be loaded.
 */

const THREE = window.THREE;

// ─── Color Constants (Style Guide) ───────────────────────────────────────────
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

// ─── Shared Materials Cache ────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
//  PLATFORM — Office Diorama Base
// ═══════════════════════════════════════════════════════════════════════════════
export class OfficePlatform {
  constructor() {
    // ASSET_SLOT: office_diorama_platform — replace with GLB
    this.root = new THREE.Group();
    this._build();
  }

  _build() {
    const root = this.root;

    // Main platform slab
    const slabGeo  = new THREE.BoxGeometry(10, 0.4, 8);
    const slabMat  = obsidianMat(COLORS.obsidianDeep);
    const slab     = new THREE.Mesh(slabGeo, slabMat);
    slab.castShadow    = true;
    slab.receiveShadow = true;
    root.add(slab);

    // Beveled top edge trim (thin ring)
    const trimGeo = new THREE.BoxGeometry(10.1, 0.06, 8.1);
    const trimMat = new THREE.MeshStandardMaterial({
      color: COLORS.border, metalness: 0.9, roughness: 0.1,
    });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.y = 0.23;
    root.add(trim);

    // Bottom bevel
    const bottomTrim = new THREE.Mesh(trimGeo, trimMat);
    bottomTrim.position.y = -0.23;
    root.add(bottomTrim);

    // Low obsidian walls (3 sides; front is open for visibility)
    const wallMat = obsidianMat(0x111111);
    const wallConfigs = [
      { w: 10, h: 0.6, d: 0.15, x: 0,    y: 0.5, z: -4  }, // back
      { w: 0.15, h: 0.6, d: 8,  x: -5,   y: 0.5, z: 0   }, // left
      { w: 0.15, h: 0.6, d: 8,  x:  5,   y: 0.5, z: 0   }, // right
    ];
    for (const cfg of wallConfigs) {
      const wGeo = new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d);
      const wall = new THREE.Mesh(wGeo, wallMat);
      wall.position.set(cfg.x, cfg.y, cfg.z);
      wall.castShadow = true;
      root.add(wall);
    }

    // Frosted glass panels along walls (cyan-tinted)
    const panelMat = glassMat(0.15);
    panelMat.color.set(COLORS.obsidianLight);
    const panelConfigs = [
      { w: 9.5, h: 0.8, d: 0.05, x: 0,    y: 0.9, z: -3.9 },
      { w: 0.05, h: 0.8, d: 7.5, x: -4.9, y: 0.9, z: 0    },
      { w: 0.05, h: 0.8, d: 7.5, x:  4.9, y: 0.9, z: 0    },
    ];
    for (const cfg of panelConfigs) {
      const pGeo   = new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d);
      const panel  = new THREE.Mesh(pGeo, panelMat.clone());
      panel.material.emissive = new THREE.Color(COLORS.cyan);
      panel.material.emissiveIntensity = 0.05;
      panel.position.set(cfg.x, cfg.y, cfg.z);
      root.add(panel);
    }

    // Void base (floating platform — thin pillar under slab)
    const pillarGeo = new THREE.BoxGeometry(0.4, 3, 0.4);
    const pillarMat = obsidianMat(0x080808);
    for (const [px, pz] of [[-4.5,3.5],[-4.5,-3.5],[4.5,3.5],[4.5,-3.5]]) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, -1.7, pz);
      root.add(pillar);
    }

    // Floor surface with subtle grid texture via vertex colors isn't trivial;
    // use a slightly lighter obsidian plane for the desk area
    const deskFloorGeo = new THREE.BoxGeometry(6, 0.02, 5);
    const deskFloorMat = new THREE.MeshStandardMaterial({
      color: COLORS.obsidianLight, metalness: 0.7, roughness: 0.3,
    });
    const deskFloor = new THREE.Mesh(deskFloorGeo, deskFloorMat);
    deskFloor.position.set(0, 0.21, 0.5);
    deskFloor.receiveShadow = true;
    root.add(deskFloor);

    // Cyan edge glow lines (emissive thin bars)
    const edgeMat = new THREE.MeshStandardMaterial({
      color: COLORS.cyan, emissive: new THREE.Color(COLORS.cyan),
      emissiveIntensity: 0.8,
    });
    const edgeConfigs = [
      { w: 10.1, h: 0.02, d: 0.02, x: 0,  y: 0.21, z: -4 },
      { w: 10.1, h: 0.02, d: 0.02, x: 0,  y: 0.21, z:  4 },
      { w: 0.02, h: 0.02, d: 8,    x:-5,  y: 0.21, z:  0 },
      { w: 0.02, h: 0.02, d: 8,    x: 5,  y: 0.21, z:  0 },
    ];
    for (const cfg of edgeConfigs) {
      const eGeo = new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d);
      const edge = new THREE.Mesh(eGeo, edgeMat);
      edge.position.set(cfg.x, cfg.y, cfg.z);
      root.add(edge);
    }

    root.position.y = -0.2;
  }

  addToScene(scene) { scene.add(this.root); }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  OFFICE FURNITURE
// ═══════════════════════════════════════════════════════════════════════════════
export class OfficeFurniture {
  constructor() {
    // ASSET_SLOT: minimal_office_furniture — replace with GLB
    this.root = new THREE.Group();
    this._build();
  }

  _build() {
    this._buildDesk();
    this._buildChair();
    this._buildServerRacks();
    this._buildMonitors();
  }

  _buildDesk() {
    const g = new THREE.Group();

    // Desk surface — dark with glass inlay
    const topGeo = new THREE.BoxGeometry(3, 0.08, 1.4);
    const topMat = obsidianMat(0x0D0D0D);
    const top    = new THREE.Mesh(topGeo, topMat);
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);

    // Glass surface inlay (frosted with cyan edge)
    const glassGeo = new THREE.BoxGeometry(2.6, 0.01, 1.0);
    const glassMesh = new THREE.Mesh(glassGeo, glassMat(0.4));
    glassMesh.material.emissive    = new THREE.Color(COLORS.cyan);
    glassMesh.material.emissiveIntensity = 0.06;
    glassMesh.position.y = 0.045;
    g.add(glassMesh);

    // Desk legs
    const legGeo = new THREE.BoxGeometry(0.08, 0.8, 0.08);
    const legMat = chromeMat();
    for (const [lx, lz] of [[-1.4, -0.6], [-1.4, 0.6], [1.4, -0.6], [1.4, 0.6]]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, -0.44, lz);
      g.add(leg);
    }

    g.position.set(0, 0.62, 0);
    this.root.add(g);
  }

  _buildChair() {
    const g = new THREE.Group();
    const mat = obsidianMat(0x111111);
    const chromM = chromeMat();

    // Seat
    const seatGeo = new THREE.BoxGeometry(0.7, 0.1, 0.7);
    g.add(new THREE.Mesh(seatGeo, mat));

    // Back
    const backGeo = new THREE.BoxGeometry(0.7, 0.9, 0.08);
    const back = new THREE.Mesh(backGeo, mat);
    back.position.set(0, 0.5, -0.31);
    back.rotation.x = 0.1;
    g.add(back);

    // Arm rests
    const armGeo = new THREE.BoxGeometry(0.06, 0.06, 0.6);
    for (const ax of [-0.35, 0.35]) {
      const arm = new THREE.Mesh(armGeo, chromM);
      arm.position.set(ax, 0.2, -0.05);
      g.add(arm);
    }

    // Base pole
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8);
    const pole    = new THREE.Mesh(poleGeo, chromM);
    pole.position.y = -0.3;
    g.add(pole);

    // 5-star base
    const baseGeo = new THREE.CylinderGeometry(0.04, 0.4, 0.06, 5);
    const base    = new THREE.Mesh(baseGeo, chromM);
    base.position.y = -0.56;
    g.add(base);

    g.position.set(0, 0.33, 1.4);
    this.root.add(g);
  }

  _buildServerRacks() {
    // Two server rack towers — these are where fires spawn
    const rackGeo = new THREE.BoxGeometry(0.6, 1.4, 0.4);
    const rackMat = obsidianMat(0x111111);

    const rackPositions = [
      { x: -3.5, z: -2.5, name: 'rack_left'  },
      { x:  3.5, z: -2.5, name: 'rack_right' },
    ];

    this.serverRacks = [];

    for (const cfg of rackPositions) {
      const rack = new THREE.Group();
      rack.name = cfg.name;

      const body = new THREE.Mesh(rackGeo, rackMat.clone());
      body.castShadow = body.receiveShadow = true;
      rack.add(body);

      // Rack unit stripes (visual detail)
      const stripeMat = new THREE.MeshStandardMaterial({
        color: COLORS.border, metalness: 0.7, roughness: 0.3,
      });
      for (let i = 0; i < 5; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.58, 0.04, 0.38),
          stripeMat
        );
        stripe.position.y = -0.6 + i * 0.28;
        rack.add(stripe);
      }

      // LED indicator row
      const ledMat = new THREE.MeshStandardMaterial({
        color: COLORS.success,
        emissive: new THREE.Color(COLORS.success),
        emissiveIntensity: 1,
      });
      rack.userData.ledMat = ledMat;

      for (let i = 0; i < 4; i++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), ledMat.clone());
        led.position.set(-0.2 + i * 0.13, 0.6, 0.21);
        rack.add(led);
      }

      rack.position.set(cfg.x, 0.9, cfg.z);
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

// ═══════════════════════════════════════════════════════════════════════════════
//  MERCURY AI CORE — Liquid mercury sphere with custom shader displacement
// ═══════════════════════════════════════════════════════════════════════════════
export class MercuryAICore {
  constructor() {
    // ASSET_SLOT: mercury_ai_core — replace with GLB + retain shader wrapper
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

          // Base metallic color — silver-gray
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
   * Set hype level (0..1) — drives cyan glow intensity.
   */
  setHype(level) {
    this._hypeLevel = Math.max(0, Math.min(1, level));
  }

  /**
   * Set stress level (0..1) — drives surface turbulence and magenta flash.
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

// ═══════════════════════════════════════════════════════════════════════════════
//  SERVER FIRE — Physical fire placeholder on a server rack
// ═══════════════════════════════════════════════════════════════════════════════
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
    this.root.position.y += 0.7;
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

// ═══════════════════════════════════════════════════════════════════════════════
//  HYPE CONFETTI — Particle burst on successful actions
// ═══════════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════════
//  DESK STATIONS — buildable workstations where hired employees sit
// ═══════════════════════════════════════════════════════════════════════════════
export const DESK_SLOT_POSITIONS = [
  { x: -3.6, z: -1.0 }, { x: -2.2, z: -1.0 },
  { x: -3.6, z:  0.6 }, { x: -2.2, z:  0.6 },
  { x: -3.6, z:  2.2 }, { x: -2.2, z:  2.2 },
];

export const CHARACTER_PALETTE = [
  0x00FFFF, 0xFF00FF, 0xFFB300, 0x4CFF4C, 0x8A7CFF, 0xFF7A4C,
];

/**
 * Small low-poly person. Used for employees (colored hoodie)
 * and VCs (dark suit + tie).
 */
export class EmployeeCharacter {
  constructor({ color = COLORS.cyan, suit = false } = {}) {
    this.root    = new THREE.Group();
    this._energy = 1.0;
    this._burned = false;
    this._build(color, suit);
  }

  _build(color, suit) {
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
    } else {
      // Energy halo above the head: green → amber → red
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

  update(time, seed = 0) {
    // Typing bob
    const bob = this._burned ? 0 : Math.sin(time * 4 + seed * 1.7) * 0.01;
    this.root.position.y = this._baseY + bob;
    // Burnout slump + twitch
    this.root.rotation.x = this._burned ? 0.35 : 0;
    if (this._burned) {
      this.root.rotation.z = Math.sin(time * 20 + seed) * 0.01;
    }
    if (this.energyRing) this.energyRing.rotation.z = time * 0.8;
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
  constructor(slotIndex, hasComputer = false) {
    this.root      = new THREE.Group();
    this.slotIndex = slotIndex;
    this.character = null;
    this._build();
    this.monitorGroup.visible = hasComputer;

    const slot = DESK_SLOT_POSITIONS[slotIndex % DESK_SLOT_POSITIONS.length];
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

    // Computer (monitor + base) — hidden until purchased
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

  setEnergy(level, burnedOut) {
    if (this.character) this.character.setEnergy(level, burnedOut);
  }

  update(time, seed = 0) {
    if (this.monitorGroup.visible) {
      const pulse = 0.6 + 0.25 * Math.sin(time * 1.4 + seed * 2.1);
      this.displayMat.emissiveIntensity = pulse;
    }
    if (this.character) this.character.update(time, seed);
  }

  addToScene(scene) { scene.add(this.root); }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCT SHOWCASE — shipped absurd products float along the back wall
// ═══════════════════════════════════════════════════════════════════════════════
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

  addProduct(idx) {
    const color = CHARACTER_PALETTE[idx % CHARACTER_PALETTE.length];
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.7,
      metalness: 0.6, roughness: 0.25,
      transparent: true, opacity: 0.95,
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), mat);
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

// ═══════════════════════════════════════════════════════════════════════════════
//  PITCH ROOM — VC meeting corner. VCs materialize when you pitch.
// ═══════════════════════════════════════════════════════════════════════════════
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
