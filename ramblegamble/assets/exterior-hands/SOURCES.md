# Exterior fog hands — sourced photographic art

The renderer expects `hands-atlas.png` (288×96 RGBA, six horizontal 48×96 tiles).
The archive does **not** contain this atlas: this build environment could browse
source pages but could not download the original image files. No synthetic hand
art or remote runtime fallback is supplied. The scene fails closed if the atlas
is absent; the other changes work independently.

From the project root, on a machine with Internet access:

```sh
python3 -m pip install Pillow
python3 ramblegamble/assets/exterior-hands/install-hands.py
```

Alternatively download the four originals below and use
`python3 ramblegamble/assets/exterior-hands/install-hands.py --source-dir /path/to/downloads`.
Use the filenames shown below. The three photographs are SHA-1 checked against
Wikimedia Commons metadata; the CC0 decal is checked for PNG format and size.
The installer performs background keying, source rotation, cropping,
low-resolution resampling, decal compositing, mirroring and wrist alpha fading.
Inspect the resulting atlas before deployment; extraction quality on the actual
files could not be visually tested in this environment. Deploy the generated PNG
along with the patch. Do not publish the originals unless needed.

| Original | Author / license | Direct file |
|---|---|---|
| [Forearm.jpg](https://commons.wikimedia.org/wiki/File:Forearm.jpg) | Mikael Häggström, public domain dedication | [Original](https://upload.wikimedia.org/wikipedia/commons/3/32/Forearm.jpg) |
| [5@BackForward.jpg](https://commons.wikimedia.org/wiki/File:5@BackForward.jpg) | Mario Carneiro (Di gama), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [Original](https://upload.wikimedia.org/wikipedia/commons/e/eb/5%40BackForward.jpg) |
| [Claw5@UlnarForward.jpg](https://commons.wikimedia.org/wiki/File:Claw5@UlnarForward.jpg) | Mario Carneiro (Di gama), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | [Original](https://upload.wikimedia.org/wikipedia/commons/5/58/Claw5%40UlnarForward.jpg) |
| [Liquid Splatter Pixel Texture](https://opengameart.org/content/liquid-splatter-pixel-texture) | AlejandroHaibi, [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | [blood_splatter_0.png](https://opengameart.org/sites/default/files/blood_splatter_0.png) |

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
