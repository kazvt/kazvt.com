export const secrets = {
  title: "i'm monkey",
  motion: {
    fps: 60
  },
  music: {
    repository: "kazvt/kazvt.com",
    branch: "main",
    path: "newdesign/assets/music"
  },
  marquee: {
    marquees: [
      {
        path: "newdesign/assets/marquee",
        direction: "horizontal",
        y: 100,
        blinkMs: 0,
        speedSeconds: 24,
        height: 34,
        gaps: 15,
        z: 0
      },
      {
        path: "newdesign/assets/marquee",
        direction: "vertical",
        x: 0,
        blinkMs: 0,
        speedSeconds: 18,
        height: 34,
        gaps: 8,
        z: 1
      }
    ]
  },
  randomGifs: {
    path: "newdesign/assets/randomGifs",
    spawnEveryMs: 500,
    initialDelayMs: 1200,
    maxOnScreen: 10,
    minHeight: 250,
    maxHeight: 450,
    holdMs: 0
  }
};
