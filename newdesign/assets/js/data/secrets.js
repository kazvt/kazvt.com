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
        blinkMs: 800,
        speedSeconds: 24,
        height: 34,
        gaps: 15,
        z: 0
      },
      {
        path: "newdesign/assets/marquee",
        direction: "vertical",
        x: 0,
        blinkMs: 600,
        speedSeconds: 18,
        height: 34,
        gaps: 15,
        z: 1
      },
      {
        path: "newdesign/assets/marquee",
        direction: "vertical",
        x: 100,
        blinkMs: 400,
        speedSeconds: 18,
        height: 34,
        gaps: 15,
        z: 2
      },
      {
        path: "newdesign/assets/marquee",
        direction: "horizontal",
        y: 0,
        blinkMs: 200,
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
  },
  cursorSparkles: {
    enabled: true,
    colors: ["#5BCEFA", "#F5A9B8", "#ffffff", "#F5A9B8", "#5BCEFA"],
    symbols: ["✦"],
    dragColors: ["#D42C00", "#FD9855", "#FFFFFF", "#D161A2", "#A20161"],
    dragSymbols: ["✦", "✧", "★"],
    dragLayers: 2
  },
  peekGifs: {
    path: "newdesign/assets/peekGifs",
    spawnEveryMs: 2500,
    initialDelayMs: 400,
    visibleMs: 3000,
    motionMs: 750,
    minWidth: 104,
    maxWidth: 178,
    maxOnScreen: 4,
    maxImagesPerEdge: 1,
    gap: 28,
    edges: ["top", "right", "bottom", "left"]
  }
};
