# Exterior fog hands — sourced photographic art

The renderer expects `hands-clean-v2.png` (288×96 RGBA, six horizontal 48×96 tiles).
The distinct filename prevents stale cached bloody `hands-atlas.png` from being
loaded by the current renderer. A cleaned compatibility copy is also supplied at
`hands-atlas.png` for older modules; fresh installer runs target the new filename.
Deploy both PNGs and the updated module/HTML chain together.
The archive includes a cleaned atlas. The existing mirrored photographic tiles
were combined and overlapping stain regions locally interpolated to remove the
baked-in decal, retaining the original silhouettes and wrist alpha exactly.
Original photos could not be retrieved in the patch environment. For a fresh
build directly from the licensed photos, run the installer below; it no longer
uses any blood decal. No remote runtime fallback is supplied.

From the project root, on a machine with Internet access:

```sh
python3 -m pip install Pillow
python3 ramblegamble/assets/exterior-hands/install-hands.py
```

Alternatively download the three originals below and use
`python3 ramblegamble/assets/exterior-hands/install-hands.py --source-dir /path/to/downloads`.
Use the filenames shown below. The three photographs are SHA-1 checked against
Wikimedia Commons metadata.
The installer performs background keying, source rotation, cropping,
low-resolution resampling, mirroring and wrist alpha fading.
Inspect any regenerated atlas before deployment. The included cleaned atlas has been visually inspected. Do not publish the originals unless needed.

| Original | Author / license | Direct file |
|---|---|---|
| [Forearm.jpg](https://commons.wikimedia.org/wiki/File:Forearm.jpg) | Mikael Häggström, public domain dedication | [Original](https://upload.wikimedia.org/wikipedia/commons/3/32/Forearm.jpg) |
| [5@BackForward.jpg](https://commons.wikimedia.org/wiki/File:5@BackForward.jpg) | Mario Carneiro (Di gama), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [Original](https://upload.wikimedia.org/wikipedia/commons/e/eb/5%40BackForward.jpg) |
| [Claw5@UlnarForward.jpg](https://commons.wikimedia.org/wiki/File:Claw5@UlnarForward.jpg) | Mario Carneiro (Di gama), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [Original](https://upload.wikimedia.org/wikipedia/commons/5/58/Claw5%40UlnarForward.jpg) |

The edited atlas is distributed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
Preserve this attribution alongside the atlas. The images are used as fictional
horror cutouts; the source photographs depict ordinary anatomy/hand poses, not
injured or drowning people. The source creators do not endorse this game.
Only the photographic atlas is licensed this way; existing application code and
unrelated project artwork are not relicensed by this notice.

The exterior uses the already bundled recorded `vip-water-drips-cave-loop.ogg`;
see `../sfx/SOURCES.md` and `../sfx/install-vip-water.py` for its provenance.

Implementation references: [Three.js transparency](https://threejs.org/manual/pages/transparency.html),
[InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html),
[Material.forceSinglePass](https://threejs.org/docs/pages/Material.html),
[Web Audio API](https://www.w3.org/TR/webaudio-1.1/).
