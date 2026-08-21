const EDITABLE_LINKS = window.KAZVT_LINKS || {};

function editableLink(key, field, fallback) {
  const value = EDITABLE_LINKS?.[key]?.[field];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function shortPathForDestination(destination) {
  try {
    const target = new URL(destination, window.location.href);
    for (const entry of Object.values(EDITABLE_LINKS)) {
      if (!entry) continue;
      const candidates = [
        [entry.url, entry.shortPath],
        [entry.liveUrl, entry.liveShortPath],
      ];
      for (const [configuredUrl, configuredPath] of candidates) {
        if (!configuredUrl || !configuredPath) continue;
        const configured = new URL(configuredUrl, window.location.href);
        if (configured.href !== target.href) continue;
        const cleanPath = String(configuredPath).trim().replace(/^\/+|\/+$/g, "");
        if (cleanPath) return `/${cleanPath}/`;
      }
    }
  } catch {}
  return "";
}

function outboundHref(destination) {
  try {
    const url = new URL(destination, window.location.href);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin) {
      const shortPath = shortPathForDestination(url.href);
      if (shortPath) return shortPath;
      return url.href;
    }
  } catch {}
  return destination;
}

const streamLinks = [
  {
    key: "twitch",
    label: "",
    href: editableLink("twitch", "url", "https://www.twitch.tv/kazvt"),
    liveHref: editableLink("twitch", "liveUrl", "https://www.twitch.tv/kazvt"),
    icon: "twitch",
    note: "",
    status: "offline",
    color: "#d9c5ff",
  },
  {
    key: "kick",
    label: "",
    href: editableLink("kick", "url", "https://kick.com/kazvt"),
    icon: "kick",
    note: "",
    status: "offline",
    color: "#c8ffc9",
  },
  {
    key: "youtube",
    label: "",
    href: editableLink("youtube", "url", "https://www.youtube.com/@kazvt"),
    liveHref: editableLink("youtube", "liveUrl", "https://www.youtube.com/@kazvt/live"),
    icon: "youtube",
    note: "",
    status: "offline",
    color: "#ffc6b7",
  },
];

const socialLinks = [
  {
    key: "discord",
    label: "",
    href: editableLink("discord", "url", "https://discord.com/invite/huzMpfJZ4J"),
    icon: "discord",
    note: "",
    color: "#ffc7ee",
  },
  {
    key: "tumblr",
    label: "",
    href: editableLink("tumblr", "url", "https://www.tumblr.com/kazvt"),
    icon: "tumblr",
    note: "",
    color: "#d8d4ff",
  },
  {
    key: "bsky",
    label: "",
    href: editableLink("bsky", "url", "https://bsky.app/profile/kazvt.com"),
    icon: "bsky",
    note: "",
    color: "#bde8ff",
  },
  {
    key: "twitter",
    label: "",
    href: editableLink("twitter", "url", "https://twitter.com/monkevt"),
    icon: "twitter",
    note: "",
    color: "#c9f0ff",
  },
  {
    key: "wife",
    label: "",
    href: editableLink("wife", "url", "https://lillie.garden/"),
    images: ["zzz_assets/wife/kazberry.webp", "zzz_assets/wife/ramberry.webp"],
    note: "",
    color: "#ffd7ef",
  },
];

const buttonBadges = [
  { key: "believe", file: "believe-it.png" },
  { key: "moon", file: "moon-prism.png" },
  { key: "waku", file: "waku-waku.png" },
  { key: "blast", file: "gotta-blast.png" },
  { key: "ultra", file: "plus-ultra.png" },
  { key: "snack", file: "snack-break.png" },
  { key: "cowboy", file: "space-cowboy.png" },
  { key: "power", file: "power-up.png" },
];

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]);
const audioExtensions = new Set([".mp3", ".ogg", ".wav", ".m4a", ".flac", ".aac"]);
const ART_ROTATION_MS = 8000;
const ART_MANUAL_HOLD_MS = 20000;
const THEME_STORAGE_KEY = "kazvt-theme";
const VOLUME_STORAGE_KEY = "kazvt-volume";
const DEFAULT_SITE_VOLUME = 0.2;
const WIFE_KISS_SOUND_SRC = "zzz_assets/sounds/wifey-kissy.mp3";
const FRUIT_SOUND_SRC = "zzz_assets/sounds/fruit.mp3";
const LANGUAGE_STORAGE_KEY = "kazvt-language";
const DEFAULT_LANGUAGE_NAME = "english";
const DEFAULT_LANGUAGE_CODE = "en";
const WUMPA_STORAGE_KEY = "kazvt-wumpa-count";
const LOGO_WUMPA_EATEN_STORAGE_PREFIX = "kazvt-logo-wumpa-eaten-";
const KISSY_STORAGE_KEY = "kazvt-kissy-count";

// Global hit counter. The site is static, so browser JavaScript cannot write a
// counter file back to the web host. This public counter service provides the
// shared state instead; the cached value is display-only and is never locally
// incremented.
const VISIT_COUNTER_ENDPOINT = "https://countapi.mileshilliard.com/api/v1/hit/kazvt_com_global_visitors_v1";
const VISIT_COUNTER_CACHE_KEY = "kazvt-global-visits-last";
const EMOTE_FILE = "emotes.txt";

const cursorThemes = {
  p1: { effect: "lineboilGlyphCursor", options: { glyphs: [], colors: ["#F599C6", "#FFEA88", "#7DCCAD"], sizes: [8, 13, 19, 27], spawn: 2, scatter: 0.85, gravity: 0.015, life: 58 } },
  p2: { effect: "lineboilGlyphCursor", options: { glyphs: [], colors: ["#EF6905", "#F1E5A1", "#486C2F"], sizes: [13, 18, 24], spawn: 2, scatter: 0.42, gravity: 0.006, life: 96, spin: 0.03 } },
  p3: { effect: "lineboilGlyphCursor", options: { glyphs: [], colors: ["#1D4533", "#F9D2BA", "#5E3122"], sizes: [9, 15, 22, 30], spawn: 1, scatter: 0.55, gravity: -0.005, life: 68, spin: 0.08 } },
  p4: { effect: "lineboilBubbleCursor", options: { colors: ["#D8FFC5", "#92EEFF", "#30AFFF"], strokeColor: "#30AFFF", minSize: 6, maxSize: 20, spawn: 2, life: 95 } },
  p5: { effect: "lineboilGlyphCursor", options: { glyphs: [], colors: ["#FAF7BB", "#D99B21", "#133458"], sizes: [12, 18, 24], spawn: 1, scatter: 0.24, gravity: -0.004, life: 92, spin: 0.02 } },
  p6: { effect: "lineboilGlyphCursor", options: { glyphs: [], colors: ["#FEF2A0", "#F3CD97", "#BC4F4F"], sizes: [16, 22, 27], spawn: 1, scatter: 0.32, gravity: 0.004, life: 104, spin: 0.018 } },
  p7: { effect: "lineboilFlagCursor", options: { text: "", color: "#FCF2E5", strokeColor: "#EC5B38", shadowColor: "#524646", font: "900 24px Trebuchet MS, Comic Sans MS, Arial", gap: 16, wobble: 1.5 } },
  p8: { effect: "lineboilSpringyGlyphCursor", options: { glyph: "", color: "#E8F5E9", strokeColor: "#1B5E20", font: "900 18px Trebuchet MS, Comic Sans MS, Arial", links: 7 } },
  p9: { effect: "lineboilBubbleCursor", options: { colors: ["#E3F2FD", "#90CAF9", "#2196F3"], strokeColor: "#0D47A1", minSize: 3, maxSize: 18, spawn: 2, life: 82 } },
  p10: { effect: "lineboilGlyphCursor", options: { glyphs: [], colors: ["#F6D8BD", "#F39399", "#CF4173"], sizes: [16, 24, 34], spawn: 1, scatter: 0.35, gravity: -0.012, life: 72, spin: 0.035 } },
  p11: { effect: "characterCursor", options: { characters: [], colors: ["#98E8DE", "#45A9A9", "#4E1F6E"], font: "27px monospace", characterLifeSpanFunction: () => Math.floor(55 + Math.random() * 30), initialCharacterVelocityFunction: () => ({ x: (Math.random() - 0.5) * 1.1, y: (Math.random() - 0.5) * 1.1 }), characterVelocityChangeFunctions: { x_func: () => (Math.random() - 0.5) / 90, y_func: () => (Math.random() - 0.5) / 90 }, characterScalingFunction: (age, life) => Math.max((life - age) / life, 0) } },
  p12: { effect: "rainbowCursor", options: { colors: ["#007DCC", "#FFB900", "#D10056", "#B2054C"], length: 26, size: 5 } },
  p13: { effect: "rainbowCursor", options: { colors: ["#E73F1E", "#FB6C00", "#F9B637", "#FFDD9C"], length: 24, size: 5 } },
  p14: { effect: "rainbowCursor", options: { colors: ["#FED24F", "#FFF449", "#B2D959", "#7EC151"], length: 28, size: 5 } },
  p15: { effect: "lineboilGlyphCursor", options: { glyphs: [], colors: ["#F8B2B2", "#AF719D", "#8B639B", "#403D88"], sizes: [11, 16, 23, 29], spawn: 1, scatter: 0.28, gravity: 0.01, life: 74, spin: 0.012 } },
  p16: { effect: "lineboilFlagCursor", options: { text: "", color: "#E1E100", strokeColor: "#063B00", shadowColor: "#90B800", font: "900 17px Courier New, monospace", gap: 12, wobble: 0.75 } },
};

let activeCursorEffect = null;
let activeCursorTheme = "";
let mwahAudio = null;
let fruitAudio = null;
let siteVolume = DEFAULT_SITE_VOLUME;
let activeLanguageText = new Map();
let activeEmotes = new Map();

function getMwahAudio() {
  if (mwahAudio) return mwahAudio;

  mwahAudio = new Audio(WIFE_KISS_SOUND_SRC);
  mwahAudio.preload = "auto";
  mwahAudio.load();
  return mwahAudio;
}

function getFruitAudio() {
  if (fruitAudio) return fruitAudio;

  fruitAudio = new Audio(FRUIT_SOUND_SRC);
  fruitAudio.preload = "auto";
  fruitAudio.load();
  return fruitAudio;
}

function playSiteSound(sourceAudio, volumeScale = 1) {
  try {
    const audio = sourceAudio.cloneNode();
    audio.volume = Math.max(0, Math.min(1, siteVolume * volumeScale));
    audio.play().catch(() => {});
  } catch {}
}

function svgTrailCursorImage(fill, stroke, shape = "diamond") {
  const paths = {
    diamond: '<path d="M12 1 L23 12 L12 23 L1 12 Z"/>',
    ghost: '<path d="M12 2 C17 2 21 6 21 12 V22 L17 19 L14 22 L11 19 L8 22 L5 19 L3 22 V12 C3 6 7 2 12 2 Z"/>',
    heart: '<path d="M12 21 C6 16 3 12 3 8 C3 5 5 3 8 3 C10 3 11 4 12 6 C13 4 15 3 17 3 C20 3 22 5 22 8 C22 12 18 16 12 21 Z"/>',
    spark: '<path d="M12 1 L15 9 L23 12 L15 15 L12 23 L9 15 L1 12 L9 9 Z"/>',
    stripe: '<path d="M3 7 H21 L17 17 H1 Z"/>',
  };
  const path = paths[shape] || paths.diamond;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round">${path}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function activeCursorLayerHost() {
  return document.querySelector("dialog[data-kazvt-modal][open], dialog[data-multistream-guide-modal][open]") || document.body;
}

function promoteCursorCanvas(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) return;
  canvas.dataset.cursorEffectLayer = "true";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "2147483647";
  const host = activeCursorLayerHost();
  if (canvas.parentElement !== host) host.appendChild(canvas);
}

function setupCursorCanvas() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "2147483647";
  activeCursorLayerHost().appendChild(canvas);
  canvas.dataset.cursorEffectLayer = "true";

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  resize();
  window.addEventListener("resize", resize);

  return { canvas, context, resize };
}

function randomFrom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function createLineboilGlyphCursor(options = {}) {
  const { canvas, context, resize } = setupCursorCanvas();
  const glyphs = options.glyphs?.length ? options.glyphs : [""];
  const colors = options.colors || ["#F599C6", "#FFEA88", "#7DCCAD"];
  const sizes = options.sizes || [10, 16, 22];
  const spawnCount = options.spawn || 1;
  const scatter = options.scatter ?? 0.55;
  const gravity = options.gravity ?? 0.01;
  const spin = options.spin ?? 0.045;
  const lifeBase = options.life || 58;
  const particles = [];
  let animationFrame = 0;
  let lastSpawn = 0;

  const spawn = (x, y) => {
    for (let index = 0; index < spawnCount; index += 1) {
      const size = randomFrom(sizes);
      const life = lifeBase + Math.floor(Math.random() * 24);
      particles.push({
        glyph: randomFrom(glyphs),
        color: randomFrom(colors),
        size,
        x,
        y,
        vx: (Math.random() - 0.5) * scatter * 4,
        vy: (Math.random() - 0.7) * scatter * 4,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * spin,
        life,
        initialLife: life,
      });
    }
  };

  const move = (event) => {
    if (event.timeStamp - lastSpawn < 22) return;
    lastSpawn = event.timeStamp;
    spawn(event.clientX, event.clientY);
  };

  const touch = (event) => {
    [...event.touches].forEach((point) => spawn(point.clientX, point.clientY));
  };

  const draw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.life -= 1;
      if (particle.life <= 0) {
        particles.splice(index, 1);
        continue;
      }

      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += gravity;
      particle.rotation += particle.spin;
      const alpha = Math.max(particle.life / particle.initialLife, 0);
      const scale = 0.45 + alpha * 0.75;

      context.save();
      context.globalAlpha = alpha;
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.scale(scale, scale);
      context.font = `900 ${particle.size}px "Trebuchet MS", "Comic Sans MS", monospace`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = Math.max(1, particle.size / 12);
      context.strokeStyle = "#111111";
      context.fillStyle = particle.color;
      context.strokeText(particle.glyph, 0, 0);
      context.fillText(particle.glyph, 0, 0);
      context.restore();
    }
    animationFrame = window.requestAnimationFrame(draw);
  };

  document.body.addEventListener("mousemove", move);
  document.body.addEventListener("touchmove", touch, { passive: true });
  document.body.addEventListener("touchstart", touch, { passive: true });
  draw();

  return {
    destroy() {
      window.cancelAnimationFrame(animationFrame);
      document.body.removeEventListener("mousemove", move);
      document.body.removeEventListener("touchmove", touch);
      document.body.removeEventListener("touchstart", touch);
      window.removeEventListener("resize", resize);
      canvas.remove();
    },
  };
}

