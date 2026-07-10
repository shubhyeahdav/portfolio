/* ============================================================
   SHUBHAM YADAV — cinematic scroll engine (production build)
   Lenis smooth scroll + GSAP ScrollTrigger + canvas video scrub
   ------------------------------------------------------------
   ★ VIDEO SLOTS — drop your real clips here (auto-detected on
     reload, zero code changes):
       SLOT 1  portfolio/public/videos/hero-orbit.mp4
       SLOT 2  portfolio/public/videos/craft.mp4
       SLOT 3  portfolio/public/videos/studio.mp4
       SLOT 4  portfolio/public/videos/walk.mp4
     Served at /videos/*.mp4 in both dev and production.
     Slot URLs live on each .media-slot element (data-src)
     in index.html. Missing file → placeholder renders.
   ------------------------------------------------------------
   Performance architecture:
   - ResizeObserver + IntersectionObserver: zero per-frame
     layout reads (no getBoundingClientRect in the draw loop).
   - Dirty-flag rendering: placeholders repaint only when
     scroll progress actually changes.
   - Static layer pre-render: charcoal bg + vignette + grain +
     labels drawn once per resize, then blitted per frame.
   - Lazy loading: only the hero slot loads immediately;
     below-fold slots detect their video when scrolled near.
   - Mobile: DPR capped at 1 + progress quantized to 36 steps
     (the "reduced frame count" path) + shorter pin distances.
   ============================================================ */

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const qs = new URLSearchParams(location.search);
// `?reduced` mirrors the prefers-reduced-motion experience for easy testing.
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches || qs.has("reduced");
const MOBILE = window.matchMedia("(max-width: 768px)").matches;
const TOUCH = window.matchMedia("(pointer: coarse)").matches;
const SCRUB_STEPS = MOBILE ? 36 : 0; // 0 = continuous (desktop)

if (REDUCED) document.documentElement.classList.add("reduced-motion");

/* ---------------- loader: reveal when fonts/assets settle ---------------- */

const revealSite = () => document.documentElement.classList.add("site-ready");
Promise.race([
  Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((res) => {
      if (document.readyState === "complete") res();
      else window.addEventListener("load", res, { once: true });
    }),
  ]),
  new Promise((res) => setTimeout(res, REDUCED ? 400 : 2200)), // hard cap — never trap the visitor
]).then(() => requestAnimationFrame(revealSite));

/* ---------------- grain texture (generated, no image assets) ---------------- */

function makeNoiseTile(size = 140, alpha = 26) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
const noiseTile = makeNoiseTile();
document.querySelector(".grain").style.backgroundImage = `url(${noiseTile.toDataURL()})`;

/* ---------------- smooth scroll (Lenis) ---------------- */

const lenis = REDUCED ? null : new Lenis({ lerp: 0.09, smoothWheel: true });
if (lenis) {
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
window.__lenis = lenis; // debug/testing handle

document.querySelectorAll("[data-scroll]").forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (!id || !id.startsWith("#")) return;
    e.preventDefault();
    const target = document.querySelector(id);
    if (!target) return;
    lenis ? lenis.scrollTo(target, { offset: 0 }) : target.scrollIntoView();
  });
});

/* ---------------- MediaSlot: video scrub w/ placeholder fallback ---------------- */

const ACCENT = "#4fe0ff";
const PAPER = "rgba(236,234,226,";

class MediaSlot {
  constructor(el, { eager = false } = {}) {
    this.el = el;
    this.src = el.dataset.src;
    this.kind = el.dataset.kind;
    this.name = el.dataset.slotname;
    this.canvas = el.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.video = el.querySelector("video");
    this.staticLayer = document.createElement("canvas"); // pre-rendered bg/grain/labels
    this.mode = "placeholder";
    this.progress = 0;
    this.targetT = 0;
    this.seeking = false;
    this.videoDirty = false;
    this.dirty = true;
    this.visible = false;
    this.detected = false;
    this.cssW = 0;
    this.cssH = 0;
    this.needsResize = false;
    this.dpr = 1;
    if (eager) this.detect(); // hero loads immediately; others lazy-load on approach
  }

