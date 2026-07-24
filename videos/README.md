# Site assets — videos & portrait

Everything here is **optional**. Until a real file exists, the site renders a
procedural placeholder (charcoal + grain + a motion diagram) in each slot, so
the page always works. Drop the real files with the EXACT names below, reload,
and they're auto-detected — no code changes needed.

## Checklist

| # | File → drop at | Type | Ratio / size | Length | Camera move |
|---|---|---|---|---|---|
| 1 | `videos/hero-orbit.mp4` | video | 16:9 · 1920×1080 | 6–10s | 360° orbit around you, standing |
| 2 | `videos/craft.mp4` | video | 16:9 · 1920×1080 | 6–10s | Push-in (dolly toward desk) |
| 3 | `videos/studio.mp4` | video | 16:9 · 1920×1080 | 6–10s | Sideways dolly across a studio |
| 4 | `videos/walk.mp4` | video | 16:9 · 1920×1080 | 6–10s | Walk toward camera down a screen gallery |
| 5 | `portrait.jpg` *(repo root)* | image | 4:5 · ≥1200×1500 | — | Still portrait for the About card |

> ✅ `portrait.jpg` is already added. If it's ever missing, the About card
> falls back to an `SY` monogram automatically.

## How the video scrubbing works

Scroll position = playback position. While each section is pinned, the page
scrubs `video.currentTime` from 0→1 across the scroll and draws frames to a
canvas (like a frame sequence). Because of this the footage must behave like a
**camera you control by scrolling**:

- **One continuous take, ZERO cuts.** No scene changes, jump cuts, or flashes.
- **Monotonic motion** — one steady move start→end; scrolling back should feel
  like rewinding that single move.
- **Center-frame the subject** — the canvas uses `object-fit: cover` and crops
  the edges on some screens.
- **No baked-in text/logos/captions** — the site adds its own typography.
- **Dark, cinematic, on-brand** — charcoal/ink background with electric-cyan /
  teal rim light. The site darkens footage ~18% and adds grain, so generate
  slightly brighter and cleaner than the final look.
- **Locked exposure & white balance**, steady constant speed.

## Encoding

Export H.264 `.mp4`, `yuv420p`, keep each under ~8–12 MB. Then re-encode with
dense keyframes so scrubbing/seeking stays smooth:

```bash
ffmpeg -i input.mp4 -c:v libx264 -pix_fmt yuv420p -g 10 -bf 0 -crf 22 -movflags +faststart -an hero-orbit.mp4
```

## AI video prompts (Runway / Kling / Veo / Sora / Pika)

Append this negative list to each: `text, captions, watermark, logo, jump cuts,
multiple shots, camera shake, flicker, warm/orange tones, bright background,
extra people, morphing hands`.

**1 — `hero-orbit.mp4` (360° orbit)**
> Cinematic full-body shot of a young man standing confidently in the center of
> a dark charcoal studio, minimal dark outfit (black tee, dark trousers). The
> camera performs one smooth, continuous 360-degree orbit around him at a steady
> speed, subject staying centered. Moody low-key lighting with a soft
> electric-cyan/teal rim light tracing his silhouette, deep near-black
> background, faint haze. Shallow depth of field, 35mm anamorphic film look.
> Single unbroken take, constant rotation, no cuts.

**2 — `craft.mp4` (push-in)**
> A young creator seated at a dark editing desk, focused on color-grading
> footage across two glowing monitors. The camera performs one slow, continuous
> dolly push-in from wide to medium. Cinematic low-key lighting, monitors casting
> soft cyan/teal glow on his face and the charcoal room, subtle reflections,
> faint haze. 35mm anamorphic, shallow depth of field. Single continuous take,
> steady push-in, no cuts.

**3 — `studio.mp4` (sideways dolly)**
> Interior of a moody content-creation studio: camera on a tripod, softboxes,
> shelves, a wall of framed screens. The camera performs one smooth continuous
> lateral dolly (left to right) revealing the studio in parallax. Dark charcoal
> palette with electric-cyan accent and teal practical lights, cinematic haze,
> deep shadows. 35mm anamorphic, shallow depth of field. One unbroken take,
> constant sideways speed, no cuts.

**4 — `walk.mp4` (walk toward camera)**
> A young man walks slowly and confidently straight toward the camera down a dark
> gallery corridor lined on both sides with glowing screens showing abstract
> motion graphics. The camera retreats at his pace so he grows larger, staying
> centered, from full-body to medium. Cinematic low-key lighting, electric-cyan
> and teal glow raking across him and the charcoal walls, volumetric haze,
> reflective floor. Single continuous take, steady approach, no cuts.

**5 — `portrait.jpg` (still, 4:5)** — a real photo is best; to generate a match:
> Editorial 4:5 vertical portrait of a young man, head and shoulders, direct
> confident gaze, minimal dark outfit, against a deep charcoal background. Soft
> key light from one side with a subtle electric-cyan rim light on the shoulder
> and hair, cinematic low-key mood, shallow depth of field, sharp eyes, natural
> skin texture, premium magazine look.

Keep wardrobe, lighting, and the cyan accent consistent across all five assets —
that consistency is what makes the personal brand read as one system.