function createLineboilFlagCursor(options = {}) {
  const { canvas, context, resize } = setupCursorCanvas();
  const text = ` ${options.text || ""}`;
  const letters = Array.from(text).map((letter) => ({
    letter,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }));
  const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const color = options.color || "#FCF2E5";
  const strokeColor = options.strokeColor || "#111111";
  const shadowColor = options.shadowColor || "#F599C6";
  const font = options.font || '900 20px "Trebuchet MS", "Comic Sans MS", sans-serif';
  const gap = options.gap || 14;
  const wobble = options.wobble || 1;
  let phase = 0;
  let animationFrame = 0;

  const move = (event) => {
    target.x = event.clientX;
    target.y = event.clientY;
  };

  const draw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    phase += 0.14;

    letters[0].x += (target.x - letters[0].x) / 5;
    letters[0].y += (target.y - letters[0].y) / 5;

    for (let index = 1; index < letters.length; index += 1) {
      letters[index].x += (letters[index - 1].x + gap - letters[index].x) / 2.6;
      letters[index].y += (letters[index - 1].y + Math.sin(phase + index * 0.4) * wobble - letters[index].y) / 2.6;
    }

    context.font = font;
    context.textBaseline = "middle";
    context.textAlign = "center";
    context.lineWidth = 4;
    context.shadowColor = shadowColor;
    context.shadowBlur = 0;
    context.shadowOffsetX = 3;
    context.shadowOffsetY = 3;

    for (let index = letters.length - 1; index >= 0; index -= 1) {
      const item = letters[index];
      const lift = Math.sin(phase + index) * wobble;
      context.save();
      context.translate(item.x, item.y + lift);
      context.rotate(Math.sin(phase * 0.5 + index) * 0.08);
      context.strokeStyle = strokeColor;
      context.fillStyle = color;
      context.strokeText(item.letter, 0, 0);
      context.fillText(item.letter, 0, 0);
      context.restore();
    }

    animationFrame = window.requestAnimationFrame(draw);
  };

  document.body.addEventListener("mousemove", move);
  draw();

  return {
    destroy() {
      window.cancelAnimationFrame(animationFrame);
      document.body.removeEventListener("mousemove", move);
      window.removeEventListener("resize", resize);
      canvas.remove();
    },
  };
}

function createLineboilBubbleCursor(options = {}) {
  const { canvas, context, resize } = setupCursorCanvas();
  const bubbles = [];
  const colors = options.colors || ["#E3F2FD", "#90CAF9", "#2196F3"];
  const strokeColor = options.strokeColor || "#0D47A1";
  const minSize = options.minSize || 3;
  const maxSize = options.maxSize || 16;
  const spawnCount = options.spawn || 1;
  const lifeBase = options.life || 80;
  let animationFrame = 0;

  const spawn = (x, y) => {
    for (let index = 0; index < spawnCount; index += 1) {
      const radius = minSize + Math.random() * (maxSize - minSize);
      const life = lifeBase + Math.floor(Math.random() * 35);
      bubbles.push({
        x,
        y,
        radius,
        color: randomFrom(colors),
        vx: (Math.random() - 0.5) * 1.4,
        vy: -0.4 - Math.random() * 1.7,
        life,
        initialLife: life,
      });
    }
  };

  const move = (event) => spawn(event.clientX, event.clientY);
  const touch = (event) => [...event.touches].forEach((point) => spawn(point.clientX, point.clientY));

  const draw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let index = bubbles.length - 1; index >= 0; index -= 1) {
      const bubble = bubbles[index];
      bubble.life -= 1;
      if (bubble.life <= 0) {
        bubbles.splice(index, 1);
        continue;
      }

      bubble.x += bubble.vx;
      bubble.y += bubble.vy;
      bubble.vx += (Math.random() - 0.5) * 0.04;
      const alpha = Math.max(bubble.life / bubble.initialLife, 0);
      const grow = 1 + (1 - alpha) * 0.9;

      context.save();
      context.globalAlpha = alpha * 0.9;
      context.fillStyle = bubble.color;
      context.strokeStyle = strokeColor;
      context.lineWidth = Math.max(1.5, bubble.radius / 4);
      context.beginPath();
      context.arc(bubble.x, bubble.y, bubble.radius * grow, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.restore();
    }
    animationFrame = window.requestAnimationFrame(draw);
  };

  document.body.addEventListener("mousemove", move);
  document.body.addEventListener("touchmove", touch, { passive: true });
  document.body.addEventListener("touchstart", touch, { passive: true });
  draw();

  return {
    destroy() {
      window.cancelAnimationFrame(animationFrame);
      document.body.removeEventListener("mousemove", move);
      document.body.removeEventListener("touchmove", touch);
      document.body.removeEventListener("touchstart", touch);
      window.removeEventListener("resize", resize);
      canvas.remove();
    },
  };
}

function createLineboilCenteredTrailCursor(options = {}) {
  const { canvas, context, resize } = setupCursorCanvas();
  const particleCount = options.particles || 16;
  const rate = options.rate || 0.3;
  const size = options.size || 12;
  const image = new Image();
  const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const particles = Array.from({ length: particleCount }, () => ({ ...target }));
  let started = false;
  let animationFrame = 0;

  image.src = options.image || svgTrailCursorImage("#ffffff", "#111111", "diamond");

  const move = (event) => {
    target.x = event.clientX;
    target.y = event.clientY;
    if (!started) {
      started = true;
      particles.forEach((particle) => {
        particle.x = target.x;
        particle.y = target.y;
      });
    }
  };

  const touch = (event) => {
    if (!event.touches.length) return;
    move(event.touches[0]);
  };

  const drawFallbackShape = (x, y, drawSize, alpha) => {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = options.fallbackFill || "#ffffff";
    context.strokeStyle = options.fallbackStroke || "#111111";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, y - drawSize / 2);
    context.lineTo(x + drawSize / 2, y);
    context.lineTo(x, y + drawSize / 2);
    context.lineTo(x - drawSize / 2, y);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  };

  const draw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((particle, index) => {
      const previous = index === 0 ? target : particles[index - 1];
      particle.x += (previous.x - particle.x) * rate;
      particle.y += (previous.y - particle.y) * rate;

      const alpha = 1 - index / particles.length;
      const drawSize = size * (0.58 + alpha * 0.7);
      const x = particle.x - drawSize / 2;
      const y = particle.y - drawSize / 2;

      context.save();
      context.globalAlpha = Math.max(alpha, 0.14);
      context.rotate(0);
      if (image.complete && image.naturalWidth) {
        context.drawImage(image, x, y, drawSize, drawSize);
      } else {
        drawFallbackShape(particle.x, particle.y, drawSize, alpha);
      }
      context.restore();
    });
    animationFrame = window.requestAnimationFrame(draw);
  };

  document.body.addEventListener("mousemove", move);
  document.body.addEventListener("touchmove", touch, { passive: true });
  document.body.addEventListener("touchstart", touch, { passive: true });
  draw();

  return {
    destroy() {
      window.cancelAnimationFrame(animationFrame);
      document.body.removeEventListener("mousemove", move);
      document.body.removeEventListener("touchmove", touch);
      document.body.removeEventListener("touchstart", touch);
      window.removeEventListener("resize", resize);
      canvas.remove();
    },
  };
}

function createLineboilSpringyGlyphCursor(options = {}) {
  const { canvas, context, resize } = setupCursorCanvas();
  const glyph = options.glyph || "";
  const links = options.links || 7;
  const color = options.color || "#ffffff";
  const strokeColor = options.strokeColor || "#111111";
  const font = options.font || '900 18px "Trebuchet MS", "Comic Sans MS", sans-serif';
  const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const nodes = Array.from({ length: links }, () => ({
    x: target.x,
    y: target.y,
    vx: 0,
    vy: 0,
  }));
  let animationFrame = 0;
  let phase = 0;

  const move = (event) => {
    target.x = event.clientX;
    target.y = event.clientY;
  };

  const touch = (event) => {
    if (!event.touches.length) return;
    target.x = event.touches[0].clientX;
    target.y = event.touches[0].clientY;
  };

  const drawGlyph = (node, index) => {
    const alpha = 1 - index / (nodes.length + 2);
    context.save();
    context.globalAlpha = Math.max(alpha, 0.32);
    context.translate(node.x, node.y + Math.sin(phase + index) * 2);
    context.rotate(Math.sin(phase * 0.6 + index) * 0.18);
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 3.3;
    context.strokeStyle = strokeColor;
    context.fillStyle = color;
    context.strokeText(glyph, 0, 0);
    context.fillText(glyph, 0, 0);
    context.restore();
  };

  const draw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    phase += 0.12;
    nodes[0].x += (target.x - nodes[0].x) / 4;
    nodes[0].y += (target.y - nodes[0].y) / 4;

    for (let index = 1; index < nodes.length; index += 1) {
      const previous = nodes[index - 1];
      const node = nodes[index];
      const dx = previous.x - node.x;
      const dy = previous.y - node.y;
      node.vx += dx * 0.035;
      node.vy += dy * 0.035;
      node.vx *= 0.72;
      node.vy *= 0.72;
      node.x += node.vx;
      node.y += node.vy;
    }

    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      drawGlyph(nodes[index], index);
    }
    animationFrame = window.requestAnimationFrame(draw);
  };

  document.body.addEventListener("mousemove", move);
  document.body.addEventListener("touchmove", touch, { passive: true });
  document.body.addEventListener("touchstart", touch, { passive: true });
  draw();

  return {
    destroy() {
      window.cancelAnimationFrame(animationFrame);
      document.body.removeEventListener("mousemove", move);
      document.body.removeEventListener("touchmove", touch);
      document.body.removeEventListener("touchstart", touch);
      window.removeEventListener("resize", resize);
      canvas.remove();
    },
  };
}

function installLineboilCursorEffects() {
  if (!window.cursoreffects || window.cursoreffects.lineboilGlyphCursor) return;

  window.cursoreffects.lineboilGlyphCursor = createLineboilGlyphCursor;
  window.cursoreffects.lineboilFlagCursor = createLineboilFlagCursor;
  window.cursoreffects.lineboilBubbleCursor = createLineboilBubbleCursor;
  window.cursoreffects.lineboilCenteredTrailCursor = createLineboilCenteredTrailCursor;
  window.cursoreffects.lineboilSpringyGlyphCursor = createLineboilSpringyGlyphCursor;
}

async function loadTextLines(file) {
  try {
    const response = await fetch(file, { cache: "no-store" });
    if (!response.ok) return [];
    const text = await response.text();
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    return [];
  }
}

function parseKeyValueLines(lines) {
  const values = new Map();
  lines.forEach((line) => {
    const separator = line.indexOf("=");
    if (separator === -1) return;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replaceAll("\\n", "\n");
    if (key && value) values.set(key, value);
  });
  return values;
}

function parseColonKeyValueLines(lines) {
  const values = {};
  lines.forEach((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key) values[key] = value;
  });
  return values;
}

async function loadLanguageManifest() {
  const lines = await loadTextLines("languages.txt");
  const values = parseKeyValueLines(lines.flatMap((line) => line.split(",")));
  const languages = [...values.entries()].map(([name, code]) => ({ name, code }));
  return languages.length ? languages : [{ name: DEFAULT_LANGUAGE_NAME, code: DEFAULT_LANGUAGE_CODE }];
}

function selectedLanguageFromManifest(languages) {
  let selectedName = languages[0].name;

  try {
    const stored = sessionStorage.getItem(LANGUAGE_STORAGE_KEY);
    const match = languages.find((language) => language.name === stored || language.code === stored);
    if (match) selectedName = match.name;
  } catch {}

  return languages.find((item) => item.name === selectedName) || languages[0];
}

function emoteTokenFromFilename(file) {
  const clean = String(file || "").split(/[\/]/).pop() || "";
  const dot = clean.lastIndexOf(".");
  return (dot > 0 ? clean.slice(0, dot) : clean).trim();
}

async function discoverEmoteFiles() {
  const files = new Set();

  try {
    const response = await fetch("zzz_assets/emotes/manifest.json", { cache: "no-store" });
    if (response.ok) {
      const manifest = await response.json();
      (manifest.files || []).forEach((file) => {
        if (typeof file === "string" && file.trim()) files.add(file.trim());
      });
    }
  } catch {}

  // Servers that expose a directory index can work without a manifest at all.
  // GitHub Pages does not expose indexes, so the included workflow keeps the
  // manifest in sync automatically whenever emote files are pushed.
  try {
    const response = await fetch("zzz_assets/emotes/", { cache: "no-store" });
    if (response.ok && /text\/html/i.test(response.headers.get("content-type") || "")) {
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("a[href]").forEach((anchor) => {
        const href = anchor.getAttribute("href") || "";
        if (!href || href.endsWith("/") || href.startsWith("?") || href.startsWith("#")) return;
        try {
          const url = new URL(href, response.url);
          const file = decodeURIComponent(url.pathname.split("/").pop() || "");
          if (file && file !== "manifest.json") files.add(file);
        } catch {}
      });
    }
  } catch {}

  return [...files];
}

async function loadActiveEmotes() {
  const aliases = parseKeyValueLines(await loadTextLines(EMOTE_FILE));
  const discovered = await discoverEmoteFiles();
  activeEmotes = new Map(aliases);

  discovered.forEach((file) => {
    const token = emoteTokenFromFilename(file);
    if (!token) return;
    const path = `zzz_assets/emotes/${file.split("/").map(encodeURIComponent).join("/")}`;
    // The filename stem is the token. Brackets/parentheses only matter when
    // they are literally present in the filename; bare names work bare.
    activeEmotes.set(token, path);
  });

  return activeEmotes;
}

async function loadActiveLanguageText() {
  if (window.KazvtI18n) {
    await window.KazvtI18n.ready;
    activeLanguageText = new Map(window.KazvtI18n.entries());
    document.documentElement.lang = window.KazvtI18n.language.code || DEFAULT_LANGUAGE_CODE;
    return activeLanguageText;
  }

  const languages = await loadLanguageManifest();
  const language = selectedLanguageFromManifest(languages);
  activeLanguageText = parseKeyValueLines(await loadTextLines(`${language.name}.txt`));
  document.documentElement.lang = language.code || DEFAULT_LANGUAGE_CODE;
  return activeLanguageText;
}

function translatedText(key) {
  return activeLanguageText.get(key) || window.KazvtI18n?.t?.(key) || "";
}

function translatedList(key) {
  const value = translatedText(key);
  return value ? value.split("|").map((item) => item.trim()).filter(Boolean) : [];
}

function translateTemplate(key, values = {}) {
  let text = translatedText(key);
  Object.entries(values).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value));
  });
  return text;
}

function mediaPath(file) {
  if (/^(https?:|data:|blob:|\/)/i.test(file)) return file;
  if (file.includes("/")) return file;
  return `zzz_assets/${file}`;
}

function emoteNode(token, file) {
  const src = mediaPath(file);
  const extension = fileExtension(file);
  if ([".mp4", ".webm", ".mov", ".m4v", ".ogv"].includes(extension)) {
    return el("video", {
      className: "inline-emote",
      src,
      ariaLabel: token,
      title: token,
      autoplay: "",
      muted: "",
      loop: "",
      playsinline: "",
    });
  }

  return el("img", {
    className: "inline-emote",
    src,
    alt: token,
    title: token,
    loading: "lazy",
  });
}

