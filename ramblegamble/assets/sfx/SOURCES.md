# Ramble Gamble sound effects

All sound playback uses existing sound files. No oscillator, noise generator or runtime composition is used. Physical foley is used for mechanical actions; pre-existing electronic effects are used for arcade and interface feedback. The bundled `cheer.ogg` is the previously installed Mixkit clip.

## Install / update (GitHub Pages)

From the repository root on your own Internet-connected computer, run:

```sh
python3 ramblegamble/assets/sfx/install-foley.py
```

Commit the resulting `ramblegamble/assets/sfx/foley/` directory to GitHub Pages. Do not commit a Freesound API token. Existing valid files are preserved. To check the inventory without downloading, use `--check`. Reload the deployed pages after committing new samples. The patch authoring environment could not download or audition new binary audio; the installer downloads the actual source files. The site uses same-origin audio only, never hotlinks the stock sites.

If Freesound's public page does not expose the preview URL, use the free API token as `FREESOUND_API_TOKEN` in your shell environment. Alternatively download from the source pages below and put MP3 copies in a private staging directory with the listed names. Convert if necessary with `ffmpeg -i ORIGINAL.wav -c:a libmp3lame -q:a 2 OUTPUT.mp3` (conversion, not synthesis). You can also download both Kenney ZIPs manually and run:

```sh
python3 ramblegamble/assets/sfx/install-foley.py --kenney-zip /path/to/kenney_casino-audio.zip --interface-zip /path/to/kenney_interface-sounds.zip --recordings /path/to/staging
```

Missing or undecodable effects use the listed fallback where available; gameplay does not depend on playback. If every candidate is absent, the cue stays silent. The installer checks file signatures and reports missing files, not the subjective quality of the samples.

## Source credits

