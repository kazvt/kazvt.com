# Radio loudness settings

`normalization.json` controls playback normalization without changing or re-encoding the audio files.

- `defaultMode` is `loudness` for tracks unless a track overrides it. `peak` matches peak level instead; `off` leaves the file untouched.
- `targetLufs` sets the integrated-loudness target (currently -16 LUFS).
- `truePeakCeilingDbtp` sets the peak ceiling for peak mode (currently -1.5 dBTP).
- `peakGuardMarginDb` sets how far below that ceiling the browser's soft peak guard starts compressing in loudness mode (currently 1.5 dB).
- `maximumGainDb` limits boosts for very quiet files.
- `tracks` is keyed by a path relative to `radio/assets`, such as `tracks/example.mp3`. Each entry can set `mode`, `targetLufs`, `truePeakCeilingDbtp`, `peakGuardMarginDb`, or `maximumGainDb` to override the global value for only that file.

Example per-track override:

```json
"tracks/example.mp3": {
  "mode": "peak",
  "integratedLufs": -19.4,
  "truePeakDbtp": -2.1
}
```

The analyzer uses FFmpeg's `loudnorm` measurement pass to save integrated LUFS and true-peak data for all active tracks. Loudness mode applies measured LUFS gain, then uses the browser's built-in DynamicsCompressorNode only if peaks need reining in; peak mode uses gain-only peak matching. No audio files are rewritten. The browser compressor is a soft guard, not a mastering-grade true-peak limiter, so its exact result can vary slightly by browser:

```powershell
node scripts/analyze-radio-loudness.mjs
node scripts/build-radio-playlist.mjs
```

After adding files, run those commands in order. Unmeasured tracks intentionally play at their source level until analyzed.
