/* ==========================================================================
   FEATURED PROJECTS ROULETTE
   Turns the project cards into a 3D wheel that rotates by itself.

   - pauses while you hover or keyboard-focus it, when it is off screen and
     when the tab is hidden; there is also a pause button
   - arrows, numbered tabs, left/right keys and swiping all work
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

  const INTERVAL = 5600;                   // ms on each project (keep in sync with --roulette-interval)
  const MIN_SLOTS = 6;                     // a wheel needs enough cards for the neighbours to show
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
  const dotsBox = root.querySelector(".roulette-dots");
  const pointer = root.querySelector(".roulette-pointer");

  const dots = titles.map((title, j) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "roulette-dot";
    b.textContent = String(j + 1).padStart(2, "0");
    b.setAttribute("aria-label", `Show project ${j + 1}: ${title}`);
    b.addEventListener("click", () => goTo(j));
    dotsBox.appendChild(b);
    return b;
  });

  let active = 0;                          // keeps counting up, so the wheel always turns the same way
  let timer = 0;
  let userPaused = false, hovering = false, focused = false, visible = false;

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
    dots.forEach((b, j) => b.setAttribute("aria-current", String(j === f % n)));
  }

  function tick() {
    if (!pointer || reduce.matches) return;
    pointer.classList.remove("is-tick");
    void pointer.offsetWidth;              // restart the animation
    pointer.classList.add("is-tick");
  }

  const canRun = () => !reduce.matches && !userPaused && !hovering && !focused && visible && !document.hidden;

  function schedule() {
    clearTimeout(timer);
    root.classList.remove("is-playing");
    ring.setAttribute("aria-live", canRun() ? "off" : "polite");
    if (!canRun()) return;
    void root.offsetWidth;                 // restart the timer bar
    root.classList.add("is-playing");
    timer = setTimeout(() => go(1), INTERVAL);
  }

  function go(delta) {
    active += delta;
    render();
    tick();
    schedule();
  }

  function goTo(j) {
    let d = (j - (front() % n) + n) % n;
    if (d > n / 2) d -= n;
    if (d) go(d);
  }

  function setToggleLabel() {
    toggle.setAttribute("aria-pressed", String(userPaused));
    toggle.setAttribute("aria-label", userPaused ? "Resume automatic rotation" : "Pause automatic rotation");
    toggle.innerHTML = userPaused
      ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5v13L14 8z"/></svg>'
      : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5h3.5v13H3zM9.5 1.5H13v13H9.5z"/></svg>';
  }

  // Measure the cards: the wheel radius from the card width, the card height from the tallest one.
  function measure() {
    root.classList.add("is-measuring");
    const h = Math.max.apply(null, originals.map((el) => el.offsetHeight));
    root.classList.remove("is-measuring");
    const w = originals[0].offsetWidth;
    root.style.setProperty("--card-h", `${h}px`);
    root.style.setProperty("--r", `${(w / 2 / Math.tan(Math.PI / slots)) * 1.12}px`);   // a little gap between cards
  }

  // ---- controls
  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  toggle.addEventListener("click", () => { userPaused = !userPaused; setToggleLabel(); schedule(); });
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
  });
  root.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { hovering = true; schedule(); } });
  root.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { hovering = false; schedule(); } });
  root.addEventListener("focusin", (e) => { focused = e.target.matches(":focus-visible"); schedule(); });
  root.addEventListener("focusout", () => { focused = false; schedule(); });

  let startX = null;                       // swipe
  stage.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || e.button === 0) startX = e.clientX; });
  stage.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
  });
  stage.addEventListener("pointercancel", () => { startX = null; });

  // ---- keep it from running when nobody can see it
  new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; schedule(); }, { threshold: 0.25 }).observe(root);
  document.addEventListener("visibilitychange", schedule);
  if (reduce.addEventListener) reduce.addEventListener("change", schedule);

  // ---- go
  root.style.setProperty("--slots", slots);
  root.classList.add("is-ready");
  setToggleLabel();
  render();
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  let raf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); }).observe(stage);
})();
