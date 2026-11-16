# GFUMES — The Future Is Empty™

A playable, fully fictional, G FUEL-inspired **parody** storefront. The name and artwork are original text/CSS; the 3D GLB characters, props and preview images are *real* free Kenney assets, not AI-generated or custom-built models.

## Start the website

1. Unzip this folder.
2. **Optional but recommended:** from the GFUMES folder run `python download_assets.py` while connected to the internet. This downloads the five Kenney CC0 models and five thumbnails to the `assets` folder, then switches the site to use those local files.
3. Run `python -m http.server 8000` inside the GFUMES folder. On Windows, `py -m http.server 8000` also works.
4. Open `http://localhost:8000` in Chrome, Firefox, Edge, or Safari.

If you skip step 2, models and images will stream from GitHub/jsDelivr when you're online. Three.js is loaded from jsDelivr, and the fonts are loaded from Google Fonts, so internet access is needed for the best visual experience. If the 3D imports cannot load, **the cart, fake orders, and rest of the store still work** and the viewer areas use image previews.

## Features

- Responsive promotional storefront, four fake collectible products, merchandising sections, and animations.
- Actual draggable 3D rotating GLB objects (not pre-rendered spin GIFs); each item has its own viewer, with pixelated rendering and nearest-neighbor textures.
- PSX-style 3D humanoid and product scene, interactive experimental modes, animated pixel vapor *visual effects*.
- Functional shopping cart, quantity controls, fake checkout, random receipt code, and browser-only order history.
- Customize the faux creator collaboration name and copy a personalized shareable `?collab=YOUR_HANDLE` prank link.
- No payments, personal shipping addresses, third-party order APIs, backend, or actual product.

## Important parody/safety note

GFUMES is **not affiliated with, sponsored by, or endorsed by G FUEL**. The mock pricing and order flow are for a joke only. Nothing will be ordered, charged, shipped, or inhaled. Do **not** inhale unknown gases, fumes, or vapors.

## Models and image credit

All 3D GLB and thumbnail preview files from the free [Kenney](https://kenney.nl/) asset packs (Creative Commons CC0 1.0):

- [Prototype Kit](https://kenney.nl/assets/prototype-kit) — `crate-color`, `crate`
- [Car Kit](https://kenney.nl/assets/car-kit) — `box`
- [Food Kit](https://kenney.nl/assets/food-kit) — `pizza-box`
- [Blocky Characters](https://kenney.nl/assets/blocky-characters) — `character-a`

Browser-ready GLBs/thumbs are mirrored by [Hidencod/tge-assets](https://github.com/Hidencod/tge-assets), which lists the original authors and licenses. Attribution to Kenney isn't required for CC0, but is included here in appreciation. The website interface and text are composed in HTML/CSS/JS; no custom illustration, textures, or 3D meshes were produced for the project.

## Files

- `index.html` — full parody page, demo viewer mounts, fake checkout and order dialogs
- `styles.css` — responsive neon/industrial styling
- `store.js` — cart, fake checkout, local browser storage, demo controls
- `scene.js` — Three.js GLTF loading, rotating models and PSX pixelated viewer
- `download_assets.py` — downloads actual CC0 assets into `assets/`
- `asset-config.js` — set automatically by the asset downloader

### Hosting

Upload this entire folder as `gfumes/` to GitHub Pages, Netlify, or any static web host. The storefront will be reachable at `/gfumes/` on that host. A `localhost` collaboration link can only be opened from your own computer; publish the page before sharing the personalized link with friends. There is no server-side component. The "my orders" feature is browser-local, so orders on one device will not transfer to another.
