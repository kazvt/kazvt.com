# Floating sky video

The floating sky is a silent, 20-second, 20 FPS pre-rendered loop. The game only loads `floating-sky-matte.mp4` (2048×1024 packed RGB and alpha), and only when an unlocked active room camera can see an overhead tile. The separately included `floating-sky-alpha.webm` is the actual 1024×1024 VP9 alpha export for reuse in other tooling. The native alpha export is **not** requested at runtime. `sky-preview.png` is an offline transparent first-frame reference. Both videos contain no audio track.

The shader samples the left 1024-pixel square as sRGB color and the right square as straight alpha, with half-texel insets, compression noise rejection, edge feathering and distance fade. The MP4 approach avoids relying on browser-specific transparent-video upload support. All visible planes share one VideoTexture, geometry and material. A world-fixed 36×36-unit tile repeats on a 30.24-unit grid; adjacent tiles overlap by 16%, and stable quarter-turn variation reduces obvious repetition. The plane starts at Y=15 relative to the stage's Y=0 reference floor and rises to max(15, camera.y + 3), without a maximum height or any horizontal attachment to the camera. It returns to Y=15 on descent. The renderer reuses a 7×7 pool, frustum/distance culls each tile, and pauses the single decoder when no candidate is visible, the room is hidden/locked/paused, or VIP Dice is open. No new interactive targets, live model loading, physical simulation, audio, database or runtime library.

## Artwork and provenance

- Two cards and one decorative die reuse the exact indexed triangles and original texture atlases from `../provided/rg_stage.gltf`. One additional chair uses the original stage mesh with a recolored atlas.
- Retro chair, table, desk, notebooks, cats, cars and sailboat are **locally generated** low-poly models. The “ILY LILLIE” inscription is layered extruded lettering. They are shaded, grain-treated, and rendered offline with per-pixel depth and back-face culling.
- Two obsidian spheres have procedural marbling, branching red scleral veins, radial iris filaments, specular highlights, purple motes, and discrete 5 FPS blinking and gaze movement. They are **stylized, not photographic/hyperrealistic**. No real eye photo has been downloaded or used.
- The bake runs an equal-mass collision simulation using conservative disk proxies in the projected plane; the 20-second loop smoothly retraces the baked trajectory, rather than calculating 3D rigid-body collisions in the browser. The current seed generates 10 collision impulses. The props retain generous negative space; opacity covers about 8% of the tile in sampled frames.

### External asset research (not bundled)

The following freely licensed sources were selected, but this environment could not download their binaries (DNS / container download failures). No third-party asset is represented as incorporated.

- Kenney Furniture Kit (CC0): https://kenney.nl/assets/furniture-kit
- Kenney Car Kit (CC0): https://kenney.nl/assets/car-kit
- Kenney Watercraft Kit (CC0): https://kenney.nl/assets/watercraft-kit
- Psychonaught, *Bloodshot.jpg* (public domain): https://commons.wikimedia.org/wiki/File:Bloodshot.jpg — actual red-veined eye reference.
- Kookaaa, *Close up shot of the human eye, 9 August 2024.jpg* (CC0): https://commons.wikimedia.org/wiki/File:Close_up_shot_of_the_human_eye,_9_August_2024.jpg
- Poly Haven (CC0 surface textures): https://polyhaven.com/

Technical research: https://threejs.org/docs/pages/VideoTexture.html ; https://threejs.org/docs/pages/Frustum.html ; https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay ; https://bugs.webkit.org/show_bug.cgi?id=273006 ; https://stepancar.github.io/alpha-video-kit/ (packed alpha technique; no dependency on the library).

## Optional offline re-bake with downloaded assets

No re-bake is required to deploy this patch. On an Internet-connected machine, download models and textures with appropriate licenses and keep their attribution/license notices. Export chosen models as GLBs with embedded textures and conventional Y-up coordinates, named `chair.glb`, `chair2.glb`, `desk.glb`, `table.glb`, `book.glb`, `book2.glb`, `car.glb`, `car2.glb`, `boat.glb`, `cat.glb`, `cat2.glb` in a local directory. The script uses only files that exist, falling back to the supplied art for others. A manually cropped, appropriately licensed close-up eye photo can be supplied via `--eye`; it is mapped into the blinking aperture. The photo override is not verified against an actual photograph in this environment. Choose a crop centered on the eye, without extraneous skin or identifying context. The source eye and model files are not required by the deployed site. The script supports original `card1`, `card2`, `die` overrides as well, but keep the supplied stage art if desired.

Install Python packages in a local virtual environment (`numpy scipy pillow opencv-python-headless trimesh`), FFmpeg with libx264/libvpx-vp9, and the DejaVu Sans font package. The renderer uses `/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf` for the inscription. From the project root:

```sh
python3 ramblegamble/assets/sky/render-sky.py --models /path/to/glbs --eye /path/to/cropped-eye.jpg
```

Use `--preview-only` to inspect the first rendered frame before encoding, and `--output /path/to/directory` to avoid replacing the shipped files. When replacing the deployed clip, keep the packed format/dimensions and alpha convention or update `floating-sky.mjs` accordingly; bump the video cache version. The source assets are used only at build time. No SQL changes.
