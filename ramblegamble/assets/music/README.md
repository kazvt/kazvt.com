# Ramble Gamble local soundtrack

The runtime uses only these two files beside this README. It never contacts Discord, streams a signed URL, generates substitute music, or plays both songs at once.

| Local filename | Game context |
| --- | --- |
| `sonic_gammon_leel_theme.mp3` | Overview, contestants, host, Hazel balcony, Slots |
| `sonic_no_daifuugou_title_theme.mp3` | Card table/menu, BerryBlast, Red-Handed, Shop, Roulette, associated trivia stage |

Dice, the VIP doorway, and Smeemo have no soundtrack. The title/pause menu retains its original marquee audio, and the new music starts only in the actual arcade. Existing room ambience and gameplay sound effects are independent of the music player. The existing Game sounds checkbox mutes the soundtrack too. Both tracks loop at an initial conservative 20% volume with a 300 ms incoming ramp; changes stop the previous track first. Shared contexts do not restart their song.

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
