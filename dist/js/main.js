/* ============================================================
   SHUBHAM YADAV — cinematic scroll engine
   Lenis smooth scroll + GSAP ScrollTrigger + canvas video scrub
   ------------------------------------------------------------
   VIDEO SLOTS (drop real files, everything auto-detects):
     SLOT 1  /videos/hero-orbit.mp4  — hero, 360° orbit scrub
     SLOT 2  /videos/craft.mp4       — pillars backdrop, push-in
     SLOT 3  /videos/studio.mp4      — work backdrop, dolly
     SLOT 4  /videos/walk.mp4        — finale backdrop, walk-in
   Slot sources live on each .media-slot element (data-src) in
   index.html. Missing file → procedural placeholder renders.
   ============================================================ */

gsap.registerPlugin(ScrollTrigger);

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (REDUCED) document.documentElement.classList.add("reduced-motion");

/* ---------------- grain texture (generated, no assets) ---------------- */

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
window.__lenis = lenis; // exposed for testing

// anchor links scroll smoothly
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

const marqueeTracks = gsap.utils.toArray(".marquee__track");
let lastScroll = window.pageYOffset || 0;

function updateMarqueeDirection(scroll) {
  const delta = scroll - lastScroll;
  if (delta !== 0) {
    marqueeTracks.forEach((track) => {
      const baseDirection = track.closest(".marquee--alt") ? "reverse" : "normal";
      track.style.animationDirection = delta > 0
        ? baseDirection
        : baseDirection === "normal"
          ? "reverse"
          : "normal";
    });
  }
  lastScroll = scroll;
}

if (lenis) {
  lenis.on("scroll", ({ scroll }) => updateMarqueeDirection(scroll));
} else {
  window.addEventListener("scroll", () => updateMarqueeDirection(window.pageYOffset));
}
updateMarqueeDirection(lastScroll);

/* ---------------- MediaSlot: video scrub with placeholder fallback ----------------
   Scroll progress (0..1) maps to video.currentTime, frames drawn to canvas —
   the "frame sequence" technique. If data-src 404s, a procedural painter
   (per data-kind) renders instead so all scrub logic stays testable. */

const ACCENT = "#4fe0ff";
const PAPER = "rgba(236,234,226,";

class MediaSlot {
  constructor(el) {
    this.el = el;
    this.src = el.dataset.src;
    this.kind = el.dataset.kind;
    this.name = el.dataset.slotname;
    this.canvas = el.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.video = el.querySelector("video");
    this.mode = "placeholder";
    this.progress = 0;
    this.targetT = 0;
    this.seeking = false;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.detect();
  }

  async detect() {
    try {
      const res = await fetch(this.src, { method: "HEAD" });
      const type = res.headers.get("content-type") || "";
      if (res.ok && type.includes("video")) {
        this.video.src = this.src;
        this.video.addEventListener("loadeddata", () => (this.mode = "video"), { once: true });
        this.video.addEventListener("seeked", () => (this.seeking = false));
        this.video.load();
      }
    } catch (_) { /* stay in placeholder mode */ }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return; // layout not ready yet — draw() retries every frame
    this.dpr = dpr;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
  }

  setProgress(p) {
    this.progress = Math.min(1, Math.max(0, p));
    if (this.mode === "video" && this.video.duration) {
      this.targetT = this.progress * (this.video.duration - 0.05);
    }
  }

  inView() {
    const r = this.el.getBoundingClientRect();
    return r.bottom > -80 && r.top < innerHeight + 80;
  }

  draw() {
    this.resize(); // self-heal: canvas tracks element size every frame (no-op when unchanged)
    if (this.canvas.width <= 1 || !this.inView()) return;
    if (this.mode === "video" && this.video.readyState >= 2) {
      if (!this.seeking && Math.abs(this.video.currentTime - this.targetT) > 0.033) {
        this.seeking = true;
        this.video.currentTime = this.targetT;
      }
      this.drawVideoFrame();
    } else {
      this.drawPlaceholder();
    }
  }

