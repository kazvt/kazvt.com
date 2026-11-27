# Ramble Gamble local soundtrack

The normal arcade soundtrack uses the following two files beside this README. It never contacts Discord, streams a signed URL, generates substitute music, or plays both songs at once.

| Local filename | Game context |
| --- | --- |
| `sonic_gammon_leel_theme.mp3` | Overview, contestants, host, Hazel balcony, Slots |
| `sonic_no_daifuugou_title_theme.mp3` | Card table/menu, BerryBlast, Red-Handed, Shop, Roulette, associated trivia stage |

Dice and the VIP doorway have no soundtrack; Smeemo uses the separate ambience described below. The title/pause menu retains its original marquee audio, then plays the separate menu theme described below; the normal arcade tracks start only in the actual arcade. Existing room ambience and gameplay sound effects are independent of the music player. The existing Game sounds checkbox mutes the soundtrack too. Both tracks loop at an initial conservative 20% volume with a 300 ms incoming ramp; changes stop the previous track first. Shared contexts do not restart their song.

The two MP3s were requested by the project owner via Discord attachments, but could not be retrieved in the editing environment (DNS/download failure). The patch does **not** contain either recording. Use the original attachments in Discord to obtain fresh links if needed. Only install/publish recordings you have the rights to use.

## Installation

Save both original MP3 files into this directory with the exact filenames shown above, or run the optional installer from the project root on an internet-connected machine with Python 3 and ffprobe installed:

```sh
python3 ramblegamble/assets/music/install-soundtrack.py
```

Paste the two current attachment URLs at the prompts. Alternatively, if you've already downloaded the two original files to a local directory:

```sh
python3 ramblegamble/assets/music/install-soundtrack.py --downloads /path/to/downloads
```

The installer checks both inputs contain MP3 audio with a positive reported duration before replacing either file. It copies the recordings unchanged. Refresh the host arcade after installing; missing/invalid tracks fail silently in the game (with a developer-console warning for media errors). No substitute music is used. Deploy both files with the static site if hosted remotely. The host console and private player pages do not start the soundtrack.

## Smeemo encounter and table ambience
The project owner's original `smeemo_ambiance.mp3` (44.16 seconds, stereo MP3) is bundled unchanged. It replaces the previous optional `smeemo_theme.mp3`. It loops on the same exclusive soundtrack player, from click 1, pauses for the stinger's own audio, resumes during the return to the table, and continues during the Smeemo game until its committed completion/reset. Leaving the table pauses this track; returning to the pending encounter/table game resumes the saved position. Other game modes retain their usual music. The shared mute, hidden tab, pause menu and VIP/Dice rules take priority.

Ambient stage deformation and card rotation read one absolute playback clock; no wall-time fallback or per-prop phase offsets. Only the normal general and cards tracks drive dance, and not the horror ambience. `DANCE_TRACKS` in `stage-dance.mjs` defines the BPM and downbeat offset (seconds). The current 120 BPM defaults are unmeasured because the two Sonic files are not supplied; tune these against the original recordings for exact beat alignment.

## Title / pause menu theme

`ramble-gamble-theme.mp3` is the owner-supplied original stereo MP3 (198.288 seconds), bundled unchanged. At each opening of the Play screen, the one-shot marquee plays first; its ended event starts the theme at 20% volume with native looping. If the video fails or stalls, the theme starts once the fallback sign settles. The theme pauses while hidden, locked, suspended or in Controls and resumes at the same position; closing the menu (PLAY or direct game entry) pauses and rewinds before the normal arcade soundtrack starts. The shared Game sounds & music toggle also mutes it. If autoplay is blocked, a trusted gesture retries playback. No theme is played on the initial READY screen or host console/player pages.
