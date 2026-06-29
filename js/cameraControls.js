/**
 * cameraControls.js  Orbit-style camera controls for Pre-Revenue.
 * Mouse drag to rotate, scroll to zoom, WASD for panning.
 * Uses spring damping for smooth feel.
 */

const THREE = window.THREE;

export class CameraControls {
  constructor(camera, domElement) {
    this.camera     = camera;
    this.domElement = domElement;

    // Spherical coordinates
    this.target  = new THREE.Vector3(0, 0.5, 0);
    this.radius  = 13;
    this.theta   = 0;          // horizontal angle
    this.phi     = Math.PI / 4; // vertical angle (from top)

    // Limits
    this.minRadius = 5;
    this.maxRadius = 22;
    this.minPhi    = 0.1;
    this.maxPhi    = Math.PI / 2.2;

    // Drag state
    this._dragging   = false;
    this._lastX      = 0;
    this._lastY      = 0;
    this._deltaPhi   = 0;
    this._deltaTheta = 0;

    // Smoothing velocities
    this._velTheta  = 0;
    this._velPhi    = 0;
    this._velRadius = 0;

    // WASD pan + follow state (camera detaches from the founder when you pan)
    this._keys = { w: false, a: false, s: false, d: false };
    this.follow = true;
    this.bounds = { minX: -7, maxX: 7, minZ: -6, maxZ: 6 };

    this._bind();
    this._updateCamera();
  }

  _bind() {
    const el = this.domElement;
    el.addEventListener('mousedown',  this._onMouseDown.bind(this));
    el.addEventListener('mousemove',  this._onMouseMove.bind(this));
    el.addEventListener('mouseup',    this._onMouseUp.bind(this));
    el.addEventListener('mouseleave', this._onMouseUp.bind(this));
    el.addEventListener('wheel',      this._onWheel.bind(this), { passive: false });

    // Touch support
    el.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: true });
    el.addEventListener('touchmove',  this._onTouchMove.bind(this),  { passive: false });
    el.addEventListener('touchend',   this._onTouchEnd.bind(this),   { passive: true });

    window.addEventListener('keydown', this._onKeyDown.bind(this));
    window.addEventListener('keyup',   this._onKeyUp.bind(this));
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    this._dragging = true;
    this._lastX    = e.clientX;
    this._lastY    = e.clientY;
  }

  _onMouseMove(e) {
    if (!this._dragging) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;

    // Accumulate rotation delta (slow orbit)
    this._velTheta -= dx * 0.0023;
    this._velPhi   -= dy * 0.0019;
  }

  _onMouseUp() {
    this._dragging = false;
  }

  _onWheel(e) {
    e.preventDefault();
    this._velRadius += e.deltaY * 0.01;
  }

  // Touch handling for mobile
  _touchStartDist = 0;
  _touchStartRadius = 0;

  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this._dragging = true;
      this._lastX    = e.touches[0].clientX;
      this._lastY    = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this._touchStartDist   = Math.sqrt(dx*dx + dy*dy);
      this._touchStartRadius = this.radius;
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && this._dragging) {
      const dx = e.touches[0].clientX - this._lastX;
      const dy = e.touches[0].clientY - this._lastY;
      this._lastX = e.touches[0].clientX;
      this._lastY = e.touches[0].clientY;
      this._velTheta -= dx * 0.0023;
      this._velPhi   -= dy * 0.0019;
    } else if (e.touches.length === 2) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const scale = this._touchStartDist / dist;
      this.radius = Math.max(this.minRadius, Math.min(this.maxRadius,
        this._touchStartRadius * scale));
    }
  }

  _onTouchEnd() {
    this._dragging = false;
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this._keys.w = true; break;
      case 'KeyS': case 'ArrowDown':  this._keys.s = true; break;
      case 'KeyA': case 'ArrowLeft':  this._keys.a = true; break;
      case 'KeyD': case 'ArrowRight': this._keys.d = true; break;
      case 'KeyF': case 'KeyC': this.follow = true; break;   // recenter on the founder
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this._keys.w = false; break;
      case 'KeyS': case 'ArrowDown':  this._keys.s = false; break;
      case 'KeyA': case 'ArrowLeft':  this._keys.a = false; break;
      case 'KeyD': case 'ArrowRight': this._keys.d = false; break;
    }
  }

  update(dt) {
    // WASD / arrows pan the camera target across the floor (screen-relative).
    // Panning detaches the camera from the founder until you press F to recenter.
    const f  = (this._keys.w ? 1 : 0) - (this._keys.s ? 1 : 0);
    const rt = (this._keys.d ? 1 : 0) - (this._keys.a ? 1 : 0);
    if (f || rt) {
      const panSpeed = 9 * dt * (this.radius / 13);
      const st = Math.sin(this.theta), ct = Math.cos(this.theta);
      this.target.x += (-st * f + ct * rt) * panSpeed;
      this.target.z += (-ct * f - st * rt) * panSpeed;
      const b = this.bounds;
      this.target.x = Math.max(b.minX, Math.min(b.maxX, this.target.x));
      this.target.z = Math.max(b.minZ, Math.min(b.maxZ, this.target.z));
      this.follow = false;
    }

    // Apply spring damping to velocities
    const damping = 1 - Math.min(1, dt * 10);
    this._velTheta  *= damping;
    this._velPhi    *= damping;
    this._velRadius *= damping;

    // Apply velocities
    this.theta  += this._velTheta;
    this.phi    = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi + this._velPhi));
    this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.radius + this._velRadius));

    this._updateCamera();
  }

  _updateCamera() {
    // Convert spherical to Cartesian
    const x = this.radius * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * Math.sin(this.phi) * Math.cos(this.theta);

    this.camera.position.set(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z
    );
    this.camera.lookAt(this.target);
  }

  /**
   * Smoothly reset to default view.
   */
  resetView() {
    this._velTheta  = (0 - this.theta) * 0.1;
    this._velPhi    = (Math.PI / 4 - this.phi) * 0.1;
    this._velRadius = (13 - this.radius) * 0.1;
  }

  /**
   * Get the world-space ray from screen coordinates (for raycasting).
   */
  getPickRay(screenX, screenY) {
    const canvas = this.domElement;
    const nx = (screenX / canvas.clientWidth)  * 2 - 1;
    const ny = -(screenY / canvas.clientHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    return raycaster;
  }
}