  drawVideoFrame() {
    const { ctx, canvas, video } = this;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw) return;
    const s = Math.max(canvas.width / vw, canvas.height / vh);
    const dw = vw * s, dh = vh * s;
    ctx.drawImage(video, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    // cinematic tint + grain pass
    ctx.fillStyle = "rgba(8,9,12,0.18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.05;
    ctx.drawImage(noiseTile, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  /* ----- placeholder painters (charcoal + grain + motion diagram) ----- */

  drawPlaceholder() {
    const { ctx, canvas } = this;
    const w = canvas.width, h = canvas.height, p = this.progress;
    const cx = w / 2, cy = h / 2, m = Math.min(w, h);

    // charcoal base + vignette
    ctx.fillStyle = "#101218";
    ctx.fillRect(0, 0, w, h);
    const vg = ctx.createRadialGradient(cx, cy, m * 0.2, cx, cy, m * 0.85);
    vg.addColorStop(0, "rgba(8,9,12,0)");
    vg.addColorStop(1, "rgba(4,5,7,0.9)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    // static grain
    ctx.globalAlpha = 0.06;
    for (let x = 0; x < w; x += noiseTile.width)
      for (let y = 0; y < h; y += noiseTile.height) ctx.drawImage(noiseTile, x, y);
    ctx.globalAlpha = 1;

    const painters = { orbit: this.pOrbit, push: this.pPush, dolly: this.pDolly, walk: this.pWalk };
    (painters[this.kind] || this.pPush).call(this, ctx, w, h, p);

    // slot label chip + progress bar
    const fs = Math.round(11 * this.dpr);
    ctx.font = `500 ${fs}px "Space Grotesk", monospace`;
    ctx.fillStyle = PAPER + "0.5)";
    ctx.textAlign = "left";
    ctx.fillText(`[ ${this.name} · ${this.src} — DROP FILE TO REPLACE ]`, 24 * this.dpr, h - 28 * this.dpr);
    ctx.fillStyle = "rgba(79,224,255,0.25)";
    ctx.fillRect(24 * this.dpr, h - 18 * this.dpr, 160 * this.dpr, 2);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(24 * this.dpr, h - 18 * this.dpr, 160 * this.dpr * p, 2);
  }

  pOrbit(ctx, w, h, p) {
    const cx = w / 2, cy = h / 2, m = Math.min(w, h);
    const a = p * Math.PI * 2;
    // orbit ring
    ctx.strokeStyle = "rgba(79,224,255,0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + m * 0.06, m * 0.34, m * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
    // camera marker on ring
    const mx = cx + Math.cos(a) * m * 0.34;
    const my = cy + m * 0.06 + Math.sin(a) * m * 0.1;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(mx, my, 5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
    // rotating "figure" card (pseudo-3D: width follows cos)
    const fw = Math.max(0.06, Math.abs(Math.cos(a))) * m * 0.16;
    const fh = m * 0.42;
    ctx.strokeStyle = PAPER + "0.75)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - fw / 2, cy - fh / 2, fw, fh);
    ctx.strokeStyle = "rgba(79,224,255,0.5)";
    ctx.strokeRect(cx - fw / 2 - 8 * this.dpr, cy - fh / 2 - 8 * this.dpr, fw + 16 * this.dpr, fh + 16 * this.dpr);
    // degree readout
    ctx.font = `400 ${Math.round(14 * this.dpr)}px "Space Grotesk", monospace`;
    ctx.fillStyle = PAPER + "0.6)";
    ctx.textAlign = "center";
    ctx.fillText(`ORBIT ${Math.round(p * 360)}°`, cx, cy - fh / 2 - 24 * this.dpr);
  }

  pPush(ctx, w, h, p) {
    const cx = w / 2, cy = h / 2, m = Math.min(w, h);
    // concentric frames pushing in (scale grows with progress)
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
    // three panels tracking sideways at parallax speeds
    const speeds = [0.55, 1, 1.6];
    speeds.forEach((s, i) => {
      const px = w * 0.15 + ((p * s * w * 0.6) % (w * 0.9));
      const fw = m * (0.24 - i * 0.04), fh = m * (0.34 - i * 0.05);
      ctx.strokeStyle = i === 1 ? PAPER + "0.75)" : "rgba(79,224,255,0.4)";
      ctx.lineWidth = i === 1 ? 1.5 : 1;
      ctx.strokeRect(px - fw / 2, cy - fh / 2 + (i - 1) * m * 0.05, fw, fh);
    });
    // dolly track line
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
    // corridor perspective lines
    ctx.strokeStyle = "rgba(236,234,226,0.18)";
    ctx.lineWidth = 1;
    [[0, 0], [w, 0], [0, h], [w, h]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    });
    // gallery screens receding on both sides
    for (let i = 0; i < 5; i++) {
      const depth = ((i / 5 + p * 0.6) % 1);
      const s = 0.15 + depth * 0.85;
      const fw = m * 0.1 * s, fh = m * 0.16 * s;
      const off = m * 0.42 * s;
      ctx.strokeStyle = `rgba(79,224,255,${0.15 + depth * 0.4})`;
      ctx.strokeRect(cx - off - fw, cy - fh / 2, fw, fh);
      ctx.strokeRect(cx + off, cy - fh / 2, fw, fh);
    }
    // approaching figure (grows with progress)
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

const slots = {};
document.querySelectorAll(".media-slot").forEach((el) => {
  const key = el.dataset.kind;
  slots[key] = new MediaSlot(el);
});
window.__slots = slots; // exposed for testing

// global draw loop
gsap.ticker.add(() => Object.values(slots).forEach((s) => s.draw()));
document.fonts?.ready.then(() => Object.values(slots).forEach((s) => s.draw()));

/* ---------------- progress hairline ---------------- */

ScrollTrigger.create({
  start: 0,
  end: "max",
  onUpdate: (st) => {
    document.querySelector(".progress-hair").style.transform = `scaleX(${st.progress})`;
  },
});

/* ---------------- HERO: pinned orbit scrub + letter-by-letter name ---------------- */

const degEl = document.getElementById("deg");

if (!REDUCED) {
  // Held hidden behind the preloader curtain, then revealed once — so the
  // name greets visitors immediately (personal brand), not only on scroll.
  gsap.set(".hero__name .ltr", { yPercent: 118, rotate: 5, autoAlpha: 0 });
  gsap.set(".hero__sub", { autoAlpha: 0, y: 26 });
  gsap.set(".hero__meta", { autoAlpha: 0 });

  window.__playHeroIntro = () => {
    gsap.timeline()
      .to(".hero__name .ltr",
        { yPercent: 0, rotate: 0, autoAlpha: 1, stagger: 0.05, duration: 0.95, ease: "power3.out" })
      .to(".hero__sub", { autoAlpha: 1, y: 0, duration: 0.55, ease: "power2.out" }, "-=0.45")
      .to(".hero__meta", { autoAlpha: 1, duration: 0.4 }, "-=0.35");
  };

  // scroll only drives the orbit + subtle kinetic breathing (name stays visible)
  const heroTl = gsap.timeline({
    scrollTrigger: {
      trigger: "#hero",
      start: "top top",
      end: "+=320%",
      pin: true,
      scrub: 0.6,
      onUpdate: (st) => {
        slots.orbit.setProgress(st.progress);
        degEl.textContent = Math.round(st.progress * 360);
      },
    },
  });

  heroTl
    .to(".hero__name .line", { letterSpacing: "0.06em", duration: 1.6, ease: "none" }, 0.2)
    .to(".hero__content", { yPercent: -6, duration: 1.0, ease: "none" }, 1.4);
} else {
  gsap.set(".hero__name .ltr, .hero__sub, .hero__meta", { clearProps: "all", opacity: 1 });
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
      end: "+=300%",
      pin: true,
      scrub: 0.6,
      onUpdate: (st) => slots.push.setProgress(st.progress),
    },
  });

  pillars.forEach((el, i) => {
    const t = i * 1.0; // each pillar owns 1 "unit" of the timeline
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
}

/* ---------------- STATS: count up on entry ---------------- */

gsap.utils.toArray(".stat__num span").forEach((el) => {
  const target = +el.dataset.target;
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
      end: "+=220%",
      pin: true,
      scrub: 0.6,
      onUpdate: (st) => slots.dolly.setProgress(st.progress),
    },
  });
  workTl.fromTo(".work-row",
    { autoAlpha: 0, y: 60 },
    { autoAlpha: 1, y: 0, stagger: 0.14, duration: 0.4, ease: "power2.out" }, 0.05);
}

// cursor-following preview card
const preview = document.getElementById("work-preview");
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

/* ---------------- FINALE: pinned walk-in + rising words ---------------- */

if (!REDUCED) {
  const finaleTl = gsap.timeline({
    scrollTrigger: {
      trigger: "#contact",
      start: "top top",
      end: "+=180%",
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

/* ---------------- ABOUT: portrait fallback + line/element reveals ---------------- */

// If the portrait image is missing/errors, drop to the monogram card.
const aboutImg = document.querySelector(".about__img");
if (aboutImg) {
  const failPortrait = () => aboutImg.setAttribute("data-missing", "");
  aboutImg.addEventListener("error", failPortrait);
  if (aboutImg.complete && aboutImg.naturalWidth === 0) failPortrait();
}

if (!REDUCED) {
  gsap.utils.toArray(".about .reveal, .about .reveal-lines").forEach((el) => {
    gsap.from(el, {
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
      autoAlpha: 0, y: 40, duration: 0.7, ease: "power3.out",
    });
  });
}

/* ---------------- PRELOADER: count 0→100, wipe up, hand off to hero ---------------- */

(function preloader() {
  const pl = document.getElementById("preloader");
  if (!pl) return;
  const countEl = document.getElementById("pl-count");
  const counter = { v: 0 };

  // hold scroll until the intro finishes
  lenis?.stop();
  document.documentElement.classList.remove("loaded");

  const finish = () => {
    document.documentElement.classList.add("loaded");
    lenis?.start();
    ScrollTrigger.refresh();
    window.__playHeroIntro?.();
  };

  if (REDUCED) {
    gsap.set(pl, { autoAlpha: 0, display: "none" });
    if (countEl) countEl.textContent = "100";
    finish();
    return;
  }

  const tl = gsap.timeline({ onComplete: finish });
  tl.to(counter, {
      v: 100, duration: 1.6, ease: "power2.inOut",
      onUpdate: () => { if (countEl) countEl.textContent = Math.round(counter.v); },
    })
    .to(".preloader__tag", { autoAlpha: 1, duration: 0.4 }, 0.2)
    .to(".preloader__count", { autoAlpha: 0, duration: 0.3 }, "-=0.1")
    .to(".preloader__name .pw", { yPercent: -110, stagger: 0.06, duration: 0.5, ease: "power3.in" }, "-=0.15")
    .to(".preloader__wipe", { yPercent: 0, duration: 0.6, ease: "power4.inOut" }, "-=0.35")
    .set(pl, { display: "none" })
    // kick the hero name reveal in fresh once the curtain lifts
    .add(() => ScrollTrigger.refresh());
})();

/* ---------------- CUSTOM CURSOR: dot + lagging ring, magnetic buttons ---------------- */

(function customCursor() {
  const fine = window.matchMedia("(pointer: fine)").matches;
  if (REDUCED || !fine) return;

  const cursor = document.getElementById("cursor");
  if (!cursor) return;
  document.documentElement.classList.add("has-cursor");

  const ring = cursor.querySelector(".cursor__ring");
  const dot = cursor.querySelector(".cursor__dot");
  const setDotX = gsap.quickSetter(dot, "x", "px");
  const setDotY = gsap.quickSetter(dot, "y", "px");
  const ringX = gsap.quickTo(ring, "x", { duration: 0.32, ease: "power3.out" });
  const ringY = gsap.quickTo(ring, "y", { duration: 0.32, ease: "power3.out" });

  window.addEventListener("mousemove", (e) => {
    setDotX(e.clientX); setDotY(e.clientY);
    ringX(e.clientX); ringY(e.clientY);
  }, { passive: true });

  const hoverSel = "a, .btn, .work-row, [data-cursor]";
  document.querySelectorAll(hoverSel).forEach((el) => {
    el.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
    el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
  });

  // magnetic pull on primary interactive chrome
  document.querySelectorAll(".btn, .nav__links a, .nav__brand").forEach((el) => {
    const strength = 0.35;
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * strength,
        y: (e.clientY - (r.top + r.height / 2)) * strength,
        duration: 0.4, ease: "power3.out",
      });
    });
    el.addEventListener("mouseleave", () =>
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" }));
  });
})();

/* ---------------- refresh after layout settles ---------------- */

window.addEventListener("load", () => ScrollTrigger.refresh());
