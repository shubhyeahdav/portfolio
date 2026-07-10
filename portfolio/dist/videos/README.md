# Video Slots — drop your 4 clips HERE (portfolio/public/videos/)

Place your real footage in THIS folder with EXACTLY these file names.
Reload the site — they are auto-detected. No code changes needed.
Files in `public/` are copied as-is by the build, so the same
`/videos/*.mp4` URLs work in local dev AND on Vercel.

| # | File name        | Shot description                                            |
|---|------------------|-------------------------------------------------------------|
| 1 | `hero-orbit.mp4` | Full-body shot, 360° camera orbit (scroll scrubs the orbit) |
| 2 | `craft.mp4`      | You at a desk with editing work, cinematic push-in          |
| 3 | `studio.mp4`     | Content studio, camera dollying sideways                    |
| 4 | `walk.mp4`       | Walking toward camera down a gallery of project screens     |

**Specs:** 1080p, 16:9, ~8 seconds each, H.264 MP4.
Keep files under ~20 MB each for fast scrubbing (2-pass encode recommended).

Scroll position = playback position: the page scrubs `video.currentTime`
through the clip while each section is pinned, then draws frames to a canvas
(like a frame sequence). Only the hero clip loads on page-load — the other
three lazy-load as their sections approach. Until a file exists, a charcoal
placeholder with grain + a motion diagram renders in its slot.
