# Sound effect source

- `cheer.ogg` is “Conference audience clapping strongly” (8.6 seconds), Mixkit sound effect #476.
- Downloaded from: https://mixkit.co/free-sound-effects/clapping/
- License: Mixkit Sound Effects Free License, https://mixkit.co/license/ . It permits use in a larger project, including web projects; the sound must not be redistributed as a standalone stock item.
- The clip is used as the Ramble Gamble cheer-button sound effect. Attribution is not required.

## Game foley (slots, cards, roulette, dice)

The patch implements a same-origin audio mixer, not synthesized audio. Asset bytes could not be downloaded in the patch-authoring environment. Run this once from the site root on an Internet-connected machine (as the site owner, not root):

```sh
python3 ramblegamble/assets/sfx/install-foley.py
```

If the Freesound website does not expose previews to the script, use a free Freesound API token as the `FREESOUND_API_TOKEN` environment variable (not a password and not embedded in site code). Alternatively obtain the original downloads on the linked pages, convert each to MP3 with e.g. `ffmpeg -i ORIGINAL.wav -c:a libmp3lame -q:a 2 OUTPUT.mp3`, put them in a private staging directory with the filenames below, and use `--recordings /path/to/staging`. For a downloaded Kenney archive use `--kenney-zip /path/to/kenney_casino-audio.zip`. No network requests to stock sites are made by the browser; it only fetches local files in `assets/sfx/foley/`. Missing files fail silently in gameplay; installer returns nonzero and lists them. Reload after installation. The host Arcade tab has a mute toggle.

| File | Source and attribution | License / intended use |
|---|---|---|
| `switch.mp3` | [Mechanical Switch — Crinkem](https://freesound.org/people/Crinkem/sounds/496328/) (Sony PCM-A10 recording) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/), physical button and reel stop |
| `lever.mp3` | [Mechanical switch (latch) 01 — xkeril](https://freesound.org/people/xkeril/sounds/815492/) (recorded wooden latch) | CC0, crank pull proxy |
| `reel.mp3` | [Spinning ratchet (SoundAction 116) — Alexander Refsum Jensenius (alexarje)](https://freesound.org/people/alexarje/sounds/863094/) (recorded ratchet) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), mechanical reel rotation proxy; gain and playback looping in game |
| `wheel.mp3` | [Hard_Ball_Rolling_Mono_1.wav — Stagno](https://freesound.org/people/Stagno/sounds/705775/) (field recording of a hard stone ball rolling in a bowl) | CC0, roulette rolling-ball proxy; gain and playback looping in game |
| `card-place-*`, `card-slide-*`, `card-shuffle`, `chip-lay-*`, `chips-handle-*`, `die-shuffle-*`, `die-throw-*` (OGG) | [Casino Audio — Kenney](https://kenney.nl/assets/casino-audio) | CC0; cards, dice and chips, plus chip clack/handling used as landing and payout proxies |

The source descriptions and licenses were checked, not the audible clips (download blocked). Preview files remain unmodified; gain, looping and stop fades are playback operations. A genuine spinning ratchet is used instead of synthetic slot audio. Check the mix and source timbres by ear after installation. CC BY credit must remain with distributed game assets; this document is served alongside the recordings.

Design references: [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), and [Second Chance recording pipeline](https://www.secondchancegame.com/freesound-sound-effects).