function normalizeStatus(status) {
  return status === "online" ? "live" : status;
}

function availableTheme(themeButtons) {
  const themes = new Set(themeButtons.map((button) => button.getAttribute("data-tool-theme")).filter(Boolean));
  return themes.size ? themes : new Set(Object.keys(cursorThemes));
}

function storedTheme(themeButtons) {
  const themes = availableTheme(themeButtons);
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    if (theme && themes.has(theme)) return theme;
  } catch {}
  return document.body.dataset.theme && themes.has(document.body.dataset.theme) ? document.body.dataset.theme : "p1";
}

function destroyCursorEffect() {
  if (!activeCursorEffect || typeof activeCursorEffect.destroy !== "function") return;

  try {
    activeCursorEffect.destroy();
  } catch {}
  activeCursorEffect = null;
}

function updateThemeMetaColor() {
  const meta = document.querySelector('meta[name="theme-color"]');

  window.requestAnimationFrame(() => {
    const bodyStyle = getComputedStyle(document.body);
    const bg = bodyStyle.getPropertyValue("--bg").trim();
    const wallpaper = bodyStyle.getPropertyValue("--wallpaper-image").trim();
    const wallpaperSize = bodyStyle.getPropertyValue("--wallpaper-size").trim();

    if (meta && bg) meta.setAttribute("content", bg);

    // During pinch zoom Chrome can reveal the root canvas around the body's
    // layout viewport. Keep that canvas visually identical to the body.
    if (bg) document.documentElement.style.backgroundColor = bg;
    if (wallpaper) document.documentElement.style.backgroundImage = wallpaper;
    document.documentElement.style.backgroundRepeat = "repeat";
    if (wallpaperSize) document.documentElement.style.backgroundSize = wallpaperSize;
  });
}

function anyStreamLive() {
  return Boolean(document.querySelector(".sticker.is-live, .status-card.live, .sticker-status-corner.live"));
}

function cursorThemeConfig(theme) {
  const config = cursorThemes[theme] || cursorThemes.p1;
  const options = { ...(config.options || {}) };

  const glyphs = translatedList(`cursor.${theme}.glyphs`);
  const characters = translatedList(`cursor.${theme}.characters`);
  const glyph = translatedText(`cursor.${theme}.glyph`);
  const text = translatedText(`cursor.${theme}.text`);
  if (glyphs.length) options.glyphs = glyphs;
  if (characters.length) options.characters = characters;
  if (glyph) options.glyph = glyph;
  if (text) options.text = text;

  if (theme !== "p16") {
    return { ...config, options };
  }

  return {
    ...config,
    options: {
      ...options,
      text: anyStreamLive()
        ? translatedText("cursor.p16.live")
        : translatedText("cursor.p16.offline"),
    },
  };
}

let limitedGraphicsAcceleration = null;

function hasLimitedGraphicsAcceleration() {
  if (limitedGraphicsAcceleration !== null) return limitedGraphicsAcceleration;

  // Browsers do not expose their "hardware acceleration" setting directly.
  // A strict WebGL context is the safest useful proxy: it fails when the
  // browser reports a major graphics performance caveat. We also identify
  // common software renderers when renderer information is available.
  const makeContext = (strict) => {
    try {
      const canvas = document.createElement("canvas");
      const options = {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: strict,
        powerPreference: "low-power",
      };
      return canvas.getContext("webgl2", options) || canvas.getContext("webgl", options);
    } catch {
      return null;
    }
  };

  const strictContext = makeContext(true);
  const fallbackContext = strictContext || makeContext(false);
  let softwareRenderer = false;

  if (fallbackContext) {
    try {
      const debugInfo = fallbackContext.getExtension("WEBGL_debug_renderer_info");
      const renderer = String(debugInfo
        ? fallbackContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : fallbackContext.getParameter(fallbackContext.RENDERER)
      ).toLowerCase();
      softwareRenderer = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/.test(renderer);
    } catch {}
  }

  limitedGraphicsAcceleration = !strictContext || !fallbackContext || softwareRenderer;
  document.documentElement.dataset.cursorGraphics = limitedGraphicsAcceleration ? "limited" : "accelerated";
  return limitedGraphicsAcceleration;
}

function lightenCursorConfig(config) {
  if (!hasLimitedGraphicsAcceleration()) return config;

  const options = { ...(config.options || {}) };
  if (Number.isFinite(options.spawn)) options.spawn = Math.max(1, Math.min(1, options.spawn));
  if (Number.isFinite(options.life)) options.life = Math.max(28, Math.round(options.life * 0.58));
  if (Number.isFinite(options.scatter)) options.scatter *= 0.58;
  if (Number.isFinite(options.spin)) options.spin *= 0.5;
  if (Number.isFinite(options.minSize)) options.minSize = Math.max(2, Math.round(options.minSize * 0.72));
  if (Number.isFinite(options.maxSize)) options.maxSize = Math.max(options.minSize || 2, Math.round(options.maxSize * 0.72));
  if (Number.isFinite(options.length)) options.length = Math.max(10, Math.round(options.length * 0.5));
  if (Number.isFinite(options.size)) options.size = Math.max(2, Math.round(options.size * 0.72));
  if (Number.isFinite(options.links)) options.links = Math.max(3, Math.round(options.links * 0.6));
  if (Number.isFinite(options.gap)) options.gap = Math.max(9, Math.round(options.gap * 1.35));
  if (Number.isFinite(options.wobble)) options.wobble *= 0.45;
  if (Array.isArray(options.sizes)) options.sizes = options.sizes.map((size) => Math.max(6, Math.round(size * 0.72)));

  if (typeof options.characterLifeSpanFunction === "function") {
    const originalLifeSpan = options.characterLifeSpanFunction;
    options.characterLifeSpanFunction = (...args) => Math.max(24, Math.round(originalLifeSpan(...args) * 0.55));
  }
  if (typeof options.initialCharacterVelocityFunction === "function") {
    const originalVelocity = options.initialCharacterVelocityFunction;
    options.initialCharacterVelocityFunction = (...args) => {
      const velocity = originalVelocity(...args) || { x: 0, y: 0 };
      return { x: (velocity.x || 0) * 0.55, y: (velocity.y || 0) * 0.55 };
    };
  }

  return { ...config, options };
}

function updateCursorEffect(theme, { force = false } = {}) {
  if (!force && activeCursorTheme === theme && activeCursorEffect) return;
  activeCursorTheme = theme;
  destroyCursorEffect();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const touchOnly = window.matchMedia("(hover: none) and (pointer: coarse)").matches && navigator.maxTouchPoints > 0;
  if (reducedMotion.matches || touchOnly || !window.cursoreffects) return;

  installLineboilCursorEffects();
  const config = lightenCursorConfig(cursorThemeConfig(theme));
  const CursorEffect = window.cursoreffects[config.effect] || window.cursoreffects.fairyDustCursor;
  if (!CursorEffect) return;

  try {
    const canvasesBefore = new Set(document.querySelectorAll("canvas"));
    activeCursorEffect = new CursorEffect(config.options || {});
    // Native dialogs occupy the browser top layer. Promote only the canvas
    // created by the active cursor effect into that same layer so it remains
    // visible over the multistream modal for every palette.
    document.querySelectorAll("canvas").forEach((canvas) => {
      if (!canvasesBefore.has(canvas)) promoteCursorCanvas(canvas);
    });
  } catch {
    activeCursorEffect = null;
  }
}

function applySiteTheme(theme, themeButtons, { persist = true } = {}) {
  document.body.dataset.theme = theme;
  themeButtons.forEach((item) => {
    const isSelected = item.getAttribute("data-tool-theme") === theme;
    item.setAttribute("aria-pressed", String(isSelected));
    item.closest(".palette-choice")?.classList.toggle("is-selected", isSelected);
  });

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }

  updateThemeMetaColor();
  updateCursorEffect(theme);
  window.dispatchEvent(new CustomEvent("kazvt:themechange", { detail: { theme } }));
}