  /* Probe for the real video file; silently keep placeholder if absent. */
  async detect() {
    if (this.detected) return;
    this.detected = true;
    try {
      const res = await fetch(this.src, { method: "HEAD" });
      const type = res.headers.get("content-type") || "";
      if (res.ok && type.includes("video")) {
        this.video.preload = "auto";
        this.video.src = this.src;
        this.video.addEventListener("loadeddata", () => { this.mode = "video"; this.videoDirty = true; }, { once: true });
        this.video.addEventListener("seeked", () => { this.seeking = false; this.videoDirty = true; });
        this.video.load();
      }
    } catch (_) { /* placeholder mode */ }
  }

  onResize(w, h) {
    this.cssW = w;
    this.cssH = h;
    this.needsResize = true;
    this.dirty = true;
  }

  applyResize() {
    const dpr = MOBILE ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    this.dpr = dpr;
    const W = Math.max(2, Math.round(this.cssW * dpr));
    const H = Math.max(2, Math.round(this.cssH * dpr));
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    this.buildStaticLayer();
    this.needsResize = false;
  }

  /* Everything that never changes per-frame, painted ONCE per resize. */
  buildStaticLayer() {
    const w = this.canvas.width, h = this.canvas.height;
    this.staticLayer.width = w;
    this.staticLayer.height = h;
    const ctx = this.staticLayer.getContext("2d");
    const cx = w / 2, cy = h / 2, m = Math.min(w, h);

    ctx.fillStyle = "#101218";
    ctx.fillRect(0, 0, w, h);
    const vg = ctx.createRadialGradient(cx, cy, m * 0.2, cx, cy, m * 0.85);
    vg.addColorStop(0, "rgba(8,9,12,0)");
    vg.addColorStop(1, "rgba(4,5,7,0.9)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.06;
    for (let x = 0; x < w; x += noiseTile.width)
      for (let y = 0; y < h; y += noiseTile.height) ctx.drawImage(noiseTile, x, y);
    ctx.globalAlpha = 1;

    // slot label chip + progress track base
    const fs = Math.round(11 * this.dpr);
    ctx.font = `500 ${fs}px "Space Grotesk", monospace`;
    ctx.fillStyle = PAPER + "0.5)";
    ctx.textAlign = "left";
    ctx.fillText(`[ ${this.name} · ${this.src} — DROP FILE TO REPLACE ]`, 24 * this.dpr, h - 28 * this.dpr);
    ctx.fillStyle = "rgba(79,224,255,0.25)";
    ctx.fillRect(24 * this.dpr, h - 18 * this.dpr, 160 * this.dpr, 2);
  }

  setProgress(p) {
    p = Math.min(1, Math.max(0, p));
    if (SCRUB_STEPS) p = Math.round(p * SCRUB_STEPS) / SCRUB_STEPS; // mobile frame-count reduction
    if (p === this.progress && !this.dirty) return;
    this.progress = p;
    this.dirty = true;
    if (this.mode === "video" && this.video.duration) {
      this.targetT = p * (this.video.duration - 0.05);
    }
  }

  draw() {
    if (this.needsResize && this.cssW) this.applyResize();
    if (!this.visible || this.canvas.width <= 2) return;

    if (this.mode === "video" && this.video.readyState >= 2) {
      if (!this.seeking && Math.abs(this.video.currentTime - this.targetT) > 0.033) {
        this.seeking = true;
        this.video.currentTime = this.targetT;
      }
      if (this.videoDirty) {
        this.drawVideoFrame();
        this.videoDirty = false;
      }
      return;
    }

    if (!this.dirty) return; // nothing changed — skip the frame entirely
    const { ctx, canvas } = this;
    ctx.drawImage(this.staticLayer, 0, 0);
    const painters = { orbit: this.pOrbit, push: this.pPush, dolly: this.pDolly, walk: this.pWalk };
    (painters[this.kind] || this.pPush).call(this, ctx, canvas.width, canvas.height, this.progress);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(24 * this.dpr, canvas.height - 18 * this.dpr, 160 * this.dpr * this.progress, 2);
    this.dirty = false;
  }

  drawVideoFrame() {
    const { ctx, canvas, video } = this;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw) return;
    const s = Math.max(canvas.width / vw, canvas.height / vh);
    const dw = vw * s, dh = vh * s;
    ctx.drawImage(video, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    ctx.fillStyle = "rgba(8,9,12,0.18)"; // cinematic tint
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.05;
    ctx.drawImage(noiseTile, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  /* ----- per-kind motion diagrams (dynamic part only) ----- */

  pOrbit(ctx, w, h, p) {
    const cx = w / 2, cy = h / 2, m = Math.min(w, h);
    const a = p * Math.PI * 2;
    ctx.strokeStyle = "rgba(79,224,255,0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + m * 0.06, m * 0.34, m * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
    const mx = cx + Math.cos(a) * m * 0.34;
    const my = cy + m * 0.06 + Math.sin(a) * m * 0.1;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(mx, my, 5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
    const fw = Math.max(0.06, Math.abs(Math.cos(a))) * m * 0.16;
    const fh = m * 0.42;
    ctx.strokeStyle = PAPER + "0.75)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - fw / 2, cy - fh / 2, fw, fh);
    ctx.strokeStyle = "rgba(79,224,255,0.5)";
    ctx.strokeRect(cx - fw / 2 - 8 * this.dpr, cy - fh / 2 - 8 * this.dpr, fw + 16 * this.dpr, fh + 16 * this.dpr);
    ctx.font = `400 ${Math.round(14 * this.dpr)}px "Space Grotesk", monospace`;
    ctx.fillStyle = PAPER + "0.6)";
    ctx.textAlign = "center";
    ctx.fillText(`ORBIT ${Math.round(p * 360)}°`, cx, cy - fh / 2 - 24 * this.dpr);
  }

  pPush(ctx, w, h, p) {
    const cx = w / 2, cy = h / 2, m = Math.min(w, h);
    for (let i = 0; i < 4; i++) {
      const s = (1 + p * 0.35) * (1 - i * 0.16);
      const fw = m * 0.62 * s, fh = m * 0.38 * s;
      ctx.strokeStyle = i === 0 ? PAPER + "0.7)" : `rgba(79,224,255,${0.35 - i * 0.07})`;
      ctx.lineWidth = i === 0 ? 1.5 : 1;
      ctx.strokeRect(cx - fw / 2, cy - fh / 2, fw, fh);
    }
    ctx.font = `400 ${Math.round(13 * this.dpr)}px "Space Grotesk", monospace`;
    ctx.fillStyle = PAPER + "0.55)";
    ctx.textAlign = "center";
    ctx.fillText(`PUSH-IN ${(1 + p * 0.35).toFixed(2)}×`, cx, cy + m * 0.28);
  }

  pDolly(ctx, w, h, p) {
    const cy = h / 2, m = Math.min(w, h);
    const speeds = [0.55, 1, 1.6];
    speeds.forEach((s, i) => {
      const px = w * 0.15 + ((p * s * w * 0.6) % (w * 0.9));
      const fw = m * (0.24 - i * 0.04), fh = m * (0.34 - i * 0.05);
      ctx.strokeStyle = i === 1 ? PAPER + "0.75)" : "rgba(79,224,255,0.4)";
      ctx.lineWidth = i === 1 ? 1.5 : 1;
      ctx.strokeRect(px - fw / 2, cy - fh / 2 + (i - 1) * m * 0.05, fw, fh);
    });
    ctx.strokeStyle = "rgba(236,234,226,0.2)";
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(0, cy + m * 0.26);
    ctx.lineTo(w, cy + m * 0.26);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `400 ${Math.round(13 * this.dpr)}px "Space Grotesk", monospace`;
    ctx.fillStyle = PAPER + "0.55)";
    ctx.textAlign = "center";
    ctx.fillText(`DOLLY ${(p * 100).toFixed(0)}%`, w / 2, cy - m * 0.3);
  }

  pWalk(ctx, w, h, p) {
    const cx = w / 2, cy = h / 2, m = Math.min(w, h);
    ctx.strokeStyle = "rgba(236,234,226,0.18)";
    ctx.lineWidth = 1;
    [[0, 0], [w, 0], [0, h], [w, h]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    });
    for (let i = 0; i < 5; i++) {
      const depth = ((i / 5 + p * 0.6) % 1);
      const s = 0.15 + depth * 0.85;
      const fw = m * 0.1 * s, fh = m * 0.16 * s;
      const off = m * 0.42 * s;
      ctx.strokeStyle = `rgba(79,224,255,${0.15 + depth * 0.4})`;
      ctx.strokeRect(cx - off - fw, cy - fh / 2, fw, fh);
      ctx.strokeRect(cx + off, cy - fh / 2, fw, fh);
    }
    const fh = m * (0.12 + p * 0.5);
    const fw2 = fh * 0.36;
    ctx.strokeStyle = PAPER + "0.8)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - fw2 / 2, cy - fh / 2, fw2, fh);
    ctx.font = `400 ${Math.round(13 * this.dpr)}px "Space Grotesk", monospace`;
    ctx.fillStyle = PAPER + "0.55)";
    ctx.textAlign = "center";
    ctx.fillText(`WALK-IN ${(p * 100).toFixed(0)}%`, cx, cy - m * 0.34);
  }
}

/* ---------------- slot wiring: observers replace per-frame DOM reads ---------------- */

const slots = {};
const slotByEl = new Map();
document.querySelectorAll(".media-slot").forEach((el) => {
  const slot = new MediaSlot(el, { eager: el.dataset.kind === "orbit" }); // hero = eager
  slots[el.dataset.kind] = slot;
  slotByEl.set(el, slot);
});
window.__slots = slots; // debug/testing handle

const ro = new ResizeObserver((entries) => {
  for (const e of entries) {
    const s = slotByEl.get(e.target);
    if (s) s.onResize(e.contentRect.width, e.contentRect.height);
  }
});
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const s = slotByEl.get(e.target);
    if (!s) continue;
    s.visible = e.isIntersecting;
    if (e.isIntersecting) {
      s.detect(); // lazy-load the video only when its section approaches
      s.dirty = true;
    }
  }
}, { rootMargin: "120% 0px" });

