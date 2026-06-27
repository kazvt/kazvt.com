export const home = {
  art: {
    src: "assets/img/art.png",
    alt: "Anime character standing beside the welcome window"
  },
  notepad: {
    title: "welcome.txt - Notepad",
    menus: ["File", "Edit", "Format", "View", "Help"],
    status: ["Ready", "Windows XP", "Ln 1", "Col 1"],
    text: "Hello, visitor!\n\nWelcome to my little corner of the old internet.\n\nThis page is built like a Windows XP desktop, with the Notepad window structure handled by XP.css.\n\nThe character on the right is loaded from assets/img/art.png, so you can swap that file whenever you want.\n\nEnjoy your stay."
  },
  music: {
    volume: 0.5
  },
  motion: {
    fps: 24
  },
  edgePeek: {
    src: "assets/img/osaka.gif",
    alt: "Osaka peeking from the desktop edge",
    intervalMs: 10000,
    visibleMs: 3000,
    motionMs: 750,
    fps: 24
  },
  imageMarquee: {
    manifest: "assets/marquee/manifest.json",
    path: "assets/marquee",
    direction: "horizontal",
    y: 100,
    blinkMs: 1000,
    speedSeconds: 24,
    height: 34,
    gaps: 0,
    fps: 24
  },
  randomGifs: {
    manifest: "assets/randomGifs/manifest.json",
    path: "assets/randomGifs",
    spawnEveryMs: 8500,
    initialDelayMs: 1200,
    maxOnScreen: 3,
    minHeight: 46,
    maxHeight: 116,
    holdMs: 1300,
    fps: 24
  },
  cursorSparkles: {
    enabled: true,
    move: {
      colors: ["#ffff00", "#ff66ff", "#66ffff", "#ffffff", "#00ff66"],
      symbols: ["✦"],
      layers: 1
    },
    drag: {
      colors: ["#ffffff", "#ffff00", "#ff00ff", "#00ffff", "#ff9900"],
      symbols: ["✦", "✧", "★"],
      layers: 2
    }
  },
  taskbar: {
    startLabel: "Start",
    activeTitle: "welcome.txt - Notepad",
    trayIcons: [
      { id: "tour", label: "Take a tour of Windows XP" },
      { id: "security", label: "Security alert" },
      { id: "volume", label: "Volume" }
    ]
  }
};
