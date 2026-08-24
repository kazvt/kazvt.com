WIFEY MIX-8 — AGC / AUTO-GAIN COMPENSATION

The bundled MP3 playlist stems were scanned offline. Their measured full-file RMS
levels are stored in auto-gain-references.js.

AUDIO FILES
-----------
AGC computes the arithmetic mean of all documented stem reference levels
(measuredDb + adjustDb). That library mean is the common loudness anchor. Each
audio strip receives a static pre-TRIM / pre-fader correction 82% of the way
toward that mean, capped at +/-12 dB so role differences are not completely
flattened.

A second correction follows only broad changes inside a file:
  * 10-second RMS analysis window
  * about 0.9 seconds between updates
  * 1.15 dB dead-band
  * maximum dynamic correction +/-2.5 dB
  * about 5.5-second reductions and 9.5-second lifts

This is intentionally not compressor behavior. Short notes, drum hits, attacks
and phrases do not directly drive gain; only sustained multi-second loudness
changes produce a small, smooth correction.

MIDI FILES
----------
MIDI has no uploaded waveform reference. AGC finds the authored/default SoundFont
instrument and measures middle C (MIDI note 60). If that preset has no playable
layer on C, it searches outward semitone-by-semitone and uses the nearest playable
note. The note is rendered at a fixed velocity/duration and its RMS becomes the
MIDI reference. If a different patch is selected, that patch is measured the same
way, so patch changes can be level-matched without analysing/compressing the MIDI
performance itself.

TUNING AUDIO REFERENCES
-----------------------
Do not change measuredDb unless replacing the scan. Change adjustDb instead:

    adjustDb: +1.5   treats that stem as 1.5 dB louder than the scan
    adjustDb: -2.0   treats that stem as 2.0 dB quieter than the scan
    adjustDb:  0.0   uses the measured level exactly

peakDb remains informational only.

UI / SIGNAL ORDER
-----------------
AGC is before TRIM and before the channel fader. It is session-only and starts ON
on every page load. The key is labelled "AGC" in the bottom-left of each channel's
fader area. Hovering it shows exactly "AUTO-GAIN COMPENSATION".
