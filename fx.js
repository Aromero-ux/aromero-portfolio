/* ==========================================================================
   WEBGL ACCENTS & EFFECTS LAB
   ========================================================================== */
(() => {
  "use strict";

  if (!("IntersectionObserver" in window) || !("ResizeObserver" in window)) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const liteMQ = matchMedia("(max-width: 767px)");      
  const lite = () => liteMQ.matches;
  const sideLayout = () => innerWidth >= 1100;           

  /* ---- Settings (switched in the effects lab) ---------------------------- */
  const settings = { motion: "full", quality: "auto", cursor: "on" };
  const QUALITY_SCALE = { low: 0.6, auto: 1, high: 1.25 };
  const QUALITY_BUDGET = { low: 0.45, auto: 1, high: 1.8 };
  const html = document.documentElement;
  const isSynth = () => html.classList.contains("fx-synthwave");

  /* ---- Palette (matches the site) -------------------------------------- */
  const ORANGE = [0.996, 0.498, 0.176];
  const CREAM = [0.918, 0.925, 0.941];

  // Killer Synthwave palette
  const SYNTH_PINK = [1.0, 0.0, 0.498];   // #ff007f
  const SYNTH_CYAN = [0.0, 0.898, 1.0];   // #00e5ff

  /* ---- Pointer (shared) ------------------------------------------------- */
  const P = { x: 0, y: 0, seen: false, last: 0 };
  const stages = [];
  const pointerActive = (now) => settings.cursor === "on" && P.seen && now - P.last < 2600;

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    P.x = e.clientX; P.y = e.clientY; P.seen = true; P.last = performance.now();
  }, { passive: true });
  addEventListener("pointerdown", (e) => {
    P.x = e.clientX; P.y = e.clientY; P.last = performance.now();
    if (settings.cursor !== "on") return;
    stages.forEach((s) => s.on && s.visible && s.fx && s.fx.click && s.fx.click(e.clientX, e.clientY));
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

  /* ---- Matrices -------------------------- */
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

  /* Shared GLSL */
  const GLSL_NOISE = `
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float vnoise(vec2 p) {
      vec2 f = fract(p);
      vec2 i0 = mod(floor(p), 61.0);
      vec2 i1 = mod(i0 + 1.0, 61.0);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i0), hash(vec2(i1.x, i0.y)), f.x), mix(hash(vec2(i0.x, i1.y)), hash(i1), f.x), f.y);
    }
    float fbm(vec2 p) {
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
     STAGE
     ====================================================================== */
  /* ---- Shared clock: every canvas reads the same time, so neighbouring effects line up ---- */
  let clockT = 3, clockLast = 0;
  const clock = (now) => {
    if (clockLast && now > clockLast) clockT += (Math.min(now - clockLast, 100) / 1000) * (settings.motion === "calm" ? 0.4 : 1);
    clockLast = now;
    return clockT;
  };

  /* ---- Sound: the Killer Synthwave track, and the numbers the visuals listen to ---------------
     The audio is only created when the theme is switched on. Where the browser allows it
     (any http/https page) a Web Audio analyser reads the real spectrum; on file:// pages the
     browser silences analysed audio, so the track plays untouched and the visuals use a
     simulated beat instead. */
  const BANDS = 64;
  const WAVE_N = 256;
  const audio = (() => {
    const SRC = "assets/hackers.mp3";
    const TIME_KEY = "synthwaveAudioTime";
    const levels = { bass: 0, mid: 0, treble: 0, beat: 0, calm: 0 };
    const bands = new Float32Array(BANDS);
    const wave = new Float32Array(WAVE_N);                   // -1..1, what the wave lines draw
    const ranges = [];
    const analysable = location.protocol !== "file:";
    let el = null, ctx = null, analyser = null, gain = null, bins = null, td = null;
    let wanted = false, muted = false, armed = false, lastNow = -1, slowBass = 0, peak = 0.1;

    const ensure = () => {
      if (el) return;
      el = new Audio(SRC);
      el.loop = true;
      el.preload = "auto";
      try { const t = parseFloat(sessionStorage.getItem(TIME_KEY)); if (t > 0) el.currentTime = t; } catch (e) { }
    };

    const graph = () => {
      if (ctx || !analysable) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        const src = ctx.createMediaElementSource(el);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.72;
        gain = ctx.createGain();
        gain.gain.value = muted ? 0 : 1;
        src.connect(analyser);
        analyser.connect(gain);
        gain.connect(ctx.destination);
        bins = new Uint8Array(analyser.frequencyBinCount);
        td = new Uint8Array(analyser.fftSize);
        const top = Math.floor(bins.length * 0.74);          // up to ~16 kHz, log-spaced bands
        for (let b = 0; b < BANDS; b++) {
          const lo = Math.max(1, Math.round(Math.exp((Math.log(top) * b) / BANDS)));
          const hi = Math.max(lo + 1, Math.round(Math.exp((Math.log(top) * (b + 1)) / BANDS)));
          ranges.push([lo, hi]);
        }
      } catch (e) {
        if (ctx && ctx.close) ctx.close();
        ctx = analyser = gain = bins = td = null;
      }
    };

    // Browsers block sound until the visitor interacts: try again on the first click, key press or tap.
    const unlock = () => {
      if (armed) return;
      armed = true;
      const events = ["pointerdown", "keydown", "touchstart"];
      const go = () => { events.forEach((t) => removeEventListener(t, go, true)); armed = false; if (wanted) start(); };
      events.forEach((t) => addEventListener(t, go, true));
    };

    function start() {
      wanted = true;
      ensure();
      graph();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => { });
      el.muted = !ctx && muted;
      const p = el.play();
      if (p && p.catch) p.catch(unlock);
    }
    const stop = () => {
      wanted = false;
      if (el) { el.pause(); el.currentTime = 0; }
      try { sessionStorage.removeItem(TIME_KEY); } catch (e) { }
    };
    const setMuted = (m) => {
      muted = m;
      if (gain) gain.gain.value = m ? 0 : 1;      // the analyser sits before the gain: muted, the lines still follow the song
      else if (el) el.muted = m;
    };

    // keep the song position across pages, and do not play into a background tab
    addEventListener("pagehide", () => {
      try {
        if (wanted && el && !el.paused) sessionStorage.setItem(TIME_KEY, String(el.currentTime));
        else sessionStorage.removeItem(TIME_KEY);
      } catch (e) { }
    });
    document.addEventListener("visibilitychange", () => {
      if (!el || !wanted) return;
      if (document.hidden) el.pause(); else start();
    });

    const active = () => !!el && !el.paused;

    // once per frame: refresh bands, the waveform and the bass / mid / treble / beat levels
    function update(now) {
      if (now === lastNow) return;
      lastNow = now;
      const playing = active();
      if (playing && analyser) analyser.getByteFrequencyData(bins);
      for (let b = 0; b < BANDS; b++) {
        let v;
        if (playing && analyser) {
          let sum = 0;
          const r = ranges[b];
          for (let i = r[0]; i < r[1]; i++) sum += bins[i];
          v = Math.min(1, Math.pow(sum / (r[1] - r[0]) / 255, 1.15) * (1 + (0.9 * b) / BANDS));
        } else if (playing) {                                  // no analysis available (file://): a believable beat instead
          const ph = el.currentTime * 2;
          const kick = Math.pow(Math.max(0, 1 - (ph % 1) * 3.5), 2);
          const hat = Math.pow(Math.max(0, 1 - ((ph * 2 + 0.5) % 1) * 4), 2);
          const x = b / BANDS;
          v = 0.22 * Math.exp(-x * 3) + kick * 0.85 * Math.exp(-x * 5) + hat * 0.5 * x + 0.14 * (0.5 + 0.5 * Math.sin(el.currentTime * (2 + b * 0.37) + b));
          v = Math.min(1, v);
        } else {                                               // nothing playing: a slow breath
          v = 0.05 + 0.035 * (0.5 + 0.5 * Math.sin(now * 0.0011 + b * 0.35));
        }
        bands[b] = v > bands[b] ? bands[b] + (v - bands[b]) * 0.6 : bands[b] * 0.88 + v * 0.12;
      }

      if (playing && analyser) {                               // the real signal, started on a rising zero crossing so the shape holds still
        analyser.getByteTimeDomainData(td);
        const lim = td.length >> 1;
        let s = 0;
        while (s < lim && !(td[s] < 128 && td[s + 1] >= 128)) s++;
        if (s >= lim) s = 0;
        let m = 0;
        for (let i = 0; i < WAVE_N; i++) m = Math.max(m, Math.abs(td[s + i * 4] - 128) / 128);
        peak = Math.max(peak * 0.995, m, 0.08);
        for (let i = 0; i < WAVE_N; i++) {
          const v = Math.max(-1, Math.min(1, ((td[s + i * 4] - 128) / 128 / peak) * 0.9));
          wave[i] += (v - wave[i]) * 0.6;
        }
      } else {                                                 // no signal to read: a ripple built from the bands, still moving with the song
        const ph = playing && el ? el.currentTime : now / 1000;
        const k0 = playing ? 1.6 : 0.5;
        for (let i = 0; i < WAVE_N; i++) {
          const x = i / WAVE_N;
          let v = 0;
          for (let k = 0; k < 6; k++) v += (bands[k * 9 + 2] * Math.sin(x * (k + 2) * 6.2832 + ph * (1.5 + k * 0.6) + k * 1.7)) / (1 + k * 0.4);
          wave[i] += (v * k0 - wave[i]) * 0.3;
        }
      }
      const mean = (a, z) => { let t = 0; for (let i = a; i < z; i++) t += bands[i]; return t / (z - a); };
      levels.bass = Math.min(1, mean(0, 14) * 1.3);
      levels.mid = Math.min(1, mean(14, 41) * 1.3);
      levels.treble = Math.min(1, mean(41, BANDS) * 1.5);
      slowBass += (levels.bass - slowBass) * 0.04;
      levels.calm += ((levels.bass + levels.mid + levels.treble) / 3 - levels.calm) * 0.02;
      levels.beat = Math.max(levels.beat * 0.88, Math.min(1, Math.max(0, (levels.bass - slowBass) * 3.2)));
    }

    return { start, stop, setMuted, update, active, levels, bands, wave };
  })();

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
          failIfMajorPerformanceCaveat: true   
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
        this.canvas.hidden = false;             
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
      if (!this.sized) return;                  
      if (reduce.matches || settings.motion === "still") { this.stop(); this.renderStill(); return; }
      if (!this.raf) { this.lastRender = performance.now(); this.raf = requestAnimationFrame(this.tick); }
    }
    setEffect(Effect) {
      if (Effect === this.Effect) return;
      this.stop();
      if (this.fx && this.fx.dispose) this.fx.dispose();
      this.fx = null;
      this.Effect = Effect;
      this.sized = false; this.live = false;
      this.canvas.classList.remove("is-live");
      this.sync();
    }

    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }

    resize() {
      if (!this.gl || !this.fx) return;
      if (this.fx.layout) this.fx.layout();
      const cssW = this.canvas.clientWidth, cssH = this.canvas.clientHeight;
      if (!cssW || !cssH) return;
      let s = this.fx.pixelScale(this.quality);
      const budget = this.opts.maxPixels ? this.opts.maxPixels * QUALITY_BUDGET[settings.quality] : 0;     // cap the pixels on big screens
      if (budget && cssW * cssH * s * s > budget) s = Math.sqrt(budget / (cssW * cssH));
      const w = Math.max(2, Math.round(cssW * s)), h = Math.max(2, Math.round(cssH * s));
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      this.gl.viewport(0, 0, w, h);
      this.fx.resize(w, h, cssW, cssH, s);
      this.sized = true;
      if (!this.raf && this.on && this.visible && (reduce.matches || settings.motion === "still")) this.renderStill();
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
      const minDt = settings.motion === "calm" ? 33 : busy ? 14 : lite() ? 42 : 31;      // ~60 / ~30 / ~24 fps
      if (now - this.lastRender < minDt) return;
      const dt = Math.min((now - this.lastRender) / 1000, 0.1);
      this.lastRender = now;
      this.t = clock(now);
      this.fx.step(dt, now, this.t, false);
      this.fx.draw(this.t);
      this.markLive();
      this.adapt(dt * 1000, busy);
    }

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
     1. MONOGRAM
     ====================================================================== */

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
      if (g > 0.5) {                       
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
      ndc += (rel / (dist + 1e-3)) * glow * 0.045 / aspect;     

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
      const cx = 551.7, cy = 330.2, k = 2 / 431.6;               
      const P3 = {};
      Object.keys(LOGO_PTS).forEach((n) => { P3[n] = [(LOGO_PTS[n][0] - cx) * k, -(LOGO_PTS[n][1] - cy) * k]; });

      const segs = [];                                             
      const L = 5, D = 0.28;
      const zs = Array.from({ length: L }, (_, i) => -D + (2 * D * i) / (L - 1));
      zs.forEach((z, li) => {
        const edge = li === 0 || li === L - 1;
        LOGO_EDGES.forEach(([p, q]) => segs.push({ a: [...P3[p], z], b: [...P3[q], z], tone: edge ? 1.0 : 0.3, group: 0 }));
      });
      Object.keys(P3).forEach((n) => {                             
        for (let li = 0; li < L - 1; li++) segs.push({ a: [...P3[n], zs[li]], b: [...P3[n], zs[li + 1]], tone: 0.5, group: 0 });
      });
      const R = 1.3, N = 96;                                       
      for (let i = 0; i < N; i++) {
        if (i % 3 === 2) continue;
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        segs.push({ a: [R * Math.cos(a0), 0, R * Math.sin(a0)], b: [R * Math.cos(a1), 0, R * Math.sin(a1)], tone: 0.34, group: 1 });
      }
      segs.push({ a: [R, 0, 0], b: [R * Math.cos(0.16), 0, R * Math.sin(0.16)], tone: 1.0, group: 1 }); 

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

      const n = 140, seeds = new Float32Array(n * 3);
      for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
      this.dustCount = n;
      this.dustBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dustBuf);
      gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    }

    pixelScale(q) { return Math.min(devicePixelRatio || 1, lite() ? 1.5 : 2) * q * QUALITY_SCALE[settings.quality]; }

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
      this.spinTarget += Math.PI * 2;            
    }

    draw(t) {
      const gl = this.gl, U = this.U;
      rotX(this.m1, this.pitch); rotY(this.m2, this.yaw);
      mul(this.model, this.m1, this.m2);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const synth = isSynth();
      const baseCol = synth ? SYNTH_CYAN : ORANGE;
      const hiCol = synth ? SYNTH_PINK : CREAM;

      gl.useProgram(this.lineProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      const offs = [0, 12, 24, 32, 36], sizes = [3, 3, 2, 1, 1];         
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
      
      gl.uniform3f(U.uCol, baseCol[0], baseCol[1], baseCol[2]);
      gl.uniform3f(U.uHi, hiCol[0], hiCol[1], hiCol[2]);
      
      const wpx = (lite() ? 1.3 : 1.6) * this.px;
      gl.uniform1f(U.uHalo, 1); gl.uniform1f(U.uWidth, wpx * 5);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
      gl.uniform1f(U.uHalo, 0); gl.uniform1f(U.uWidth, wpx);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
      for (let a = 0; a < 5; a++) gl.disableVertexAttribArray(a);

      gl.useProgram(this.dustProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dustBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(this.D.uVP, false, this.vp);
      gl.uniform1f(this.D.uT, t);
      gl.uniform1f(this.D.uPx, 2.0 * this.px);
      gl.uniform1f(this.D.uDist, this.dist);
      gl.uniform2f(this.D.uShift, this.shift[0], this.shift[1]);
      gl.uniform3f(this.D.uCol, baseCol[0], baseCol[1], baseCol[2]);
      gl.drawArrays(gl.POINTS, 0, this.dustCount);
      gl.disableVertexAttribArray(0);
    }
  }

  /* ======================================================================
     CONTOURS
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
      this.U = getUniforms(gl, this.prog, ["uRes", "uT", "uPtr", "uRip", "uScroll", "uInk", "uAcc", "uTone", "uSeed", "uFreq", "uPulse", "uLinePx", "uS"].concat(cfg.uniforms || []));
      this.buf = fullscreenTriangle(gl);
      this.rip = makeRipples(6);
      this.ptr = { x: 0.5, y: 0.5, amp: 0 };
      this.last = { x: 1e9, y: 1e9, t: -1 };
      this.w = 2; this.h = 2; this.cssW = 2; this.cssH = 2; this.s = 1; this.t = 0;
      gl.clearColor(0, 0, 0, 0);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
    }
    dispose() { this.gl.deleteProgram(this.prog); this.gl.deleteBuffer(this.buf); }
    pixelScale(q) {
      const qs = QUALITY_SCALE[settings.quality];
      if (this.cfg.scale) return this.cfg.scale(lite(), q) * qs;
      return (lite() ? 0.6 : Math.min(devicePixelRatio || 1, settings.quality === "high" ? 2 : 1.5)) * q * qs;
    }
    resize(w, h, cssW, cssH, s) { this.w = w; this.h = h; this.cssW = cssW; this.cssH = cssH; this.s = s; }

    toField(x, y, r) { return { x: x / r.height, y: (r.height - y) / r.height }; }

    step(dt, now, t, still) {
      this.t = t;
      if (this.cfg.audio) audio.update(now);
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
        (!!this.cfg.scroll && scrolling(now)) || (!!this.cfg.audio && audio.active());
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
      
      const synth = isSynth();
      let ink = c.ink;
      let acc = ORANGE;

      if (synth) {
        ink = SYNTH_CYAN; 
        acc = SYNTH_PINK;
      }

      gl.uniform3f(U.uInk, ink[0], ink[1], ink[2]);
      gl.uniform3f(U.uAcc, acc[0], acc[1], acc[2]);
      gl.uniform2f(U.uTone, c.minor, c.major);
      gl.uniform2f(U.uSeed, c.seed[0], c.seed[1]);
      gl.uniform1f(U.uFreq, c.freq);
      gl.uniform1f(U.uPulse, c.pulse);
      gl.uniform1f(U.uLinePx, 1.0667 * this.s);      
      gl.uniform1f(U.uS, this.s);
      if (c.extra) c.extra(gl, U, this);
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
      vec2 ps = gl_FragCoord.xy / uRes.y;                       
      vec2 p = (ps + vec2(0.0, uScroll)) * uFreq + uSeed;       
      float t = uT * 0.02;
      float f = fbm(p * 1.7 + vec2(t * 3.0, -t * 2.0));
      f += 0.3 * fbm(p * 3.6 - vec2(t * 2.2, t * 1.4) + 7.0);

      vec2 q = ps - uPtr.xy;                                    
      float heat = uPtr.z * 0.22 * exp(-dot(q, q) * 26.0);
      for (int i = 0; i < 6; i++) {                             
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
      line *= 1.0 - smoothstep(0.35, 0.65, fw / uS * 0.75);     
      float major = step(mod(floor(level + 0.5), 5.0), 0.5);
      float a = line * mix(uTone.x, uTone.y, major);

      float travel = mod(uT * 0.32, 3.2) - 0.6;                 
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
    uniform vec3 uInk;
    uniform vec3 uAcc;
    void main() {
      float asp = uRes.x / uRes.y;
      vec2 c = vec2(0.5 * asp, 0.5);
      vec2 p = gl_FragCoord.xy / uRes.y - c;
      vec2 ptr = uPtr.xy - c;
      vec2 origin = vec2(0.0, 0.12) + ptr * 0.05 * uPtr.z;    
      vec2 r = p - origin;
      float rad = length(r);
      float ang = atan(r.y, r.x) + uScroll * 1.2;             

      const float N = 20.0;
      float phase = ang / 6.2831853 * N + uT * 0.02;
      float w = fract(phase);
      float aa = N / 6.2831853 / max(rad, 0.02) / uRes.y * 1.5;
      float s = smoothstep(0.0, aa, w) - smoothstep(0.5, 0.5 + aa, w);
      float orangeRay = step(mod(floor(phase), 4.0), 0.5);    
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
      vec3 col = mix(uInk, uAcc, clamp(orangeRay + spot * 1.2 + pulse, 0.0, 1.0));
      a = clamp(a, 0.0, 1.0);
      gl_FragColor = vec4(col * a, a);
    }
  `;

  /* ---- SYNTHWAVE SUNSET: the hero scene (sun, mountains, neon grid) in one shader ---------- */
  const SUNSET_FS = (deriv) => `
    ${deriv ? "#extension GL_OES_standard_derivatives : enable" : ""}
    ${FRAG_PRECISION}
    uniform vec2 uRes;
    uniform float uT;
    uniform vec3 uPtr;
    uniform vec4 uRip[6];
    uniform vec4 uAudio;                                     // bass, mid, treble, calm (a slow average, so nothing pulses on the beat)
    ${GLSL_NOISE}
    void main() {
      vec2 frag = gl_FragCoord.xy;
      float asp = uRes.x / uRes.y;
      vec2 uv = frag / uRes;
      float px = 1.0 / uRes.y;
      float treb = uAudio.z;
      float energy = uAudio.w;
      float horizon = 0.30;
      vec2 par = (uPtr.xy - vec2(0.5 * asp, 0.5)) * uPtr.z;  // a hint of parallax toward the cursor

      float pulse = 0.0;                                     // a click makes the scene flare
      for (int i = 0; i < 6; i++) {
        vec4 r = uRip[i];
        float age = uT - r.z;
        if (r.w > 0.0 && age >= 0.0) pulse += r.w * exp(-age * 2.2);
      }
      pulse = min(pulse, 1.5);

      // the perspective grid, evaluated everywhere so its derivatives stay valid
      float y = horizon - uv.y;
      float zf = 0.06 / max(y, 0.0015);
      float speed = 0.9 + energy * 1.2;
      vec2 g = vec2((uv.x - 0.5) * asp * zf * 34.0, zf * 20.0 + uT * speed);
      ${deriv ? "float wx = max(fwidth(g.x), 1e-4); float wz = max(fwidth(g.y), 1e-4);" : "float wx = 0.05; float wz = 0.05;"}

      vec3 col;
      if (uv.y >= horizon) {
        float h = (uv.y - horizon) / (1.0 - horizon);
        col = mix(vec3(0.82, 0.07, 0.46), vec3(0.17, 0.02, 0.31), smoothstep(0.0, 0.38, h));
        col = mix(col, vec3(0.02, 0.015, 0.06), smoothstep(0.28, 1.0, h));

        vec2 sc = frag / uRes.y * 55.0;                      // twinkling stars
        vec2 si = floor(sc);
        float sh = hash(si);
        float star = step(0.978, sh) * (1.0 - smoothstep(0.0, 0.14 + sh * 0.1, length(fract(sc) - 0.5)));
        float tw = 0.55 + 0.45 * sin(uT * (1.5 + sh * 4.0) + sh * 40.0);
        col += vec3(0.8, 0.9, 1.0) * star * tw * smoothstep(0.25, 0.7, h) * (0.55 + treb * 1.3);

        float R = 0.27 * (1.0 + 0.04 * pulse);   // the sun, steady
        vec2 sunC = vec2(0.76 * asp + par.x * 0.02, horizon + R * 0.48 + par.y * 0.01);
        vec2 q = vec2(uv.x * asp, uv.y) - sunC;
        float d = length(q);
        float disc = 1.0 - smoothstep(R - 1.5 * px, R, d);
        float sy = clamp((q.y + R) / (2.0 * R), 0.0, 1.0);
        vec3 sunCol = mix(vec3(1.0, 0.05, 0.50), vec3(1.0, 0.42, 0.12), smoothstep(0.0, 0.5, sy));
        sunCol = mix(sunCol, vec3(1.0, 0.86, 0.28), smoothstep(0.42, 1.0, sy));
        float below = clamp(-q.y / R, 0.0, 1.0);             // the cut-out stripes, widening toward the bottom
        float f = fract(below * 14.0 - uT * 0.35);
        float vis = smoothstep(0.10 + 0.62 * below, 0.15 + 0.62 * below, f);
        disc *= mix(1.0, vis, smoothstep(0.0, 0.06, below));

        float outside = max(d - R, 0.0);                     // the aura: the same glow as ever, with mist drifting through it
        float mist = fbm(q / R * 1.6 + vec2(uT * 0.04, -uT * 0.055));
        col += vec3(1.0, 0.25, 0.60) * exp(-outside * 5.5) * (0.6 + 0.5 * energy) * (0.8 + 0.5 * mist);
        col += vec3(1.0, 0.30, 0.65) * exp(-outside * 2.4) * mist * mist * 0.5;
        col = mix(col, sunCol * (1.05 + 0.2 * pulse), disc);

        float away = smoothstep(0.05, 0.55, abs(uv.x - 0.76));   // mountains, lowest in front of the sun
        float ridge = horizon + 0.006 + (0.012 + 0.065 * away) * (0.4 + 1.2 * fbm(vec2(uv.x * asp * 2.1 + 7.0 + par.x * 0.4, 1.3)));
        col = mix(col, vec3(0.035, 0.008, 0.075), 1.0 - smoothstep(ridge - px, ridge + px, uv.y));
        float rim = (1.0 - smoothstep(0.0, 2.2 * px, abs(uv.y - ridge)));
        col += vec3(0.0, 0.85, 1.0) * rim * (0.22 + 0.5 * energy);
      } else {
        col = mix(vec3(0.01, 0.0, 0.04), vec3(0.17, 0.0, 0.26), exp(-y * 7.0));
        float dx = abs(fract(g.x) - 0.5);
        float dz = abs(fract(g.y) - 0.5);
        float lx = 1.0 - smoothstep(0.0, wx * 1.5, 0.5 - dx);
        float lz = 1.0 - smoothstep(0.0, wz * 1.5, 0.5 - dz);
        float fade = smoothstep(0.0, 0.16, y);
        float bright = 0.8 + 1.0 * energy + 0.3 * pulse;
        col += vec3(0.0, 0.9, 1.0) * lz * bright * fade;
        col += vec3(1.0, 0.10, 0.60) * lx * bright * fade;
        float glow = (1.0 - smoothstep(0.0, wx * 6.0, 0.5 - dx)) * 0.10 + (1.0 - smoothstep(0.0, wz * 6.0, 0.5 - dz)) * 0.10;
        col += vec3(0.6, 0.1, 0.9) * glow * fade * bright;
        col += vec3(1.0, 0.1, 0.55) * exp(-abs(uv.x - 0.76) * 3.2) * exp(-y * 5.0) * 0.28 * (0.5 + energy);   // the sun's reflection
      }

      float hz = abs(uv.y - horizon);                         // glowing horizon line
      col += vec3(1.0, 0.30, 0.70) * exp(-hz * 120.0) * (0.6 + 0.7 * energy);
      col += vec3(1.0, 0.85, 0.95) * exp(-hz * 420.0) * 0.6;
      col *= 1.0 - 0.38 * length((uv - 0.5) * vec2(0.9, 0.8));
      gl_FragColor = vec4(col, 1.0);
    }
  `;
  const sunset = (() => {
    const cfg = {
      frag: SUNSET_FS, ink: CREAM, minor: 0, major: 0, seed: [0, 0], freq: 1, pulse: 0, audio: true, trail: false, click: 1.0,
      scale: (l, q) => (l ? 0.5 : Math.min(devicePixelRatio || 1, 1.25)) * q,
      uniforms: ["uAudio"],
      extra: (gl, U) => gl.uniform4f(U.uAudio, audio.levels.bass, audio.levels.mid, audio.levels.treble, audio.levels.calm)
    };
    return class extends FieldFX { constructor(gl, stage) { super(gl, stage, cfg); } };
  })();

  /* ---- WAVE LINES: a page-wide overlay that draws the sound itself: the live waveform, with its recent past stacked above it ------ */
  const WAVE_ROWS = 10;
  const FREQ_FS = () => `
    ${FRAG_PRECISION}
    uniform vec2 uRes;
    uniform float uT;
    uniform float uShift;
    uniform float uGain;
    uniform sampler2D uTex;
    float wv(float x, float row) { return texture2D(uTex, vec2(clamp(x, 0.0, 1.0), row)).r * 2.0 - 1.0; }
    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      vec3 pink = vec3(1.0, 0.0, 0.5);
      vec3 cyan = vec3(0.0, 0.9, 1.0);
      vec3 col = vec3(0.0);
      float a = 0.0;
      float edge = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x);
      float e = 2.0 / uRes.x;
      for (int i = 0; i < ${WAVE_ROWS}; i++) {
        float fi = float(i);
        float t = fi / ${WAVE_ROWS - 1}.0;                       // 0 is the live line at the bottom, 1 the oldest at the top
        float amp = (0.08 + 0.08 * uGain) * mix(1.25, 0.6, t) * edge;
        float base = 0.06 + 0.66 * pow(t, 0.9) + sin(uv.x * 4.0 + uT * 0.6 + fi * 0.8) * 0.008;
        if (abs(uv.y - base) > amp + 0.01) continue;
        float row = (max(fi - uShift, 0.0) + 0.5) / ${WAVE_ROWS}.0;
        float w0 = wv(uv.x, row);
        float yl = base + w0 * amp;
        float slope = (wv(uv.x + e, row) - wv(uv.x - e, row)) * amp / (2.0 * e) * (uRes.y / uRes.x);
        float d = abs(uv.y - yl) * uRes.y / sqrt(1.0 + slope * slope);   // distance to the line, not just vertically
        float wpx = mix(2.4, 1.5, t);
        float l = 1.0 - smoothstep(wpx * 0.5, wpx * 0.5 + 1.2, d);
        float br = mix(1.0, 0.55, t) * (0.5 + abs(w0) * 0.9 + uGain * 0.4);
        col += mix(cyan, pink, clamp(t + abs(w0) * 0.3, 0.0, 1.0)) * l * br;
        a += l * br;
      }
      a = clamp(max(a, max(col.r, max(col.g, col.b))), 0.0, 1.0);
      gl_FragColor = vec4(min(col, vec3(a)), a);
    }
  `;
  class FreqFX {
    constructor(gl, stage) {
      this.gl = gl; this.canvas = stage.canvas;
      this.prog = makeProgram(gl, FULL_VS, FREQ_FS(), ["aPos"]);
      this.U = getUniforms(gl, this.prog, ["uRes", "uT", "uShift", "uGain", "uTex"]);
      this.buf = fullscreenTriangle(gl);
      this.hist = new Uint8Array(WAVE_N * WAVE_ROWS);
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, WAVE_N, WAVE_ROWS, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.hist);
      this.w = 2; this.h = 2; this.lastShift = 0; this.frac = 0;
      gl.clearColor(0, 0, 0, 0);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
    }
    dispose() { this.gl.deleteProgram(this.prog); this.gl.deleteBuffer(this.buf); this.gl.deleteTexture(this.tex); }
    pixelScale(q) { return Math.min(devicePixelRatio || 1, 1.25) * q * QUALITY_SCALE[settings.quality]; }
    resize(w, h) { this.w = w; this.h = h; }
    step(dt, now) {
      audio.update(now);
      const H = this.hist, wave = audio.wave;
      if (now - this.lastShift >= 70) {                      // every ~70 ms the live line becomes history
        H.copyWithin(WAVE_N, 0, WAVE_N * (WAVE_ROWS - 1));
        this.lastShift = now;
      }
      this.frac = clamp((now - this.lastShift) / 70, 0, 1);
      for (let i = 0; i < WAVE_N; i++) H[i] = clamp(wave[i] * 0.5 + 0.5, 0, 1) * 255 + 0.5;
    }
    busy() { return audio.active(); }
    draw(t) {
      const gl = this.gl, U = this.U;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, WAVE_N, WAVE_ROWS, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.hist);
      gl.uniform1i(U.uTex, 0);
      gl.uniform2f(U.uRes, this.w, this.h);
      gl.uniform1f(U.uT, t);
      gl.uniform1f(U.uShift, this.frac);
      gl.uniform1f(U.uGain, audio.active() ? audio.levels.bass * 0.6 + audio.levels.mid * 0.4 : 0.3);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(0);
    }
  }

  /* ---- DITHER and HALFTONE: the same drifting field, drawn as dots ------------------ */
  const DOT_LIB = `
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
    uniform float uS;
    ${GLSL_NOISE}
    float fieldAt(vec2 ps, out float heat) {
      vec2 p = (ps + vec2(0.0, uScroll)) * uFreq + uSeed;
      float t = uT * 0.02;
      float f = fbm(p * 1.7 + vec2(t * 3.0, -t * 2.0));
      f += 0.3 * fbm(p * 3.6 - vec2(t * 2.2, t * 1.4) + 7.0);
      vec2 q = ps - uPtr.xy;
      heat = uPtr.z * 0.22 * exp(-dot(q, q) * 26.0);
      for (int i = 0; i < 6; i++) {
        vec4 r = uRip[i];
        float age = uT - r.z;
        if (r.w > 0.0 && age >= 0.0) {
          float d = distance(ps, r.xy) - age * 0.42;
          heat += r.w * 0.16 * exp(-age * 0.9) * exp(-d * d * 120.0) * cos(d * 26.0);
        }
      }
      return f + heat;
    }
    float hotAt(vec2 ps, float heat) {
      float travel = mod(uT * 0.32, 3.2) - 0.6;
      float across = ps.x * 0.9 + ps.y * 0.35 - travel;
      return clamp(abs(heat) * 5.0 + uPulse * exp(-across * across * 38.0), 0.0, 1.0);
    }
  `;
  const DITHER_FS = () => `
    ${FRAG_PRECISION}
    ${DOT_LIB}
    float b2(vec2 p) { return mod(p.x * 2.0 + p.y * 3.0, 4.0); }
    float bayer4(vec2 c) { return (b2(mod(c, 2.0)) * 4.0 + b2(mod(floor(c / 2.0), 2.0)) + 0.5) / 16.0; }
    void main() {
      float cell = max(2.0, 3.0 * uS);                          // one dither dot is about 3 css px
      vec2 cp = floor(gl_FragCoord.xy / cell);
      vec2 ps = (cp + 0.5) * cell / uRes.y;
      float heat;
      float f = fieldAt(ps, heat);
      float v = clamp((f - 0.4) / 0.55, 0.0, 1.0);
      float on = step(bayer4(cp), v * v);
      float hot = hotAt(ps, heat);
      float a = on * uTone.y * (0.55 + 0.45 * hot);
      gl_FragColor = vec4(mix(uInk, uAcc, hot) * a, a);
    }
  `;
  const HALFTONE_FS = () => `
    ${FRAG_PRECISION}
    ${DOT_LIB}
    void main() {
      float cell = max(5.0, 8.0 * uS);                          // a print-style grid, turned 15 degrees
      vec2 fc = gl_FragCoord.xy;
      vec2 q = vec2(0.9659 * fc.x + 0.2588 * fc.y, -0.2588 * fc.x + 0.9659 * fc.y) / cell;
      vec2 fr = fract(q) - 0.5;
      vec2 c = (floor(q) + 0.5) * cell;
      vec2 ps = vec2(0.9659 * c.x - 0.2588 * c.y, 0.2588 * c.x + 0.9659 * c.y) / uRes.y;
      float heat;
      float f = fieldAt(ps, heat);
      float v = clamp((f - 0.3) / 0.6, 0.0, 1.0);
      float r = 0.12 + 0.4 * v;
      float aa = 1.0 / cell + 0.04;
      float disc = 1.0 - smoothstep(r - aa, r, length(fr));
      float hot = hotAt(ps, heat);
      float a = disc * uTone.y * (0.7 + 0.5 * hot);
      gl_FragColor = vec4(mix(uInk, uAcc, hot) * a, a);
    }
  `;

  const ON_NAVY = { ink: CREAM, minor: 0.10, major: 0.26 };
  const ON_BLACK = { ink: CREAM, minor: 0.11, major: 0.27 };
  const ON_CREAM = { ink: BLACK, minor: 0.10, major: 0.26 };

  const contours = (tone, o) => {
    const cfg = Object.assign({ frag: CONTOUR_FS, seed: [0, 0], freq: 1, pulse: 0, scroll: 0 }, tone, o);
    return class extends FieldFX { constructor(gl, stage) { super(gl, stage, cfg); } };
  };
  const rays = (tone, o) => {
    const cfg = Object.assign({ frag: RAYS_FS, seed: [0, 0], freq: 1, pulse: 0, trail: false, click: 1.2, scale: (l, q) => (l ? 0.4 : 0.75) * q }, tone, o);
    return class extends FieldFX { constructor(gl, stage) { super(gl, stage, cfg); } };
  };
  const dither = (tone, o) => {
    const cfg = Object.assign({ frag: DITHER_FS, seed: [0, 0], freq: 1, pulse: 0, scroll: 0 }, tone, o);
    return class extends FieldFX { constructor(gl, stage) { super(gl, stage, cfg); } };
  };
  const fieldEffects = (tone, o) => ({ contours: contours(tone, o), rays: rays(tone, o) });

  const FIELD = { maxPixels: 2.0e6 };
  const PROJECT_FIELD = { seed: [4, 2], pulse: 1, scroll: 0.3 };      // projects and experience share it, so they read as one backdrop
  const SLOTS = [
    { key: "hero",       label: "Hero",       id: "fx-hero-mono",  initial: "monogram", opts: { antialias: true }, effects: { monogram: MonogramFX } },
    { key: "skills",     label: "Skills",     id: "fx-skills",     initial: "contours", opts: FIELD, effects: fieldEffects(ON_NAVY, { seed: [0, 0] }) },
    { key: "projects",   label: "Projects",   id: "fx-projects",   initial: "contours", opts: FIELD, effects: Object.assign(fieldEffects(ON_CREAM, PROJECT_FIELD), { dither: dither(ON_CREAM, PROJECT_FIELD) }) },
    { key: "experience", label: "Experience", id: "fx-experience", initial: "contours", opts: FIELD, effects: Object.assign(fieldEffects(ON_CREAM, PROJECT_FIELD), { dither: dither(ON_CREAM, PROJECT_FIELD) }) },
    { key: "education",  label: "Education",  id: "fx-education",  initial: "contours", opts: FIELD, effects: fieldEffects(ON_BLACK, { seed: [13, 3], pulse: 1, scroll: 0.3 }) },
    { key: "contact",    label: "Contact",    id: "fx-contact",    initial: "rays",     opts: FIELD, effects: fieldEffects(ON_NAVY, { seed: [7, 11], freq: 0.9, pulse: 1, scroll: 0.35 }) },
    // only exists in the Killer Synthwave look (the lab shows it under "Synthwave")
    { key: "sun",        label: "Scene",      id: "fx-hero-sun",   initial: "sunset",   theme: "synthwave", opts: { maxPixels: 1.6e6 }, effects: { sunset } }
  ];
  const NAMES = { monogram: "Monogram", contours: "Contours", rays: "Rays", dither: "Dither", sunset: "Sunset" };

  // Everything else the lab can change. The first option is not necessarily the default: `def` is.
  const OPTIONS = [
    { title: "Style", rows: [
      { key: "look", label: "Look", def: "glass", options: [["glass", "Glass"], ["brutalist", "Brutalist"], ["synthwave", "Killer Synthwave"]] },
      { key: "glass", label: "Glass", def: "frosted", options: [["clear", "Clear"], ["frosted", "Frosted"], ["mirror", "Mirror"]] },
      { key: "tilt", label: "Tilt", def: "off", options: [["off", "Off"], ["on", "On"]] },
      { key: "layout", label: "Projects", def: "wheel", options: [["wheel", "Roulette"], ["sphere", "Sphere"]] }
    ] },
    { title: "Performance", rows: [
      { key: "motion", label: "Motion", def: "full", options: [["full", "Full"], ["calm", "Calm"], ["still", "Still"]] },
      { key: "quality", label: "Quality", def: "auto", options: [["low", "Low"], ["auto", "Auto"], ["high", "High"]] },
      { key: "cursor", label: "Cursor", def: "on", options: [["on", "On"], ["off", "Off"]] }
    ] },
    { title: "Synthwave", rows: [
      { key: "sun", label: "Scene", def: "sunset", options: [["sunset", "Sunset"], ["off", "Off"]] },
      { key: "sound", label: "Sound", def: "on", options: [["on", "On"], ["off", "Off"]] },
      { key: "scan", label: "Scanlines", def: "on", options: [["on", "On"], ["off", "Off"]] }
    ] }
  ];

  // choices survive a reload (and carry over to the other pages); anything unknown falls back to the default
  const STORE = "portfolio-fx-v4";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { /* storage unavailable */ }
  const choice = {};
  SLOTS.forEach((sl) => { choice[sl.key] = saved[sl.key] === "off" || sl.effects[saved[sl.key]] ? saved[sl.key] : sl.initial; });
  OPTIONS.forEach((group) => group.rows.forEach((row) => {
    if (row.key in choice) return;                                   // the scene row is a slot, handled above
    choice[row.key] = row.options.some((o) => o[0] === saved[row.key]) ? saved[row.key] : row.def;
  }));

  let freqStage = null;
  let credit = null;

  function ensureFreqStage() {
    if (freqStage) return freqStage;
    const cv = document.createElement("canvas");
    cv.className = "fx-canvas fx-freq";
    cv.setAttribute("aria-hidden", "true");
    cv.hidden = true;
    document.body.appendChild(cv);
    freqStage = new Stage(cv, FreqFX, { maxPixels: 1.6e6 });
    return freqStage;
  }

  // the little "Music: ..." strip, with a mute button
  function updateCredit() {
    if (!isSynth()) return;
    if (!credit) {
      credit = document.createElement("div");
      credit.className = "synthwave-music-credit";
      credit.innerHTML = '<span>Music: Hackers by White Bat Audio</span><button type="button"></button>';
      credit.querySelector("button").addEventListener("click", () => { choice.sound = choice.sound === "on" ? "off" : "on"; apply(); });
      document.body.appendChild(credit);
    }
    const btn = credit.querySelector("button");
    btn.textContent = choice.sound === "on" ? "Sound: on" : "Sound: off";
    btn.setAttribute("aria-label", choice.sound === "on" ? "Mute the music" : "Unmute the music");
  }

  function apply() {
    html.classList.toggle("fx-glass", choice.look === "glass");
    html.classList.toggle("fx-synthwave", choice.look === "synthwave");
    html.classList.toggle("fx-glass-clear", choice.glass === "clear");
    html.classList.toggle("fx-glass-mirror", choice.glass === "mirror");
    html.classList.toggle("fx-tilt", choice.tilt === "on");
    html.classList.toggle("fx-no-scan", choice.scan === "off");
    html.classList.toggle("fx-sphere", choice.layout === "sphere");

    const quality = settings.quality, motion = settings.motion;
    settings.quality = choice.quality;
    settings.motion = choice.motion;
    settings.cursor = choice.cursor;

    SLOTS.forEach((sl) => {
      if (!sl.stage) return;
      const allowed = !sl.theme || (sl.theme === "synthwave" && isSynth());
      if (choice[sl.key] === "off" || !allowed) { sl.stage.setOn(false); return; }
      sl.stage.setEffect(sl.effects[choice[sl.key]]);
      sl.stage.setOn(true);
    });

    if (isSynth()) {
      audio.setMuted(choice.sound === "off");
      audio.start();
      ensureFreqStage().setOn(true);
    } else {
      audio.stop();
      if (freqStage) freqStage.setOn(false);
    }
    updateCredit();

    if (quality !== settings.quality) stages.forEach((s) => s.resize());
    if (motion !== settings.motion) stages.forEach((s) => s.sync());

    document.querySelectorAll(".fx-lab button[data-slot]").forEach((b) => {
      b.setAttribute("aria-pressed", String(choice[b.dataset.slot] === b.dataset.value));
    });
    try { localStorage.setItem(STORE, JSON.stringify(choice)); } catch (e) { /* storage unavailable */ }
  }

  /* ---- The Effects Lab: a hidden lightning bolt in the hero opens it ---- */
  function setupLab() {
    const bolt = document.querySelector(".fx-bolt");
    if (!bolt) return;
    const button = (key, value, label) => `<button type="button" data-slot="${key}" data-value="${value}" aria-pressed="false">${label}</button>`;
    const row = (label, key, opts) => `<div class="fx-lab-row"><span class="fx-lab-label">${label}</span>${opts.map((o) => button(key, o[0], o[1])).join("")}</div>`;
    const effectRows = SLOTS.filter((sl) => sl.stage && !sl.theme).map((sl) =>
      row(sl.label, sl.key, Object.keys(sl.effects).map((k) => [k, NAMES[k]]).concat([["off", "Off"]]))).join("");
    const groups = OPTIONS.map((g) => `<div class="fx-lab-title">${g.title}</div>${g.rows.map((r) => row(r.label, r.key, r.options)).join("")}`).join("");

    const panel = document.createElement("div");
    panel.className = "fx-lab";
    panel.id = "fx-lab";
    panel.hidden = true;
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "Effects lab");
    panel.innerHTML = `<div class="fx-lab-head"><span>Effects lab</span><button type="button" class="fx-lab-close" aria-label="Close effects lab">&times;</button></div>
      <div class="fx-lab-title">Effects</div>${effectRows}${groups}
      <div class="fx-lab-row fx-lab-foot"><button type="button" data-reset="default">Reset</button><button type="button" data-reset="off">Effects off</button></div>`;
    document.body.appendChild(panel);
    bolt.setAttribute("aria-controls", "fx-lab");
    bolt.classList.add("is-ready");

    const setOpen = (open) => {
      panel.hidden = !open;
      bolt.classList.toggle("is-open", open);
      bolt.setAttribute("aria-expanded", String(open));
      if (open) panel.querySelector("button").focus(); else if (panel.contains(document.activeElement)) bolt.focus();
    };
    bolt.addEventListener("click", () => setOpen(panel.hidden));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) setOpen(false); });
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.classList.contains("fx-lab-close")) { setOpen(false); return; }
      if (b.dataset.reset === "off") { SLOTS.forEach((sl) => { choice[sl.key] = "off"; }); apply(); return; }
      if (b.dataset.reset === "default") {
        SLOTS.forEach((sl) => { choice[sl.key] = sl.initial; });
        OPTIONS.forEach((g) => g.rows.forEach((r) => { if (!SLOTS.some((sl) => sl.key === r.key)) choice[r.key] = r.def; }));
        apply();
        return;
      }
      choice[b.dataset.slot] = b.dataset.value;
      apply();
    });
  }

  // Start after load + idle so the effects never compete with first paint.
  const start = () => {
    SLOTS.forEach((sl) => {
      const cv = document.getElementById(sl.id);
      if (cv) sl.stage = new Stage(cv, sl.effects[choice[sl.key]] || sl.effects[sl.initial], sl.opts);
    });
    setupLab();
    apply();
    liteMQ.addEventListener && liteMQ.addEventListener("change", () => stages.forEach((s) => s.resize()));
    reduce.addEventListener && reduce.addEventListener("change", () => stages.forEach((s) => s.sync()));
    document.addEventListener("visibilitychange", () => stages.forEach((s) => s.sync()));
  };
  const whenIdle = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 300));
  if (document.readyState === "complete") whenIdle(); else addEventListener("load", whenIdle, { once: true });
})();
