/* ==========================================================================
   FEATURED PROJECTS ROULETTE
   Turns the project cards into a 3D wheel that rotates by itself.

   - the arrows sit on the side cards; arrow keys and swiping work too
   - pauses while you hover or keyboard-focus it, when it is off screen and
     when the tab is hidden (keyboard and screen reader users also get a pause
     button, which only appears when it is focused)
   - with prefers-reduced-motion it never rotates on its own
   - only the card at the front can be reached by keyboard or screen reader
   ========================================================================== */
(() => {
  "use strict";

  const root = document.querySelector("[data-roulette]");
  if (!root) return;
  const stage = root.querySelector(".roulette-stage");
  const ring = root.querySelector(".roulette-ring");
  const originals = Array.from(ring.children);
  const n = originals.length;
  if (n < 2) return;                       // nothing to rotate between

  const INTERVAL = 5600;                   // ms on each project
  const MIN_SLOTS = 6;                     // a wheel needs enough cards for the neighbours to show
  const PERSPECTIVE = 1900;                // keep in sync with the stage's perspective in styles.css
  const slots = n * Math.ceil(MIN_SLOTS / n);
  const step = 360 / slots;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // Fill the wheel by repeating the real cards in order (A B A B ...).
  const cards = [];
  for (let i = 0; i < slots; i++) {
    const el = i < n ? originals[i] : originals[i % n].cloneNode(true);
    if (i >= n) ring.appendChild(el);
    el.style.setProperty("--i", i);
    cards.push(el);
  }
  const titles = originals.map((el) => (el.querySelector("h4") || el).textContent.replace(/\s+/g, " ").trim());

  const prev = root.querySelector("[data-roulette-prev]");
  const next = root.querySelector("[data-roulette-next]");
  const toggle = root.querySelector("[data-roulette-toggle]");
  const controls = root.querySelector(".roulette-controls");

  let active = 0;                          // keeps counting up, so the wheel always turns the same way
  let timer = 0;
  let userPaused = false, hovering = false, focused = false, visible = false, sphereOn = false;

  const front = () => ((active % slots) + slots) % slots;

  function render() {
    const f = front();
    root.style.setProperty("--turn", (active * step).toFixed(3));
    cards.forEach((el, i) => {
      const d = Math.min((i - f + slots) % slots, (f - i + slots) % slots);
      const on = d === 0;
      el.classList.toggle("is-active", on);
      el.classList.toggle("is-adjacent", d === 1);
      el.toggleAttribute("inert", !on);
      el.setAttribute("aria-hidden", on ? "false" : "true");
      el.setAttribute("role", "group");
      el.setAttribute("aria-roledescription", "slide");
      el.setAttribute("aria-label", `${(i % n) + 1} of ${n}: ${titles[i % n]}`);
    });
  }

  const canRun = () => !sphereOn && !reduce.matches && !userPaused && !hovering && !focused && visible && !document.hidden;

  function schedule() {
    clearTimeout(timer);
    ring.setAttribute("aria-live", canRun() ? "off" : "polite");
    if (canRun()) timer = setTimeout(() => go(1), INTERVAL);
  }

  function go(delta) {
    active += delta;
    render();
    schedule();
  }

  function setToggleLabel() {
    toggle.setAttribute("aria-pressed", String(userPaused));
    toggle.textContent = userPaused ? "Resume rotation" : "Pause rotation";
    toggle.setAttribute("aria-label", userPaused ? "Resume automatic rotation" : "Pause automatic rotation");
  }

  // Measure the cards: the wheel radius from the card width, the card height from the tallest one,
  // and where the neighbouring cards land on screen (that is where the arrows go).
  function measure() {
    if (sphereOn) return;                  // the wheel is hidden, so there is nothing to measure
    root.classList.add("is-measuring");
    const h = Math.max.apply(null, originals.map((el) => el.offsetHeight));
    root.classList.remove("is-measuring");
    const w = originals[0].offsetWidth;
    const r = (w / 2 / Math.tan(Math.PI / slots)) * 1.12;                 // a little gap between cards
    const a = (step * Math.PI) / 180;
    const side = (r * Math.sin(a) * PERSPECTIVE) / (PERSPECTIVE + r * (1 - Math.cos(a)));
    root.style.setProperty("--card-h", `${h}px`);
    root.style.setProperty("--r", `${r}px`);
    root.style.setProperty("--side", `${side}px`);
  }

  // ---- controls
  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  toggle.addEventListener("click", () => { userPaused = !userPaused; setToggleLabel(); schedule(); });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = e.key === "ArrowLeft" ? -1 : 1;
    if (sphereOn) select(((selected + delta) % n + n) % n); else go(delta);
  });
  root.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { hovering = true; schedule(); } });
  root.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { hovering = false; schedule(); } });
  root.addEventListener("focusin", (e) => { focused = e.target.matches(":focus-visible"); schedule(); });
  root.addEventListener("focusout", () => { focused = false; schedule(); });

  let startX = null;                       // swipe
  stage.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; if (e.pointerType !== "mouse" || e.button === 0) startX = e.clientX; });
  stage.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
  });
  stage.addEventListener("pointercancel", () => { startX = null; });

  // ---- keep it from running when nobody can see it
  new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; schedule(); sphereSync(); }, { threshold: 0.25 }).observe(root);
  document.addEventListener("visibilitychange", () => { schedule(); sphereSync(); });
  if (reduce.addEventListener) reduce.addEventListener("change", schedule);

  // ---- sphere layout (Effects lab > Projects): one tile per project, floating on a globe you can drag; a click opens the project full screen
  const html = document.documentElement;
  const TAU = Math.PI * 2;
  const wrap = (a) => a - TAU * Math.round(a / TAU);
  const small = matchMedia("(max-width: 767px)");
  const floating = () => !reduce.matches && !html.classList.contains("fx-no-float");
  const spinning = () => !reduce.matches && !html.classList.contains("fx-no-spin");
  const tileScale = Math.max(0.72, Math.min(1, 1.12 - n * 0.03));      // more projects, smaller tiles
  let sphere = null, field = null, view = null, lines = null;
  let tiles = [];
  let yaw = 0.4, pitch = 0.15, vYaw = 0, vPitch = 0, goal = null, drag = null, selected = -1;
  let fieldW = 0, fieldH = 0, rx = 0, ry = 0, sphereRaf = 0, last = 0, ignoreClickUntil = 0;
  let open = -1, viewOn = false;

  function buildSphere() {
    sphere = document.createElement("div");
    sphere.className = "sphere";
    sphere.hidden = true;
    sphere.innerHTML = '<div class="sphere-field" role="group" aria-label="Project sphere. Drag to turn it, choose a project to open it."></div>' +
      '<p class="sphere-hint" aria-hidden="true">Drag to explore &middot; click a project to open it</p>';
    field = sphere.querySelector(".sphere-field");
    root.insertBefore(sphere, controls);

    // the links between projects, drawn behind the tiles
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, cls) => { const e = document.createElementNS(NS, tag); e.setAttribute("class", cls); return e; };
    lines = { svg: mk("svg", "sphere-lines"), links: [] };
    lines.svg.setAttribute("aria-hidden", "true");
    field.appendChild(lines.svg);

    for (let k = 0; k < n; k++) {
      const src = originals[k];
      const badge = src.querySelector(".justify-between > span");
      const sub = src.querySelector("h4 + p");
      const y = 1 - (2 * (k + 0.5)) / n, r = Math.sqrt(1 - y * y), a = k * 2.399963;      // spread evenly over the globe
      const el = document.createElement("button");
      el.type = "button";
      el.className = "sphere-tile";
      el.dataset.k = k;
      el.setAttribute("aria-label", `${titles[k]}. Open project`);
      [["sphere-tile-tag", badge ? badge.textContent : ""], ["sphere-tile-title", titles[k].split(/\s+[\u2014\u2013-]\s+/)[0]],
        ["sphere-tile-sub", sub ? sub.textContent.split(/\s*\u2022\s*/)[0] : ""]].forEach(([cls, text]) => {
        const s = document.createElement("span");
        s.className = cls;
        s.textContent = text.replace(/\s+/g, " ").trim();
        el.appendChild(s);
      });
      field.appendChild(el);
      tiles.push({ el, x: Math.cos(a) * r, y, z: Math.sin(a) * r, badge, hov: 0, want: 0, ph: k * 2.1, sx: 0, sy: 0, d: 0 });
    }

    // each project is linked to its two nearest neighbours
    const seen = new Set();
    tiles.forEach((a, i) => {
      tiles.map((b, j) => [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2]).filter(([j]) => j !== i)
        .sort((p, q) => p[1] - q[1]).slice(0, 2).forEach(([j]) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (seen.has(key)) return;
          seen.add(key);
          const line = mk("line", "link");
          lines.svg.appendChild(line);
          lines.links.push({ line, a: i, b: j });
        });
    });

    field.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t: e.timeStamp, moved: false };
      vYaw = vPitch = 0; goal = null;
    });
    field.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
        drag.moved = true;
        field.setPointerCapture(e.pointerId);
        field.classList.add("is-dragging");
      }
      const dt = Math.max(1, e.timeStamp - drag.t) / 1000;
      const dx = (e.clientX - drag.lx) * 0.0075, dy = (e.clientY - drag.ly) * 0.0075;
      yaw += dx;
      pitch = Math.max(-1.2, Math.min(1.2, pitch + dy));
      vYaw = Math.max(-4, Math.min(4, dx / dt));
      vPitch = Math.max(-3, Math.min(3, dy / dt));
      drag.lx = e.clientX; drag.ly = e.clientY; drag.t = e.timeStamp;
      drawSphere();
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) { ignoreClickUntil = performance.now() + 120; field.classList.remove("is-dragging"); }
      else { vYaw = vPitch = 0; }
      drag = null;
    };
    field.addEventListener("pointerup", endDrag);
    field.addEventListener("pointercancel", endDrag);
    field.addEventListener("click", (e) => {
      const t = e.target.closest(".sphere-tile");
      if (t && performance.now() > ignoreClickUntil) openProject(+t.dataset.k, t);
    });
    field.addEventListener("pointerover", (e) => {
      const t = e.target.closest(".sphere-tile");
      tiles.forEach((tl) => { tl.want = tl.el === t ? 1 : 0; });
    });
    field.addEventListener("pointerleave", () => tiles.forEach((tl) => { tl.want = 0; }));

    new ResizeObserver(layoutSphere).observe(field);
  }

  function paintTiles() {
    tiles.forEach((t) => {
      if (!t.badge) return;
      const cs = getComputedStyle(t.badge);
      t.el.style.setProperty("--tile-bg", cs.backgroundColor);
      t.el.style.setProperty("--tile-fg", cs.color);
    });
  }

  function layoutSphere() {
    fieldW = field.clientWidth; fieldH = field.clientHeight;
    rx = fieldW < 640 ? fieldW * 0.3 : Math.min(fieldW * 0.38, 40 * 16);   // wider than tall, so the tiles spread across the page
    ry = fieldH * 0.27;
    drawSphere();
  }

  function drawSphere(now) {
    const time = (now === undefined ? performance.now() : now) / 1000;
    const bob = floating();
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const ox = fieldW / 2, oy = fieldH / 2;
    tiles.forEach((t) => {
      const x1 = t.x * cy + t.z * sy, z1 = -t.x * sy + t.z * cy;
      const y2 = t.y * cp - z1 * sp, z2 = t.y * sp + z1 * cp;
      const depth = (z2 + 1) / 2;                          // 0 at the back of the globe, 1 at the front
      const k = 0.8 + 0.4 * depth, s = (0.6 + 0.5 * depth) * tileScale * (1 + 0.08 * t.hov);
      const fx = bob ? Math.sin(time * 0.7 + t.ph) * 9 : 0, fy = bob ? Math.cos(time * 0.55 + t.ph * 1.3) * 11 : 0;   // each tile drifts on its own
      t.sx = ox + x1 * rx * k + fx; t.sy = oy + y2 * ry * k + fy; t.d = depth;
      const st = t.el.style;
      st.transform = `translate3d(${t.sx.toFixed(1)}px, ${t.sy.toFixed(1)}px, 0) translate(-50%, -50%) scale(${s.toFixed(3)})`;
      st.opacity = (0.5 + 0.5 * depth).toFixed(2);
      st.zIndex = Math.round(depth * 100);
    });

    lines.links.forEach(({ line, a, b }) => {
      const A = tiles[a], B = tiles[b];
      line.setAttribute("x1", A.sx.toFixed(1)); line.setAttribute("y1", A.sy.toFixed(1));
      line.setAttribute("x2", B.sx.toFixed(1)); line.setAttribute("y2", B.sy.toFixed(1));
      line.style.opacity = (0.35 + 0.65 * Math.min(A.d, B.d)).toFixed(2);
    });
  }

  // the angles that bring tile k to the front and centre
  function pointAt(k) {
    const t = tiles[k], r = Math.hypot(t.x, t.z);
    const gy = Math.atan2(-t.x, t.z), gp = Math.atan2(t.y, r);
    return { yaw: gy, pitch: gp };
  }

  function stripCard(p) {
    const c = originals[p].cloneNode(true);
    ["inert", "aria-hidden", "role", "aria-roledescription", "aria-label", "style"].forEach((a) => c.removeAttribute(a));
    c.classList.remove("roulette-card", "is-active", "is-adjacent");
    c.classList.add("sphere-card", "is-in");
    return c;
  }

  function select(p) {                      // turn the globe so project p faces you
    selected = p;
    const target = pointAt(p);
    goal = { yaw: yaw + wrap(target.yaw - yaw), pitch: target.pitch };
    vYaw = vPitch = 0;
    tiles.forEach((t, i) => t.el.classList.toggle("is-selected", i === p));
  }

  // ---- the full-screen view of one project
  const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

  function buildView() {
    view = document.createElement("div");
    view.className = "sphere-view";
    view.hidden = true;
    view.setAttribute("role", "dialog");
    view.setAttribute("aria-modal", "true");
    view.innerHTML = '<div class="sphere-view-scroll"><div class="sphere-view-bar"><button type="button" class="sphere-view-btn" data-view-close aria-label="Close project">Close &times;</button></div>' +
      '<div class="sphere-view-body"></div>' +
      '<div class="sphere-view-pager"><button type="button" class="sphere-view-btn" data-view-step="-1">&larr; Previous</button><span class="sphere-view-count" aria-live="polite"></span><button type="button" class="sphere-view-btn" data-view-step="1">Next &rarr;</button></div></div>';
    document.body.appendChild(view);
    view.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-view-close]")) closeProject();
      else if (t.closest("[data-view-step]")) stepProject(+t.closest("[data-view-step]").dataset.viewStep);
      else if (t.matches(".sphere-view-scroll, .sphere-view-bar, .sphere-view-body")) closeProject();      // the empty space around the card
    });
    document.addEventListener("keydown", (e) => {
      if (!viewOn) return;
      if (e.key === "Escape") closeProject();
      else if (e.key === "ArrowLeft") stepProject(-1);
      else if (e.key === "ArrowRight") stepProject(1);
    });
  }

  // the card grows out of its tile (or shrinks back into it)
  function flight(card, from, back) {
    if (!card.animate) return Promise.resolve();
    let frames;
    if (reduce.matches) frames = [{ opacity: 0 }, { opacity: 1 }];
    else if (from && from.isConnected && from.getClientRects().length) {
      const c = card.getBoundingClientRect(), t = from.getBoundingClientRect();
      const s = Math.max(0.15, Math.min(1, t.width / c.width));
      const dx = t.left + t.width / 2 - (c.left + c.width / 2), dy = t.top + t.height / 2 - (c.top + c.height / 2);
      frames = [{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.1 }, { transform: "none", opacity: 1 }];
    } else frames = [{ transform: "translateY(24px) scale(0.97)", opacity: 0 }, { transform: "none", opacity: 1 }];
    if (back) frames.reverse();
    const a = card.animate(frames, { duration: reduce.matches ? 160 : back ? 420 : 600, easing: EASE, fill: back ? "forwards" : "backwards" });
    return a.finished.catch(() => { });
  }

  function fillView(p) {
    const card = stripCard(p);
    view.setAttribute("aria-label", titles[p]);
    view.querySelector(".sphere-view-body").replaceChildren(card);
    view.querySelector(".sphere-view-count").textContent = `${p + 1} / ${n}`;
    view.querySelector(".sphere-view-scroll").scrollTop = 0;
    return card;
  }

  function openProject(p, from) {
    if (!view) buildView();
    if (viewOn) return;
    viewOn = true; open = p;
    const card = fillView(p);
    view.hidden = false;
    const bar = innerWidth - html.clientWidth;
    if (bar > 0) document.body.style.paddingRight = `${bar}px`;
    html.classList.add("sphere-locked");
    Array.from(document.body.children).forEach((el) => { if (el !== view && el.tagName !== "SCRIPT") el.inert = true; });
    view.getBoundingClientRect();                          // so the scrim fades in instead of appearing
    view.classList.add("is-open");
    flight(card, from);
    view.querySelector("[data-view-close]").focus({ preventScroll: true });
  }

  function stepProject(delta) {
    if (!viewOn) return;
    open = ((open + delta) % n + n) % n;
    const card = fillView(open);
    select(open);
    if (!card.animate) return;
    const dx = reduce.matches ? 0 : delta * 48;
    card.animate([{ transform: `translateX(${dx}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 420, easing: EASE, fill: "backwards" });
  }

  function closeProject() {
    if (!viewOn) return;
    viewOn = false;
    view.classList.remove("is-open");
    const from = tiles[open] ? tiles[open].el : null;
    const card = view.querySelector(".sphere-card");
    flight(card, from, true).then(() => {
      view.hidden = true;
      html.classList.remove("sphere-locked");
      document.body.style.paddingRight = "";
      Array.from(document.body.children).forEach((el) => { if (el !== view) el.inert = false; });
      if (from) from.focus({ preventScroll: true });
    });
  }

  function sphereTick(now) {
    sphereRaf = requestAnimationFrame(sphereTick);
    if (small.matches && now - last < 32) return;          // ~30 fps on phones
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    let moving = false;
    if (drag && drag.moved) return;
    if (goal) {
      const k = 1 - Math.exp(-dt * 5);
      yaw += (goal.yaw - yaw) * k;
      pitch += (goal.pitch - pitch) * k;
      if (Math.abs(goal.yaw - yaw) < 0.002 && Math.abs(goal.pitch - pitch) < 0.002) goal = null;
      moving = true;
    } else {
      if (Math.abs(vYaw) > 0.01 || Math.abs(vPitch) > 0.01) {
        yaw += vYaw * dt;
        pitch = Math.max(-1.2, Math.min(1.2, pitch + vPitch * dt));
        const f = Math.exp(-dt * 2.6);
        vYaw *= f; vPitch *= f;
        moving = true;
      }
      if (spinning() && !hovering && !focused && !userPaused && !viewOn) {
        yaw += 0.1 * dt;
        pitch += (0.22 * Math.sin(now / 5000) - pitch) * Math.min(1, dt * 0.6);   // a slow nod, so it never feels like a flat carousel
        moving = true;
      }
    }
    tiles.forEach((t) => {
      const d = t.want - t.hov;
      if (Math.abs(d) > 0.003) { t.hov += d * Math.min(1, dt * 10); moving = true; }
    });
    if (floating()) moving = true;                        // the tiles keep floating
    if (moving) drawSphere(now);
  }

  function sphereSync() {
    const run = sphereOn && visible && !document.hidden;
    if (run && !sphereRaf) { last = performance.now(); sphereRaf = requestAnimationFrame(sphereTick); }
    if (!run && sphereRaf) { cancelAnimationFrame(sphereRaf); sphereRaf = 0; }
  }

  function modeSync() {
    const want = html.classList.contains("fx-sphere");
    if (want && !sphere) buildSphere();
    if (want === sphereOn) { if (sphereOn) paintTiles(); return; }
    sphereOn = want;
    root.classList.toggle("is-sphere", want);
    if (sphere) sphere.hidden = !want;
    if (want) {
      paintTiles();
      layoutSphere();
    } else {
      if (viewOn) closeProject();
      measure();
    }
    sphereSync();
    schedule();
  }

  // ---- go
  root.style.setProperty("--slots", slots);
  root.classList.add("is-ready");
  setToggleLabel();
  render();
  modeSync();
  measure();
  new MutationObserver(modeSync).observe(html, { attributes: true, attributeFilter: ["class"] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  let raf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); }).observe(stage);
})();
