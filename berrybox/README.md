# Berrybox

Static browser game screen for one host and members.

## Run

```powershell
cd E:\sites\kazvt.com-1\berrybox
python -m http.server 8765 --bind 127.0.0.1
```

Member screen:

```text
http://127.0.0.1:8765/
```

Host screen:

```text
http://127.0.0.1:8765/?role=host
```

The default role can also be changed in `settings.json` with `game.defaultRole`.

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

Edit `settings.json` for title, timers, round count, scoring, canvas size, image order, palette, and editor defaults.
