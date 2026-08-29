# Christoph Schneider — portfolio

Static site, no build step. Copy the contents of this folder to the root of
`Stufj/Stufj.github.io` (branch `master`) and GitHub Pages serves it as-is.

## Files

- `index.html` — entry point, forwards to `Home.dc.html`
- `Home.dc.html` — index: hero, project tiles, CV
- Project pages: `AR-MR Research.dc.html`, `Un-Useless Interactions.dc.html`,
  `catch-22.dc.html`, `VR Parcours.dc.html`, `Remote Play Experiments.dc.html`,
  `Virtual Design Kit.dc.html`, `Virtual Exhibition.dc.html`, `Craft.dc.html`
- `support.js` — page runtime, loaded by every page
- `dancer.js` — the 3D dancer on the home page; plays only while the cursor moves
- `models/dance.glb` — that animated model
- `brain.js` — the earlier brain canvas (still used on the thesis page)
- `_ds/` — design-system stylesheet and bundle
- `images/`, `VDK/` — photography
- `.nojekyll` — tells Pages to serve files verbatim

This is the v2 (simplified) edit of every page: one headline claim per project,
a three-field fact sheet, and process/reflection behind a single disclosure.

Pages are plain HTML documents; open any of them directly in a browser.

The dancer loads three.js from a CDN (esm.sh), so it needs a network
connection to appear — everything else on the site is local.
