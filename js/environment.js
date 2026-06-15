/**
 * environment.js — Ambient environment elements for the Pre-Revenue void.
 *
 * Creates:
 *  - Floating void particles (distant dots suggesting infinite depth)
 *  - Subtle grid plane far below the platform
 *  - Cyan accent "data stream" lines
 *  - Distant ambient glow spheres
 */

const THREE = window.THREE;

// ─── Void Particles ────────────────────────────────────────────────────────────
export class VoidParticles {
  constructor() {
    this.root = new THREE.Group();
    this._build();
  }

  _build() {
    const count     = 800;
    const geometry  = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);

    // Color palette — very dim cyans, magentas, neutral blues
    const palette = [
      [0, 0.08, 0.08],   // very dim cyan
      [0.08, 0, 0.08],   // very dim magenta
      [0.05, 0.05, 0.1], // dim blue
      [0.04, 0.04, 0.04],// near black
    ];

    for (let i = 0; i < count; i++) {
      // Scatter in a large sphere around the platform
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(Math.random() * 2 - 1);
      const r     = 15 + Math.random() * 40;

      positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = (Math.random() - 0.5) * 30;
      positions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i*3]   = col[0];
      colors[i*3+1] = col[1];
      colors[i*3+2] = col[2];

      sizes[i] = 0.5 + Math.random() * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size:            0.08,
      vertexColors:    true,
      transparent:     true,
      opacity:         0.6,
      depthWrite:      false,
      blending:        THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this._points = new THREE.Points(geometry, mat);
    this.root.add(this._points);
  }

  update(time) {
    // Very slow rotation for subtle depth parallax
    this.root.rotation.y = time * 0.005;
    this.root.rotation.x = Math.sin(time * 0.003) * 0.05;
  }

  addToScene(scene) { scene.add(this.root); }
}

// ─── Grid Plane (infinite floor grid suggestion) ─────────────────────────────
export function createVoidGrid() {
  const group = new THREE.Group();

  // A very subtle grid far below — suggests infinite corporate void
  const gridHelper = new THREE.GridHelper(100, 50, 0x1a1a2e, 0x0D0D1A);
  gridHelper.position.y = -8;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity     = 0.2;
  group.add(gridHelper);

  return group;
}

// ─── Ambient Glow Orbs ────────────────────────────────────────────────────────
export function createAmbientOrbs() {
  const group = new THREE.Group();

  // Distant glow spheres — visual depth anchors
  const orbDefs = [
    { pos: [-12, -3, -8],  color: 0x001133, size: 2.0, opacity: 0.4 },
    { pos: [ 14, -2, -10], color: 0x110022, size: 1.5, opacity: 0.3 },
    { pos: [ -8,  5, -18], color: 0x001122, size: 3.0, opacity: 0.2 },
    { pos: [  6, -6,  12], color: 0x0a0015, size: 1.0, opacity: 0.25 },
  ];

  for (const def of orbDefs) {
    const geo = new THREE.SphereGeometry(def.size, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color:       def.color,
      transparent: true,
      opacity:     def.opacity,
      depthWrite:  false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...def.pos);
    group.add(mesh);
  }

  // Cyan glow light source (large, distant point light for atmospheric fill)
  const cyanGlow = new THREE.PointLight(0x002244, 0.5, 30);
  cyanGlow.position.set(-10, 2, -10);
  group.add(cyanGlow);

  const magentaGlow = new THREE.PointLight(0x220022, 0.3, 25);
  magentaGlow.position.set(10, -2, -8);
  group.add(magentaGlow);

  return group;
}

// ─── Floating Data Stream Lines ───────────────────────────────────────────────
export class DataStreams {
  constructor() {
    this.root    = new THREE.Group();
    this._lines  = [];
    this._build();
  }

  _build() {
    // Vertical cyan data-stream lines suggesting server data flow
    const streamCount = 8;
    for (let i = 0; i < streamCount; i++) {
      const angle  = (i / streamCount) * Math.PI * 2;
      const radius = 6 + Math.random() * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const length  = 2 + Math.random() * 3;
      const startY  = -2 + Math.random() * 4;

      const points = [
        new THREE.Vector3(x, startY,          z),
        new THREE.Vector3(x, startY + length, z),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color:       0x00FFFF,
        transparent: true,
        opacity:     0.06 + Math.random() * 0.08,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geo, mat);
      this.root.add(line);

      this._lines.push({
        line,
        startY,
        length,
        speed:   0.3 + Math.random() * 0.5,
        x, z,
        opacity: mat.opacity,
        mat,
      });
    }
  }

  update(time) {
    for (const s of this._lines) {
      // Lines drift upward and wrap
      const offset = (time * s.speed) % 8;
      const points = [
        new THREE.Vector3(s.x, s.startY + offset,            s.z),
        new THREE.Vector3(s.x, s.startY + offset + s.length, s.z),
      ];
      s.line.geometry.setFromPoints(points);
      s.line.geometry.attributes.position.needsUpdate = true;

      // Fade in/out
      const phase       = ((time * s.speed) % 1);
      s.mat.opacity     = s.opacity * Math.sin(phase * Math.PI);
    }
  }

  addToScene(scene) { scene.add(this.root); }
}
