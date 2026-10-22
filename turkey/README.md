# Turkey mascot (rigged)

A new turkey in the style of Lauren's invite (`invite/lauren/src/table-card.png`), split into parts and animated with plain CSS. The demo page lives outside the public site: open `turkey/demo.html` (project root) to see it.

## Files

| file | what |
|---|---|
| `turkey.css` | the rig: pivots, keyframes, reduced-motion handling. Copy as is. |
| `tail-left.webp`, `tail-right.webp`, `tail-top.webp` | tail fan in three pieces. The hidden middle is filled, so the side pieces can fold in behind the top feather. |
| `feet.webp` | both feet |
| `body.webp` | body, with plain skin under where the head sits (no face), so the head can move |
| `wing-l.webp`, `wing-r.webp` | wings; each carries a little of the shoulder so the root stays covered when raised |
| `head.webp` | head with beak, wattle and blush, **without eyes** |
| `eyes-happy.webp` | Lauren-style closed happy eyes (the resting look) |
| `eyes-open.webp` | small open dot eyes (used while idle, and for the blink) |
| `turkey-still.webp` | everything flattened, happy eyes: use for `og:image` or a no-CSS fallback |

Every part is the **same 600 x 600 canvas**, so they stack with **no offsets**: `position:absolute; inset:0; width:100%`. Parts weigh 81 KB together (still: 31 KB).

## Stacking order (back to front)

1. `.tk-tail` wrapper: `tail-left`, `tail-right`, `tail-top`
2. `feet`
3. `body`
4. `wing-l`, `wing-r` (in front of the body, so a raised wing reads)
5. `.tk-face` wrapper: `head`, `eyes-happy`, `eyes-open`

Wrappers, outermost first: `.turkey` (size) > `.tk-hop` (jump) > `.tk-squash` (squash and stretch from the feet). `.tk-shadow` sits outside the hop so it stays on the ground.

Pivots (% of the canvas, already in `turkey.css`): tail fan 50% 66.8%; wing-l shoulder 31% 65.5%; wing-r shoulder 69.1% 65.5%; neck 50.2% 63.2%; eye line 50.2% 46.6%; feet 50% 97%.

## Markup to drop in

```html
<link rel="stylesheet" href="turkey/turkey.css">

<div class="turkey" style="--tk-size: 260px" role="img" aria-label="A cute cartoon turkey hopping and waving">
  <div class="tk-shadow"></div>
  <div class="tk-hop"><div class="tk-squash">
    <div class="tk-tail">
      <img class="tk-tail-l" src="turkey/tail-left.webp" alt="">
      <img class="tk-tail-r" src="turkey/tail-right.webp" alt="">
      <img class="tk-tail-top" src="turkey/tail-top.webp" alt="">
    </div>
    <img class="tk-feet" src="turkey/feet.webp" alt="">
    <img class="tk-body" src="turkey/body.webp" alt="">
    <img class="tk-wing-l" src="turkey/wing-l.webp" alt="">
    <img class="tk-wing-r" src="turkey/wing-r.webp" alt="">
    <div class="tk-face">
      <img class="tk-head" src="turkey/head.webp" alt="">
      <img class="tk-eyes-happy" src="turkey/eyes-happy.webp" alt="">
      <img class="tk-eyes-open" src="turkey/eyes-open.webp" alt="">
    </div>
  </div></div>
</div>
```

- `--tk-size` sets the width (square). `--tk-loop` (default `3.6s`) sets the loop length.
- The hop rises 17% of the size above the box: leave that much headroom or it clips under whatever sits above.
- Want it to start at a different point (several on a page)? Give its descendants a negative `animation-delay`, as `turkey/demo.html` does.
- Pause it: `.turkey * { animation-play-state: paused }`.

## The loop (3.6 s)

0-0.8 s idle with open eyes and one blink · 0.6-0.9 s crouch (squash), eyes go happy, tail starts folding · 0.9-1.6 s hop with two wing flaps, tail folded in behind the top feather · 1.6 s land with a big squash, the tail fan pops open with a bounce, head bobs on follow-through · 2.1-3.1 s head tilt and three waves of the right wing · 3.2 s eyes open again.

`prefers-reduced-motion: reduce`: no animation; it shows the still pose with happy closed eyes (Lauren's look).

## How it was made (to redo or tweak)

Scripts are in `turkey/src/` (outside `docs/`); raw takes in `turkey/_raw/` (each has a `.recipe.json`).

- `gen.py base` / `round2.py`: FLUX.2 klein 4B reference edits with a crop of Lauren's characters as the style reference (and four Qwen-Image-Edit takes, which came out too clip-art). All through the Shovelware GPU broker, lane FRIENDSGIVING. The pick is `r2_plain_s505` (copied to `_raw/pick.png` + `pick_mask.png`, BiRefNet alpha).
- `rig.py`: splits the pick into parts by colour segmentation plus hand-fitted shapes (body ellipse, head outline, shoulder pivots), fills the hidden middle of the tail by extending each feather inward along rays from the fan centre, lifts the eyes off the head (inpaint) and draws the open eyes, then crops to the 600 px canvas and writes the webps here.
- `check.js` (Playwright, real Chrome) freezes the loop at set times and saves `screenshots/2026-10-21/turkey-frames/`; `sheet.py` makes `_sheet.jpg` there.
