// ============================================================
// KAZVT LINKS — EDIT THIS FILE
// ============================================================
// Change your profile/invite URLs and redirect-page text here.
//
// For a clean short URL such as kazvt.com/bsky:
//   1. copy the /bsky/ folder
//   2. rename the copy to the short name you want (example: /twitch/)
//   3. make sure an entry with that same key exists below
//
// The folder's index.html does NOT need editing; it reads its folder name.
// delayMs controls how long the pretty transition stays onscreen.
// shortPath makes the matching link on the main site use that clean path.
// ============================================================

window.KAZVT_LINKS = {
  twitch: {
    label: "Twitch",
    url: "https://www.twitch.tv/kazvt",
    liveUrl: "https://www.twitch.tv/kazvt",
    redirectText: "tuning into twitch...",
    destinationText: "twitch.tv",
    delayMs: 1000
  },

  kick: {
    label: "Kick",
    url: "https://kick.com/kazvt",
    redirectText: "kicking open the next page...",
    destinationText: "kick.com",
    delayMs: 1000
  },

  youtube: {
    label: "YouTube",
    url: "https://www.youtube.com/@kazvt",
    liveUrl: "https://www.youtube.com/@kazvt/live",
    redirectText: "loading the video portal...",
    destinationText: "youtube.com",
    delayMs: 1000
  },

  discord: {
    label: "Discord",
    url: "https://discord.com/invite/huzMpfJZ4J",
    redirectText: "connecting to the discord...",
    destinationText: "discord.com",
    delayMs: 1000
  },

  tumblr: {
    label: "Tumblr",
    url: "https://www.tumblr.com/kazvt",
    redirectText: "tumbling into the next page...",
    destinationText: "tumblr.com",
    delayMs: 1000
  },

  bsky: {
    label: "BSky",
    url: "https://bsky.app/profile/kazvt.com",
    redirectText: "opening the blue sky...",
    destinationText: "bsky.app",
    delayMs: 1000,

    // This is the included working example: kazvt.com/bsky
    // Remove this line if you want the main-site BSky button to use
    // the generic redirect.html page instead.
    shortPath: "bsky"
  },

  twitter: {
    label: "Twitter",
    url: "https://twitter.com/monkevt",
    redirectText: "flying over to twitter...",
    destinationText: "twitter.com",
    delayMs: 1000
  },

  wife: {
    label: "my wife",
    url: "https://lillie.garden/",
    redirectText: "visiting the garden...",
    destinationText: "lillie.garden",
    delayMs: 1000
  }
};
