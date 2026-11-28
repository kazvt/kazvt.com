# Ramble Gamble menu karaoke

## Recording and cue format

`assets/music/ramble-gamble-theme.mp3` is the original, unchanged menu recording: 198.288 seconds, SHA-256 `7485aa4feaf5557e2688b1ecf4fe448d96ec7e33d2388842096cd4d319258ec5`. The cue sheet retains all 240 supplied lyric tokens as 190 lead words and 50 backing words. Lead and backing are separate timed tracks so a backing response can begin before the lead line has finished. Instrumental sections remain lyric-free.

Every word is a `[text, startSeconds, endSeconds]` tuple on the original audio clock. Cue/word validation checks bounds and order; backing phrases have their own bounds and may overlap the lead or other phrases. Structural validation is not proof that a timestamp matches the recording.

## Why synchronization could look wrong

The playback clock was already `theme.currentTime`; it was not a separate timer gradually drifting away from the MP3. The larger error was the cue model: parenthetical backing parts were mixed into one sequential word list. A single current-word cursor cannot display simultaneous singers, so one voice was necessarily shown late or displaced. Some sung words and scat are also hard to time with speech-recognition aligners, especially short syllables and long melismas.

The current pass separates lead and response timings. Word onsets combine a separated-vocal transcript and local CTC alignment, with selected corrections for clearly inconsistent outputs. This improves alignment evidence and correctly represents overlap, but remains an acoustic estimate. The scat ending and some sustained syllables need human listening review; no “perfect” or human-certified sync claim is made.

## Correcting word timings

Open `/ramblegamble/tools/menu-karaoke-timing.html` over the existing local/deployed static server. Choose a phrase and `Lead` or `Backing`, play slowly, then tap each word onset and tap once after the last word to close it. Individual word start/end fields and phrase bounds can also be edited. Lead and backing may overlap. `Apply timing to this browser` saves a validated override for this exact recording and origin only; export downloads a cue module. Neither action changes the MP3 or writes to a server.

When adding another backing phrase to a cue, preserve its own `start`, `end`, and ordered `words`. Calibration rejects edits that change lyrics, voice assignment, response count, or section names. If a lead phrase is shifted, check adjacent cue bounds before applying.

## Optional offline lead realignment

`tools/align-menu-karaoke.py` can generate an untrusted candidate for the 190 lead words. It verifies the MP3 SHA-256 and, when a vocal stem is supplied, checks duration. It preserves backing phrases unchanged because a single lead transcript cannot safely align overlapping responses. Independent ASR comparisons are diagnostics only; a near match does not certify the lyric onset. Inspect and listen to the candidate in the timing editor before applying it.

The optional authoring environment is not a website dependency. With Python 3.10-3.12, FFmpeg, and Faster-Whisper already installed/cached on Windows:

```powershell
py -3.10 -m venv --system-site-packages "$env:LOCALAPPDATA\RambleGambleKaraoke\venv"
& "$env:LOCALAPPDATA\RambleGambleKaraoke\venv\Scripts\python.exe" -m pip install "stable-ts[fw]"
& "$env:LOCALAPPDATA\RambleGambleKaraoke\venv\Scripts\python.exe" ramblegamble\tools\align-menu-karaoke.py --backend faster-whisper --model small.en --device cuda --output "$env:LOCALAPPDATA\RambleGambleKaraoke\alignment"
```

The tool writes an alignment candidate and review diagnostics only; it never edits live cues automatically. A Demucs vocal stem is an optional alignment aid, not ground truth, and must preserve the source start/sample alignment. Do not replace or re-encode the song as part of timing calibration.

## Runtime behavior

The marquee lifecycle controls visibility and the existing menu MP3 remains the sole clock. On each existing animation frame, word fills are derived from `theme.currentTime`, so pause, playback-rate changes, seeking, loop wrap, tab resume, and the menu's normal audio lifecycle do not accumulate an independent timer error. Lead and backing highlight separately and can overlap; the marker follows lead when it is active and backing during lead gaps. No recognition model or extra player runs in the browser. Reduced-motion and forced-colors styling remain supported.

## Design/research basis

Music-aware alignment work notes that speech aligners do not model sung pitch/phoneme timing well; vocal boundary and pitch cues can help. Karaoke alignment pipelines commonly combine source/vocal separation, lyric recognition and forced alignment, with manual review for errors. These approaches are useful evidence, not a substitute for checking against the recording:

- Huang et al., [Improving Lyrics Alignment through Joint Pitch Detection](https://qmro.qmul.ac.uk/xmlui/bitstream/handle/123456789/76603/Huang%20Improving%20lyrics%20Alignment%202022%20Accepted.pdf?isAllowed=y&sequence=10)
- Dzhambazov et al., [Lyrics to Audio Alignment for Karaoke in Pop Music](https://www.music-ir.org/mirex/abstracts/2017/DMS2.pdf)
- [Automatic Recognition of Lyrics in Singing](https://link.springer.com/article/10.1155/2010/546047)
- [MIREX Lyrics-to-Audio Alignment task](https://music-ir.org/mirex/wiki/2024%3ALyrics-to-Audio_Alignment)
- [Demucs](https://github.com/facebookresearch/demucs), for optional source separation
- W3C [Media Timed Events](https://www.w3.org/TR/media-timed-events/) and MDN [`HTMLMediaElement.currentTime`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime), for media-clock synchronization
