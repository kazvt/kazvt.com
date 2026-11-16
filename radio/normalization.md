# Radio loudness settings

`normalization.json` controls playback normalization without changing or re-encoding the audio files.

- `defaultMode` is `loudness` for tracks unless a track overrides it. `peak` matches peak level instead; `off` leaves the file untouched.
- `targetLufs` sets the integrated-loudness target (currently -16 LUFS).
- `truePeakCeilingDbtp` prevents gain from pushing a track above the selected true-peak ceiling (currently -1.5 dBTP).
- `maximumGainDb` limits boosts for very quiet files.
- `tracks` is keyed by a path relative to `radio/assets`, such as `tracks/example.mp3`. Each entry can set `mode`, `targetLufs`, `truePeakCeilingDbtp`, or `maximumGainDb` to override the global value for only that file.

Example per-track override:

```json
"tracks/example.mp3": {
  "mode": "peak",
  "integratedLufs": -19.4,
  "truePeakDbtp": -2.1
}
```

The analyzer uses FFmpeg's `loudnorm` measurement pass to save integrated LUFS and true-peak data for all active tracks. It does not write to the MP3s:

```powershell
node scripts/analyze-radio-loudness.mjs
node scripts/build-radio-playlist.mjs
```

After adding files, run those commands in order. Unmeasured tracks intentionally play at their source level until analyzed. Loudness mode is gain-only, so a track with unusually high peaks may remain below the target rather than being compressed.