slotByEl.forEach((_, el) => { ro.observe(el); io.observe(el); });

gsap.ticker.add(() => Object.values(slots).forEach((s) => s.draw()));
if (document.fonts) {
  document.fonts.ready.then(() => {
    Object.values(slots).forEach((s) => { if (s.cssW) { s.buildStaticLayer(); s.dirty = true; } });
    ScrollTrigger.refresh();
  });
}

/* ---------------- progress hairline ---------------- */

const hair = document.querySelector(".progress-hair");
ScrollTrigger.create({
  start: 0,
  end: "max",
  onUpdate: (st) => { hair.style.transform = `scaleX(${st.progress})`; },
});

/* ---------------- HERO: pinned orbit scrub + letter-by-letter name ---------------- */

const degEl = document.getElementById("deg");

if (!REDUCED) {
  const heroTl = gsap.timeline({
    scrollTrigger: {
      trigger: "#hero",
      start: "top top",
      end: MOBILE ? "+=220%" : "+=320%",
      pin: true,
      scrub: 0.6,
      onUpdate: (st) => {
        slots.orbit.setProgress(st.progress);
        degEl.textContent = Math.round(st.progress * 360);
      },
    },
  });

  heroTl
    .fromTo(".hero__name .ltr",
      { yPercent: 130, rotate: 5 },
      { yPercent: 0, rotate: 0, stagger: 0.055, ease: "power3.out", duration: 1.1 }, 0)
    .fromTo(".hero__sub",
      { autoAlpha: 0, y: 28 },
      { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.75)
    .fromTo(".hero__meta",
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.4 }, 0.9)
    .to(".hero__name .line", { letterSpacing: "0.06em", duration: 1.6, ease: "none" }, 1.4)
    .to(".hero__sub", { autoAlpha: 0.35, duration: 0.8 }, 2.0)
    .to(".hero__content", { yPercent: -6, duration: 1.0, ease: "none" }, 2.2);
} else {
  // Static, still-composed hero for reduced motion.
  slots.orbit.setProgress(0.35);
  degEl.textContent = "126";
}

