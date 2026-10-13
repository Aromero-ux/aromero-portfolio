/* ==========================================================================
   WEBGL ACCENTS  (raw WebGL, no libraries)

   HERO         the AR logo as a 3D wireframe (tilts to the cursor, click spins it)
   SECTIONS     drifting topographic contour lines behind skills, projects,
                experience and education, tinted per background: they bulge under
                the cursor, ripple on click, and flow as you scroll
   CONTACT      a slow sunburst whose rays point at the cursor

   To drop an effect from a section, delete that section's <canvas> in index.html.

   Performance rules:
   - starts only after the page has loaded and the browser is idle
   - creates its GL context only when it first scrolls into view
   - draws only while its canvas is on screen and the tab is visible
   - the tall sections share ONE viewport-sized canvas each that stays put while
     the content scrolls over it, so cost never grows with section height
   - ~60fps while you interact or scroll, ~30fps (24fps on phones) when idle
   - crisp on high-DPI screens, with a pixel budget and automatic step-down
     if frames run long
   - refuses to run on software rendering; the plain page stays as the fallback
   - prefers-reduced-motion gets a single still frame
   ========================================================================== */
(() => {
  "use strict";

  if (!("IntersectionObserver" in window) || !("ResizeObserver" in window)) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const liteMQ = matchMedia("(max-width: 767px)");      // phones: simplified version
  const lite = () => liteMQ.matches;
  const sideLayout = () => innerWidth >= 1100;           // room beside the hero text?

  /* ---- Palette (matches the site) -------------------------------------- */
  const ORANGE = [0.996, 0.498, 0.176];  // #FE7F2D
  const CREAM = [0.918, 0.925, 0.941];   // #EAECF0

  /* ---- Pointer (shared) ------------------------------------------------- */
  const P = { x: 0, y: 0, seen: false, last: 0 };
  const stages = [];
  const pointerActive = (now) => P.seen && now - P.last < 2600;

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    P.x = e.clientX; P.y = e.clientY; P.seen = true; P.last = performance.now();
  }, { passive: true });
  addEventListener("pointerdown", (e) => {
    P.x = e.clientX; P.y = e.clientY; P.last = performance.now();
    stages.forEach((s) => s.on && s.visible && s.fx && s.fx.click(e.clientX, e.clientY));
  }, { passive: true });
  let lastScroll = 0;
  addEventListener("scroll", () => { lastScroll = performance.now(); }, { passive: true });
  const scrolling = (now) => now - lastScroll < 260;
  addEventListener("mouseout", (e) => { if (!e.relatedTarget) P.seen = false; });
  addEventListener("blur", () => { P.seen = false; });

  /* ---- Small helpers ---------------------------------------------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function makeProgram(gl, vsSrc, fsSrc, attribs) {
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const getUniforms = (gl, p, names) => {
    const u = {};
    names.forEach((n) => { u[n] = gl.getUniformLocation(p, n === "uRip" ? "uRip[0]" : n); });
    return u;
  };
  // One triangle that covers the whole canvas.
  function fullscreenTriangle(gl) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    return b;
  }
  function makeRipples(n) {
    return {
      n, a: new Float32Array(n * 4), i: 0, end: 0,
      add(x, y, t, s, life) {
        const o = this.i * 4;
        this.a[o] = x; this.a[o + 1] = y; this.a[o + 2] = t; this.a[o + 3] = s;
        this.i = (this.i + 1) % this.n;
        this.end = Math.max(this.end, t + (life || 4));
      }
    };
  }

  /* ---- Matrices (column-major, write into `o`) -------------------------- */
  const mul = (o, a, b) => {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  };
  const rotX = (o, a) => { const c = Math.cos(a), s = Math.sin(a); o.set([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); return o; };
  const rotY = (o, a) => { const c = Math.cos(a), s = Math.sin(a); o.set([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); return o; };
  const translate = (o, x, y, z) => { o.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]); return o; };
  const perspective = (o, fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2);
    o.set([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]);
    return o;
  };

  /* Shared GLSL: value noise + fbm */
  const GLSL_NOISE = `
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p){
      float a = 0.5, s = 0.0;
      for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
      return s;
    }
  `;
  const FRAG_PRECISION = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
  `;

  /* ======================================================================
     STAGE: owns one canvas + its GL context and decides when to draw
     ====================================================================== */
  class Stage {
    constructor(canvas, Effect, opts) {
      this.canvas = canvas; this.Effect = Effect; this.opts = opts || {};
      this.fx = null; this.gl = null; this.on = false; this.visible = false; this.failed = false;
      this.sized = false; this.live = false; this.raf = 0; this.t = 3; this.lastRender = 0;
      this.quality = 1; this.ema = 16.7; this.slow = 0;
      this.tick = this.tick.bind(this);
      this.io = new IntersectionObserver((es) => { this.visible = es[es.length - 1].isIntersecting; this.sync(); }, { rootMargin: "120px" });
      this.io.observe(canvas);
      this.ro = new ResizeObserver(() => this.resize());
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.stop(); this.fx = null; });
      canvas.addEventListener("webglcontextrestored", () => { this.sized = false; this.sync(); });
      stages.push(this);
    }

    init() {
      if (this.failed) return false;
      if (this.gl && this.fx) return true;
      try {
        const o = {
          alpha: true, antialias: !!this.opts.antialias, depth: false, premultipliedAlpha: true,
          powerPreference: "low-power",
          failIfMajorPerformanceCaveat: true   // software rendering would be slower than no effect
        };
        const gl = this.canvas.getContext("webgl", o) || this.canvas.getContext("experimental-webgl", o);
        if (!gl) throw new Error("WebGL unavailable");
        this.gl = gl;
        this.fx = new this.Effect(gl, this);
        return true;
      } catch (err) {
        console.warn("[fx] disabled:", err && err.message ? err.message : err);
        this.failed = true;
        this.canvas.hidden = true;
        return false;
      }
    }

    setOn(on) {
      if (on === this.on) return;
      this.on = on;
      if (on) {
        if (this.failed) { this.on = false; return; }
        this.canvas.hidden = false;             // GL itself starts lazily, once it is on screen
        this.ro.observe(this.canvas);
        this.sync();
      } else {
        this.stop();
        this.ro.unobserve(this.canvas);
        this.canvas.hidden = true;
        this.canvas.classList.remove("is-live");
        this.live = false; this.sized = false;
      }
    }

    sync() {
      const go = this.on && this.visible && !document.hidden;
      if (!go) { this.stop(); return; }
      if (!this.init()) { this.on = false; return; }
      if (!this.sized) this.resize();
      if (!this.sized) return;                  // not laid out yet; the ResizeObserver will call back
      if (reduce.matches) { this.stop(); this.renderStill(); return; }
      if (!this.raf) { this.lastRender = performance.now(); this.raf = requestAnimationFrame(this.tick); }
    }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }

    resize() {
      if (!this.gl || !this.fx) return;
      if (this.fx.layout) this.fx.layout();
      const cssW = this.canvas.clientWidth, cssH = this.canvas.clientHeight;
      if (!cssW || !cssH) return;
      let s = this.fx.pixelScale(this.quality);
      const budget = this.opts.maxPixels;                       // cap total pixels on very large screens
      if (budget && cssW * cssH * s * s > budget) s = Math.sqrt(budget / (cssW * cssH));
      const w = Math.max(2, Math.round(cssW * s)), h = Math.max(2, Math.round(cssH * s));
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      this.gl.viewport(0, 0, w, h);
      this.fx.resize(w, h, cssW, cssH, s);
      this.sized = true;
      if (!this.raf && this.on && this.visible && reduce.matches) this.renderStill();
    }

    renderStill() {
      if (!this.fx) return;
      this.fx.step(0.016, performance.now(), this.t, true);
      this.fx.draw(this.t);
      this.markLive();
    }
    markLive() { if (!this.live) { this.live = true; this.canvas.classList.add("is-live"); } }

    tick(now) {
      this.raf = requestAnimationFrame(this.tick);
      if (!this.fx) return;
      const busy = this.fx.busy(now);
      if (now - this.lastRender < (busy ? 14 : lite() ? 42 : 31)) return;   // ~60 / ~30 / ~24 fps
      const dt = Math.min((now - this.lastRender) / 1000, 0.1);
      this.lastRender = now;
      this.t += dt;
      this.fx.step(dt, now, this.t, false);
      this.fx.draw(this.t);
      this.markLive();
      this.adapt(dt * 1000, busy);
    }

    // If frames keep taking too long, quietly render fewer pixels.
    adapt(ms, busy) {
      if (!busy) { this.slow = 0; return; }
      this.ema = this.ema * 0.9 + ms * 0.1;
      if (this.ema > 26) {
        if (++this.slow > 40 && this.quality > 0.55) {
          this.quality = Math.max(0.55, this.quality - 0.15);
          this.slow = 0; this.ema = 16.7;
          this.resize();
        }
      } else this.slow = Math.max(0, this.slow - 1);
    }
  }

  /* Pointer position in this canvas's own CSS pixels, or null if unused. */
  function localPointer(canvas, now, onlyNear) {
    if (!pointerActive(now)) return null;
    const r = canvas.getBoundingClientRect();
    if (!r.width) return null;
    const x = P.x - r.left, y = P.y - r.top;
    if (onlyNear && (x < -r.width * 0.25 || x > r.width * 1.25 || y < -r.height * 0.25 || y > r.height * 1.25)) return null;
    return { x, y, w: r.width, h: r.height, r };
  }
  const hit = (canvas, cx, cy, pad) => {
    const r = canvas.getBoundingClientRect();
    const px = (pad || 0) * r.width, py = (pad || 0) * r.height;
    return cx >= r.left - px && cx <= r.right + px && cy >= r.top - py && cy <= r.bottom + py ? r : null;
  };

  /* ======================================================================
     1. MONOGRAM: the AR logo as a 3D wireframe slab
     ====================================================================== */

  // Stroke centerlines traced from the logo SVG (viewBox 320 105 465 450).
  const LOGO_PTS = {
    a0: [544.3, 116.0], a1: [353.8, 446.5], a2: [547.2, 530.5], a3: [325.2, 487.8],
    r0: [573.2, 118.0], r1: [571.6, 544.0], r2: [682.2, 319.0], r3: [573.4, 400.0], r4: [778.2, 488.0]
  };
  const LOGO_EDGES = [["a0", "a1"], ["a0", "a2"], ["a1", "a2"], ["a1", "a3"], ["r0", "r1"], ["r0", "r2"], ["r2", "r3"], ["r3", "r4"]];

  const MONO_VS = `
    precision highp float;
    attribute vec3 aA;
    attribute vec3 aB;
    attribute vec2 aCorner;
    attribute float aTone;
    attribute float aGroup;
    uniform mat4 uVP;
    uniform mat4 uModel;
    uniform float uRing;
    uniform vec2 uRes;
    uniform float uWidth;
    uniform vec2 uPtr;
    uniform float uPtrAmp;
    uniform float uScan;
    uniform float uDist;
    uniform vec2 uShift;
    varying float vSide;
    varying float vTone;
    varying float vGlow;
    varying float vScan;
    varying float vDepth;

    vec4 place(vec3 p, float g) {
      if (g > 0.5) {                       // orbit ring: spin, then tilt
        float c = cos(uRing), s = sin(uRing);
        p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
        p = vec3(p.x, p.y * 0.4536 - p.z * 0.8912, p.y * 0.8912 + p.z * 0.4536);
      }
      vec4 c = uVP * (uModel * vec4(p, 1.0));
      c.xy += uShift * c.w;
      return c;
    }

    void main() {
      vec4 ca = place(aA, aGroup);
      vec4 cb = place(aB, aGroup);
      vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uRes;
      float len = max(length(d), 1e-4);
      vec2 dir = d / len;
      vec2 nrm = vec2(-dir.y, dir.x);
      vec4 c = mix(ca, cb, aCorner.x);
      vec2 ndc = c.xy / c.w;

      vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
      vec2 rel = (ndc - uPtr) * aspect;
      float dist = length(rel);
      float glow = uPtrAmp * exp(-dist * dist * 5.0);
      ndc += (rel / (dist + 1e-3)) * glow * 0.045 / aspect;     // gentle push away from the cursor

      float w = uWidth * (1.0 + glow * 0.9);
      vec2 off = (nrm * aCorner.y + dir * (aCorner.x * 2.0 - 1.0)) * (w * 0.5) * 2.0 / uRes;
      gl_Position = vec4((ndc + off) * c.w, c.z, c.w);

      float y = mix(aA.y, aB.y, aCorner.x);
      float sd = (y - uScan) * 4.5;
      vSide = aCorner.y;
      vTone = aTone;
      vGlow = glow;
      vScan = exp(-sd * sd) * (1.0 - aGroup);
      vDepth = clamp(1.0 - (c.w - uDist) * 0.9, 0.35, 1.0);
    }
  `;
  const MONO_FS = FRAG_PRECISION + `
    uniform vec3 uCol;
    uniform vec3 uHi;
    uniform float uHalo;
    varying float vSide;
    varying float vTone;
    varying float vGlow;
    varying float vScan;
    varying float vDepth;
    void main() {
      float crisp = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
      float soft = 1.0 - abs(vSide);
      float edge = mix(crisp, soft * soft, uHalo);
      float a = edge * vTone * vDepth * (1.0 + vGlow * 0.9 + vScan * 0.9);
      a = clamp(a, 0.0, 1.0) * mix(1.0, 0.17, uHalo);
      vec3 col = mix(uCol, uHi, clamp(vGlow * 1.3 + vScan * 0.8, 0.0, 1.0));
      gl_FragColor = vec4(col * a, a);
    }
  `;
  const DUST_VS = `
    precision highp float;
    attribute vec3 aSeed;
    uniform mat4 uVP;
    uniform float uT;
    uniform float uPx;
    uniform float uDist;
    uniform vec2 uShift;
    varying float vA;
    void main() {
      vec3 p;
      p.x = (aSeed.x * 2.0 - 1.0) * 1.9 + sin(uT * 0.3 + aSeed.z * 6.28) * 0.08;
      p.y = mod(aSeed.y * 3.4 + uT * (0.05 + aSeed.z * 0.09), 3.4) - 1.7;
      p.z = (aSeed.z * 2.0 - 1.0) * 1.1;
      vec4 c = uVP * vec4(p, 1.0);
      c.xy += uShift * c.w;
      gl_Position = c;
      gl_PointSize = max(1.0, uPx * (1.0 + aSeed.x * 1.5) * (uDist / c.w));
      vA = (1.0 - smoothstep(1.0, 1.7, abs(p.y))) * (0.22 + 0.5 * aSeed.x);
    }
  `;
  const DUST_FS = FRAG_PRECISION + `
    uniform vec3 uCol;
    varying float vA;
    void main() { gl_FragColor = vec4(uCol * vA, vA); }
  `;

  class MonogramFX {
    constructor(gl, stage) {
      this.gl = gl; this.canvas = stage.canvas;
      this.lineProg = makeProgram(gl, MONO_VS, MONO_FS, ["aA", "aB", "aCorner", "aTone", "aGroup"]);
      this.U = getUniforms(gl, this.lineProg, ["uVP", "uModel", "uRing", "uRes", "uWidth", "uPtr", "uPtrAmp", "uScan", "uDist", "uShift", "uCol", "uHi", "uHalo"]);
      this.dustProg = makeProgram(gl, DUST_VS, DUST_FS, ["aSeed"]);
      this.D = getUniforms(gl, this.dustProg, ["uVP", "uT", "uPx", "uDist", "uShift", "uCol"]);
      this.buildGeometry();

      this.vp = new Float32Array(16); this.model = new Float32Array(16);
      this.m1 = new Float32Array(16); this.m2 = new Float32Array(16); this.m3 = new Float32Array(16);
      this.proj = new Float32Array(16); this.view = new Float32Array(16);
      this.yaw = 0; this.pitch = 0; this.tiltX = 0; this.tiltY = 0;
      this.spin = 0; this.spinTarget = 0; this.amp = 0;
      this.ndc = { x: 0, y: 0 }; this.scale = 1; this.px = 1; this.dist = 5; this.shift = [0, 0];
      this.fov = (32 * Math.PI) / 180;

      gl.clearColor(0, 0, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    buildGeometry() {
      const gl = this.gl;
      const cx = 551.7, cy = 330.2, k = 2 / 431.6;               // center + scale so the logo is 2 units tall
      const P3 = {};
      Object.keys(LOGO_PTS).forEach((n) => { P3[n] = [(LOGO_PTS[n][0] - cx) * k, -(LOGO_PTS[n][1] - cy) * k]; });

      const segs = [];                                             // {a, b, tone, group}
      const L = 5, D = 0.28;
      const zs = Array.from({ length: L }, (_, i) => -D + (2 * D * i) / (L - 1));
      zs.forEach((z, li) => {
        const edge = li === 0 || li === L - 1;
        LOGO_EDGES.forEach(([p, q]) => segs.push({ a: [...P3[p], z], b: [...P3[q], z], tone: edge ? 1.0 : 0.3, group: 0 }));
      });
      Object.keys(P3).forEach((n) => {                             // ribs joining the slices
        for (let li = 0; li < L - 1; li++) segs.push({ a: [...P3[n], zs[li]], b: [...P3[n], zs[li + 1]], tone: 0.5, group: 0 });
      });
      const R = 1.3, N = 96;                                       // dashed orbit ring
      for (let i = 0; i < N; i++) {
        if (i % 3 === 2) continue;
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        segs.push({ a: [R * Math.cos(a0), 0, R * Math.sin(a0)], b: [R * Math.cos(a1), 0, R * Math.sin(a1)], tone: 0.34, group: 1 });
      }
      segs.push({ a: [R, 0, 0], b: [R * Math.cos(0.16), 0, R * Math.sin(0.16)], tone: 1.0, group: 1 }); // satellite

      const corners = [[0, -1], [0, 1], [1, -1], [1, -1], [0, 1], [1, 1]];
      const data = new Float32Array(segs.length * 6 * 10);
      let o = 0;
      segs.forEach((s) => corners.forEach((c) => {
        data.set(s.a, o); data.set(s.b, o + 3); data[o + 6] = c[0]; data[o + 7] = c[1]; data[o + 8] = s.tone; data[o + 9] = s.group;
        o += 10;
      }));
      this.vertCount = segs.length * 6;
      this.lineBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

      // Dust: seeds only, the vertex shader does the rest.
      const n = 140, seeds = new Float32Array(n * 3);
      for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
      this.dustCount = n;
      this.dustBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dustBuf);
      gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    }

    pixelScale(q) { return Math.min(devicePixelRatio || 1, lite() ? 1.5 : 2) * q; }

    layout() {
      const side = sideLayout();
      this.canvas.dataset.layout = side ? "side" : "bg";
    }

    resize(w, h, cssW, cssH, s) {
      const aspect = w / h, tanH = Math.tan(this.fov / 2);
      this.aspect = aspect;
      this.dist = Math.max(1.42 / tanH, 1.5 / (tanH * aspect));
      perspective(this.proj, this.fov, aspect, 0.5, 60);
      translate(this.view, 0, 0, -this.dist);
      mul(this.vp, this.proj, this.view);
      this.px = s;
      this.cssW = cssW;
      // When the canvas is a background (small screens), park the logo off to one side.
      if (this.canvas.dataset.layout === "bg") this.shift = aspect > 1 ? [0.5, 0.0] : [0.0, -0.28];
      else this.shift = [0, 0];
    }

    step(dt, now, t, still) {
      const k = (r) => 1 - Math.exp(-dt * r);
      const p = still || lite() ? null : localPointer(this.canvas, now, false);
      let tx = 0, ty = 0, ampT = 0;
      if (p) {
        tx = clamp((p.x - p.w / 2) / 650, -1, 1);
        ty = clamp((p.y - p.h / 2) / 420, -1, 1);
        this.ndc.x = (p.x / p.w) * 2 - 1;
        this.ndc.y = 1 - (p.y / p.h) * 2;
        ampT = 1;
      }
      this.tiltX += (tx - this.tiltX) * k(4);
      this.tiltY += (ty - this.tiltY) * k(4);
      this.amp += (ampT - this.amp) * k(ampT ? 8 : 3);
      this.spin += (this.spinTarget - this.spin) * k(2.8);
      if (Math.abs(this.spinTarget - this.spin) < 1e-3) this.spin = this.spinTarget;

      this.yaw = 0.5 * Math.sin(t * 0.35) + this.tiltX * 0.6 + this.spin;
      this.pitch = 0.07 * Math.sin(t * 0.27 + 1.0) + this.tiltY * 0.28;
    }

    busy(now) {
      return (!lite() && pointerActive(now)) || this.amp > 0.02 || Math.abs(this.spinTarget - this.spin) > 0.002;
    }

    click(cx, cy) {
      if (!hit(this.canvas, cx, cy, 0.12)) return;
      this.spinTarget += Math.PI * 2;            // always settles facing front
    }

    draw(t) {
      const gl = this.gl, U = this.U;
      rotX(this.m1, this.pitch); rotY(this.m2, this.yaw);
      mul(this.model, this.m1, this.m2);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // --- wireframe: soft halo pass, then crisp pass
      gl.useProgram(this.lineProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      const offs = [0, 12, 24, 32, 36], sizes = [3, 3, 2, 1, 1];         // aA aB aCorner aTone aGroup, 40-byte stride
      for (let a = 0; a < 5; a++) { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, sizes[a], gl.FLOAT, false, 40, offs[a]); }
      gl.uniformMatrix4fv(U.uVP, false, this.vp);
      gl.uniformMatrix4fv(U.uModel, false, this.model);
      gl.uniform1f(U.uRing, t * 0.5);
      gl.uniform2f(U.uRes, this.canvas.width, this.canvas.height);
      gl.uniform2f(U.uPtr, this.ndc.x, this.ndc.y);
      gl.uniform1f(U.uPtrAmp, this.amp);
      gl.uniform1f(U.uScan, -1.3 + ((t * 0.42) % 3.6));
      gl.uniform1f(U.uDist, this.dist);
      gl.uniform2f(U.uShift, this.shift[0], this.shift[1]);
      gl.uniform3f(U.uCol, ORANGE[0], ORANGE[1], ORANGE[2]);
      gl.uniform3f(U.uHi, CREAM[0], CREAM[1], CREAM[2]);
      const wpx = (lite() ? 1.3 : 1.6) * this.px;
      gl.uniform1f(U.uHalo, 1); gl.uniform1f(U.uWidth, wpx * 5);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
      gl.uniform1f(U.uHalo, 0); gl.uniform1f(U.uWidth, wpx);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
      for (let a = 0; a < 5; a++) gl.disableVertexAttribArray(a);

      // --- dust (square pixels, on purpose)
      gl.useProgram(this.dustProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dustBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(this.D.uVP, false, this.vp);
      gl.uniform1f(this.D.uT, t);
      gl.uniform1f(this.D.uPx, 2.0 * this.px);
      gl.uniform1f(this.D.uDist, this.dist);
      gl.uniform2f(this.D.uShift, this.shift[0], this.shift[1]);
      gl.uniform3f(this.D.uCol, ORANGE[0], ORANGE[1], ORANGE[2]);
      gl.drawArrays(gl.POINTS, 0, this.dustCount);
      gl.disableVertexAttribArray(0);
    }
  }

  /* ======================================================================
     CONTOURS: a fragment shader engine for the topographic lines
     ====================================================================== */
  const FULL_VS = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;
  const BLACK = [0, 0, 0];
  const V3 = (c) => `vec3(${c.map((n) => n.toFixed(3)).join(",")})`;

  class FieldFX {
    constructor(gl, stage, cfg) {
      this.gl = gl; this.canvas = stage.canvas; this.cfg = cfg;
      const deriv = !!gl.getExtension("OES_standard_derivatives");
      this.prog = makeProgram(gl, FULL_VS, cfg.frag(deriv), ["aPos"]);
      this.U = getUniforms(gl, this.prog, ["uRes", "uT", "uPtr", "uRip", "uScroll", "uInk", "uAcc", "uTone", "uSeed", "uFreq", "uPulse", "uLinePx", "uS"]);
      this.buf = fullscreenTriangle(gl);
      this.rip = makeRipples(6);
      this.ptr = { x: 0.5, y: 0.5, amp: 0 };
      this.last = { x: 1e9, y: 1e9, t: -1 };
      this.w = 2; this.h = 2; this.cssW = 2; this.cssH = 2; this.s = 1; this.t = 0;
      gl.clearColor(0, 0, 0, 0);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
    }
    // crisp on high-DPI screens (the stage also enforces a pixel budget)
    pixelScale(q) {
      if (this.cfg.scale) return this.cfg.scale(lite(), q);
      return (lite() ? 0.6 : Math.min(devicePixelRatio || 1, 1.5)) * q;
    }
    resize(w, h, cssW, cssH, s) { this.w = w; this.h = h; this.cssW = cssW; this.cssH = cssH; this.s = s; }

    // pointer in "height units": (css px / canvas css height), y up. Same space as the shader's ps.
    toField(x, y, r) { return { x: x / r.height, y: (r.height - y) / r.height }; }

    step(dt, now, t, still) {
      this.t = t;
      const k = (rate) => 1 - Math.exp(-dt * rate);
      const lp = still || lite() ? null : localPointer(this.canvas, now, true);
      let ampT = 0;
      if (lp) {
        const f = this.toField(lp.x, lp.y, lp.r);
        if (this.ptr.amp < 0.01) { this.ptr.x = f.x; this.ptr.y = f.y; }
        this.ptr.x += (f.x - this.ptr.x) * k(12);
        this.ptr.y += (f.y - this.ptr.y) * k(12);
        ampT = 1;
        const moved = Math.hypot(f.x - this.last.x, f.y - this.last.y);
        if (this.cfg.trail !== false && moved > 0.1 && t - this.last.t > 0.18) {
          this.rip.add(f.x, f.y, t, 0.5, 4);
          this.last = { x: f.x, y: f.y, t };
        }
      }
      this.ptr.amp += (ampT - this.ptr.amp) * k(ampT ? 9 : 3);
      if (this.ptr.amp < 0.003) this.ptr.amp = 0;
    }
    busy(now) {
      return (!lite() && pointerActive(now)) || this.ptr.amp > 0.02 || this.t < this.rip.end ||
        (!!this.cfg.scroll && scrolling(now));
    }
    click(cx, cy) {
      const r = hit(this.canvas, cx, cy, 0);
      if (!r) return;
      const f = this.toField(cx - r.left, cy - r.top, r);
      this.rip.add(f.x, f.y, this.t, this.cfg.click || 1.6, 4.5);
    }
    draw(t) {
      const gl = this.gl, U = this.U, c = this.cfg;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(U.uRes, this.w, this.h);
      gl.uniform1f(U.uT, t);
      gl.uniform3f(U.uPtr, this.ptr.x, this.ptr.y, this.ptr.amp);
      gl.uniform4fv(U.uRip, this.rip.a);
      gl.uniform1f(U.uScroll, c.scroll ? (window.scrollY * c.scroll) / this.cssH : 0);
      gl.uniform3f(U.uInk, c.ink[0], c.ink[1], c.ink[2]);
      gl.uniform3f(U.uAcc, ORANGE[0], ORANGE[1], ORANGE[2]);
      gl.uniform2f(U.uTone, c.minor, c.major);
      gl.uniform2f(U.uSeed, c.seed[0], c.seed[1]);
      gl.uniform1f(U.uFreq, c.freq);
      gl.uniform1f(U.uPulse, c.pulse);
      gl.uniform1f(U.uLinePx, 1.0667 * this.s);      // line width stays ~1px of CSS at any resolution
      gl.uniform1f(U.uS, this.s);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(0);
    }
  }

  const CONTOUR_FS = (deriv) => `
    ${deriv ? "#extension GL_OES_standard_derivatives : enable" : ""}
    ${FRAG_PRECISION}
    uniform vec2 uRes;
    uniform float uT;
    uniform vec3 uPtr;
    uniform vec4 uRip[6];
    uniform float uScroll;
    uniform vec3 uInk;
    uniform vec3 uAcc;
    uniform vec2 uTone;
    uniform vec2 uSeed;
    uniform float uFreq;
    uniform float uPulse;
    uniform float uLinePx;
    uniform float uS;
    ${GLSL_NOISE}
    void main() {
      vec2 ps = gl_FragCoord.xy / uRes.y;                       // screen space, in canvas heights
      vec2 p = (ps + vec2(0.0, uScroll)) * uFreq + uSeed;       // terrain space (scrolls slower than the page)
      float t = uT * 0.02;
      float f = fbm(p * 1.7 + vec2(t * 3.0, -t * 2.0));
      f += 0.3 * fbm(p * 3.6 - vec2(t * 2.2, t * 1.4) + 7.0);

      vec2 q = ps - uPtr.xy;                                    // the cursor raises a hill
      float heat = uPtr.z * 0.22 * exp(-dot(q, q) * 26.0);
      for (int i = 0; i < 6; i++) {                             // clicks send rings through the terrain
        vec4 r = uRip[i];
        float age = uT - r.z;
        if (r.w > 0.0 && age >= 0.0) {
          float d = distance(ps, r.xy) - age * 0.42;
          heat += r.w * 0.16 * exp(-age * 0.9) * exp(-d * d * 120.0) * cos(d * 26.0);
        }
      }
      f += heat;

      float level = f * 15.0;
      float dist = abs(fract(level + 0.5) - 0.5);
      ${deriv ? "float fw = max(fwidth(level), 1e-4);" : "float fw = 0.05;"}
      float line = 1.0 - clamp(dist / (fw * uLinePx), 0.0, 1.0);
      line *= 1.0 - smoothstep(0.35, 0.65, fw / uS * 0.75);     // no mush where the slope is steep
      float major = step(mod(floor(level + 0.5), 5.0), 0.5);
      float a = line * mix(uTone.x, uTone.y, major);

      float travel = mod(uT * 0.32, 3.2) - 0.6;                 // an orange wavefront crosses the lines now and then
      float across = ps.x * 0.9 + ps.y * 0.35 - travel;
      float sweep = uPulse * exp(-across * across * 38.0);
      float hot = clamp(abs(heat) * 5.0 + sweep, 0.0, 1.0);
      vec3 col = mix(uInk, uAcc, hot);
      a = clamp(a + line * hot * 0.5, 0.0, 1.0);
      gl_FragColor = vec4(col * a, a);
    }
  `;

  /* ---- CONTACT: sunburst rays (navy background) ------------------------ */
  const RAYS_FS = () => `
    ${FRAG_PRECISION}
    uniform vec2 uRes;
    uniform float uT;
    uniform vec3 uPtr;
    uniform vec4 uRip[6];
    uniform float uScroll;
    void main() {
      float asp = uRes.x / uRes.y;
      vec2 c = vec2(0.5 * asp, 0.5);
      vec2 p = gl_FragCoord.xy / uRes.y - c;
      vec2 ptr = uPtr.xy - c;
      vec2 origin = vec2(0.0, 0.12) + ptr * 0.05 * uPtr.z;    // the burst leans toward the cursor
      vec2 r = p - origin;
      float rad = length(r);
      float ang = atan(r.y, r.x) + uScroll * 1.2;             // scrolling turns the burst

      const float N = 20.0;
      float phase = ang / 6.2831853 * N + uT * 0.02;
      float w = fract(phase);
      float aa = N / 6.2831853 / max(rad, 0.02) / uRes.y * 1.5;
      float s = smoothstep(0.0, aa, w) - smoothstep(0.5, 0.5 + aa, w);
      float orangeRay = step(mod(floor(phase), 4.0), 0.5);    // every 4th ray is orange
      float fade = smoothstep(0.03, 0.3, rad) * exp(-rad * 0.9);

      float pa = atan(ptr.y - origin.y, ptr.x - origin.x);
      float da = abs(mod(ang - uScroll * 1.2 - pa + 3.14159265, 6.2831853) - 3.14159265);
      float spot = uPtr.z * exp(-da * da * 14.0) * smoothstep(0.0, 0.25, rad);

      float pulse = 0.0;
      for (int i = 0; i < 6; i++) {
        vec4 rp = uRip[i];
        float age = uT - rp.z;
        if (rp.w > 0.0 && age >= 0.0) {
          float d = rad - age * 0.7;
          pulse += rp.w * exp(-age * 1.0) * exp(-d * d * 160.0);
        }
      }
      pulse = clamp(pulse, 0.0, 1.5);

      float a = s * fade * (mix(0.045, 0.10, orangeRay) + spot * 0.3 + pulse * 0.2) + pulse * 0.16 * fade;
      vec3 col = mix(${V3(CREAM)}, ${V3(ORANGE)}, clamp(orangeRay + spot * 1.2 + pulse, 0.0, 1.0));
      a = clamp(a, 0.0, 1.0);
      gl_FragColor = vec4(col * a, a);
    }
  `;

  // Line tint per background: cream lines on navy/black, black lines on cream.
  const ON_NAVY = { ink: CREAM, minor: 0.10, major: 0.26 };
  const ON_BLACK = { ink: CREAM, minor: 0.11, major: 0.27 };
  const ON_CREAM = { ink: BLACK, minor: 0.10, major: 0.26 };
  const contours = (tone, o) => {
    const cfg = Object.assign({ frag: CONTOUR_FS, seed: [0, 0], freq: 1, pulse: 0, scroll: 0 }, tone, o);
    return class extends FieldFX { constructor(gl, stage) { super(gl, stage, cfg); } };
  };

  // Contact: the sunburst. It is a very smooth image, so it renders a little lighter than the contours.
  const rays = (() => {
    const cfg = { frag: RAYS_FS, ink: CREAM, minor: 0, major: 0, seed: [0, 0], freq: 1, pulse: 0, scroll: 0.35, trail: false, click: 1.2, scale: (l, q) => (l ? 0.4 : 0.75) * q };
    return class extends FieldFX { constructor(gl, stage) { super(gl, stage, cfg); } };
  })();

  /* ======================================================================
     Wiring: which canvas gets which effect
     ====================================================================== */
  const FIELD = { maxPixels: 2.0e6 };
  const SLOTS = [
    { id: "fx-hero-mono",  Effect: MonogramFX,                                                          opts: { antialias: true } },
    { id: "fx-skills",     Effect: contours(ON_NAVY),                                                   opts: FIELD },
    { id: "fx-projects",   Effect: contours(ON_CREAM, { seed: [11, 5], pulse: 1, scroll: 0.3 }),        opts: FIELD },
    { id: "fx-experience", Effect: contours(ON_CREAM, { seed: [31, 17], freq: 1.25, pulse: 1, scroll: 0.3 }), opts: FIELD },
    { id: "fx-education",  Effect: contours(ON_BLACK, { seed: [53, 2], pulse: 1 }),                     opts: FIELD },
    { id: "fx-contact",    Effect: rays,                                                        opts: FIELD }
  ];

  // Start after load + idle so the effects never compete with first paint.
  const start = () => {
    SLOTS.forEach((sl) => {
      const cv = document.getElementById(sl.id);
      if (cv) new Stage(cv, sl.Effect, sl.opts).setOn(true);
    });
    liteMQ.addEventListener && liteMQ.addEventListener("change", () => stages.forEach((s) => s.resize()));
    reduce.addEventListener && reduce.addEventListener("change", () => stages.forEach((s) => s.sync()));
    document.addEventListener("visibilitychange", () => stages.forEach((s) => s.sync()));
  };
  const whenIdle = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 300));
  if (document.readyState === "complete") whenIdle(); else addEventListener("load", whenIdle, { once: true });
})();
