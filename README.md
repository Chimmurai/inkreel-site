# InkReel: website

Website for [InkReel](https://inkreel.raimex.space), a free Windows app that turns video, photos and GIFs into black and white.
Static, no build step and no dependencies, served by GitHub Pages. Languages: Ukrainian and English.

- Live site: https://inkreel.raimex.space
- Privacy policy: https://inkreel.raimex.space/privacy/
- Contact: raimex.crucible@gmail.com

## Run locally
```
python -m http.server 8000
```
then open http://localhost:8000/ (paths are root-relative, so opening the files directly will not work).

## Replace the placeholders
```
python tools/set_links.py --repo <owner/repository> --store <Store ID>
```

## What the page does
- Clicking the word "two" in the headline (or pressing **I**) swaps light and shadow: an ink blot spreads from the click point, and the choice is remembered.
- The demo can take your own photo or a short video. It is processed only in the browser's memory and is never uploaded.
- A pen trail follows the cursor (can be turned off in the footer), plus handwritten notes, pen-drawn check marks, a film strip that speeds up while scrolling, and a tab icon that follows the light and shadow state.
- With `prefers-reduced-motion` the motion is off, and cursor-based effects are not used on touch devices.

## Fonts
Cormorant, Spectral, IBM Plex Mono and Marck Script (handwritten notes only) are bundled in `assets/fonts/` (SIL Open Font License 1.1, see `assets/fonts/LICENSE.txt`). The site makes no requests to third-party servers.

## Pen strokes
Underlines, rules and corner marks come from a single generator: `python tools/pen.py` (no dependencies) rewrites `assets/pen/*.svg`. The output is deterministic.
