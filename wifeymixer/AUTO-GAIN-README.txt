WIFEY MIX-8 — AUTO GAIN REFERENCE CALIBRATION

The bundled MP3 playlist stems were scanned offline. Their measured full-file RMS levels are stored in:

    auto-gain-references.js

Each stem looks like:

    "folder/stem.mp3": { measuredDb: -24.334, adjustDb: 0.0, peakDb: -5.223 }

HOW TO TUNE A STEM LATER
------------------------
Do not change measuredDb unless you intentionally want to replace the scan result.
Change adjustDb instead:

    adjustDb: +1.5   makes AUTO GAIN target that stem 1.5 dB louder
    adjustDb: -2.0   makes AUTO GAIN target that stem 2.0 dB quieter
    adjustDb:  0.0   uses the offline measured level exactly

The mixer uses:

    effectiveReferenceDb = measuredDb + adjustDb

peakDb is included only as useful scan information and is not used by AUTO GAIN.

AUTO GAIN remains pre-TRIM and pre-channel-fader. TRIM and the strip volume fader therefore still act after compensation. If a file is not listed, the mixer's existing runtime measurement remains the fallback.
