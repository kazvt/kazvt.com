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
    spawnEveryMs: 250,
    initialDelayMs: 1200,
    maxOnScreen: 35,
    minHeight: 150,
    maxHeight: 250,
    holdMs: 0,
    settleInMs: 1000,
    settleOutMs: 700,
    shadows: [
      { x: 15, y: 15, blur: 0, color: "#000000" },
      { x: 10, y: 10, blur: 0, color: "#FFFFFF" },
      { x: 10, y: 10, blur: 0, color: "#A20161" },
      { x: 10, y: 10, blur: 0, color: "#D161A2" },
      { x: 10, y: 10, blur: 0, color: "#D42C00" },
      { x: 10, y: 10, blur: 0, color: "#FD9855" },
      { x: 10, y: 10, blur: 0, color: "#5BCEFA" },
      { x: 10, y: 10, blur: 0, color: "#F5A9B8" },
      {
        layers: [
          { x: 30, y: 30, blur: 0, color: "#000000" },
          { x: 20, y: 20, blur: 0, color: "#5BCEFA" },
          { x: 10, y: 10, blur: 0, color: "#F5A9B8" }
        ]
      }
    ]
  },


  cursorSparkles: {
    enabled: true,
    amount: 3,
    move: {
      size: 22,
      amount: 1,
      colors: ["#5BCEFA", "#F5A9B8", "#ffffff", "#F5A9B8", "#5BCEFA"],
      symbols: ["✦"]
    },
    drag: {
      size: 34,
      intensity: 4,
      colors: ["#D42C00", "#FD9855", "#FFFFFF", "#D161A2", "#A20161"],
      symbols: ["✦", "✧", "★"]
    }
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
      style: "avs",
      width: "15%",
      height: "100%",
      y: 0,
      smoothing: 0.1,
      z: 0,
      background: false,
      frequencyRange: [20, 500],
      colors: {
        waveA: "#F5A9B8",
        waveB: "#5BCEFA",
        barA: "#F5A9B8",
        barB: "#5BCEFA",
        border: "#ffffff",
        innerBorder: "#4b4b4b"
      }
    },
    {
      id: "avs-top",
      enabled: true,
      edge: "top",
      style: "bars",
      width: "100%",
      height: "25%",
      smoothing: 0.1,
      z: 3,
      background: false,
      frequencyRange: [20, 6000],
      colors: {
        low: "#5BCEFA",
        mid: "#F5A9B8",
        high: "#ffffff",
        border: "#b9b9b9",
        innerBorder: "#4b4b4b"
      }
    },
    {
      id: "scope-bottom",
      enabled: true,
      edge: "bottom",
      style: "avs",
      width: "100%",
      height: "30%",
      z: 6,
      smoothing: 0.1,
      fftSize: 1024,
      background: false,
      frequencyRange: [20, 7000],
      colors: {
        low: "#D42C00",
        mid: "#D42C00",
        high: "#D42C00",
        grid: "rgba(0,0,0,0)",
        border: "#b9b9b9",
        innerBorder: "#4b4b4b"
      }
    },
    {
      id: "scope-bottom2",
      enabled: true,
      edge: "bottom",
      style: "avs",
      width: "100%",
      height: "28%",
      z: 6,
      smoothing: 0.1,
      fftSize: 1024,
      background: false,
      frequencyRange: [20, 6500],
      colors: {
        low: "#FD9855",
        mid: "#FD9855",
        high: "#FD9855",
        grid: "rgba(0,0,0,0)",
        border: "#b9b9b9",
        innerBorder: "#4b4b4b"
      }
    },
    {
      id: "scope-bottom3",
      enabled: true,
      edge: "bottom",
      style: "avs",
      width: "100%",
      height: "26%",
      z: 6,
      smoothing: 0.1,
      fftSize: 1024,
      background: false,
      frequencyRange: [20, 6000],
      colors: {
        low: "#FFFFFF",
        mid: "#FFFFFF",
        high: "#FFFFFF",
        grid: "rgba(0,0,0,0)",
        border: "#b9b9b9",
        innerBorder: "#4b4b4b"
      }
    },
    {
      id: "scope-bottom4",
      enabled: true,
      edge: "bottom",
      style: "avs",
      width: "100%",
      height: "24%",
      z: 6,
      smoothing: 0.1,
      fftSize: 1024,
      background: false,
      frequencyRange: [20, 5500],
      colors: {
        low: "#D161A2",
        mid: "#D161A2",
        high: "#D161A2",
        grid: "rgba(0,0,0,0)",
        border: "#b9b9b9",
        innerBorder: "#4b4b4b"
      }
    },
    {
      id: "scope-bottom5",
      enabled: true,
      edge: "bottom",
      style: "avs",
      width: "100%",
      height: "22%",
      z: 6,
      smoothing: 0.1,
      fftSize: 1024,
      background: false,
      frequencyRange: [20, 5000],
      colors: {
        low: "#A20161",
        mid: "#A20161",
        high: "#A20161",
        grid: "rgba(0,0,0,0)",
        border: "#b9b9b9",
        innerBorder: "#4b4b4b"
      }
    }
  ]
};