/* ---------------- PILLARS: pinned, one at a time ---------------- */

if (!REDUCED) {
  const pillars = gsap.utils.toArray(".pillar");
  const pillarsTl = gsap.timeline({
    scrollTrigger: {
      trigger: "#pillars",
      start: "top top",
      end: MOBILE ? "+=240%" : "+=300%",
      pin: true,
      scrub: 0.6,
      onUpdate: (st) => slots.push.setProgress(st.progress),
    },
  });

  pillars.forEach((el, i) => {
    const t = i * 1.0;
    pillarsTl
      .fromTo(el,
        { autoAlpha: 0, y: 90 },
        { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, t)
      .fromTo(el.querySelector(".pillar__ghost"),
        { xPercent: 14 },
        { xPercent: -6, duration: 1.0, ease: "none" }, t);
    if (i < pillars.length - 1) {
      pillarsTl.to(el, { autoAlpha: 0, y: -70, duration: 0.3, ease: "power2.in" }, t + 0.7);
    }
  });
} else {
  slots.push.setProgress(0.5);
}

/* ---------------- STATS: count up on entry (instant when reduced) ---------------- */

gsap.utils.toArray(".stat__num span").forEach((el) => {
  const target = +el.dataset.target;
  if (REDUCED) { el.textContent = target; return; }
  ScrollTrigger.create({
    trigger: el,
    start: "top 85%",
    once: true,
    onEnter: () =>
      gsap.fromTo(el,
        { textContent: 0 },
        { textContent: target, duration: 1.6, ease: "power2.out", snap: { textContent: 1 } }),
  });
});

/* ---------------- WORK: pinned dolly + staggered rows + hover preview ---------------- */

if (!REDUCED) {
  const workTl = gsap.timeline({
    scrollTrigger: {
      trigger: "#work",
      start: "top top",
      end: MOBILE ? "+=180%" : "+=220%",
      pin: true,
      scrub: 0.6,
      onUpdate: (st) => slots.dolly.setProgress(st.progress),
    },
  });
  workTl.fromTo(".work-row",
    { autoAlpha: 0, y: 60 },
    { autoAlpha: 1, y: 0, stagger: 0.14, duration: 0.4, ease: "power2.out" }, 0.05);
} else {
  slots.dolly.setProgress(0.5);
}

// cursor-following preview card — pointer devices only
const preview = document.getElementById("work-preview");
if (!TOUCH && preview) {
  const pvX = gsap.quickTo(preview, "x", { duration: 0.4, ease: "power3.out" });
  const pvY = gsap.quickTo(preview, "y", { duration: 0.4, ease: "power3.out" });
  document.querySelectorAll(".work-row").forEach((row) => {
    row.addEventListener("mouseenter", () => {
      preview.querySelector(".work-preview__initials").textContent = row.dataset.initials;
      preview.dataset.grad = row.dataset.grad;
      gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "power2.out" });
    });
    row.addEventListener("mouseleave", () =>
      gsap.to(preview, { autoAlpha: 0, scale: 0.9, duration: 0.25 }));
    row.addEventListener("mousemove", (e) => { pvX(e.clientX); pvY(e.clientY); });
  });
}

/* ---------------- FINALE: pinned walk-in + rising words ---------------- */

if (!REDUCED) {
  const finaleTl = gsap.timeline({
    scrollTrigger: {
      trigger: "#contact",
      start: "top top",
      end: MOBILE ? "+=150%" : "+=180%",
      pin: true,
      scrub: 0.6,
      onUpdate: (st) => slots.walk.setProgress(st.progress),
    },
  });
  finaleTl
    .fromTo(".finale__title .fw",
      { yPercent: 110, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, stagger: 0.08, duration: 0.5, ease: "power3.out" }, 0.1)
    .fromTo(".finale__ctas",
      { autoAlpha: 0, y: 40 },
      { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0.75);
} else {
  slots.walk.setProgress(0.8);
}

/* ---------------- refresh after full load ---------------- */

window.addEventListener("load", () => ScrollTrigger.refresh());
