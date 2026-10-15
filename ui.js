/* ==========================================================================
   NAVBAR + GLASS LOOK

   - the navbar blends from its full size to a slim one as you scroll (styles.css
     does the blending; this only reports how far down you are, as --p)
   - exactly one nav link is "active": the section you are reading
   - the glass look (switched in the effects lab) gets a sheen that follows the
     cursor and a reveal as cards scroll into view
   ========================================================================== */
(() => {
  "use strict";

  const root = document.documentElement;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // The glass look is remembered; apply it straight away so the page never flashes the other style.
  try {
    if (JSON.parse(localStorage.getItem("portfolio-fx-v3") || "{}").look === "glass") root.classList.add("fx-glass");
  } catch (e) { /* storage unavailable */ }

  /* ---- Navbar ----------------------------------------------------------- */
  const nav = document.querySelector(".site-nav");
  const links = Array.from(document.querySelectorAll(".nav-link, .mobile-nav-link"));
  const targets = [];
  links.forEach((a) => {
    const el = document.querySelector(a.getAttribute("href"));
    if (el && !targets.includes(el)) targets.push(el);
  });

  const SHRINK_OVER = 140;                 // px of scrolling over which the bar slims down
  let current = null;                      // id of the active section
  let lockedUntilIdle = false;             // after a click, the clicked link stays active while the page glides there
  let idleTimer = 0;
  let queued = false;

  function setActive(id) {
    if (id === current) return;
    current = id;
    links.forEach((a) => {
      const on = id !== null && a.getAttribute("href") === `#${id}`;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  function sectionInView() {
    const line = innerHeight * 0.32;       // the section whose top has passed this line is the one being read
    let found = null;
    targets.forEach((el) => { if (el.getBoundingClientRect().top <= line) found = el.id; });
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) found = targets[targets.length - 1].id;
    return found;
  }

  function update() {
    queued = false;
    if (nav) {
      const t = clamp(scrollY / SHRINK_OVER, 0, 1);
      nav.style.setProperty("--p", (t * t * (3 - 2 * t)).toFixed(4));   // eased, so it starts and ends softly
    }
    if (!lockedUntilIdle) setActive(sectionInView());
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  addEventListener("scroll", () => {
    schedule();
    if (lockedUntilIdle) {                 // unlock once the page stops moving
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { lockedUntilIdle = false; schedule(); }, 160);
    }
  }, { passive: true });
  addEventListener("resize", schedule);
  addEventListener("hashchange", schedule);
  links.forEach((a) => a.addEventListener("click", () => {
    const id = a.getAttribute("href").slice(1);
    if (!id) return;
    setActive(id);                         // light up the clicked link right away
    lockedUntilIdle = true;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { lockedUntilIdle = false; schedule(); }, 900);
  }));
  update();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
  addEventListener("load", update);

  /* ---- Glass look: sheen that follows the cursor, reveal on scroll ------- */
  const cards = Array.from(document.querySelectorAll(".glass-card"));

  addEventListener("pointermove", (e) => {
    if (!root.classList.contains("fx-glass") || e.pointerType === "touch") return;
    const el = e.target.closest && e.target.closest(".glass-card");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, { passive: true });

  // Cards are marked as seen in both looks, so switching to glass never hides a card you are looking at.
  if ("IntersectionObserver" in window) {
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); seen.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    cards.forEach((el) => seen.observe(el));
  } else {
    cards.forEach((el) => el.classList.add("is-in"));
  }
})();
