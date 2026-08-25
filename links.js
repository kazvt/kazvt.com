// ============================================================
// KAZVT REDIRECTS — EDIT EVERY DESTINATION / SHORT PATH / LOGO HERE
// ============================================================
// All user-visible copy belongs in the active language .txt file.
// `shortPath: "yt"` means kazvt.com/yt/.
// `logo` may point at any local or remote image. If omitted, the redirect
// uses KAZVT_REDIRECT_DEFAULTS.logo.
// After adding/removing a shortPath, run:
//   node zzz_redirect/build-shortlinks.mjs
// The included GitHub workflow also regenerates shortlink folders on push.
// ============================================================

window.KAZVT_REDIRECT_DEFAULTS = {
  delayMs: 1000,
  logo: "/zzz_assets/kazvt-transparent.gif"
};

window.KAZVT_LINKS = {
  twitch: {
    url: "https://www.twitch.tv/kazvt",
    liveUrl: "https://www.twitch.tv/kazvt",
    shortPath: "twitch",
    liveShortPath: "twitch",
    logo: "/zzz_assets/redirect-logos/twitch.gif",
    delayMs: 1000
  },
  kick: {
    url: "https://kick.com/kazvt",
    shortPath: "kick",
    logo: "/zzz_assets/redirect-logos/kick.gif",
    delayMs: 1000
  },
  youtube: {
    url: "https://www.youtube.com/@kazvt",
    liveUrl: "https://www.youtube.com/@kazvt/live",
    shortPath: "yt",
    liveShortPath: "yt-live",
    logo: "/zzz_assets/redirect-logos/youtube.gif",
    delayMs: 1000
  },
  discord: {
    url: "https://discord.com/invite/huzMpfJZ4J",
    shortPath: "discord",
    logo: "/zzz_assets/redirect-logos/discord.gif",
    delayMs: 1000
  },
  tumblr: {
    url: "https://www.tumblr.com/kazvt",
    shortPath: "tumblr",
    logo: "/zzz_assets/redirect-logos/tumblr.gif",
    delayMs: 1000
  },
  bsky: {
    url: "https://bsky.app/profile/kazvt.com",
    shortPath: "bsky",
    logo: "/zzz_assets/redirect-logos/bsky.gif",
    delayMs: 1000
  },
  twitter: {
    url: "https://twitter.com/monkevt",
    shortPath: "twitter",
    logo: "/zzz_assets/redirect-logos/twitter.gif",
    delayMs: 1000
  },
  wife: {
    url: "https://lillie.garden/",
    shortPath: "wife",
    logo: "/zzz_assets/redirect-logos/wife.svg",
    delayMs: 1000
  },

  spotify: {
    url: "https://open.spotify.com/",
    shortPath: "spotify",
    logo: "/zzz_assets/redirect-logos/spotify.svg",
    delayMs: 1000
  },
  apple_music: {
    url: "https://music.apple.com/",
    shortPath: "apple-music",
    logo: "/zzz_assets/redirect-logos/apple-music.svg",
    delayMs: 1000
  },
  obs: {
    url: "https://obsproject.com/",
    shortPath: "obs",
    logo: "/zzz_assets/redirect-logos/obs.svg",
    delayMs: 1000
  },
  obs_multi_rtmp: {
    url: "https://github.com/sorayuki/obs-multi-rtmp",
    shortPath: "obs-multi-rtmp",
    logo: "/zzz_assets/redirect-logos/obs-multi-rtmp.svg",
    delayMs: 1000
  },
  aitum: {
    url: "https://aitum.tv/",
    shortPath: "aitum",
    logo: "/zzz_assets/redirect-logos/aitum.svg",
    delayMs: 1000
  },
  ffmpeg: {
    url: "https://ffmpeg.org/",
    shortPath: "ffmpeg",
    logo: "/zzz_assets/redirect-logos/ffmpeg.svg",
    delayMs: 1000
  },
  meld: {
    url: "https://multi.meldstudio.co/",
    shortPath: "meld",
    logo: "/zzz_assets/redirect-logos/meld.svg",
    delayMs: 1000
  },
  restream: {
    url: "https://restream.io/",
    shortPath: "restream",
    logo: "/zzz_assets/redirect-logos/restream.svg",
    delayMs: 1000
  },
  vps_streaming: {
    url: "https://github.com/kazvt/streamRIP-with-fallback-and-multistreaming",
    shortPath: "vps-streaming",
    logo: "/zzz_assets/redirect-logos/vps-streaming.svg",
    delayMs: 1000
  }
};

