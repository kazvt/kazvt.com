# berrybox

Browser game for one host and members with room-code joining.

## Run

```powershell
cd E:\sites\kazvt.com-1\berrybox
node server.js
```

Open:

```text
http://127.0.0.1:8765/
```

The first browser in a room becomes the host. Opening the bare URL creates a room code and adds it to the address bar. Share that link with players.

GitHub Pages uses the browser-side room path in `settings.json` with `network.signalingMode` set to `peerjs`. The game still sends play data browser-to-browser; PeerJS is only used so browsers can find each other from static hosting. `server.js` is only for local/custom server hosting.

## Images

Put prompt images in `assets/images/` and list them in `assets/images/manifest.json`.

```json
{
  "images": [
    { "file": "round-01.png", "title": "Round 01" },
    { "file": "round-02.webp", "title": "Round 02" }
  ]
}
```

## Fonts

Put fonts in `assets/fonts/` and list them in `assets/fonts/manifest.json`. A string entry uses the file name without the extension as the selector name.

```json
{
  "fonts": [
    "DisplayFont.woff2",
    { "file": "CaptionFont.otf", "name": "CaptionFont" }
  ]
}
```

## Settings

Edit `settings.json` for title, timers, scoring, canvas size, image order, palette, and editor defaults. Match length follows the number of listed images, capped by `game.maxRounds` up to 25.
