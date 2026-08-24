// Wifey Mix-8 — offline AUTO GAIN reference scan
// Generated from the bundled MP3 stems using full-file RMS level (dBFS).
//
// EDITING: leave measuredDb alone and change adjustDb if a stem feels wrong.
//   adjustDb: +1.5  => AUTO GAIN targets 1.5 dB louder than the scan
//   adjustDb: -2.0  => AUTO GAIN targets 2.0 dB quieter than the scan
// The effective reference used by the mixer is measuredDb + adjustDb.
// peakDb is informational only and is not used for gain matching.
window.WIFEY_AUTO_GAIN_REFERENCES = {
  scanMethod: "FFmpeg astats full-file RMS dBFS",
  stems: {
    // lillie_track_10
    "lillie_track_10/bass.mp3": { measuredDb: -22.185, adjustDb: 0.0, peakDb: -8.604 },
    "lillie_track_10/drums.mp3": { measuredDb: -23.561, adjustDb: 0.0, peakDb: -3.385 },
    "lillie_track_10/keys.mp3": { measuredDb: -26.499, adjustDb: 0.0, peakDb: -6.813 },
    "lillie_track_10/shakers.mp3": { measuredDb: -42.358, adjustDb: 0.0, peakDb: -20.074 },
    "lillie_track_10/synth lead.mp3": { measuredDb: -27.180, adjustDb: 0.0, peakDb: -12.830 },

    // lillie_track_3
    "lillie_track_3/bass.mp3": { measuredDb: -24.334, adjustDb: 0.0, peakDb: -5.223 },
    "lillie_track_3/drums.mp3": { measuredDb: -22.088, adjustDb: 0.0, peakDb: -1.998 },
    "lillie_track_3/guitar.mp3": { measuredDb: -32.066, adjustDb: 0.0, peakDb: -13.116 },
    "lillie_track_3/keys.mp3": { measuredDb: -37.442, adjustDb: 0.0, peakDb: -15.338 },
    "lillie_track_3/organ.mp3": { measuredDb: -35.909, adjustDb: 0.0, peakDb: -16.233 },
    "lillie_track_3/synth melody.mp3": { measuredDb: -34.267, adjustDb: 0.0, peakDb: -18.018 },

    // lillie_track_6
    "lillie_track_6/bass.mp3": { measuredDb: -24.446, adjustDb: 0.0, peakDb: -13.063 },
    "lillie_track_6/drums.mp3": { measuredDb: -21.248, adjustDb: 0.0, peakDb: -1.831 },
    "lillie_track_6/guitar.mp3": { measuredDb: -28.859, adjustDb: 0.0, peakDb: -9.798 },
    "lillie_track_6/strings.mp3": { measuredDb: -44.729, adjustDb: 0.0, peakDb: -28.996 },
    "lillie_track_6/vibes.mp3": { measuredDb: -34.812, adjustDb: 0.0, peakDb: -21.322 },
    "lillie_track_6/yamaha synth.mp3": { measuredDb: -30.326, adjustDb: 0.0, peakDb: -19.128 },

    // midi_lillie_3
    "midi_lillie_3/bass.mp3": { measuredDb: -24.334, adjustDb: 0.0, peakDb: -5.223 },
    "midi_lillie_3/drums.mp3": { measuredDb: -22.088, adjustDb: 0.0, peakDb: -1.998 },
    "midi_lillie_3/guitar.mp3": { measuredDb: -32.066, adjustDb: 0.0, peakDb: -13.116 },
    "midi_lillie_3/keys.mp3": { measuredDb: -37.442, adjustDb: 0.0, peakDb: -15.338 },
    "midi_lillie_3/organ.mp3": { measuredDb: -35.909, adjustDb: 0.0, peakDb: -16.233 },

    // midi_lillie_6
    "midi_lillie_6/bass.mp3": { measuredDb: -24.446, adjustDb: 0.0, peakDb: -13.063 },
    "midi_lillie_6/drums.mp3": { measuredDb: -21.248, adjustDb: 0.0, peakDb: -1.831 },
    "midi_lillie_6/guitar.mp3": { measuredDb: -28.859, adjustDb: 0.0, peakDb: -9.798 },
    "midi_lillie_6/strings.mp3": { measuredDb: -44.729, adjustDb: 0.0, peakDb: -28.996 },
    "midi_lillie_6/vibes.mp3": { measuredDb: -34.812, adjustDb: 0.0, peakDb: -21.322 },

    // sonic no 7 narabe main theme
    "sonic no 7 narabe main theme/bass.mp3": { measuredDb: -30.348, adjustDb: 0.0, peakDb: -16.776 },
    "sonic no 7 narabe main theme/drums.mp3": { measuredDb: -32.322, adjustDb: 0.0, peakDb: -9.060 },
    "sonic no 7 narabe main theme/keys.mp3": { measuredDb: -30.352, adjustDb: 0.0, peakDb: -11.163 },

    // sonic no daifuugou main theme
    "sonic no daifuugou main theme/bass.mp3": { measuredDb: -22.982, adjustDb: 0.0, peakDb: -10.998 },
    "sonic no daifuugou main theme/drum.mp3": { measuredDb: -36.917, adjustDb: 0.0, peakDb: -5.651 },
    "sonic no daifuugou main theme/keys.mp3": { measuredDb: -26.421, adjustDb: 0.0, peakDb: -7.621 },

    // sonic no daifuugou title theme
    "sonic no daifuugou title theme/bass.mp3": { measuredDb: -25.051, adjustDb: 0.0, peakDb: -9.992 },
    "sonic no daifuugou title theme/drum.mp3": { measuredDb: -36.706, adjustDb: 0.0, peakDb: -6.454 },
    "sonic no daifuugou title theme/keys.mp3": { measuredDb: -29.906, adjustDb: 0.0, peakDb: -10.436 },

    // sonic reversi hyper easy battle
    "sonic reversi hyper easy battle/bass.mp3": { measuredDb: -28.335, adjustDb: 0.0, peakDb: -12.653 },
    "sonic reversi hyper easy battle/drums.mp3": { measuredDb: -35.937, adjustDb: 0.0, peakDb: -13.806 },
    "sonic reversi hyper easy battle/keys.mp3": { measuredDb: -30.881, adjustDb: 0.0, peakDb: -12.268 },
  },
  voices: {
    // Optional manual SoundFont reference overrides can be added here.
    // Example: "sf64:0:67": { measuredDb: -18.0, adjustDb: 0.0 }
  }
};
