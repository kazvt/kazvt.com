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
        x: 100,
        blinkMs: 0,
        speedSeconds: 18,
        height: 34,
        gaps: 15,
        z: 2
      },
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
    settleOutMs: 700,
    shadows: [
      { x: 15, y: 15, blur: 0, color: "#000000" },
      { x: 10, y: 10, blur: 0, color: "#ff00ff" },
      {
        layers: [
          { x: 15, y: 15, blur: 0, color: "#00ffff" },
          { x: 22, y: 22, blur: 0, color: "#000000" }
        ]
      }
    ]
  },
  cursorSparkles: {
    enabled: true,
    colors: ["#5BCEFA", "#F5A9B8", "#ffffff", "#F5A9B8", "#5BCEFA"],
    symbols: ["✦", "K", "A", "Z"],
    dragColors: ["#D42C00", "#FD9855", "#FFFFFF", "#D161A2", "#A20161"],
    dragSymbols: ["✦", "✧", "★", "K", "A", "Z"],
    dragLayers: 5
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
  },
  // bars, scope, avs
  musicVisualizers: [
    {
      id: "bass-left",
      enabled: true,
      edge: "left",
      style: "bars",
      width: "8%",
      height: "80%",
      y: 50,
      z: 0,
      background: false,
      frequencyRange: [20, 500]
    },
    {
      id: "avs-bottom",
      enabled: true,
      edge: "bottom",
      style: "avs",
      width: "100%",
      height: "16%",
      x: 50,
      z: 3,
      background: false,
      frequencyRange: [20, 8000]
    },
    {
      id: "scope-top",
      enabled: true,
      edge: "top",
      style: "scope",
      width: "100%",
      height: "10%",
      z: 6,
      background: true,
      frequencyRange: [20, 15000]
    }
  ]
};
