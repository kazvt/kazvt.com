# Point-and-click cursor artwork

The active set is `pixelarticons/`, adapted from **Pixelarticons** by Gerrit Halfmann (MIT; license included in that directory). The exact source SVG shapes are included alongside the game-ready PNGs:

- [cursor-minimal](https://github.com/halfmage/pixelarticons/blob/master/svg/cursor-minimal.svg) — neutral pointer. Source path recovered from [IconStash](https://iconstash.io/icons/pixelarticons-cursor-minimal/).
- [pointer](https://github.com/halfmage/pixelarticons/blob/master/svg/pointer.svg) — pointing hand for interaction. Source path recovered from [SVGIcons](https://svgicons.com/icon/282334/pointer).
- [arrow-right](https://github.com/halfmage/pixelarticons/blob/master/svg/arrow-right.svg) — all three navigation directions. Source paths recovered from [DownloadIcons](https://downloadicons.com/icons/pixelarticons/arrow-right/).

The original glyph paths were transcribed from the publicly available SVG markup because direct asset downloads were unavailable during patch preparation. Adaptations: rasterized at the source 24×24 grid, filled enclosed contours, applied the game's warm yellow / deep purple palette and contrasting pixel keylines, and padded to 32×32 transparent PNGs. Left is an exact horizontal reflection of right, and back is an exact clockwise quarter-turn. No runtime external asset URLs or additional dependencies.

| Mode | PNG | Hotspot (x, y) | Native fallback |
|---|---|---|---|
| default | idle | 10, 8 | default |
| hover | interact | 11, 5 | pointer |
| left | left | 8, 15 | w-resize |
| right | right | 23, 15 | e-resize |
| back | back | 16, 23 | s-resize |

The scene raycast/edge routing sets `data-rg-cursor` on the canvas; CSS uses native cursor images and keyword fallbacks, not a floating image or `cursor:none`. Forced-colors mode uses native cursors. Static artwork also works with reduced-motion enabled. Ordinary HTML controls, drawing tools, and contestant pages are unchanged.

References: [CSS cursor / MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor), [CSS Basic UI](https://www.w3.org/TR/css-ui-3/#cursor). Other considered packs: [Kenney Cursor Pixel Pack](https://kenney.nl/assets/cursor-pixel-pack) (CC0; binary download blocked), [DcaveDerps Hand Cursors](https://dcavederps.itch.io/hand-cursors) (paid, not included).

## Legacy assets

The previous transparent GIFs remain in the repository but are no longer loaded by the game. They came from [USAGIF's transparent arrows, cursors and pointers collection](https://usagif.com/arrows-cursors-pointers-gifs-on-transparent-background/): `pointer-default.gif` (Large blue cursor), `pointer-hover.gif` (Cursor for a definitive click), and `direction-right.gif` (White arrow pointing right).
