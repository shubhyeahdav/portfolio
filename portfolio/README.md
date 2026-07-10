# Shubham Yadav — Cinematic Scroll Portfolio

Award-style scroll-driven portfolio. Charcoal/ink + electric cyan, GSAP ScrollTrigger
scrub pinning, Lenis smooth scroll, canvas frame-sequence video scrubbing.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5175
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

## ★ Drop in your 4 real video clips

Put them in **`public/videos/`** with exactly these names — auto-detected, no code changes:

```
hero-orbit.mp4   craft.mp4   studio.mp4   walk.mp4
```

Specs: 1080p, 16:9, ~8s, H.264, ideally < 20 MB each. See `public/videos/README.md`.
Only the hero clip loads on page-load; the rest lazy-load as you scroll.

## Deploy to Vercel (zero config)

1. Push this `portfolio/` folder to a Git repo (or keep the monorepo and set
   **Root Directory = `portfolio`** in Vercel project settings).
2. Import in Vercel — it auto-detects **Vite** (build `vite build`, output `dist`).
3. Done. `public/` files (videos, favicons, 404.html, robots.txt, sitemap.xml)
   are copied through as-is; `/videos/*.mp4` URLs work identically in dev and prod.

No `vercel.json` is needed — zero-config detection handles everything,
and `404.html` in the output is served automatically for unknown routes.

## ★ Swap points (search for "SWAP" in the code)

| Where | What |
|---|---|
| `index.html` head | canonical/OG URLs — set your final domain |
| `index.html` finale | "Book a Call" `mailto:` → your Cal.com/Calendly link |
| `public/robots.txt` + `public/sitemap.xml` | domain |
| `css/style.css` `--accent` | brand accent color if cyan isn't final |

## Accessibility & performance notes

- `prefers-reduced-motion` (or `?reduced` in the URL for testing) disables all
  pinning/scrubbing and shows a static composed layout.
- Placeholder rendering is dirty-flag gated + pre-rendered static layers —
  the draw loop does zero DOM reads.
- Mobile: DPR capped at 1, scrub quantized to 36 steps, shorter pin distances.
- Full keyboard navigation; skip-link; visible focus states; AA contrast.
