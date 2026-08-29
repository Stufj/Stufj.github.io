// <brain-canvas> — procedural low-poly brain that mirrors mouse movement.
// Attributes: tone (hex), angle ("x,y" radians, the resting pose), spin ("1"/"0")
const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';

class BrainCanvas extends HTMLElement {
  constructor() {
    super();
    this._target = { x: 0, y: 0 };
    this._cur = { x: 0, y: 0 };
    this._base = { x: 0, y: 0 };
    this._mouse = { x: 0, y: 0 };
  }

  static get observedAttributes() { return ['angle', 'tone']; }

  attributeChangedCallback(name, _o, v) {
    if (name === 'angle' && v) {
      const [x, y] = v.split(',').map(Number);
      this._base = { x: x || 0, y: y || 0 };
    }
    if (name === 'tone' && this._mat) this._mat.color.set(v);
  }

  connectedCallback() {
    this.style.display = 'block';
    this.style.position = this.style.position || 'relative';
    this.style.width = '100%';
    this.style.height = '100%';
    if (!this._booted) { this._booted = true; this._boot(); }
  }

  disconnectedCallback() {
    this._alive = false;
    window.removeEventListener('pointermove', this._onMove);
    if (this._ro) this._ro.disconnect();
  }

  async _boot() {
    const THREE = await import(THREE_URL);
    if (!this.isConnected) return;
    this._alive = true;
    const tone = this.getAttribute('tone') || '#5980a6';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    this.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa6b2, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2.5, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(-3, -1, -2);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    const fold = (v) => {
      const n = v.clone().normalize();
      let r = 1;
      r += 0.075 * Math.sin(7.5 * n.x) * Math.sin(6.5 * n.y) * Math.sin(7 * n.z);
      r += 0.05 * Math.sin(13 * n.y + 2.5 * n.z);
      r += 0.035 * Math.sin(17 * n.z - 4 * n.x);
      r -= 0.05 * Math.max(0, n.y) * Math.max(0, -n.z);
      return n.multiplyScalar(r);
    };

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tone), roughness: 0.55, metalness: 0.05, flatShading: true
    });
    this._mat = mat;
    const wireMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0x1d1f20), transparent: true, opacity: 0.28
    });

    const hemisphere = (sign) => {
      const geo = new THREE.IcosahedronGeometry(1, 12);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const f = fold(v);
        pos.setXYZ(i, f.x * 0.56, f.y * 0.82, f.z * 1.02);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = sign * 0.5;
      const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geo), wireMat);
      wire.position.x = sign * 0.5;
      const g = new THREE.Group();
      g.add(mesh, wire);
      return g;
    };

    group.add(hemisphere(1), hemisphere(-1));

    // cerebellum
    const cGeo = new THREE.IcosahedronGeometry(0.42, 4);
    const cPos = cGeo.attributes.position;
    const cv = new THREE.Vector3();
    for (let i = 0; i < cPos.count; i++) {
      cv.fromBufferAttribute(cPos, i);
      const n = cv.clone().normalize();
      const r = 0.42 * (1 + 0.12 * Math.sin(22 * n.y));
      cPos.setXYZ(i, n.x * r * 1.15, n.y * r * 0.8, n.z * r);
    }
    cGeo.computeVertexNormals();
    const cer = new THREE.Mesh(cGeo, mat);
    cer.position.set(0, -0.6, -0.62);
    group.add(cer);
    group.add(new THREE.LineSegments(new THREE.WireframeGeometry(cGeo), wireMat).translateY(-0.6).translateZ(-0.62));

    // stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.08, 0.7, 10, 1), mat);
    stem.position.set(0, -0.95, -0.25);
    stem.rotation.x = -0.35;
    group.add(stem);

    // synapse nodes
    const nodeCount = 90;
    const nodePos = new Float32Array(nodeCount * 3);
    for (let i = 0; i < nodeCount; i++) {
      const t = Math.acos(2 * Math.random() - 1), p = Math.random() * Math.PI * 2;
      const n = new THREE.Vector3(Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p));
      const f = fold(n).multiplyScalar(1.06);
      nodePos.set([f.x * 0.9, f.y * 0.85, f.z * 1.05], i * 3);
    }
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
    const nodes = new THREE.Points(nodeGeo, new THREE.PointsMaterial({
      color: new THREE.Color(tone), size: 0.055, transparent: true, opacity: 0.9
    }));
    group.add(nodes);

    const a = this.getAttribute('angle');
    if (a) { const [x, y] = a.split(',').map(Number); this._base = { x: x || 0, y: y || 0 }; }

    this._onMove = (e) => {
      this._mouse.x = (e.clientX / innerWidth) * 2 - 1;
      this._mouse.y = (e.clientY / innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', this._onMove, { passive: true });

    const resize = () => {
      const r = this.getBoundingClientRect();
      const w = Math.round(r.width) || 300, h = Math.round(r.height) || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // frame the whole group at any aspect: pull back when the viewport is portrait
      camera.position.z = 5.2 * Math.max(1, 1.15 / camera.aspect);
      camera.updateProjectionMatrix();
    };
    this._ro = new ResizeObserver(resize);
    this._ro.observe(this);
    resize();

    let t = 0;
    const tick = () => {
      if (!this._alive) return;
      t += 0.006;
      // mouse movement mirrored onto the brain, layered over the resting pose
      this._target.y = this._base.y + this._mouse.x * 0.9;
      this._target.x = this._base.x + this._mouse.y * 0.55;
      this._cur.x += (this._target.x - this._cur.x) * 0.06;
      this._cur.y += (this._target.y - this._cur.y) * 0.06;
      group.rotation.x = this._cur.x + Math.sin(t) * 0.02;
      group.rotation.y = this._cur.y;
      group.rotation.z = Math.sin(t * 0.7) * 0.03;
      nodes.material.opacity = 0.55 + 0.35 * Math.abs(Math.sin(t * 2.2));
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };
    tick();
  }
}

if (!customElements.get('brain-canvas')) customElements.define('brain-canvas', BrainCanvas);