function initializeCurrentUrl() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  let node = null;

  const updateUrl = () => {
    const hasUrlDetail = window.location.pathname !== "/"
      || Boolean(window.location.search)
      || Boolean(window.location.hash);

    if (!hasUrlDetail) {
      node?.remove();
      node = null;
      return;
    }

    const label = `${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (!node) {
      node = document.createElement("p");
      node.className = "tiny-status current-url-spawn";
      node.dataset.currentUrl = "";
      node.textContent = label;
      header.prepend(node);

      node.addEventListener("animationend", () => {
        node?.classList.remove("current-url-spawn");
      }, { once: true });
      return;
    }

    node.textContent = label;
  };

  updateUrl();
  window.addEventListener("hashchange", updateUrl);
  window.addEventListener("popstate", updateUrl);
  document.addEventListener("click", () => window.setTimeout(updateUrl, 0));
}

async function initializeMarquee() {
  const node = document.querySelector("[data-marquee-text]");
  if (!node) return;

  await loadActiveEmotes();
  if (!activeLanguageText.size) await loadActiveLanguageText();
  const lines = [...activeLanguageText.entries()]
    .filter(([key]) => /^marquee\.\d+$/.test(key))
    .sort(([left], [right]) => Number(left.split(".").pop()) - Number(right.split(".").pop()))
    .map(([, value]) => value);

  if (!lines.length) return;

  // Keep the starting message varied while preserving a continuous conveyor.
  const startIndex = Math.floor(Math.random() * lines.length);
  const orderedLines = [...lines.slice(startIndex), ...lines.slice(0, startIndex)];

  // Give every message its own line-boil rhythm. The same profile is reused
  // for the duplicate conveyor copy so the marquee can loop without a visible
  // style jump at the seam, while neighboring messages stay de-synchronized.
  const variants = ["a", "b", "c", "d"];
  let previousVariant = "";
  const boilProfiles = orderedLines.map(() => {
    const duration = 390 + Math.floor(Math.random() * 270);
    const phase = Math.floor(Math.random() * duration);
    const availableVariants = variants.filter((variant) => variant !== previousVariant);
    const variant = availableVariants[Math.floor(Math.random() * availableVariants.length)];
    previousVariant = variant;
    return {
      variant,
      duration,
      phase,
      reverse: Math.random() < 0.5,
    };
  });

  const makeSequence = (duplicate = false) => {
    const sequence = el("span", { className: "marquee-sequence" });
    if (duplicate) sequence.setAttribute("aria-hidden", "true");

    orderedLines.forEach((line, index) => {
      const profile = boilProfiles[index];
      const piece = el("span", {
        className: `marquee-piece marquee-piece-boil-${profile.variant}`,
        ariaHidden: "true",
      });
      piece.style.setProperty("--marquee-piece-boil-duration", `${profile.duration}ms`);
      piece.style.setProperty("--marquee-piece-boil-delay", `-${profile.phase}ms`);
      piece.style.setProperty("--marquee-piece-boil-direction", profile.reverse ? "reverse" : "normal");
      setInlineNote(piece, line, { animate: false });
      sequence.append(piece);
    });

    return sequence;
  };

  const firstSequence = makeSequence(false);
  const secondSequence = makeSequence(true);
  node.replaceChildren(firstSequence, secondSequence);

  // Match the old marquee's general travel speed, but base the loop duration
  // on the actual content width so spacing stays consistent for short/long text.
  const sequenceWidth = firstSequence.getBoundingClientRect().width;
  const pixelsPerSecond = 92;
  const duration = Math.max(18, sequenceWidth / pixelsPerSecond);
  node.style.setProperty("--marquee-duration", `${duration.toFixed(2)}s`);

  node.style.animation = "none";
  node.offsetHeight;
  node.style.animation = "";

  const marqueeBar = node.closest(".marquee");
  const setMarqueePlaybackRate = (rate) => {
    node.getAnimations().forEach((animation) => {
      if ("animationName" in animation && animation.animationName !== "marquee") return;
      if (typeof animation.updatePlaybackRate === "function") animation.updatePlaybackRate(rate);
      else animation.playbackRate = rate;
    });
  };

  marqueeBar?.addEventListener("mouseenter", () => setMarqueePlaybackRate(0.25));
  marqueeBar?.addEventListener("mouseleave", () => setMarqueePlaybackRate(1));
}

async function initializeLanguageText() {
  await loadActiveEmotes();
  const descriptions = await loadActiveLanguageText();

  applyLanguageText(document, descriptions);
}

function applyLanguageText(root, descriptions = activeLanguageText) {
  const page = document.body.dataset.page || "home";
  document.title = translatedText(`title.${page}`);

  const metaDescription = document.querySelector('meta[name="description"]');
  const description = descriptions.get(`meta.${page}.description`);
  if (metaDescription && description) metaDescription.setAttribute("content", description);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  const socialDescription = descriptions.get(`meta.${page}.og_description`) || description;
  if (ogTitle) ogTitle.setAttribute("content", translatedText(`title.${page}`));
  if (ogDescription && socialDescription) ogDescription.setAttribute("content", socialDescription);

  root.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    const value = descriptions.get(key);
    if (value) setInlineNote(node, value);
  });

  ["aria-label", "title", "alt", "placeholder"].forEach((attribute) => {
    const dataAttribute = `data-i18n-${attribute}`;
    root.querySelectorAll(`[${dataAttribute}]`).forEach((node) => {
      const key = node.getAttribute(dataAttribute);
      const value = descriptions.get(key);
      if (value) node.setAttribute(attribute, value);
    });
  });

  root.querySelectorAll("[data-status-word]").forEach((node) => {
    const status = node.getAttribute("data-status-word");
    const value = descriptions.get(`status.${status}`);
    if (value) setInlineNote(node, value);
  });

  [...streamLinks, ...socialLinks].forEach((link) => {
    const label = descriptions.get(`${link.key}.label`);
    if (label) {
      link.label = label;
      document.querySelectorAll(`[data-social-label="${link.key}"]`).forEach((node) => {
        setInlineNote(node, label);
      });
    }

    const description = descriptions.get(link.key);
    if (!description) return;
    link.note = description;
    document.querySelectorAll(`[data-social-note="${link.key}"]`).forEach((node) => {
      setInlineNote(node, description);
    });
  });
}

const profileFacts = [
  ["profile.fact.name", "profile.fact.name_value"],
  ["profile.fact.pronouns", "profile.fact.pronouns_value"],
  ["profile.fact.mode", "profile.fact.mode_value"],
];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  Object.entries(attrs).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === "className") node.className = value;
    else if (key === "style") Object.assign(node.style, value);
    else if (key.startsWith("aria")) {
      node.setAttribute(key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), value);
    } else {
      node.setAttribute(key, value);
    }
  });

  children.flat().forEach((child) => {
    node.append(child instanceof Node ? child : document.createTextNode(child));
  });

  return node;
}

function isBareEmoteToken(token) {
  return /^[\p{L}\p{N}_-]+$/u.test(token);
}

function isEmoteBoundary(source, index) {
  if (index < 0 || index >= source.length) return true;
  return !/[\p{L}\p{N}_-]/u.test(source[index]);
}

function nextEmoteMatch(source, fromIndex) {
  let best = null;
  for (const [token, file] of activeEmotes.entries()) {
    if (!token) continue;
    let index = source.indexOf(token, fromIndex);
    while (index !== -1) {
      const bare = isBareEmoteToken(token);
      const beforeOkay = !bare || isEmoteBoundary(source, index - 1);
      const afterOkay = !bare || isEmoteBoundary(source, index + token.length);
      if (beforeOkay && afterOkay) break;
      index = source.indexOf(token, index + 1);
    }
    if (index === -1) continue;
    if (!best || index < best.index || (index === best.index && token.length > best.token.length)) {
      best = { index, token, file };
    }
  }
  return best;
}

function inlineNoteNodes(text) {
  const source = String(text || "");
  const nodes = [];
  let cursor = 0;

  const pushText = (value) => {
    String(value)
      .split("\n")
      .forEach((part, lineIndex) => {
        if (lineIndex > 0) nodes.push(el("br", { className: "inline-break" }));
        if (!part) return;

        const bracketPattern = /(\[\[[^\]]+\]\]|\[[^\]]+\])/g;
        let partCursor = 0;
        let bracketMatch = bracketPattern.exec(part);
        while (bracketMatch) {
          if (bracketMatch.index > partCursor) nodes.push(part.slice(partCursor, bracketMatch.index));
          const token = bracketMatch[0];
          if (token.startsWith("[[") && token.endsWith("]]")) nodes.push(token);
          else nodes.push(el("span", { className: "note-small" }, [token]));
          partCursor = bracketMatch.index + token.length;
          bracketMatch = bracketPattern.exec(part);
        }
        if (partCursor < part.length) nodes.push(part.slice(partCursor));
      });
  };

  while (cursor < source.length) {
    const match = nextEmoteMatch(source, cursor);
    if (!match) break;
    if (match.index > cursor) pushText(source.slice(cursor, match.index));
    nodes.push(emoteNode(match.token, match.file));
    cursor = match.index + match.token.length;
  }

  if (cursor < source.length) pushText(source.slice(cursor));
  return nodes;
}

function markSoftLoaded(node) {
  if (!node || !node.isConnected) return;

  node.classList.remove("is-soft-loaded");
  void node.offsetWidth;
  node.classList.add("is-soft-loaded");
}

function setInlineNote(node, text, { animate = true } = {}) {
  if (node instanceof SVGElement) {
    node.textContent = String(text || "");
    if (animate) markSoftLoaded(node);
    return;
  }

  node.replaceChildren(...inlineNoteNodes(text));
  if (animate) markSoftLoaded(node);
}

function platformIcon(name) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("mini-logo", `mini-logo-${name}`);

  const icons = {
    twitch: `
      <path class="logo-bg" d="M12 10 H54 L50 43 L37 43 L29 52 L29 43 H18 Z" />
      <path class="logo-mark" d="M25 23 V35 M39 23 V35" />
    `,
    youtube: `
      <path class="logo-bg" d="M10 20 C11 14 15 13 32 13 C49 13 53 14 54 20 C56 28 56 36 54 44 C53 50 49 51 32 51 C15 51 11 50 10 44 C8 36 8 28 10 20 Z" />
      <path class="logo-fill" d="M28 24 L42 32 L28 40 Z" />
    `,
    kick: `
      <path class="logo-bg" d="M14 12 H30 V26 L42 12 H54 L41 29 L55 52 H42 L32 36 L30 39 V52 H14 Z" />
    `,
    twitter: `
      <path class="logo-bg" d="M15 18 C23 25 30 26 37 20 C42 16 48 17 53 20 C50 21 48 23 47 26 C51 26 54 25 57 23 C55 27 52 30 49 32 C47 45 37 53 22 53 C16 53 11 51 7 48 C14 49 20 47 24 43 C18 42 15 39 13 34 C15 35 18 35 20 34 C14 31 12 27 12 21 C14 23 16 24 19 24 C16 21 15 19 15 18 Z" />
    `,
    bsky: `
      <path class="logo-bg" d="M31 31 C22 17 11 10 8 15 C5 20 14 31 25 36 C14 36 7 41 10 48 C13 55 25 50 32 39 C39 50 51 55 54 48 C57 41 50 36 39 36 C50 31 59 20 56 15 C53 10 42 17 33 31 Z" />
    `,
    tumblr: `
      <path class="logo-bg" d="M30 9 H42 V20 H52 V32 H42 V43 C42 47 45 49 50 47 L53 57 C49 59 45 60 40 60 C31 60 25 55 25 45 V32 H17 V22 C24 19 28 15 30 9 Z" />
    `,
    discord: `
      <path class="logo-bg" d="M18 18 C25 14 39 14 46 18 L52 47 C45 52 38 54 32 54 C26 54 19 52 12 47 Z" />
      <path class="logo-mark" d="M24 34 H24.5 M40 34 H40.5 M24 43 C29 46 35 46 40 43" />
    `,
  };

  svg.innerHTML = icons[name] || icons.twitter;
  return svg;
}

function artCarouselIcon(kind) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("art-control-icon", `art-control-icon-${kind}`);

  const icons = {
    previous: `
      <path class="art-icon-fill" d="M38 10 L12 31 L38 54 L38 42 L54 42 L54 22 L38 22 Z" />
      <path class="art-icon-scratch" d="M39 12 L15 31 L39 51 M15 28 L11 31 L15 35 M39 23 L53 24 M39 41 L53 40" />
    `,
    next: `
      <path class="art-icon-fill" d="M26 10 L52 31 L26 54 L26 42 L10 42 L10 22 L26 22 Z" />
      <path class="art-icon-scratch" d="M25 12 L49 31 L25 51 M49 28 L53 31 L49 35 M25 23 L11 24 M25 41 L11 40" />
    `,
    view: `
      <path class="art-icon-frame" d="M10 15 L52 12 L55 49 L12 52 Z" />
      <path class="art-icon-fill art-icon-sun" d="M40 20 C44 19 47 22 47 26 C47 30 44 32 40 31 C36 31 34 28 35 24 C35 22 37 20 40 20 Z" />
      <path class="art-icon-fill" d="M15 45 L25 31 L32 38 L38 32 L51 46 Z" />
      <path class="art-icon-scratch" d="M12 17 L50 14 M14 49 L53 47 M18 43 L25 34 L31 40 M34 39 L39 35 L48 44" />
    `,
  };

  svg.innerHTML = icons[kind] || icons.view;
  return svg;
}

function wifeIcon(images) {
  return el(
    "span",
    { className: "wife-combo", ariaHidden: "true" },
    images.map((src) =>
      el("img", {
        src,
        alt: "",
        loading: "lazy",
      }),
    ),
  );
}

function fileExtension(file) {
  const dot = file.lastIndexOf(".");
  return dot >= 0 ? file.slice(dot).toLowerCase() : "";
}

async function loadManifest(path, allowedExtensions) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return [];
    const manifest = await response.json();
    return (manifest.files || []).filter((file) => allowedExtensions.has(fileExtension(file)));
  } catch {
    return [];
  }
}

function panel({ id, titleKey, stampKey, children }) {
  return el("section", { id, className: "panel scribble-box" }, [
    el("header", { className: "panel-head" }, [
      el("span", { className: "panel-title", "data-i18n": titleKey }, [translatedText(titleKey)]),
      el("span", { className: "panel-stamp", "data-i18n": stampKey }, [translatedText(stampKey)]),
    ]),
    el("div", { className: "panel-body" }, children),
  ]);
}

function sticker(link, extraClass = "") {
  const hasStatus = Boolean(link.status);
  const status = link.status || "";
  return el(
    "a",
    {
      className: `sticker scribble-box sticker-${link.key} ${hasStatus ? `has-status is-${status}` : ""} ${extraClass}`,
      href: outboundHref(link.status === "live" && link.liveHref ? link.liveHref : link.href),
      target: "_blank",
      rel: "noopener noreferrer",
      style: { "--paper": link.color },
    },
    [
      hasStatus
        ? el("span", { className: `sticker-status-corner ${status}`, ariaLabel: translateTemplate("status.aria", { label: link.label, status: translatedText(`status.${status}`) }) }, [
            el("span", { className: "crayon-pip", ariaHidden: "true" }),
            el("span", { className: "sticker-status-word", "data-status-word": status }, [translatedText(`status.${status}`)]),
          ])
        : "",
      el("span", { className: "sticker-glyph", ariaHidden: "true" }, [link.images ? wifeIcon(link.images) : platformIcon(link.icon || link.key)]),
      el("span", { className: "sticker-label", "data-social-label": link.key }, [link.label]),
      el("span", { className: "sticker-note", "data-social-note": link.key }, inlineNoteNodes(link.note)),
    ],
  );
}

function playMwahSound() {
  playSiteSound(getMwahAudio(), 0.85);
}

function spawnWifeKissEffect(sticker) {
  if (!sticker) return;

  const stamp = el("span", { className: "wife-kiss-stamp", ariaHidden: "true" });
  const fixedText = el("span", { className: "wife-kiss-fixed-text", ariaHidden: "true" }, [
    translatedText("wife.kiss_fixed"),
  ]);
  sticker.append(stamp);
  sticker.append(fixedText);
  window.setTimeout(() => stamp.remove(), 1250);
  window.setTimeout(() => fixedText.remove(), 1850);

  const particleCount = 26;
  const kissParticles = translatedList("wife.kiss_particles");
  for (let index = 0; index < particleCount; index += 1) {
    const isKiss = index % 4 === 0;
    const angle = Math.random() * Math.PI * 2;
    const distance = 58 + Math.random() * 126;
    const particle = el(
      "span",
      { className: `wife-kiss-particle ${isKiss ? "is-kiss" : "is-heart"}`, ariaHidden: "true" },
      [isKiss ? "" : randomFrom(kissParticles)],
    );

    particle.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--ty", `${Math.sin(angle) * distance - 22}px`);
    particle.style.setProperty("--rot", `${Math.random() * 90 - 45}deg`);
    particle.style.setProperty("--scale", `${0.7 + Math.random() * 0.75}`);
    particle.style.animationDelay = `${Math.random() * 120}ms`;
    sticker.append(particle);
    window.setTimeout(() => particle.remove(), 1950);
  }
}

function getKissyCount() {
  try {
    return Number(sessionStorage.getItem(KISSY_STORAGE_KEY) || "0") || 0;
  } catch {
    return 0;
  }
}

function setKissyCount(count) {
  const safeCount = Math.max(0, Number(count) || 0);
  try {
    sessionStorage.setItem(KISSY_STORAGE_KEY, String(safeCount));
  } catch {}

  document.querySelectorAll("[data-kissy-count]").forEach((node) => {
    node.textContent = String(safeCount);
  });
}

let kissyCounterTimer = 0;

function showKissyCounter() {
  const counter = document.querySelector(".kissy-counter");
  if (!counter) return;

  counter.classList.add("is-visible");
  window.clearTimeout(kissyCounterTimer);
  kissyCounterTimer = window.setTimeout(() => {
    counter.classList.remove("is-visible");
  }, 3000);
}

function addKissy() {
  setKissyCount(getKissyCount() + 1);
  showKissyCounter();
}

function initializeWifeStickerEffects() {
  getMwahAudio();
  setKissyCount(getKissyCount());
  document.querySelectorAll(".sticker-wife").forEach((sticker) => {
    if (sticker.dataset.kissReady) return;
    sticker.dataset.kissReady = "true";
    sticker.addEventListener("pointerenter", () => {
      addKissy();
      playMwahSound();
      spawnWifeKissEffect(sticker);
    });
  });
}

function statusCard(link) {
  return el("article", { className: `status-card scribble-box ${link.status}` }, [
    el("span", { className: "status-light", ariaHidden: "true" }),
    el("strong", {}, [link.label]),
    el("span", { className: "status-word", "data-status-word": link.status }, [translatedText(`status.${link.status}`)]),
    el("p", { "data-i18n": link.status === "live" ? "status.live_copy" : "status.offline_copy" }, [
      translatedText(link.status === "live" ? "status.live_copy" : "status.offline_copy"),
    ]),
  ]);
}

function profilePanel() {
  const facts = el("dl", { className: "profile-facts" });
  profileFacts.forEach(([key, valueKey]) => {
    facts.append(el("div", {}, [
      el("dt", { "data-i18n": key }, [translatedText(key)]),
      el("dd", { "data-i18n": valueKey }, [translatedText(valueKey)]),
    ]));
  });

  return panel({
    id: "profile",
    titleKey: "panel.profile.title",
    stampKey: "panel.profile.stamp",
    children: [
      el("div", { className: "profile-layout" }, [
        el("figure", { className: "portrait art-carousel scribble-box" }, [
          el("div", { className: "art-frame", id: "kaz-art-frame", ariaLive: "polite" }, [
            el("img", { src: "zzz_assets/kazvt-transparent.gif", alt: translatedText("art.alt"), "data-i18n-alt": "art.alt" }),
          ]),
          el("div", { className: "art-carousel-controls", ariaLabel: translatedText("art.controls_aria"), "data-i18n-aria-label": "art.controls_aria" }, [
            el("button", { type: "button", className: "art-carousel-button art-carousel-step", "data-art-prev": "true", ariaLabel: translatedText("art.previous"), "data-i18n-aria-label": "art.previous", title: translatedText("art.previous"), "data-i18n-title": "art.previous" }, [artCarouselIcon("previous")]),
            el("button", { type: "button", className: "art-carousel-button art-carousel-view", "data-art-view": "true", ariaHaspopup: "dialog", ariaLabel: translatedText("art.view_aria"), "data-i18n-aria-label": "art.view_aria", title: translatedText("art.view_title"), "data-i18n-title": "art.view_title" }, [artCarouselIcon("view")]),
            el("button", { type: "button", className: "art-carousel-button art-carousel-step", "data-art-next": "true", ariaLabel: translatedText("art.next"), "data-i18n-aria-label": "art.next", title: translatedText("art.next"), "data-i18n-title": "art.next" }, [artCarouselIcon("next")]),
          ]),
          el("figcaption", { id: "kaz-art-caption", "data-i18n": "profile.art_caption" }, [translatedText("profile.art_caption")]),
        ]),
        el("div", { className: "profile-copy" }, [facts, el("p", { "data-i18n": "profile.bio" }, [translatedText("profile.bio")])]),
      ]),
    ],
  });
}

function guestbookPanel() {
  return panel({
    id: "guestbook",
    titleKey: "panel.guestbook.title",
    stampKey: "panel.guestbook.stamp",
    children: [
      el("div", { className: "guestbook-lines" }, [
        el("p", { "data-i18n": "guestbook.name" }, [translatedText("guestbook.name")]),
        el("p", { "data-i18n": "guestbook.message" }, [translatedText("guestbook.message")]),
      ]),
    ],
  });
}

function oldWebPanel() {
  return panel({
    id: "webcorner",
    titleKey: "panel.webcorner.title",
    stampKey: "panel.webcorner.stamp",
    children: [
      el("div", { className: "web-corner" }, [
        el("p", { className: "construction-sign", "data-i18n": "webcorner.construction" }, [translatedText("webcorner.construction")]),
        el("p", {}, [
          el("span", { "data-i18n": "webcorner.webring" }, [translatedText("webcorner.webring")]),
          " ",
          el("a", { href: "#links", "data-i18n": "webcorner.prev" }, [translatedText("webcorner.prev")]),
          " ",
          el("span", { "data-i18n": "webcorner.separator" }, [translatedText("webcorner.separator")]),
          " ",
          el("a", { href: "#badges", "data-i18n": "webcorner.random" }, [translatedText("webcorner.random")]),
          " ",
          el("span", { "data-i18n": "webcorner.separator" }, [translatedText("webcorner.separator")]),
          " ",
          el("a", { href: "#guestbook", "data-i18n": "webcorner.next" }, [translatedText("webcorner.next")]),
        ]),
      ]),
    ],
  });
}

function badgesPanel() {
  return panel({
    id: "badges",
    titleKey: "panel.badges.title",
    stampKey: "panel.badges.stamp",
    children: [
      el(
        "div",
        { className: "badge-grid" },
        buttonBadges.map((badge) =>
          el(
            "a",
            {
              href: `zzz_assets/buttons/${badge.file}`,
              download: badge.file,
              className: "badge-link",
              title: translateTemplate("badge.download_title", { label: translatedText(`badge.${badge.key}`) }),
            },
            [el("img", { src: `zzz_assets/buttons/${badge.file}`, alt: translatedText(`badge.${badge.key}`), width: "88", height: "31", "data-i18n-alt": `badge.${badge.key}` })],
          ),
        ),
      ),
    ],
  });
}

function createArtViewerModal() {
  return el("dialog", {
    className: "multistream-guide-modal art-viewer-modal",
    "data-art-viewer-modal": "true",
    "data-kazvt-modal": "true",
    ariaLabelledby: "art-viewer-modal-title",
  }, [
    el("div", { className: "multistream-guide-window art-viewer-window" }, [
      el("header", { className: "guide-window-bar" }, [
        el("div", { className: "guide-window-heading" }, [
          el("span", { className: "guide-window-kicker", ariaHidden: "true", "data-i18n": "art.viewer.kicker" }, [translatedText("art.viewer.kicker")]),
          el("span", { id: "art-viewer-modal-title", className: "guide-window-title", "data-i18n": "art.viewer.title" }, [translatedText("art.viewer.title")]),
        ]),
        el("div", { className: "guide-window-controls", ariaLabel: translatedText("art.viewer.controls_aria"), "data-i18n-aria-label": "art.viewer.controls_aria" }, [
          el("span", { className: "guide-window-stamp", ariaHidden: "true", "data-i18n": "art.viewer.stamp" }, [translatedText("art.viewer.stamp")]),
          el("button", { type: "button", className: "guide-window-button guide-window-close", "data-art-viewer-close": "true", ariaLabel: translatedText("art.viewer.close_aria"), "data-i18n-aria-label": "art.viewer.close_aria", title: translatedText("art.viewer.close_title"), "data-i18n-title": "art.viewer.close_title" }, ["×"]),
        ]),
      ]),
      el("div", { className: "guide-modal-viewport art-viewer-viewport" }, [
        el("div", { className: "guide-modal-content art-viewer-content" }, [
          el("figure", { className: "art-viewer-figure scribble-box" }, [
            el("div", { className: "art-viewer-image-stage" }, [
              el("img", { className: "art-viewer-image", "data-art-viewer-image": "true", src: "zzz_assets/kazvt-transparent.gif", alt: translatedText("art.alt") }),
            ]),
            el("figcaption", { className: "art-viewer-caption", "data-art-viewer-caption": "true" }, [translatedText("profile.art_caption")]),
          ]),
        ]),
      ]),
      el("footer", { className: "guide-window-status" }, [
        el("span", { "data-i18n": "art.viewer.status_left" }, [translatedText("art.viewer.status_left")]),
        el("span", { "data-i18n": "art.viewer.status_right" }, [translatedText("art.viewer.status_right")]),
      ]),
    ]),
  ]);
}

async function initializeArtCarousel() {
  const frame = document.querySelector("#kaz-art-frame");
  const caption = document.querySelector("#kaz-art-caption");
  const previousButton = document.querySelector("[data-art-prev]");
  const nextButton = document.querySelector("[data-art-next]");
  const viewButton = document.querySelector("[data-art-view]");
  if (!frame) return;

  const files = await loadManifest("zzz_kazArt/manifest.json", imageExtensions);
  const artFiles = files.length ? files : ["../zzz_assets/kazvt-transparent.gif"];
  let index = Math.floor(Math.random() * artFiles.length);
  let autoTimer = 0;
  let displayToken = 0;
  let lastViewerTrigger = null;
  const failedFiles = new Set();

  let viewerModal = document.querySelector("[data-art-viewer-modal]");
  if (!viewerModal) {
    viewerModal = createArtViewerModal();
    document.body.append(viewerModal);
    applyLanguageText(viewerModal);
  }
  const viewerImage = viewerModal.querySelector("[data-art-viewer-image]");
  const viewerCaption = viewerModal.querySelector("[data-art-viewer-caption]");

  function artUrl(file) {
    if (/^(https?:|data:|blob:)/i.test(file)) return file;
    if (file.startsWith("../")) return file.slice(3);
    const cleanFile = file.replace(/^\.?\//, "");
    return `zzz_kazArt/${cleanFile.split("/").map(encodeURIComponent).join("/")}`;
  }

  function artCaption(file) {
    return file.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || translatedText("art.default_caption");
  }

  function scheduleAutomaticAdvance(delay = ART_ROTATION_MS) {
    window.clearTimeout(autoTimer);
    autoTimer = window.setTimeout(() => {
      index = (index + 1) % artFiles.length;
      displayArt(artFiles[index], { panDuration: ART_ROTATION_MS });
      scheduleAutomaticAdvance(ART_ROTATION_MS);
    }, delay);
  }

  function holdAutomaticAdvance() {
    scheduleAutomaticAdvance(ART_MANUAL_HOLD_MS);
  }

  function displayArt(file, { panDuration = ART_ROTATION_MS, attempts = 0 } = {}) {
    const token = ++displayToken;
    const image = new Image();
    image.alt = translatedText("art.alt");
    image.className = "art-image slide-enter";
    image.style.setProperty("--art-pan-duration", `${panDuration}ms`);
    image.onerror = () => {
      if (token !== displayToken) return;
      failedFiles.add(file);
      const nextFile = artFiles.find((candidate) => !failedFiles.has(candidate));
      if (nextFile && attempts < artFiles.length) {
        index = artFiles.indexOf(nextFile);
        displayArt(nextFile, { panDuration, attempts: attempts + 1 });
      }
    };
    image.onload = () => {
      if (token !== displayToken) return;
      const wide = image.naturalWidth > image.naturalHeight;
      const square = image.naturalWidth === image.naturalHeight;
      image.classList.toggle("is-wide", wide);
      image.classList.toggle("is-tall", !wide && !square);
      frame.querySelector(".art-image")?.classList.add("slide-exit");
      window.setTimeout(() => {
        if (token !== displayToken) return;
        frame.replaceChildren(image);
        window.requestAnimationFrame(() => {
          if (token !== displayToken) return;
          const frameBox = frame.getBoundingClientRect();
          const imageBox = image.getBoundingClientRect();
          const reverse = Math.random() > 0.5;
          if (image.classList.contains("is-tall")) {
            const panY = Math.min(0, frameBox.height - imageBox.height);
            image.style.setProperty("--pan-y-start", reverse ? `${panY}px` : "0px");
            image.style.setProperty("--pan-y-end", reverse ? "0px" : `${panY}px`);
          }
          if (image.classList.contains("is-wide")) {
            const panX = Math.min(0, frameBox.width - imageBox.width);
            image.style.setProperty("--pan-x-start", reverse ? `${panX}px` : "0px");
            image.style.setProperty("--pan-x-end", reverse ? "0px" : `${panX}px`);
          }
          image.classList.remove("slide-enter");
        });
      }, 240);
      if (caption) caption.textContent = artCaption(file);
    };
    image.src = artUrl(file);
  }

  function manuallyStep(direction) {
    index = (index + direction + artFiles.length) % artFiles.length;
    displayArt(artFiles[index], { panDuration: ART_MANUAL_HOLD_MS });
    holdAutomaticAdvance();
  }

  function openViewer(trigger) {
    const currentImage = frame.querySelector(".art-image, img");
    if (!currentImage || !viewerImage || !viewerCaption) return;
    lastViewerTrigger = trigger || document.activeElement;
    viewerImage.src = currentImage.currentSrc || currentImage.src;
    viewerImage.alt = currentImage.alt || translatedText("art.alt");
    viewerCaption.textContent = caption?.textContent || translatedText("art.default_caption");
    holdAutomaticAdvance();
    document.body.classList.add("guide-modal-open");
    if (typeof viewerModal.showModal === "function") viewerModal.showModal();
    else viewerModal.setAttribute("open", "");
    updateCursorEffect(document.body.dataset.theme || "p1", { force: true });
    window.KazvtLineboil?.sync?.();
    viewerModal.querySelector("[data-art-viewer-close]")?.focus({ preventScroll: true });
  }

  function closeViewer() {
    if (typeof viewerModal.close === "function" && viewerModal.open) viewerModal.close();
    else viewerModal.removeAttribute("open");
  }

  previousButton?.addEventListener("click", () => manuallyStep(-1));
  nextButton?.addEventListener("click", () => manuallyStep(1));
  viewButton?.addEventListener("click", () => openViewer(viewButton));
  viewerModal.querySelector("[data-art-viewer-close]")?.addEventListener("click", closeViewer);
  viewerModal.addEventListener("click", (event) => {
    if (event.target === viewerModal) closeViewer();
  });
  viewerModal.addEventListener("close", () => {
    document.body.classList.remove("guide-modal-open");
    updateCursorEffect(document.body.dataset.theme || "p1", { force: true });
    window.KazvtLineboil?.sync?.();
    if (lastViewerTrigger instanceof HTMLElement) lastViewerTrigger.focus({ preventScroll: true });
  });
  viewerModal.addEventListener("cancel", () => {
    document.body.classList.remove("guide-modal-open");
  });

  displayArt(artFiles[index]);
  scheduleAutomaticAdvance(ART_ROTATION_MS);
}

function paintPanel() {
  return panel({
    id: "paint",
    titleKey: "panel.paint.title",
    stampKey: "panel.paint.stamp",
    children: [
      el("div", { className: "paint-app" }, [
        el("div", { className: "paint-zone scribble-box" }, [
          el("canvas", { id: "doodle-canvas", width: "720", height: "360", ariaLabel: translatedText("paint.canvas_aria"), "data-i18n-aria-label": "paint.canvas_aria" }),
          el("p", { className: "paint-caption", "data-i18n": "paint.caption" }, [translatedText("paint.caption")]),
        ]),
        el("div", { className: "paint-controls scribble-box", ariaLabel: translatedText("paint.tools_aria"), "data-i18n-aria-label": "paint.tools_aria" }, [
          el("button", { type: "button", "data-brush": "#ff432f", ariaPressed: "true", "data-i18n": "paint.red" }, [translatedText("paint.red")]),
          el("button", { type: "button", "data-brush": "#48cfff", ariaPressed: "false", "data-i18n": "paint.blue" }, [translatedText("paint.blue")]),
          el("button", { type: "button", "data-brush": "#50d85f", ariaPressed: "false", "data-i18n": "paint.green" }, [translatedText("paint.green")]),
          el("button", { type: "button", "data-brush": "#302135", ariaPressed: "false", "data-i18n": "paint.ink" }, [translatedText("paint.ink")]),
          el("button", { type: "button", "data-clear": "true", "data-i18n": "paint.clear" }, [translatedText("paint.clear")]),
          el("button", { type: "button", "data-save": "true", "data-i18n": "paint.save" }, [translatedText("paint.save")]),
        ]),
      ]),
    ],
  });
}

function updateSidebar(links) {
  links.forEach((link) => {
    const node = document.querySelector(`#side-${link.key}`);
    if (node) {
      node.setAttribute("data-status-word", link.status);
      setInlineNote(node, translatedText(`status.${link.status}`));
    }
  });
}

