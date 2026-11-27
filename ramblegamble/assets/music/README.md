# Ramble Gamble local soundtrack

The runtime uses the two owner-supplied tracks and the encounter-specific Smeemo track below. Playback uses only local files; it never contacts Discord, streams signed URLs, generates substitute music, or plays two songs at once.

| Local filename | Game context |
| --- | --- |
| `sonic_gammon_leel_theme.mp3` | Overview, contestants, host, Hazel balcony, Slots |
| `sonic_no_daifuugou_title_theme.mp3` | Card table/menu, BerryBlast, Red-Handed, Shop, Roulette, associated trivia stage |
| `smeemo_theme.mp3` | Hidden Smeemo encounter reveal; not ordinary Smeemo Scramble |

Dice and the VIP doorway have no soundtrack. The title/pause menu retains its original marquee audio, and arcade music starts only in the actual game. The special Smeemo encounter uses its own track from the reveal through the table spotlight; ordinary Smeemo Scramble stays music-free. Room ambience and gameplay effects remain independent of the music player. The existing Game sounds checkbox mutes the soundtrack too. All three tracks loop at an initial conservative 20% volume with a 300 ms incoming ramp; changes stop the previous track first. Shared contexts do not restart their song.

The two owner-supplied MP3s are installed beside this README in the current source tree and were validated as nonempty MP3 audio. The installer below remains available if those local files need to be rebuilt from the originals. Only install or publish recordings you have the rights to use.

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

## Smeemo encounter theme (installed)
The hidden spectator encounter uses `smeemo_theme.mp3` from click 2 through the table spotlight, except during the stinger. It is [Evening of Chaos by Kevin MacLeod](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300041), downloaded unchanged from [Incompetech](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Evening%20of%20Chaos.mp3) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution: “Evening of Chaos” Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0 License. The MP3 is installed locally and checksum-validated; `python3 ramblegamble/assets/music/install-smeemo-theme.py --check` verifies it without downloading, while omitting `--check` installs the verified original. No edits were made. The separate stinger is optional and retains its existing graceful fallback.
