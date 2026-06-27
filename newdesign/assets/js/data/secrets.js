export const secrets = {
  title: "i'm monkey",
  motion: {
    fps: 24
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
        gaps: 15,
        z: 1
      },
      {
        path: "newdesign/assets/marquee",
        direction: "vertical",
        x: 100,
        blinkMs: 0,
        speedSeconds: 18,
        height: 34,
        gaps: 15,
        z: 2
      },
      {
        path: "newdesign/assets/marquee",
        direction: "horizontal",
        y: 0,
        blinkMs: 5,
        speedSeconds: 18,
        height: 34,
        gaps: 15,
        z: 3
      }
    ]
  },
  randomGifs: {
    path: "newdesign/assets/randomGifs",
    spawnEveryMs: 500,
    initialDelayMs: 1200,
    maxOnScreen: 25,
    minHeight: 150,
    maxHeight: 250,
    holdMs: 0,
    settleInMs: 1000,
    settleOutMs: 700
  }
};