function readCachedVisitCount() {
  try {
    const value = Number(localStorage.getItem(VISIT_COUNTER_CACHE_KEY) || "0");
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function writeCachedVisitCount(count) {
  try {
    localStorage.setItem(VISIT_COUNTER_CACHE_KEY, String(count));
  } catch {
    // The global counter still works even if local storage is blocked.
  }
}

function setVisitCounterValue(counter, count, label) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  const digits = String(safeCount).padStart(6, "0").slice(-6);
  const digitBox = counter.querySelector(".counter-digits");

  if (digitBox) {
    digitBox.replaceChildren(...digits.split("").map((digit) => el("i", {}, [digit])));
  }

  counter.setAttribute(
    "aria-label",
    translateTemplate("footer.counter_aria", { label, count: safeCount }),
  );
}

function createVisitCounter({ label = "" } = {}) {
  const cachedCount = readCachedVisitCount();
  const counter = el("div", {
    className: "visit-counter",
    ariaLabel: translateTemplate("footer.counter_aria", { label, count: cachedCount }),
  }, [
    el("span", { className: "counter-label", "data-i18n": "footer.counter" }, [label]),
    el(
      "span",
      { className: "counter-digits", ariaHidden: "true" },
      String(cachedCount).padStart(6, "0").slice(-6).split("").map((digit) => el("i", {}, [digit])),
    ),
  ]);

  // Increment the shared counter once for this page load. Every device reads
  // and updates the same remote value. If the service is temporarily offline,
  // keep the last successfully seen global value instead of inventing a local
  // per-device increment.
  fetch(VISIT_COUNTER_ENDPOINT, {
    cache: "no-store",
    mode: "cors",
    referrerPolicy: "no-referrer",
  })
    .then((response) => {
      if (!response.ok) throw new Error(`visitor counter returned ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const count = Number(data?.value);
      if (!Number.isFinite(count) || count < 0) throw new Error("visitor counter returned an invalid value");
      const safeCount = Math.floor(count);
      writeCachedVisitCount(safeCount);
      setVisitCounterValue(counter, safeCount, label);
      counter.dataset.counterStatus = "global";
    })
    .catch(() => {
      counter.dataset.counterStatus = "cached";
    });

  return counter;
}

function getWumpaCount() {
  try {
    return Number(sessionStorage.getItem(WUMPA_STORAGE_KEY) || "0") || 0;
  } catch {
    return 0;
  }
}

function setWumpaCount(count) {
  const safeCount = Math.max(0, Number(count) || 0);
  try {
    sessionStorage.setItem(WUMPA_STORAGE_KEY, String(safeCount));
  } catch {}

  document.querySelectorAll("[data-wumpa-count]").forEach((node) => {
    node.textContent = String(safeCount);
  });
}

let wumpaCounterTimer = 0;
let wumpaToastTimer = 0;
let wumpaToastGeneration = 0;

function showWumpaCounter() {
  const counter = document.querySelector(".wumpa-counter");
  if (!counter) return;

  counter.classList.add("is-visible");
  window.clearTimeout(wumpaCounterTimer);
  wumpaCounterTimer = window.setTimeout(() => {
    counter.classList.remove("is-visible");
  }, 3000);
}

function showWumpaToast(message) {
  const toast = document.querySelector(".wumpa-toast");
  if (!toast) return;

  // Toast visibility is controlled only by the is-visible class. The generic
  // soft-text animation uses animation-fill-mode: both and can otherwise keep
  // opacity at 1 after the toast's hide timer has fired.
  toast.classList.remove("is-soft-loaded");
  setInlineNote(toast, message, { animate: false });

  const generation = ++wumpaToastGeneration;
  toast.classList.add("is-visible");
  window.clearTimeout(wumpaToastTimer);
  wumpaToastTimer = window.setTimeout(() => {
    // Ignore an obsolete callback if a newer notification has already reused
    // this same toast element.
    if (generation !== wumpaToastGeneration) return;
    toast.classList.remove("is-visible", "is-soft-loaded");
  }, 3000);
}

function addWumpa(amount, message) {
  setWumpaCount(getWumpaCount() + amount);
  showWumpaCounter();
  if (message) showWumpaToast(message);
}

function playFruitSound() {
  playSiteSound(getFruitAudio(), 0.95);
}

function playCrazyRecoverySound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = Math.max(0, Math.min(1, siteVolume * 0.42));
    master.connect(context.destination);

    const notes = [196, 247, 330, 494, 659, 880, 1175, 988, 784, 523];
    notes.forEach((frequency, index) => {
      const start = context.currentTime + index * 0.055;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = index % 2 ? "square" : "sawtooth";
      osc.frequency.setValueAtTime(frequency, start);
      osc.frequency.exponentialRampToValueAtTime(frequency * (index % 3 === 0 ? 1.8 : 0.72), start + 0.16);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.24);
    });

    window.setTimeout(() => context.close().catch(() => {}), 1100);
  } catch {}
}

const logoWumpaRuntimeState = {
  left: { hits: 0, eaten: false },
  right: { hits: 0, eaten: false },
};
let logoWumpaRecoverClicks = 0;

function logoWumpaState() {
  return logoWumpaRuntimeState;
}

function storedLogoWumpaEaten(side) {
  try {
    return localStorage.getItem(`${LOGO_WUMPA_EATEN_STORAGE_PREFIX}${side}`) === "1";
  } catch {
    return false;
  }
}

function setStoredLogoWumpaEaten(side, eaten) {
  try {
    const key = `${LOGO_WUMPA_EATEN_STORAGE_PREFIX}${side}`;
    if (eaten) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {}
}

function initializeLogoWumpas() {
  const buttons = [...document.querySelectorAll("[data-logo-wumpa]")];
  if (!buttons.length) return;

  const state = logoWumpaState();
  buttons.forEach((button) => {
    const side = button.getAttribute("data-logo-wumpa") || "left";
    state[side] ||= { hits: 0, eaten: false };
    if (storedLogoWumpaEaten(side)) {
      state[side].eaten = true;
      setStoredLogoWumpaEaten(side, true);
      button.classList.add("is-eaten");
      button.setAttribute("aria-hidden", "true");
    }

    button.addEventListener("click", () => {
      if (state[side].eaten) return;

      state[side].hits += 1;
      if (state[side].hits < 20) return;

      state[side].eaten = true;
      setStoredLogoWumpaEaten(side, true);
      button.classList.add("is-eaten");
      button.setAttribute("aria-hidden", "true");
      playFruitSound();
      addWumpa(100, translatedText("wumpa.logo.eaten_toast"));
    });
  });

  document.body.classList.add("wumpa-ready");
}

function initializeLogoRecovery() {
  const logo = document.querySelector(".logo-home");
  if (!logo) return;

  logo.addEventListener("click", (event) => {
    const state = logoWumpaState();
    const canRecover = Boolean(state.left?.eaten || state.right?.eaten);
    if (!canRecover) return;

    event.preventDefault();
    logoWumpaRecoverClicks += 1;
    if (logoWumpaRecoverClicks < 100) return;

    state.left = { hits: 0, eaten: false };
    state.right = { hits: 0, eaten: false };
    setStoredLogoWumpaEaten("left", false);
    setStoredLogoWumpaEaten("right", false);
    logoWumpaRecoverClicks = 0;

    document.querySelectorAll("[data-logo-wumpa]").forEach((button) => {
      button.classList.remove("is-eaten");
      button.classList.add("is-recovered");
      button.removeAttribute("aria-hidden");
      window.setTimeout(() => button.classList.remove("is-recovered"), 1800);
    });

    playCrazyRecoverySound();
    showWumpaToast(translatedText("wumpa.logo.recover_toast"));
  });
}

function spawnRandomWumpa(layer) {
  const existing = layer.querySelectorAll(".wumpa-fruit").length;
  if (existing > 2) return;

  const size = 28;
  const fruit = el("button", { className: "wumpa-fruit", type: "button", ariaLabel: translatedText("wumpa.random_aria"), "data-i18n-aria-label": "wumpa.random_aria" }, [
    el("img", { src: "zzz_assets/wumpa.gif", alt: "" }),
  ]);
  const side = randomFrom(["left", "right"]);
  const width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

  fruit.style.setProperty("--wumpa-size", `${size}px`);
  fruit.style.setProperty("--wumpa-life", "3200ms");

  fruit.style.top = `${20 + Math.random() * Math.max(40, height - 80)}px`;
  fruit.style.left = side === "left" ? "6px" : `${Math.max(6, width - size - 6)}px`;
  fruit.style.setProperty("--from-x", side === "left" ? `-${size + 14}px` : `${size + 14}px`);
  fruit.style.setProperty("--from-y", "0px");

  fruit.addEventListener("click", () => {
    if (fruit.classList.contains("is-eaten")) return;
    playFruitSound();
    fruit.classList.add("is-eaten");
    addWumpa(1);
    window.setTimeout(() => fruit.remove(), 430);
  });

  layer.append(fruit);
  window.setTimeout(() => fruit.remove(), 3300);
}

function initializeWumpaGame() {
  setWumpaCount(getWumpaCount());
  initializeLogoWumpas();
  initializeLogoRecovery();

  const layer = document.querySelector(".wumpa-layer");
  if (!layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let alive = true;
  const queueSpawn = () => {
    if (!alive) return;
    window.setTimeout(() => {
      if (!alive) return;
      spawnRandomWumpa(layer);
      queueSpawn();
    }, 2800 + Math.random() * 3600);
  };

  queueSpawn();
  window.addEventListener("pagehide", () => {
    alive = false;
  });
}

let scrollTargetHighlightTimer = 0;
let scrollTargetHighlightFrame = 0;

function canonicalSamePageHash(hash) {
  if (!hash || hash === "#") return hash;
  const rawId = hash.slice(1);
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {}

  // Keep old shared links alive, but normalize them to the shorter canonical URL.
  if (id === "multistream-guide-home") return "#multistream";
  return hash;
}

function findSamePageHashTarget(hash) {
  const canonicalHash = canonicalSamePageHash(hash);
  if (!canonicalHash || canonicalHash === "#") return null;
  const rawId = canonicalHash.slice(1);
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {}
  return document.getElementById(id);
}

function flashScrollTarget(target) {
  if (!(target instanceof HTMLElement)) return;

  document.querySelectorAll(".scroll-target-flash").forEach((element) => {
    element.classList.remove("scroll-target-flash");
  });
  window.clearTimeout(scrollTargetHighlightTimer);

  // Re-adding the class after a layout read makes repeat clicks flash again.
  target.classList.remove("scroll-target-flash");
  void target.offsetWidth;
  target.classList.add("scroll-target-flash");

  scrollTargetHighlightTimer = window.setTimeout(() => {
    target.classList.remove("scroll-target-flash");
  }, 1800);
}

function scrollHashTargetIntoView(hash, { flash = true } = {}) {
  const target = findSamePageHashTarget(hash);
  if (!target) return false;

  target.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
  if (flash) flashHashTargetAfterScroll(hash);
  return true;
}

function flashHashTargetAfterScroll(hash) {
  const target = findSamePageHashTarget(hash);
  if (!target) return;
  const highlightTarget = target.querySelector?.("[data-open-multistream-guide]") || target;

  window.cancelAnimationFrame(scrollTargetHighlightFrame);
  const startedAt = performance.now();
  let previousY = window.scrollY;
  let steadyFrames = 0;

  const waitForScroll = (now) => {
    const currentY = window.scrollY;
    if (Math.abs(currentY - previousY) < 0.75) steadyFrames += 1;
    else steadyFrames = 0;
    previousY = currentY;

    if (steadyFrames >= 5 || now - startedAt >= 1400) {
      flashScrollTarget(highlightTarget);
      return;
    }

    scrollTargetHighlightFrame = window.requestAnimationFrame(waitForScroll);
  };

  scrollTargetHighlightFrame = window.requestAnimationFrame(waitForScroll);
}

function initializeScrollTargetHighlights() {
  if (document.documentElement.dataset.scrollTargetHighlightsBound === "true") return;
  document.documentElement.dataset.scrollTargetHighlightsBound = "true";

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href*="#"]');
    if (!link) return;

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch {
      return;
    }

    const samePage = url.origin === window.location.origin
      && url.pathname === window.location.pathname
      && url.search === window.location.search;
    if (!samePage || !url.hash) return;

    // Let the browser perform the native smooth hash scroll first, then flash
    // the destination once the motion has settled.
    window.setTimeout(() => flashHashTargetAfterScroll(url.hash), 0);
  });

  window.addEventListener("hashchange", () => {
    const canonicalHash = canonicalSamePageHash(window.location.hash);
    if (canonicalHash && canonicalHash !== window.location.hash) {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}${canonicalHash}`);
    }
    window.setTimeout(() => scrollHashTargetIntoView(canonicalHash || window.location.hash), 0);
  });

  if (window.location.hash) {
    const canonicalHash = canonicalSamePageHash(window.location.hash);
    if (canonicalHash && canonicalHash !== window.location.hash) {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}${canonicalHash}`);
    }
    window.setTimeout(() => scrollHashTargetIntoView(canonicalHash || window.location.hash), 0);
  }
}

function multistreamGuidePanel() {
  return el("section", { id: "multistream-panel", className: "panel guide-launch-panel scribble-box" }, [
    el("button", { id: "multistream", type: "button", className: "guide-launch-button", "data-open-multistream-guide": "true", ariaHaspopup: "dialog" }, [
      el("span", { className: "guide-launch-kicker", "data-i18n": "guide.launch_kicker" }, [translatedText("guide.launch_kicker")]),
      el("span", { className: "guide-launch-title", "data-i18n": "guide.summary" }, [translatedText("guide.summary")]),
      el("span", { className: "guide-launch-pointer", ariaHidden: "true", "data-i18n": "guide.launch_pointer" }, [translatedText("guide.launch_pointer")]),
    ]),
  ]);
}

function createMultistreamGuideModal() {
  return el("dialog", {
    className: "multistream-guide-modal",
    "data-multistream-guide-modal": "true",
    ariaLabelledby: "multistream-guide-modal-title",
  }, [
    el("div", { className: "multistream-guide-window" }, [
      el("header", { className: "guide-window-bar" }, [
        el("div", { className: "guide-window-heading" }, [
          el("span", { className: "guide-window-kicker", ariaHidden: "true", "data-i18n": "guide.window.kicker" }, [translatedText("guide.window.kicker")]),
          el("span", { id: "multistream-guide-modal-title", className: "guide-window-title", "data-i18n": "guide.panel_title" }, [translatedText("guide.panel_title")]),
        ]),
        el("div", { className: "guide-window-controls", ariaLabel: translatedText("guide.window.controls_aria"), "data-i18n-aria-label": "guide.window.controls_aria" }, [
          el("span", { className: "guide-window-stamp", ariaHidden: "true", "data-i18n": "guide.window.map_stamp" }, [translatedText("guide.window.map_stamp")]),
          el("button", { type: "button", className: "guide-window-button guide-window-close", "data-guide-close": "true", ariaLabel: translatedText("guide.window.close_aria"), "data-i18n-aria-label": "guide.window.close_aria", title: translatedText("guide.window.close_title"), "data-i18n-title": "guide.window.close_title" }, [translatedText("guide.window.close_symbol")]),
        ]),
      ]),
      el("div", { className: "guide-modal-viewport", "data-guide-viewport": "true" }, [
        el("div", { className: "guide-modal-content" }, [
          el("div", { className: "embedded-guide-slot", "data-guide-slot": "true" }, [
            el("p", { className: "embedded-guide-loading", "data-i18n": "guide.loading" }, [translatedText("guide.loading")]),
          ]),
        ]),
      ]),
      el("footer", { className: "guide-window-status" }, [
        el("span", { "data-i18n": "guide.window.status_scroll" }, [translatedText("guide.window.status_scroll")]),
        el("span", { "data-i18n": "guide.window.status_tools" }, [translatedText("guide.window.status_tools")]),
      ]),
    ]),
  ]);
}

async function initializeMultistreamGuideModal() {
  if (document.body.dataset.page !== "home") return;

  let modal = document.querySelector("[data-multistream-guide-modal]");
  if (!modal) {
    modal = createMultistreamGuideModal();
    document.body.append(modal);
    applyLanguageText(modal);
  }

  const viewport = modal.querySelector("[data-guide-viewport]");
  const slot = modal.querySelector("[data-guide-slot]");
  if (!viewport || !slot) return;

  let lastTrigger = null;
  let loaded = modal.dataset.loaded === "true";

  const loadGuide = async () => {
    if (loaded) return;
    slot.replaceChildren(el("p", { className: "embedded-guide-loading", "data-i18n": "guide.loading" }, [translatedText("guide.loading")]));
    markSoftLoaded(slot);

    try {
      const response = await fetch("multistream-guide.html", { cache: "no-store" });
      if (!response.ok) throw new Error("guide fetch failed");
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const body = doc.querySelector(".guide-panel .panel-body");
      if (!body) throw new Error("guide body missing");

      const fragment = document.createDocumentFragment();
      [...body.children].forEach((child) => fragment.append(document.importNode(child, true)));
      slot.replaceChildren(fragment);
      applyLanguageText(slot);
      markSoftLoaded(slot);
      loaded = true;
      modal.dataset.loaded = "true";
    } catch {
      const fallback = el("a", { className: "guide-link", href: "multistream-guide.html", "data-i18n": "guide.load_standalone" }, [translatedText("guide.load_standalone")]);
      slot.replaceChildren(
        el("p", { className: "embedded-guide-error" }, [
          translatedText("guide.load_error"),
          " ",
          fallback,
          translatedText("guide.period"),
        ]),
      );
      markSoftLoaded(slot);
    }
  };

  const openGuide = async (trigger) => {
    lastTrigger = trigger || document.activeElement;
    document.body.classList.add("guide-modal-open");
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
    updateCursorEffect(document.body.dataset.theme || "p1", { force: true });
    window.KazvtLineboil?.sync?.();
    viewport.scrollTo({ top: 0, left: 0, behavior: "auto" });
    await loadGuide();
    modal.querySelector("[data-guide-close]")?.focus({ preventScroll: true });
  };

  const closeGuide = () => {
    if (typeof modal.close === "function" && modal.open) modal.close();
    else modal.removeAttribute("open");
  };

  document.querySelectorAll("[data-open-multistream-guide]").forEach((trigger) => {
    if (trigger.dataset.guideModalBound === "true") return;
    trigger.dataset.guideModalBound = "true";
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openGuide(trigger);
    });
  });

  modal.querySelector("[data-guide-close]")?.addEventListener("click", closeGuide);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeGuide();
  });
  modal.addEventListener("close", () => {
    document.body.classList.remove("guide-modal-open");
    updateCursorEffect(document.body.dataset.theme || "p1", { force: true });
    window.KazvtLineboil?.sync?.();
    if (lastTrigger instanceof HTMLElement) lastTrigger.focus({ preventScroll: true });
  });
  modal.addEventListener("cancel", () => {
    document.body.classList.remove("guide-modal-open");
  });
}

async function mountLanguageSelector() {
  return window.KazvtLanguageDock?.mount?.();
}

function initializeSiteTools() {
  const themeButtons = [...document.querySelectorAll("[data-tool-theme]")];
  const boilButton = document.querySelector("[data-tool-boil]");
  const initialTheme = storedTheme(themeButtons);

  applySiteTheme(initialTheme, themeButtons, { persist: false });

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const theme = button.getAttribute("data-tool-theme");
      applySiteTheme(theme || "p1", themeButtons);
    });
  });

  if (boilButton) {
    boilButton.addEventListener("click", () => {
      const active = document.body.dataset.boil !== "calm";
      document.body.dataset.boil = active ? "calm" : "extra";
      boilButton.setAttribute("aria-pressed", String(!active));
      setInlineNote(boilButton, active ? translatedText("boil.steady") : translatedText("boil.extra"));
    });
  }
}

function encodeAnimatedGif(frames, width, height, palette, delay = 9) {
  const colorTableSize = 1 << Math.ceil(Math.log2(palette.length));
  const paddedPalette = [...palette];
  while (paddedPalette.length < colorTableSize) paddedPalette.push([0, 0, 0]);

  const minCodeSize = Math.max(2, Math.ceil(Math.log2(colorTableSize)));
  const bytes = [];
  const writeAscii = (text) => [...text].forEach((char) => bytes.push(char.charCodeAt(0)));
  const writeShort = (value) => bytes.push(value & 255, (value >> 8) & 255);
  const writeSubBlocks = (data) => {
    for (let index = 0; index < data.length; index += 255) {
      const block = data.slice(index, index + 255);
      bytes.push(block.length, ...block);
    }
    bytes.push(0);
  };

  writeAscii("GIF89a");
  writeShort(width);
  writeShort(height);
  bytes.push(0x80 | 0x70 | (Math.log2(colorTableSize) - 1), 0, 0);
  paddedPalette.forEach(([r, g, b]) => bytes.push(r, g, b));

  bytes.push(0x21, 0xff, 0x0b);
  writeAscii("NETSCAPE2.0");
  bytes.push(0x03, 0x01);
  writeShort(0);
  bytes.push(0);

  frames.forEach((indices) => {
    bytes.push(0x21, 0xf9, 0x04, 0x00);
    writeShort(delay);
    bytes.push(0, 0);
    bytes.push(0x2c);
    writeShort(0);
    writeShort(0);
    writeShort(width);
    writeShort(height);
    bytes.push(0);
    bytes.push(minCodeSize);
    writeSubBlocks(lzwEncode(indices, minCodeSize));
  });

  bytes.push(0x3b);
  return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
}

function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const codeSize = minCodeSize + 1;
  const dataCodesPerClear = Math.max(1, (1 << codeSize) - (endCode + 1));
  const writer = createBitWriter();

  for (let index = 0; index < indices.length; index += dataCodesPerClear) {
    writer.write(clearCode, codeSize);
    const block = indices.slice(index, index + dataCodesPerClear);
    for (const pixel of block) {
      writer.write(pixel, codeSize);
    }
  }

  writer.write(endCode, codeSize);
  return writer.finish();
}

function createBitWriter() {
  const bytes = [];
  let current = 0;
  let bitCount = 0;

  return {
    write(code, size) {
      current |= code << bitCount;
      bitCount += size;

      while (bitCount >= 8) {
        bytes.push(current & 255);
        current >>= 8;
        bitCount -= 8;
      }
    },
    finish() {
      if (bitCount > 0) bytes.push(current & 255);
      return bytes;
    },
  };
}

function nearestPaletteIndex(r, g, b, palette) {
  let bestIndex = 0;
  let bestDistance = Infinity;

  palette.forEach((color, index) => {
    const dr = r - color[0];
    const dg = g - color[1];
    const db = b - color[2];
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function initializeDrawingPad() {
  const canvas = document.querySelector("#doodle-canvas");
  const controls = document.querySelector(".paint-controls");
  if (!canvas || !controls) return;

  const context = canvas.getContext("2d");
  const strokes = [];
  let activeStroke = null;
  let brush = "#ff432f";
  let frame = 0;
  const gifPalette = [
    [255, 253, 244],
    [48, 33, 53],
    [255, 67, 47],
    [72, 207, 255],
    [80, 216, 95],
    [255, 228, 92],
    [255, 255, 255],
    [224, 213, 230],
  ];

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function drawPaper(targetContext, targetCanvas) {
    targetContext.fillStyle = "#fffdf4";
    targetContext.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    targetContext.strokeStyle = "#e0d5e6";
    targetContext.lineWidth = 1;

    for (let x = 0; x < targetCanvas.width; x += 18) {
      targetContext.beginPath();
      targetContext.moveTo(x, 0);
      targetContext.lineTo(x, targetCanvas.height);
      targetContext.stroke();
    }

    for (let y = 0; y < targetCanvas.height; y += 18) {
      targetContext.beginPath();
      targetContext.moveTo(0, y);
      targetContext.lineTo(targetCanvas.width, y);
      targetContext.stroke();
    }
  }

  function renderFrame(targetContext, targetCanvas, frameNumber) {
    drawPaper(targetContext, targetCanvas);
    strokes.forEach((stroke, strokeIndex) => {
      if (stroke.points.length < 2) return;
      targetContext.strokeStyle = stroke.color;
      targetContext.lineWidth = 7;
      targetContext.lineCap = "round";
      targetContext.lineJoin = "round";
      targetContext.beginPath();

      stroke.points.forEach((point, pointIndex) => {
        const jitter = ((pointIndex + frameNumber + strokeIndex) % 3) - 1;
        const x = point.x + jitter * 1.8;
        const y = point.y - jitter * 1.4;
        if (pointIndex === 0) targetContext.moveTo(x, y);
        else targetContext.lineTo(x, y);
      });

      targetContext.stroke();
    });
  }

  function redraw() {
    renderFrame(context, canvas, frame);
    frame += 1;
  }

  function frameToPaletteIndices(targetContext, targetCanvas) {
    const data = targetContext.getImageData(0, 0, targetCanvas.width, targetCanvas.height).data;
    const indices = new Uint8Array(targetCanvas.width * targetCanvas.height);

    for (let source = 0, output = 0; source < data.length; source += 4, output += 1) {
      indices[output] = nearestPaletteIndex(data[source], data[source + 1], data[source + 2], gifPalette);
    }

    return [...indices];
  }

  async function saveAnimatedGif(button) {
    const previousText = button.textContent;
    button.disabled = true;
    setInlineNote(button, translatedText("paint.making"));
    await new Promise((resolve) => window.setTimeout(resolve, 20));

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportContext = exportCanvas.getContext("2d");
    const frames = [];

    for (let index = 0; index < 8; index += 1) {
      renderFrame(exportContext, exportCanvas, frame + index);
      frames.push(frameToPaletteIndices(exportContext, exportCanvas));
    }

    const blob = encodeAnimatedGif(frames, exportCanvas.width, exportCanvas.height, gifPalette, 8);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "kazvt-doodle-boil.gif";
    link.href = url;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    button.disabled = false;
    setInlineNote(button, previousText);
  }

  function startStroke(event) {
    event.preventDefault();
    activeStroke = { color: brush, points: [pointFromEvent(event)] };
    strokes.push(activeStroke);
    canvas.setPointerCapture(event.pointerId);
  }

  function continueStroke(event) {
    if (!activeStroke) return;
    activeStroke.points.push(pointFromEvent(event));
    redraw();
  }

  function finishStroke() {
    activeStroke = null;
  }

  canvas.addEventListener("pointerdown", startStroke);
  canvas.addEventListener("pointermove", continueStroke);
  canvas.addEventListener("pointerup", finishStroke);
  canvas.addEventListener("pointerleave", finishStroke);

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.brush) {
      brush = button.dataset.brush;
      controls.querySelectorAll("[data-brush]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
    }

    if (button.dataset.clear) {
      strokes.length = 0;
      redraw();
    }

    if (button.dataset.save) {
      saveAnimatedGif(button);
    }
  });

  redraw();
  let redrawTimer = 0;
  const startRedrawTimer = () => {
    if (redrawTimer || document.hidden) return;
    redrawTimer = window.setInterval(redraw, 360);
  };
  const stopRedrawTimer = () => {
    if (!redrawTimer) return;
    window.clearInterval(redrawTimer);
    redrawTimer = 0;
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) startRedrawTimer();
      else stopRedrawTimer();
    }, { rootMargin: "120px" });
    observer.observe(canvas);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopRedrawTimer();
      else {
        const rect = canvas.getBoundingClientRect();
        if (rect.bottom >= -120 && rect.top <= window.innerHeight + 120) startRedrawTimer();
      }
    });
  } else {
    startRedrawTimer();
  }
}

async function initializeMusicPlayer() {
  const mount = document.querySelector("#music-player");
  if (!mount) return;

  const tracks = await loadManifest("zzz_music/manifest.json", audioExtensions);
  if (!tracks.length) {
    mount.replaceChildren(el("p", { className: "small-copy", "data-i18n": "music.empty" }, [translatedText("music.empty")]));
    return;
  }

  const audio = new Audio();
  audio.preload = "metadata";
  let index = 0;
  let audioContext = null;
  let analyser = null;
  let source = null;
  const title = el("p", { className: "track-title" }, [""]);
  const play = el("button", { type: "button", className: "music-button", "data-i18n": "music.play" }, [translatedText("music.play")]);
  const prev = el("button", { type: "button", className: "music-button", ariaLabel: translatedText("music.previous"), "data-i18n-aria-label": "music.previous", "data-i18n": "music.previous_symbol" }, [translatedText("music.previous_symbol")]);
  const next = el("button", { type: "button", className: "music-button", ariaLabel: translatedText("music.next"), "data-i18n-aria-label": "music.next", "data-i18n": "music.next_symbol" }, [translatedText("music.next_symbol")]);
  const seek = el("input", { type: "range", min: "0", max: "1000", value: "0", ariaLabel: translatedText("music.seek"), "data-i18n-aria-label": "music.seek" });
  const storedVolume = (() => {
    try {
      const stored = sessionStorage.getItem(VOLUME_STORAGE_KEY);
      if (stored === null || stored.trim() === "") return DEFAULT_SITE_VOLUME;
      const value = Number(stored);
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_SITE_VOLUME;
    } catch {
      return DEFAULT_SITE_VOLUME;
    }
  })();
  const volume = el("input", { type: "range", min: "0", max: "1", step: "0.01", value: String(storedVolume), ariaLabel: translatedText("music.volume"), "data-i18n-aria-label": "music.volume" });
  const visualizer = el("canvas", {
    width: "150",
    height: "44",
    className: "visualizer",
    role: "button",
    tabindex: "0",
    title: translateTemplate("music.visualizer_title", { mode: translatedText("music.mode.bars") }),
    ariaLabel: translateTemplate("music.visualizer", { mode: translatedText("music.mode.bars") }),
  });
  const visualContext = visualizer.getContext("2d");
  const visualizerBinCrop = 0.58;
  const visualizerBarCount = 12;
  const visualizerTrebleTilt = 0.35;
  const visualizerPeakBias = 0.72;
  const visualizerModes = ["bars", "scope", "burst"];
  const visualizerLevels = Array(visualizerBarCount).fill(0);
  let visualizerMode = visualizerModes[0];

  function cssVar(name, fallback) {
    return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
  }

  function visualizerColors() {
    return {
      bg: cssVar("--visualizer-bg", cssVar("--banner", "#16111a")),
      primary: cssVar("--visualizer-primary", cssVar("--green", "#6cff7a")),
      secondary: cssVar("--visualizer-secondary", cssVar("--blue", "#48cfff")),
      accent: cssVar("--visualizer-accent", cssVar("--yellow", "#ffef5d")),
    };
  }

  function trackUrl(file) {
    return `zzz_music/${encodeURIComponent(file)}`;
  }

  function niceTitle(file) {
    return file.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
  }

  function loadTrack(nextIndex, autoplay = false) {
    index = (nextIndex + tracks.length) % tracks.length;
    audio.src = trackUrl(tracks[index]);
    title.textContent = niceTitle(tracks[index]);
    seek.value = "0";
    if (autoplay) audio.play().catch(() => {});
  }

  function setupAudioGraph() {
    if (audioContext) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.06;
    analyser.minDecibels = -84;
    analyser.maxDecibels = -12;
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
  }

  function updateVisualizerLabel() {
    visualizer.setAttribute("aria-label", translateTemplate("music.visualizer", { mode: translatedText(`music.mode.${visualizerMode}`) }));
    visualizer.title = translateTemplate("music.visualizer_title", { mode: translatedText(`music.mode.${visualizerMode}`) });
  }

  function cycleVisualizerMode() {
    const nextMode = (visualizerModes.indexOf(visualizerMode) + 1) % visualizerModes.length;
    visualizerMode = visualizerModes[nextMode];
    updateVisualizerLabel();
    drawVisualizerFrame();
  }

  function clearVisualizer(width, height) {
    visualContext.fillStyle = visualizerColors().bg;
    visualContext.fillRect(0, 0, width, height);
  }

  function drawIdleVisualizer(width, height) {
    if (visualizerMode === "scope") {
      const waveform = Uint8Array.from({ length: 64 }, (_, index) => {
        const wave = Math.sin(index * 0.5) * 24 + Math.sin(index * 0.17) * 10;
        return Math.round(128 + wave);
      });
      drawScopeVisualizer(waveform, width, height);
      return;
    }

    if (visualizerMode === "burst") {
      drawBurstVisualizer([48, 78, 118, 158, 112, 182, 146, 96, 168, 122, 82, 52], width, height);
      return;
    }

    visualContext.fillStyle = visualizerColors().primary;
    for (let x = 6; x < width; x += 14) {
      const bar = 5 + ((x / 14) % 4) * 4;
      visualContext.fillRect(x, height - bar - 5, 9, bar);
    }
  }

  function getVisualizerLevels(data) {
    const normalized = Array.from(data, (value) => Math.min(255, value / Math.max(siteVolume, 0.08)));
    const activeBins = normalized.slice(0, Math.max(1, Math.ceil(normalized.length * visualizerBinCrop)));
    const bars = Math.min(visualizerBarCount, activeBins.length);
    const levels = [];

    for (let bar = 0; bar < bars; bar += 1) {
      const start = Math.floor((bar / bars) * activeBins.length);
      const end = Math.max(start + 1, Math.floor(((bar + 1) / bars) * activeBins.length));
      let weightedTotal = 0;
      let weightedPeak = 0;
      for (let bin = start; bin < end; bin += 1) {
        const position = activeBins.length > 1 ? bin / (activeBins.length - 1) : 0;
        const weight = 1 - visualizerTrebleTilt / 2 + position * visualizerTrebleTilt;
        const weightedValue = Math.min(255, activeBins[bin] * weight);
        weightedTotal += weightedValue;
        weightedPeak = Math.max(weightedPeak, weightedValue);
      }
      const average = weightedTotal / (end - start);
      const value = weightedPeak * visualizerPeakBias + average * (1 - visualizerPeakBias);

      const previous = visualizerLevels[bar] || 0;
      const position = bars > 1 ? bar / (bars - 1) : 0;
      const followUp = 0.96 - position * 0.32;
      const followDown = 0.9 - position * 0.5;
      const follow = value > previous ? followUp : followDown;
      const smoothed = previous + (value - previous) * follow;
      visualizerLevels[bar] = smoothed;
      levels.push(smoothed);
    }

    return levels;
  }

  function drawBarVisualizer(levels, width, height) {
    const barWidth = width / levels.length;
    const colors = visualizerColors();
    levels.forEach((value, bar) => {
      const barHeight = Math.max(3, Math.pow(value / 255, 0.72) * (height - 8));
      visualContext.fillStyle = bar % 2 ? colors.secondary : colors.primary;
      visualContext.fillRect(bar * barWidth + 2, height - barHeight - 4, Math.max(5, barWidth - 4), barHeight);
    });
  }

  function drawScopeVisualizer(waveform, width, height) {
    const colors = visualizerColors();
    const step = 4;
    const mid = Math.round(height / 2);
    visualContext.strokeStyle = colors.secondary;
    visualContext.lineWidth = 3;
    visualContext.beginPath();

    for (let x = 0; x <= width; x += step) {
      const index = Math.min(waveform.length - 1, Math.floor((x / width) * waveform.length));
      const wave = Math.max(-1, Math.min(1, ((waveform[index] - 128) / 128) / Math.max(siteVolume, 0.08)));
      const y = Math.round(mid + wave * (height * 0.42));
      if (x === 0) visualContext.moveTo(x, y);
      else visualContext.lineTo(x, y);
    }

    visualContext.stroke();
    visualContext.strokeStyle = colors.primary;
    visualContext.lineWidth = 2;
    visualContext.beginPath();
    for (let x = 0; x <= width; x += step * 2) {
      const index = Math.min(waveform.length - 1, Math.floor((x / width) * waveform.length));
      const wave = Math.max(-1, Math.min(1, ((waveform[index] - 128) / 128) / Math.max(siteVolume, 0.08)));
      const y = Math.round(mid - wave * (height * 0.3));
      if (x === 0) visualContext.moveTo(x, y);
      else visualContext.lineTo(x, y);
    }
    visualContext.stroke();
  }

  function drawBurstVisualizer(levels, width, height) {
    const centerY = Math.round(height / 2);
    const slotWidth = width / levels.length;
    const colors = visualizerColors();

    levels.forEach((value, index) => {
      const strength = Math.pow(value / 255, 0.82);
      const barHeight = Math.max(4, strength * (height - 10));
      const x = Math.round(index * slotWidth + 2);
      const y = Math.round(centerY - barHeight / 2);
      visualContext.fillStyle = index % 2 ? colors.primary : colors.secondary;
      visualContext.fillRect(x, y, Math.max(5, slotWidth - 5), Math.round(barHeight));
      if (strength > 0.42) {
        visualContext.fillStyle = colors.accent;
        visualContext.fillRect(x + 1, Math.max(3, y - 3), Math.max(3, slotWidth - 7), 2);
      }
    });
  }

  let visualizerTimer = 0;
  const visualizerFrameMs = Math.round(1000 / 24);

  function drawVisualizerFrame() {
    const width = visualizer.width;
    const height = visualizer.height;
    clearVisualizer(width, height);

    if (!analyser || audio.paused) {
      drawIdleVisualizer(width, height);
      return;
    }

    if (visualizerMode === "scope") {
      const waveform = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(waveform);
      drawScopeVisualizer(waveform, width, height);
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const levels = getVisualizerLevels(data);
    if (visualizerMode === "burst") drawBurstVisualizer(levels, width, height);
    else drawBarVisualizer(levels, width, height);
  }

  function stopVisualizerLoop({ drawIdle = true } = {}) {
    if (visualizerTimer) window.clearTimeout(visualizerTimer);
    visualizerTimer = 0;
    if (drawIdle) drawVisualizerFrame();
  }

  function visualizerLoop() {
    visualizerTimer = 0;
    if (audio.paused || document.hidden) {
      drawVisualizerFrame();
      return;
    }

    drawVisualizerFrame();
    visualizerTimer = window.setTimeout(visualizerLoop, visualizerFrameMs);
  }

  function startVisualizerLoop() {
    if (visualizerTimer || audio.paused || document.hidden) return;
    drawVisualizerFrame();
    visualizerTimer = window.setTimeout(visualizerLoop, visualizerFrameMs);
  }

  play.addEventListener("click", async () => {
    setupAudioGraph();
    if (audioContext?.state === "suspended") await audioContext.resume();
    if (audio.paused) {
      await audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });

  prev.addEventListener("click", () => loadTrack(index - 1, !audio.paused));
  next.addEventListener("click", () => loadTrack(index + 1, !audio.paused));
  audio.addEventListener("play", () => {
    setInlineNote(play, translatedText("music.pause"));
    startVisualizerLoop();
  });
  audio.addEventListener("pause", () => {
    setInlineNote(play, translatedText("music.play"));
    stopVisualizerLoop();
  });
  audio.addEventListener("ended", () => loadTrack(index + 1, true));
  audio.addEventListener("error", () => {
    title.textContent = translateTemplate("music.error", { track: niceTitle(tracks[index]) });
  });
  audio.addEventListener("timeupdate", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
    }
  });
  seek.addEventListener("input", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
    }
  });
  volume.addEventListener("input", () => {
    siteVolume = Number(volume.value);
    audio.volume = siteVolume;
    try {
      sessionStorage.setItem(VOLUME_STORAGE_KEY, String(siteVolume));
    } catch {}
  });
  visualizer.addEventListener("click", cycleVisualizerMode);
  visualizer.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    cycleVisualizerMode();
  });

  siteVolume = Number(volume.value);
  audio.volume = siteVolume;
  updateVisualizerLabel();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopVisualizerLoop({ drawIdle: false });
    else if (!audio.paused) startVisualizerLoop();
    else drawVisualizerFrame();
  });
  window.addEventListener("kazvt:themechange", () => drawVisualizerFrame());
  mount.replaceChildren(
    title,
    el("div", { className: "music-controls" }, [prev, play, next]),
    seek,
    el("label", { className: "volume-label" }, [el("span", { "data-i18n": "music.volume" }, [translatedText("music.volume")]), volume]),
    visualizer,
  );
  markSoftLoaded(mount);
  loadTrack(0);
  drawVisualizerFrame();
}

async function render(statusOverrides = {}) {
  const app = document.querySelector("#app");
  const links = streamLinks.map((link) => ({
    ...link,
    status: normalizeStatus(statusOverrides[link.key] || link.status),
  }));

  updateSidebar(links);
  app.replaceChildren(
    panel({
      id: "links",
      titleKey: "panel.links.title",
      stampKey: "panel.links.stamp",
      children: [el("div", { className: "sticker-grid" }, [...links, ...socialLinks].map(sticker))],
    }),
    multistreamGuidePanel(),
    profilePanel(),
    oldWebPanel(),
    guestbookPanel(),
    paintPanel(),
    badgesPanel(),
    el("footer", { className: "page-footer scribble-box" }, [
      el("span", { "data-i18n": "footer.message" }, [translatedText("footer.message")]),
      createVisitCounter({ label: translatedText("footer.counter") }),
    ]),
  );
  markSoftLoaded(app);

  initializeDrawingPad();
  initializeArtCarousel();
  await initializeMusicPlayer();
  applyLanguageText(document);
  initializeWifeStickerEffects();
  initializeMultistreamGuideModal();
  initializeWumpaGame();
  if (document.body.dataset.theme === "p16") updateCursorEffect("p16", { force: true });
}

async function loadStatus() {
  return parseColonKeyValueLines(await loadTextLines("status.txt"));
}

async function loadLastStreamInfo() {
  return parseColonKeyValueLines(await loadTextLines("last_stream_info.txt"));
}

function hasLivePlatform(statuses = {}) {
  return streamLinks.some((link) => normalizeStatus(String(statuses[link.key] || "").trim().toLowerCase()) === "live");
}

function liveStreamMarqueePiece(title, profile) {
  const piece = el("span", {
    className: `marquee-piece marquee-piece-boil-${profile.variant}`,
    ariaHidden: "true",
  });
  piece.style.setProperty("--marquee-piece-boil-duration", `${profile.duration}ms`);
  piece.style.setProperty("--marquee-piece-boil-delay", `-${profile.phase}ms`);
  piece.style.setProperty("--marquee-piece-boil-direction", profile.reverse ? "reverse" : "normal");
  setInlineNote(piece, title, { animate: false });
  return piece;
}

function initializeLiveStreamTitle(statuses = {}, streamInfo = {}) {
  document.querySelector("[data-live-stream-title-shell]")?.remove();

  const title = String(streamInfo.title || "").trim();
  if (!title || !hasLivePlatform(statuses)) return;

  const originalMarquee = document.querySelector(".marquee");
  if (!originalMarquee) return;

  const shell = el("div", {
    className: "live-stream-title-shell live-stream-title-spawn",
  });
  shell.dataset.liveStreamTitleShell = "";

  const bar = el("div", {
    className: "marquee scribble-box live-stream-title-marquee",
    ariaLabel: title,
  });
  const track = el("span");
  track.dataset.liveStreamTitleTrack = "";
  bar.append(track);
  shell.append(bar);
  originalMarquee.before(shell);

  const variants = ["a", "b", "c", "d"];
  const profile = {
    variant: variants[Math.floor(Math.random() * variants.length)],
    duration: 430 + Math.floor(Math.random() * 190),
    phase: Math.floor(Math.random() * 430),
    reverse: Math.random() < 0.5,
  };

  // Match the original marquee's repeat gap exactly. Fill one conveyor copy
  // wide enough that short stream titles never leave a blank stretch onscreen.
  const measuringPiece = liveStreamMarqueePiece(title, profile);
  track.append(measuringPiece);
  const pieceWidth = Math.max(1, measuringPiece.getBoundingClientRect().width);
  const barWidth = Math.max(1, bar.getBoundingClientRect().width);
  const repeatsPerSequence = Math.max(2, Math.ceil((barWidth * 1.25) / pieceWidth));
  measuringPiece.remove();

  const makeSequence = (duplicate = false) => {
    const sequence = el("span", { className: "marquee-sequence" });
    if (duplicate) sequence.setAttribute("aria-hidden", "true");
    for (let index = 0; index < repeatsPerSequence; index += 1) {
      sequence.append(liveStreamMarqueePiece(title, profile));
    }
    return sequence;
  };

  const firstSequence = makeSequence(false);
  const secondSequence = makeSequence(true);
  track.replaceChildren(firstSequence, secondSequence);

  const sequenceWidth = firstSequence.getBoundingClientRect().width;
  const pixelsPerSecond = 92;
  track.style.setProperty("--marquee-duration", `${Math.max(1, sequenceWidth / pixelsPerSecond).toFixed(2)}s`);

  const setPlaybackRate = (rate) => {
    track.getAnimations().forEach((animation) => {
      if ("animationName" in animation && animation.animationName !== "marquee") return;
      if (typeof animation.updatePlaybackRate === "function") animation.updatePlaybackRate(rate);
      else animation.playbackRate = rate;
    });
  };
  bar.addEventListener("mouseenter", () => setPlaybackRate(0.25));
  bar.addEventListener("mouseleave", () => setPlaybackRate(1));
  shell.addEventListener("animationend", () => shell.classList.remove("live-stream-title-spawn"), { once: true });
}

async function bootSite() {
  let initialHash = canonicalSamePageHash(window.location.hash);
  if (initialHash && initialHash !== window.location.hash) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}${initialHash}`);
  }

  await loadActiveEmotes();
  await loadActiveLanguageText();
  applyLanguageText(document);
  initializeSiteTools();
  initializeCurrentUrl();
  await initializeMarquee();

  if (document.body.dataset.page === "home" && document.querySelector("#app")) {
    const [status, streamInfo] = await Promise.all([loadStatus(), loadLastStreamInfo()]);
    await render(status);
    initializeLiveStreamTitle(status, streamInfo);
  } else {
    await initializeMusicPlayer();
    applyLanguageText(document);
    initializeWumpaGame();
  }

  initializeScrollTargetHighlights();

  // The homepage panels (including #multistream) are rendered above,
  // after the browser's native initial hash jump would normally have happened.
  // Re-run the jump after render so shared direct links land correctly on load.
  if (initialHash && window.location.hash === initialHash) {
    window.requestAnimationFrame(() => {
      scrollHashTargetIntoView(initialHash);
      window.requestAnimationFrame(() => {
        if (window.location.hash === initialHash) scrollHashTargetIntoView(initialHash, { flash: false });
      });
    });
  }

  mountLanguageSelector();
  updateCursorEffect(document.body.dataset.theme || "p1", { force: true });
}

bootSite();
