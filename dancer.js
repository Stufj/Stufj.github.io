// <dancer-canvas src="models/dance.glb" tone="#a1dcff">
// Plays the model's animation clip only while the pointer is moving;
// eases the clip to a stop ~0.4s after the cursor stills.
const THREE_URL = "https://esm.sh/three@0.160.0";
const GLTF_URL = "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

class DancerCanvas extends HTMLElement {
  static get observedAttributes() { return ["src", "tone", "mode"]; }

  connectedCallback() {
    this.style.display = "block";
    this.style.position = "absolute";
    this.style.inset = "0";
    this.style.overflow = "hidden";
    if (this._booted) { this._resume && this._resume(); return; }
    this._booted = true;
    this._boot();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    clearInterval(this._watch);
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("resize", this._onResize);
    this._ro && this._ro.disconnect();
    this._renderer && this._renderer.dispose();
  }

  attributeChangedCallback(name) {
    if (name === "tone" && this._applyTone) this._applyTone();
  }

  _note(text) {
    if (!this._noteEl) {
      this._noteEl = document.createElement("div");
      Object.assign(this._noteEl.style, {
        position: "absolute", inset: "0", display: "grid", placeItems: "center",
        font: "12px/1.5 ui-monospace, monospace", letterSpacing: ".06em",
        color: "#241c33", textAlign: "center", padding: "24px", opacity: ".75"
      });
      this.style.position = this.style.position || "relative";
      this.appendChild(this._noteEl);
    }
    this._noteEl.textContent = text;
  }

  async _boot() {
    this._note("loading…");
    let THREE, GLTFLoader;
    try {
      THREE = await import(THREE_URL);
      ({ GLTFLoader } = await import(GLTF_URL));
    } catch (e) {
      this._note("three.js could not load: " + e.message);
      return;
    }

    const src = this.getAttribute("src") || "models/dance.glb";
    const mode = this.getAttribute("mode") || "wireframe";

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    this.appendChild(renderer.domElement);
    this._renderer = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x99aabb, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 4, 3);
    scene.add(key);

    let gltf;
    try {
      gltf = await new GLTFLoader().loadAsync(src);
    } catch (e) {
      this._note(`no model at ${src} — drop your dancing GLB there`);
      renderer.domElement.remove();
      return;
    }
    this._noteEl && this._noteEl.remove();

    const root = gltf.scene;
    scene.add(root);

    const tone = () => this.getAttribute("tone") || "#241c33";
    const meshes = [];
    root.traverse(o => { if (o.isMesh) meshes.push(o); });
    this._applyTone = () => {
      const c = new THREE.Color(tone());
      meshes.forEach(m => {
        if (mode === "wireframe") {
          m.material = new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.85 });
        } else if (mode === "flat") {
          m.material = new THREE.MeshBasicMaterial({ color: c });
        }
        m.material.needsUpdate = true;
      });
    };
    if (mode !== "shaded") this._applyTone();

    // Skinned meshes have unreliable bind-pose bounds — sample bone
    // positions across the clip to find the space the dance actually occupies.
    const bones = [];
    root.traverse(o => { if (o.isBone) bones.push(o); });
    const mixer = new THREE.AnimationMixer(root);
    const clip = gltf.animations && gltf.animations[0];
    let action = null;
    if (clip) { action = mixer.clipAction(clip); action.play(); }
    else console.warn("[dancer-canvas] GLB has no animation clip");

    const box = new THREE.Box3();
    if (bones.length && clip) {
      const p = new THREE.Vector3();
      for (let i = 0; i < 12; i++) {
        mixer.setTime((clip.duration * i) / 12);
        root.updateMatrixWorld(true);
        bones.forEach(b => box.expandByPoint(b.getWorldPosition(p)));
      }
      mixer.setTime(0);
      box.expandByScalar(box.getSize(new THREE.Vector3()).y * 0.12);
    } else {
      box.setFromObject(root);
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    const vFov = camera.fov * Math.PI / 180;
    this._frame = () => {
      const fitH = (size.y / 2) / Math.tan(vFov / 2);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const fitW = (Math.max(size.x, size.z) / 2) / Math.tan(hFov / 2);
      camera.position.set(0, 0, Math.max(fitH, fitW) * 1.25);
      camera.lookAt(0, 0, 0);
    };


    // pointer activity -> playback rate
    let activity = 0, lastMove = 0, targetYaw = 0, yaw = 0, moves = 0;
    this._onMove = e => {
      moves++;
      lastMove = performance.now();
      activity = 1;
      const r = this.getBoundingClientRect();
      targetYaw = ((e.clientX - r.left) / r.width - 0.5) * 0.9;
    };
    window.addEventListener("pointermove", this._onMove, { passive: true });

    const dpr = () => Math.min(devicePixelRatio || 1, 2);
    const resize = () => {
      const w = this.clientWidth, h = this.clientHeight;
      if (!w || !h) return false;
      renderer.setPixelRatio(dpr());
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      this._frame && this._frame();
      return true;
    };
    this._onResize = resize;
    window.addEventListener("resize", resize);
    this._ro = new ResizeObserver(resize);
    this._ro.observe(this);
    resize();

    const clock = new THREE.Clock();
    let rate = 0, lastFrameAt = 0, frames = 0, kicks = 0;
    const step = () => {
      frames++;
      lastFrameAt = performance.now();
      const cv = renderer.domElement;
      if (cv.width !== Math.round(this.clientWidth * dpr()) ||
          cv.height !== Math.round(this.clientHeight * dpr())) resize();
      const dt = Math.min(clock.getDelta(), 0.1);
      if (performance.now() - lastMove > 220) activity = 0;
      rate += (activity - rate) * Math.min(1, dt / 0.4 * 3);
      if (rate < 0.002) rate = 0;
      mixer.update(dt * rate);
      yaw += (targetYaw - yaw) * Math.min(1, dt * 3);
      root.rotation.y = yaw;
      renderer.render(scene, camera);
    };
    const loop = () => { this._raf = requestAnimationFrame(loop); step(); };

    this._resume = () => { if (!this._raf) { clock.getDelta(); loop(); } };

    // Watchdog: rAF can be suspended (hidden tab, offscreen frame, remount).
    // If no frame has landed recently, drive one directly and re-arm rAF.
    this._watch = setInterval(() => {
      if (!this.isConnected) return;
      kicks++;
      if (performance.now() - lastFrameAt > 150) {
        cancelAnimationFrame(this._raf);
        step();
        this._raf = requestAnimationFrame(loop);
      }
    }, 100);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) { cancelAnimationFrame(this._raf); clock.getDelta(); loop(); }
    });
    new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) this._resume();
    }).observe(this);

    loop();
    this._dbg = { time: () => mixer.time, rate: () => rate, frames: () => frames, kicks: () => kicks, moves: () => moves, act: () => activity, sinceMove: () => performance.now() - lastMove };
  }
}

if (!customElements.get("dancer-canvas")) customElements.define("dancer-canvas", DancerCanvas);