| Local file(s) | Original source | License and use |
|---|---|---|
| `cheer.ogg` (bundled, parent directory) | [Conference audience clapping strongly, Mixkit #476](https://mixkit.co/free-sound-effects/clapping/) | [Mixkit Free License](https://mixkit.co/license/), applause in this game, not standalone stock redistribution |
| `settlement-cheer-long.ogg` | Edited from the bundled `cheer.ogg` (Mixkit #476 above) | 7.2-second excerpt with short attack and 0.95-second fade-out; included in the game patch, no installer download needed. |
| `smeemo-hit.ogg` | Local edit of bundled Kenney Casino Audio `chip-lay-1.ogg` | CC0; recorded chip transient with resonant EQ and a fade, a pitched percussive sting (not an orchestral recording). |
| `smeemo-rumble.ogg` | Local edit of `wheel.mp3` (Stagno, source below) | CC0; 0.95-second excerpt of actual stone rolling, band-passed and faded. |
| `error-1.ogg`, `error-2.ogg` | Local edits of bundled Mechanical Switch — Crinkem (source below) | CC0, two descending double-click recorded error cues; intentionally replace the optional Kenney error files |
| `switch.mp3` | [Mechanical Switch — Crinkem](https://freesound.org/people/Crinkem/sounds/496328/) | CC0, physical machine button |
| `lever.mp3` | [Mechanical switch (latch) 01 — xkeril](https://freesound.org/people/xkeril/sounds/815492/) | CC0, mechanical crank proxy |
| `reel.mp3` | [Spinning ratchet (SoundAction 116) — Alexander Refsum Jensenius (alexarje)](https://freesound.org/people/alexarje/sounds/863094/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), older physical spin fallback; gain, loop and fades applied at playback |
| `wheel.mp3` | [Hard_Ball_Rolling_Mono_1.wav — Stagno](https://freesound.org/people/Stagno/sounds/705775/) | CC0, hard stone ball rolling in a bowl, roulette rolling proxy |
| `spinner.mp3` | [Spinner Sound.mp3 — klc777](https://freesound.org/people/klc777/sounds/562114/) | CC0; 11.926-second repeating high-pitched arpeggio intended for game spinners. Primary slot reel sound; cut/faded when the actual final reel stops. |
| `jackpot.mp3` | [Jackpot Win — Qvantor](https://freesound.org/people/Qvantor/sounds/878618/) | CC0; existing electronic major-arpeggio chime ending on a chord, 2.892 s; reserved for an individual pattern worth 50,000 or more, and Smeemo discovery |
| `card-place-*`, `card-slide-*`, `card-fan-*`, `card-shove-*`, `card-shuffle`, `chip-lay-*`, `chips-handle-*`, `chips-stack-*`, `chips-collide-*`, `die-grab-*`, `die-shuffle-*`, `die-throw-*` | [Casino Audio — Kenney](https://kenney.nl/assets/casino-audio) | CC0, physical card/chip/dice sounds; chip collisions are a short hard-object impact proxy for dice and roulette pockets |
| `tick-*`, `select-*`, `click-*`, `scroll-*`, `open-*`, `close-*`, `back-*`, `toggle-*`, `glass-*`, `pluck-*`, `drop-*`, `confirmation-*`, `question-*`, `maximize-*`, `minimize-*`, `scratch-*` | [Interface Sounds — Kenney](https://kenney.nl/assets/interface-sounds) | CC0, existing interface sounds; exact upstream filenames are in the installer (e.g. `confirmation_001.ogg`) |

CC0: https://creativecommons.org/publicdomain/zero/1.0/ . Keep the CC BY credit when distributing `reel.mp3`. Sources and licenses were selected from the creator pages; filenames were cross-checked against the published pack inventories. No new samples were auditioned in the patch environment. Adjust the per-cue gain and source selection in `game-foley.mjs` after listening in the actual game.

## Cue design and timing

- **Slots:** physical crank/press, berry selection, star glass chime, removal, arpeggio for row/column/all-line motion, a tick at every actual line stop, chip payout, distinct large-win chime. Failed/no-op actions do not trigger spins or reward sounds.
- **Roulette:** physical start, rolling-ball loop, rate-limited hard contact ticks during inward settling and a landing clack plus the shared extended applause at the committed final pocket pose. The question prompt remains visible; the celebration replaces its generic question cue on a real spin. Off-screen, hidden, locked and missing-model completions do not celebrate.
- **Cards:** opening fan, menu flip, deal/stack shuffle, accepted submission drop, final answers fan, vote pluck, reveal/confirmation, shop card flip and chip stack purchase; errors distinct. Submissions are observed on the visible display using state changes (including console-reader deliveries), not repeated on every redraw.
- **Smeemo Scramble:** new round and accepted card reveals trigger a bounded room/board impact, a recorded low rumble and a resonant recorded chip sting. The sting is resampled upward within each hit and across successive reveals; a found berry uses the separately installed recorded horror scream. Separate replaceable channels cancel pending and playing cues on exit, hide, lock or game replacement. No runtime synthesis or external downloads.
- **VIP Dice:** portal open/exit, dice selection/grab, collision-strength-scaled impacts, the same extended applause only when both dice sleep and the upward faces are committed. Stop rolling/impact audio first; cancel settlement playback on reroll, close, hide or graphics loss. Existing collision physics remain authoritative.
- **Trivia / player activities:** question presentation, sequence changes, selection, submission and receipt, wrong/correct feedback, placement/removal, drawing stroke start, undo/clear, JSON handoff. The former oscillator error tone has been removed. Contestant pages have a compact Sound checkbox. No staff-only solutions or answer content is transmitted by audio logic.
- **Scene and interface:** navigation, back, menus, tabs, selections, switches and ordinary button activation. Explicit game actions take precedence over the generic low-level click. Ordinary scene mouse movement, typing, passive rerenders, empty-space clicks and unsolicited background restoration remain quiet (card menu retains its existing explicit hover sound). The separate text console stays quiet to avoid doubling stream audio; game events it sends to the display still use the display's cues.

Playback uses local decoded buffers, per-cue gain, alternating variants, bounded voices, a compressor, loop cancellation, stale-request rejection and shared mute state. It observes user activation and stops on page hide or host lock without changing the running multiplayer reader. It is not a music soundtrack or runtime synth.

Design references: [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [MDN audio for web games](https://developer.mozilla.org/en-US/docs/Games/Techniques/Audio_for_Web_Games), [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [Kenney Casino Audio](https://kenney.nl/assets/casino-audio), [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds). Event-specific cue routing and variations follow the common game-audio event/asset separation rather than tying playback to frame rendering.

### Room ambience and Smeemo discovery (installation required)

The following independently recorded sources are downloaded locally by `install-room-audio.py`, which verifies their published Commons SHA-1 checksums before use. The source bytes could not be retrieved in the patch-authoring environment; **do not deploy the sound patch until the installer has succeeded**. No generated audio or remote runtime hotlinks are used. On an internet-connected checkout with Python 3, FFmpeg and FFprobe on PATH, run `python ramblegamble/assets/sfx/install-room-audio.py` from the project root. If the network blocks the installer, download the original files from the three source pages into a directory and use `--downloads DIRECTORY`. Original filenames must match those in the installer. Commit the resulting three files under `ramblegamble/assets/sfx/foley/` alongside the patch. Neither Python nor FFmpeg is needed on the deployed static site.

| Output | Source | License / edit |
| --- | --- | --- |
| `room-bed.mp3` | [Cafe ambiance, Marble Toast, 20 minutes](https://commons.wikimedia.org/wiki/File:Cafe_ambiance.ogg) | CC0; 3-second wrap crossfade and band limiting, MP3 |
| `room-detail.mp3` | [Restaurant ambience, stephan, 76 seconds](https://commons.wikimedia.org/wiki/File:Restaurant_ambience.ogg) | Public domain; same wrap crossfade and band limiting |
| `smeemo-horror.mp3` | [Demonic Woman Scream, nick121087](https://commons.wikimedia.org/wiki/File:Nick121087_-_Demonic_Woman_Scream_(cc0)_(freesound).mp3), [original Freesound](https://freesound.org/people/nick121087/sounds/333832/) | CC0, published Commons MP3 unchanged; gain limited by existing mixer |

Two independently looping HTML media streams feed low-gain channels into the existing mixer compressor, avoiding whole-file PCM buffering for the twenty-minute bed. Both start at randomized positions, keep their positions across pause/visibility changes, and do not start on private player or console pages. VIP now silences these room recordings near the doorway and inside Dice (see VIP doorway ambience below); Smeemo's discovery ducks ambience, stops its normal pitched hit, and uses the new scream with the existing rumble, without jackpot/applause fallback. Main host arcade settings include a separate Room ambience checkbox. Missing files fail silently, not with synthesized substitutes. The user must audition the final recordings/mix after installing; tests used a separate existing recording as a local streaming/loop fixture only.

### Audience emotes

`audience-cheer.mp3` is an in-game derivative of the already bundled Mixkit #476 conference audience applause (`cheer.ogg`, license above). It is band-limited for distance, edited with a 1.2-second wrap crossfade, and encoded as MP3. The cheer layer fades with the active emote, alongside the two independently looping real crowd beds; all layers share the ambience toggle, visibility/mute lifecycle and master compressor. It is a short applause recording, not a new long crowd recording. No synthetic audio or runtime hotlinks. Install the two original long beds and Smeemo scream using the previous installer if not already present.

### Theatrical drum cues (install-stage-drums.py)
- `foley/stage-drum-roll.ogg`: [Drum Roll Intro.ogg](https://commons.wikimedia.org/wiki/File:Drum_Roll_Intro.ogg), Iwan Sounds and DIY, CC0 1.0; edited for short attack/end fades, original SHA-1 `e5109afea058cbc4a631fb6d05c72353bfa54ac3`.
- `foley/stage-drum-hit.ogg`: [Snare drum unmuffled.ogg](https://commons.wikimedia.org/wiki/File:Snare_drum_unmuffled.ogg), Clngre~commonswiki, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); first recorded strike trimmed and faded, adapted audio remains CC BY-SA 3.0; original SHA-1 `d8d5767eb1b289f25a8d29d0e53f2522347b6e73`.
- `foley/cheer.ogg` cue continues to use the project's existing `assets/sfx/cheer.ogg` licensed recording; no generated audio.
- Run `python3 ramblegamble/assets/sfx/install-stage-drums.py` from the project root before deployment. If downloads are unavailable, save the exact originals from the Commons pages into a local directory and use `--downloads DIRECTORY`. No drum substitute is played if files are absent.

### VIP doorway ambience

- `foley/vip-water-drips.ogg`: [Water Dripping in Cave.wav — Sclolex, Freesound #177958](https://freesound.org/people/Sclolex/sounds/177958/), 2013-02-12, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Source is a processed recording of dripping water with cave-like echoes, 89.820 seconds, stereo, 48 kHz, 16-bit WAV. Download the original (Freesound login required), then run `python3 ramblegamble/assets/sfx/install-vip-water.py "path/to/Water Dripping in Cave.wav"`. The installer creates an approximately 86.8-second crossfaded, filtered Ogg Vorbis edit; the runtime applies an additional low-pass filter near the doorway. Commit the resulting local asset before deployment. No synthetic fallback is used. Original download unavailable in the patch-building environment; verify the recording by ear after installation.
