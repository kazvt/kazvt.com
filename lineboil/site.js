const streamLinks = [
  {
    key: "twitch",
    label: "Twitch",
    href: "https://www.twitch.tv/kazvt",
    liveHref: "https://www.twitch.tv/kazvt",
    icon: "twitch",
    note: "streaming",
    status: "offline",
    color: "#d9c5ff",
  },
  {
    key: "kick",
    label: "Kick",
    href: "https://kick.com/kazvt",
    icon: "kick",
    note: "streaming",
    status: "offline",
    color: "#c8ffc9",
  },
  {
    key: "youtube",
    label: "YouTube",
    href: "https://www.youtube.com/@kazvt",
    liveHref: "https://www.youtube.com/@kazvt/live",
    icon: "youtube",
    note: "streaming & archive",
    status: "offline",
    color: "#ffc6b7",
  },
];

const socialLinks = [
  {
    key: "discord",
    label: "Discord",
    href: "https://discord.com/invite/huzMpfJZ4J",
    icon: "discord",
    note: "",
    color: "#ffc7ee",
  },
  {
    key: "tumblr",
    label: "Tumblr",
    href: "https://www.tumblr.com/kazvt",
    icon: "tumblr",
    note: "",
    color: "#d8d4ff",
  },
  {
    key: "bsky",
    label: "BSky",
    href: "https://bsky.app/profile/kazvt.com",
    icon: "bsky",
    note: "",
    color: "#bde8ff",
  },
  {
    key: "twitter",
    label: "Twitter",
    href: "https://twitter.com/monkevt",
    icon: "twitter",
    note: "",
    color: "#c9f0ff",
  },
  {
    key: "wife",
    label: "my wife",
    href: "https://lillie.garden/",
    images: ["assets/wife/kazberry.webp", "assets/wife/ramberry.webp"],
    note: "",
    color: "#ffd7ef",
  },
];

const buttonBadges = [
  { label: "believe it!", file: "believe-it.png" },
  { label: "moon prism", file: "moon-prism.png" },
  { label: "waku waku", file: "waku-waku.png" },
  { label: "gotta blast", file: "gotta-blast.png" },
  { label: "plus ultra", file: "plus-ultra.png" },
  { label: "snack break", file: "snack-break.png" },
  { label: "space cowboy", file: "space-cowboy.png" },
  { label: "power up!", file: "power-up.png" },
];

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]);
const audioExtensions = new Set([".mp3", ".ogg", ".wav", ".m4a", ".flac", ".aac"]);
const ART_ROTATION_MS = 8000;
const THEME_STORAGE_KEY = "kazvt-theme";
const WIFE_KISS_SOUND_SRC = "assets/wife/wifey%20kissy.mp3";
const FRUIT_SOUND_SRC = "assets/fruit.mp3";
const LANGUAGE_STORAGE_KEY = "kazvt-language";
const DEFAULT_LANGUAGE_NAME = "english";
const DEFAULT_LANGUAGE_CODE = "en";
const WUMPA_STORAGE_KEY = "kazvt-wumpa-count";
const WUMPA_LOGO_STORAGE_KEY = "kazvt-logo-wumpa";

const cursorThemes = {
  p1: { effect: "lineboilGlyphCursor", options: { glyphs: ["*"], colors: ["#F599C6", "#FFEA88", "#7DCCAD"], sizes: [8, 13, 19, 27], spawn: 2, scatter: 0.85, gravity: 0.015, life: 58 } },
  p2: { effect: "lineboilCenteredTrailCursor", options: { particles: 18, rate: 0.34, size: 12, image: svgTrailCursorImage("#EF6905", "#8B2626", "spark") } },
  p3: { effect: "lineboilGlyphCursor", options: { glyphs: ["+"], colors: ["#1D4533", "#F9D2BA", "#5E3122"], sizes: [9, 15, 22, 30], spawn: 1, scatter: 0.55, gravity: -0.005, life: 68, spin: 0.08 } },
  p4: { effect: "lineboilBubbleCursor", options: { colors: ["#D8FFC5", "#92EEFF", "#30AFFF"], strokeColor: "#30AFFF", minSize: 12, maxSize: 36, spawn: 2, life: 95 } },
  p5: { effect: "ghostCursor", options: { image: svgTrailCursorImage("#FAF7BB", "#133458", "ghost"), randomDelay: true, minDelay: 10, maxDelay: 30, lifeSpan: 48 } },
  p6: { effect: "lineboilCenteredTrailCursor", options: { particles: 16, rate: 0.28, size: 9, image: svgTrailCursorImage("#FEF2A0", "#BC4F4F", "stripe") } },
  p7: { effect: "lineboilFlagCursor", options: { text: "kazvt!!!", color: "#FCF2E5", strokeColor: "#EC5B38", shadowColor: "#524646", font: "900 24px Trebuchet MS, Comic Sans MS, Arial", gap: 16, wobble: 1.5 } },
  p8: { effect: "lineboilSpringyGlyphCursor", options: { glyph: "✿", color: "#E8F5E9", strokeColor: "#1B5E20", font: "900 18px Trebuchet MS, Comic Sans MS, Arial", links: 7 } },
  p9: { effect: "lineboilBubbleCursor", options: { colors: ["#E3F2FD", "#90CAF9", "#2196F3"], strokeColor: "#0D47A1", minSize: 3, maxSize: 18, spawn: 2, life: 82 } },
  p10: { effect: "lineboilGlyphCursor", options: { glyphs: ["♥", "♡"], colors: ["#F6D8BD", "#F39399", "#CF4173"], sizes: [12, 18, 26], spawn: 1, scatter: 0.35, gravity: -0.012, life: 72, spin: 0.035 } },
  p11: { effect: "characterCursor", options: { characters: ["0", "1", "."], colors: ["#98E8DE", "#45A9A9", "#4E1F6E"], font: "24px monospace", characterLifeSpanFunction: () => Math.floor(55 + Math.random() * 30), initialCharacterVelocityFunction: () => ({ x: (Math.random() - 0.5) * 1.1, y: (Math.random() - 0.5) * 1.1 }), characterVelocityChangeFunctions: { x_func: () => (Math.random() - 0.5) / 90, y_func: () => (Math.random() - 0.5) / 90 }, characterScalingFunction: (age, life) => Math.max((life - age) / life, 0) } },
  p12: { effect: "rainbowCursor", options: { colors: ["#007DCC", "#FFB900", "#D10056", "#B2054C"], length: 14, size: 5 } },
  p13: { effect: "rainbowCursor", options: { colors: ["#E73F1E", "#FB6C00", "#F9B637", "#FFDD9C"], length: 8, size: 5 } },
  p14: { effect: "rainbowCursor", options: { colors: ["#FED24F", "#FFF449", "#B2D959", "#7EC151"], length: 28, size: 5 } },
  p15: { effect: "lineboilGlyphCursor", options: { glyphs: ["■", "□"], colors: ["#F8B2B2", "#AF719D", "#8B639B", "#403D88"], sizes: [9, 13, 20, 25], spawn: 1, scatter: 0.28, gravity: 0.01, life: 74, spin: 0.012 } },
  p16: { effect: "lineboilFlagCursor", options: { text: "kazvt is OFFLINE", color: "#E1E100", strokeColor: "#063B00", shadowColor: "#90B800", font: "900 17px Courier New, monospace", gap: 12, wobble: 0.75 } },
};

let activeCursorEffect = null;
let activeCursorTheme = "";
let mwahAudio = null;
let fruitAudio = null;
let siteVolume = 0.8;
let activeLanguageText = new Map();

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

function setupCursorCanvas() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "2147483647";
  document.body.appendChild(canvas);

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
  const glyphs = options.glyphs || ["*"];
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
  const text = ` ${options.text || "kazvt"}`;
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
  const glyph = options.glyph || "✿";
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
    line.split(",").forEach((chunk) => {
      const separator = chunk.indexOf("=");
      if (separator === -1) return;
      const key = chunk.slice(0, separator).trim();
      const value = chunk.slice(separator + 1).trim();
      if (key && value) values.set(key, value);
    });
  });
  return values;
}

async function loadLanguageManifest() {
  const values = parseKeyValueLines(await loadTextLines("languages.txt"));
  const languages = [...values.entries()].map(([name, code]) => ({ name, code }));
  return languages.length ? languages : [{ name: DEFAULT_LANGUAGE_NAME, code: DEFAULT_LANGUAGE_CODE }];
}

async function loadActiveLanguageText() {
  const languages = await loadLanguageManifest();
  let selectedName = languages[0].name;

  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const match = languages.find((language) => language.name === stored || language.code === stored);
    if (match) selectedName = match.name;
  } catch {}

  const language = languages.find((item) => item.name === selectedName) || languages[0];
  const lines = await loadTextLines(`${language.name}.txt`);
  const text = parseKeyValueLines(lines);
  activeLanguageText = text;
  document.documentElement.lang = language.code || DEFAULT_LANGUAGE_CODE;
  return text;
}

function translatedText(key, fallback = "") {
  return activeLanguageText.get(key) || fallback;
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
  if (!meta) return;

  window.requestAnimationFrame(() => {
    const bg = getComputedStyle(document.body).getPropertyValue("--bg").trim();
    if (bg) meta.setAttribute("content", bg);
  });
}

function anyStreamLive() {
  return Boolean(document.querySelector(".sticker.is-live, .status-card.live, .sticker-status-corner.live"));
}

function cursorThemeConfig(theme) {
  const config = cursorThemes[theme] || cursorThemes.p1;
  if (theme !== "p16") return config;

  return {
    ...config,
    options: {
      ...config.options,
      text: anyStreamLive() ? "kazvt is LIVE" : "kazvt is OFFLINE",
    },
  };
}

function updateCursorEffect(theme, { force = false } = {}) {
  if (!force && activeCursorTheme === theme && activeCursorEffect) return;
  activeCursorTheme = theme;
  destroyCursorEffect();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches || !window.cursoreffects) return;

  installLineboilCursorEffects();
  const config = cursorThemeConfig(theme);
  const CursorEffect = window.cursoreffects[config.effect] || window.cursoreffects.fairyDustCursor;
  if (!CursorEffect) return;

  try {
    activeCursorEffect = new CursorEffect(config.options || {});
  } catch {
    activeCursorEffect = null;
  }
}

function applySiteTheme(theme, themeButtons, { persist = true } = {}) {
  document.body.dataset.theme = theme;
  themeButtons.forEach((item) => item.setAttribute("aria-pressed", String(item.getAttribute("data-tool-theme") === theme)));

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }

  updateThemeMetaColor();
  updateCursorEffect(theme);
}

function initializeCurrentUrl() {
  const node = document.querySelector("[data-current-url]");
  if (!node) return;

  const updateUrl = () => {
    node.textContent = window.location.href.replace(/^https?:\/\//i, "");
  };

  updateUrl();
  window.addEventListener("hashchange", updateUrl);
  window.addEventListener("popstate", updateUrl);
  document.addEventListener("click", () => window.setTimeout(updateUrl, 0));
}

async function initializeMarquee() {
  const node = document.querySelector("[data-marquee-text]");
  if (!node) return;

  const lines = await loadTextLines("marquee_announcements.txt");
  if (!lines.length) return;

  let index = Math.floor(Math.random() * lines.length);
  const showLine = () => {
    node.textContent = lines[index];
  };

  showLine();
  node.style.animation = "none";
  node.offsetHeight;
  node.style.animation = "";

  node.addEventListener("animationiteration", (event) => {
    if (event.animationName !== "marquee") return;
    index = (index + 1) % lines.length;
    showLine();
  });
}

async function initializeLanguageText() {
  const descriptions = await loadActiveLanguageText();

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    const value = descriptions.get(key);
    if (value) setInlineNote(node, value);
  });

  [...streamLinks, ...socialLinks].forEach((link) => {
    const description = descriptions.get(link.key);
    if (!description) return;
    link.note = description;
    document.querySelectorAll(`[data-social-note="${link.key}"]`).forEach((node) => {
      setInlineNote(node, description);
    });
  });
}

const profileFacts = [
  ["name", "kazvt"],
  ["pronouns", "she/her"],
  ["mode", "retro games and streams"],
];

const bio =
  "hey! i'm kaz, a monke girl who loves retro gaming and streaming. i play classic games from the 1980s to the late 2000s, i love classic shooters, platformers, and i yap quite a bit. i also programme a lot of my own tools. come hang out and watch me try not to lose my mind at old jank!";

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

function inlineNoteNodes(text) {
  return String(text || "")
    .split(/(\[[^\]]+\])/g)
    .filter(Boolean)
    .map((part) => {
      if (!part.startsWith("[") || !part.endsWith("]")) return part;
      return el("span", { className: "note-small" }, [part]);
    });
}

function setInlineNote(node, text) {
  node.replaceChildren(...inlineNoteNodes(text));
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

function panel({ id, title, stamp, children }) {
  return el("section", { id, className: "panel scribble-box" }, [
    el("header", { className: "panel-head" }, [
      el("span", { className: "panel-title" }, [title]),
      el("span", { className: "panel-stamp" }, [stamp]),
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
      href: link.status === "live" && link.liveHref ? link.liveHref : link.href,
      target: "_blank",
      rel: "noopener noreferrer",
      style: { "--paper": link.color },
    },
    [
      hasStatus
        ? el("span", { className: `sticker-status-corner ${status}`, ariaLabel: `${link.label} is ${status}` }, [
            el("span", { className: "crayon-pip", ariaHidden: "true" }),
            el("span", { className: "sticker-status-word" }, [status]),
          ])
        : "",
      el("span", { className: "sticker-glyph", ariaHidden: "true" }, [link.images ? wifeIcon(link.images) : platformIcon(link.icon || link.key)]),
      el("span", { className: "sticker-label" }, [link.label]),
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
  const fixedText = el("span", { className: "wife-kiss-fixed-text", ariaHidden: "true" }, ["mwah !!!"]);
  sticker.append(stamp);
  sticker.append(fixedText);
  window.setTimeout(() => stamp.remove(), 1250);
  window.setTimeout(() => fixedText.remove(), 1850);

  const particleCount = 26;
  for (let index = 0; index < particleCount; index += 1) {
    const isKiss = index % 4 === 0;
    const angle = Math.random() * Math.PI * 2;
    const distance = 58 + Math.random() * 126;
    const particle = el(
      "span",
      { className: `wife-kiss-particle ${isKiss ? "is-kiss" : "is-heart"}`, ariaHidden: "true" },
      [isKiss ? "" : randomFrom(["\u2665", "\u2661", "<3", "xoxo", "mwah"])],
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

function initializeWifeStickerEffects() {
  getMwahAudio();
  document.querySelectorAll(".sticker-wife").forEach((sticker) => {
    if (sticker.dataset.kissReady) return;
    sticker.dataset.kissReady = "true";
    sticker.addEventListener("pointerenter", () => {
      playMwahSound();
      spawnWifeKissEffect(sticker);
    });
  });
}

function statusCard(link) {
  return el("article", { className: `status-card scribble-box ${link.status}` }, [
    el("span", { className: "status-light", ariaHidden: "true" }),
    el("strong", {}, [link.label]),
    el("span", { className: "status-word" }, [link.status]),
    el("p", {}, [link.status === "live" ? "paint is wet, stream is on" : "drying out for now"]),
  ]);
}

function profilePanel() {
  const facts = el("dl", { className: "profile-facts" });
  profileFacts.forEach(([key, value]) => {
    facts.append(el("div", {}, [el("dt", {}, [key]), el("dd", {}, [value])]));
  });

  return panel({
    id: "profile",
    title: "about kaz",
    stamp: "profile.gif",
    children: [
      el("div", { className: "profile-layout" }, [
        el("figure", { className: "portrait art-carousel scribble-box" }, [
          el("div", { className: "art-frame", id: "kaz-art-frame", ariaLive: "polite" }, [
            el("img", { src: "assets/kazvt-transparent.gif", alt: "kazvt art" }),
          ]),
          el("figcaption", { id: "kaz-art-caption" }, ["art window"]),
        ]),
        el("div", { className: "profile-copy" }, [facts, el("p", {}, [bio])]),
      ]),
    ],
  });
}

function guestbookPanel() {
  return panel({
    id: "guestbook",
    title: "guestbook",
    stamp: "sign here",
    children: [
      el("div", { className: "guestbook-lines" }, [
        el("p", {}, ["name: kazvt visitor"]),
        el("p", {}, ["message: thanks for visiting kazvt dot com!!"]),
      ]),
    ],
  });
}

function oldWebPanel() {
  return panel({
    id: "webcorner",
    title: "web corner",
    stamp: "always open",
    children: [
      el("div", { className: "web-corner" }, [
        el("p", { className: "construction-sign" }, ["under construction forever"]),
        el("p", {}, ["webring: ", el("a", { href: "#links" }, ["prev"]), " / ", el("a", { href: "#badges" }, ["random"]), " / ", el("a", { href: "#guestbook" }, ["next"])]),
      ]),
    ],
  });
}

function badgesPanel() {
  return panel({
    id: "badges",
    title: "88x31 stash",
    stamp: "take one",
    children: [
      el(
        "div",
        { className: "badge-grid" },
        buttonBadges.map((badge) =>
          el(
            "a",
            {
              href: `assets/buttons/${badge.file}`,
              download: badge.file,
              className: "badge-link",
              title: `Download ${badge.label}`,
            },
            [el("img", { src: `assets/buttons/${badge.file}`, alt: badge.label, width: "88", height: "31" })],
          ),
        ),
      ),
    ],
  });
}

async function initializeArtCarousel() {
  const frame = document.querySelector("#kaz-art-frame");
  const caption = document.querySelector("#kaz-art-caption");
  if (!frame) return;

  const updateZoomFocus = (event) => {
    const bounds = frame.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    frame.style.setProperty("--zoom-x", `${Math.min(88, Math.max(12, x))}%`);
    frame.style.setProperty("--zoom-y", `${Math.min(88, Math.max(12, y))}%`);
  };

  frame.addEventListener("pointermove", updateZoomFocus);
  frame.addEventListener("pointerleave", () => {
    frame.style.setProperty("--zoom-x", "50%");
    frame.style.setProperty("--zoom-y", "50%");
  });

  const files = await loadManifest("kazArt/manifest.json", imageExtensions);
  const artFiles = files.length ? files : ["../assets/kazvt-transparent.gif"];
  let index = Math.floor(Math.random() * artFiles.length);
  const failedFiles = new Set();

  function artUrl(file) {
    if (/^(https?:|data:|blob:)/i.test(file)) return file;
    if (file.startsWith("../")) return file.slice(3);
    const cleanFile = file.replace(/^\.?\//, "");
    return `kazArt/${cleanFile.split("/").map(encodeURIComponent).join("/")}`;
  }

  function displayArt(file, attempts = 0) {
    const image = new Image();
    image.alt = "kazvt art";
    image.className = "art-image slide-enter";
    image.onerror = () => {
      failedFiles.add(file);
      const nextFile = artFiles.find((candidate) => !failedFiles.has(candidate));
      if (nextFile && attempts < artFiles.length) {
        index = artFiles.indexOf(nextFile);
        displayArt(nextFile, attempts + 1);
      }
    };
    image.onload = () => {
      const wide = image.naturalWidth > image.naturalHeight;
      const square = image.naturalWidth === image.naturalHeight;
      image.classList.toggle("is-wide", wide);
      image.classList.toggle("is-tall", !wide && !square);
      frame.querySelector(".art-image")?.classList.add("slide-exit");
      window.setTimeout(() => {
        frame.replaceChildren(image);
        window.requestAnimationFrame(() => {
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
      if (caption) caption.textContent = file.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    };
    image.src = artUrl(file);
  }

  displayArt(artFiles[index]);
  window.setInterval(() => {
    index = (index + 1) % artFiles.length;
    displayArt(artFiles[index]);
  }, ART_ROTATION_MS);
}

function paintPanel() {
  return panel({
    id: "paint",
    title: "doodle pad",
    stamp: "stylus.exe",
    children: [
      el("div", { className: "paint-app" }, [
        el("div", { className: "paint-zone scribble-box" }, [
          el("canvas", { id: "doodle-canvas", width: "720", height: "360", ariaLabel: "Draw here" }),
          el("p", { className: "paint-caption" }, ["draw here, then save your doodle"]),
        ]),
        el("div", { className: "paint-controls scribble-box", ariaLabel: "Doodle pad tools" }, [
          el("button", { type: "button", "data-brush": "#ff432f", ariaPressed: "true" }, ["red"]),
          el("button", { type: "button", "data-brush": "#48cfff", ariaPressed: "false" }, ["blue"]),
          el("button", { type: "button", "data-brush": "#50d85f", ariaPressed: "false" }, ["green"]),
          el("button", { type: "button", "data-brush": "#302135", ariaPressed: "false" }, ["ink"]),
          el("button", { type: "button", "data-clear": "true" }, ["clear"]),
          el("button", { type: "button", "data-save": "true" }, ["save gif"]),
        ]),
      ]),
    ],
  });
}

function updateSidebar(links) {
  links.forEach((link) => {
    const node = document.querySelector(`#side-${link.key}`);
    if (node) node.textContent = link.status;
  });
}

function createVisitCounter({ key = "kazvt-page-visits", label = "visits" } = {}) {
  let count = 1;

  try {
    count = Number(localStorage.getItem(key) || "0") + 1;
    localStorage.setItem(key, String(count));
  } catch {
    count = 1;
  }

  const digits = String(count).padStart(6, "0").slice(-6);

  return el("div", { className: "visit-counter", ariaLabel: `${label}: ${count}` }, [
    el("span", { className: "counter-label" }, [label]),
    el(
      "span",
      { className: "counter-digits", ariaHidden: "true" },
      digits.split("").map((digit) => el("i", {}, [digit])),
    ),
  ]);
}

function readSessionJson(key, fallback) {
  try {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeSessionJson(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session storage is decorative here; the fruit game still works without it.
  }
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
  } catch {
    // Ignore storage failures; the visible counter can still update.
  }

  document.querySelectorAll("[data-wumpa-count]").forEach((node) => {
    node.textContent = String(safeCount);
  });
}

let wumpaCounterTimer = 0;
let wumpaToastTimer = 0;

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

  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(wumpaToastTimer);
  wumpaToastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
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

function logoWumpaState() {
  return readSessionJson(WUMPA_LOGO_STORAGE_KEY, {
    left: { hits: 0, eaten: false },
    right: { hits: 0, eaten: false },
  });
}

function saveLogoWumpaState(state) {
  writeSessionJson(WUMPA_LOGO_STORAGE_KEY, state);
}

function initializeLogoWumpas() {
  const buttons = [...document.querySelectorAll("[data-logo-wumpa]")];
  if (!buttons.length) return;

  const state = logoWumpaState();
  buttons.forEach((button) => {
    const side = button.getAttribute("data-logo-wumpa") || "left";
    state[side] ||= { hits: 0, eaten: false };

    if (state[side].eaten) {
      button.classList.add("is-eaten");
      button.setAttribute("aria-hidden", "true");
      return;
    }

    button.setAttribute("aria-label", `eat ${side} wumpa fruit, ${state[side].hits} of 20 bites`);
    button.addEventListener("click", () => {
      if (state[side].eaten) return;

      playFruitSound();
      state[side].hits += 1;
      button.setAttribute("aria-label", `eat ${side} wumpa fruit, ${state[side].hits} of 20 bites`);

      if (state[side].hits >= 20) {
        state[side].eaten = true;
        button.classList.add("is-eaten");
        button.setAttribute("aria-hidden", "true");
        addWumpa(100, "You just permanently ate this wumpa fruit. It'll never appear back.");
      } else {
        showWumpaToast(`${side} wumpa: ${state[side].hits}/20`);
      }

      saveLogoWumpaState(state);
    });
  });

  saveLogoWumpaState(state);
}

function spawnRandomWumpa(layer) {
  const existing = layer.querySelectorAll(".wumpa-fruit").length;
  if (existing > 2) return;

  const size = 22 + Math.round(Math.random() * 12);
  const fruit = el("button", { className: "wumpa-fruit", type: "button", ariaLabel: "eat wumpa fruit" }, [
    el("img", { src: "assets/wumpa.gif", alt: "" }),
  ]);
  const side = randomFrom(["left", "right", "top", "bottom"]);
  const width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

  fruit.style.setProperty("--wumpa-size", `${size}px`);
  fruit.style.setProperty("--wumpa-life", "2200ms");

  if (side === "left" || side === "right") {
    fruit.style.top = `${20 + Math.random() * Math.max(40, height - 80)}px`;
    fruit.style.left = side === "left" ? "5px" : `${Math.max(5, width - size - 5)}px`;
    fruit.style.setProperty("--from-x", side === "left" ? `-${size + 12}px` : `${size + 12}px`);
    fruit.style.setProperty("--from-y", "0px");
  } else {
    fruit.style.left = `${20 + Math.random() * Math.max(40, width - 80)}px`;
    fruit.style.top = side === "top" ? "5px" : `${Math.max(5, height - size - 5)}px`;
    fruit.style.setProperty("--from-x", "0px");
    fruit.style.setProperty("--from-y", side === "top" ? `-${size + 12}px` : `${size + 12}px`);
  }

  fruit.addEventListener("click", () => {
    if (fruit.classList.contains("is-eaten")) return;
    playFruitSound();
    fruit.classList.add("is-eaten");
    addWumpa(1);
    window.setTimeout(() => fruit.remove(), 430);
  });

  layer.append(fruit);
  window.setTimeout(() => fruit.remove(), 2300);
}

function initializeWumpaGame() {
  setWumpaCount(getWumpaCount());
  initializeLogoWumpas();

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

function multistreamGuidePanel() {
  return el("details", { id: "multistream-guide-home", className: "panel guide-disclosure guide-embed-panel scribble-box", "data-embedded-guide": "true" }, [
    el("summary", { "data-i18n": "guide.summary" }, ["multistream setup guide"]),
    el("div", { className: "panel-body" }, [
      el("div", { className: "embedded-guide-slot" }, [
        el("p", { className: "embedded-guide-loading" }, ["open this to load the guide"]),
      ]),
    ]),
  ]);
}

async function initializeEmbeddedGuide() {
  const details = document.querySelector("[data-embedded-guide]");
  if (!details) return;

  const slot = details.querySelector(".embedded-guide-slot");
  if (!slot) return;

  const loadGuide = async () => {
    if (details.dataset.loaded) return;
    details.dataset.loaded = "true";
    slot.replaceChildren(el("p", { className: "embedded-guide-loading" }, ["loading guide..."]));

    try {
      const response = await fetch("multistream-guide.html", { cache: "no-store" });
      if (!response.ok) throw new Error("guide fetch failed");
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const body = doc.querySelector(".guide-panel .panel-body");
      if (!body) throw new Error("guide body missing");

      const fragment = document.createDocumentFragment();
      [...body.children].forEach((child) => {
        fragment.append(document.importNode(child, true));
      });
      slot.replaceChildren(fragment);
    } catch {
      details.dataset.loaded = "";
      slot.replaceChildren(el("p", { className: "embedded-guide-error" }, ["the guide could not load here. use the multistream guide page from the nav."]));
    }
  };

  details.addEventListener("toggle", () => {
    if (details.open) loadGuide();
  });
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
      boilButton.textContent = active ? "steady mode" : "extra wobble";
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
    button.textContent = "making gif";
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
    button.textContent = previousText;
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
  window.setInterval(redraw, 280);
}

async function initializeMusicPlayer() {
  const mount = document.querySelector("#music-player");
  if (!mount) return;

  const tracks = await loadManifest("music/manifest.json", audioExtensions);
  if (!tracks.length) {
    mount.replaceChildren(el("p", { className: "small-copy" }, ["radio is quiet for now"]));
    return;
  }

  const audio = new Audio();
  audio.preload = "metadata";
  let index = 0;
  let audioContext = null;
  let analyser = null;
  let source = null;
  const title = el("p", { className: "track-title" }, [""]);
  const play = el("button", { type: "button", className: "music-button" }, ["play"]);
  const prev = el("button", { type: "button", className: "music-button", ariaLabel: "Previous track" }, ["<<"]);
  const next = el("button", { type: "button", className: "music-button", ariaLabel: "Next track" }, [">>"]);
  const seek = el("input", { type: "range", min: "0", max: "1000", value: "0", ariaLabel: "Track position" });
  const volume = el("input", { type: "range", min: "0", max: "1", step: "0.01", value: "0.8", ariaLabel: "Volume" });
  const visualizer = el("canvas", {
    width: "150",
    height: "44",
    className: "visualizer",
    role: "button",
    tabindex: "0",
    title: "Switch visualizer mode",
    ariaLabel: "Music visualizer: bars mode. Click to switch.",
  });
  const visualContext = visualizer.getContext("2d");
  const visualizerBinCrop = 0.58;
  const visualizerBarCount = 12;
  const visualizerTrebleTilt = 0.35;
  const visualizerPeakBias = 0.72;
  const visualizerModes = ["bars", "scope", "burst"];
  const visualizerLevels = Array(visualizerBarCount).fill(0);
  let visualizerMode = visualizerModes[0];

  function trackUrl(file) {
    return `music/${encodeURIComponent(file)}`;
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
    visualizer.setAttribute("aria-label", `Music visualizer: ${visualizerMode} mode. Click to switch.`);
    visualizer.title = `visualizer: ${visualizerMode}`;
  }

  function cycleVisualizerMode() {
    const nextMode = (visualizerModes.indexOf(visualizerMode) + 1) % visualizerModes.length;
    visualizerMode = visualizerModes[nextMode];
    updateVisualizerLabel();
  }

  function clearVisualizer(width, height) {
    visualContext.fillStyle = "#16111a";
    visualContext.fillRect(0, 0, width, height);
  }

  function drawIdleVisualizer(width, height) {
    visualContext.fillStyle = "#6cff7a";
    for (let x = 6; x < width; x += 14) {
      const bar = 5 + ((x / 14) % 4) * 4;
      visualContext.fillRect(x, height - bar - 5, 9, bar);
    }
  }

  function getVisualizerLevels(data) {
    const activeBins = data.slice(0, Math.max(1, Math.ceil(data.length * visualizerBinCrop)));
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
    levels.forEach((value, bar) => {
      const barHeight = Math.max(3, Math.pow(value / 255, 0.72) * (height - 8));
      visualContext.fillStyle = bar % 2 ? "#48cfff" : "#6cff7a";
      visualContext.fillRect(bar * barWidth + 2, height - barHeight - 4, Math.max(5, barWidth - 4), barHeight);
    });
  }

  function drawScopeVisualizer(waveform, width, height) {
    const step = 4;
    const mid = Math.round(height / 2);
    visualContext.strokeStyle = "#48cfff";
    visualContext.lineWidth = 3;
    visualContext.beginPath();

    for (let x = 0; x <= width; x += step) {
      const index = Math.min(waveform.length - 1, Math.floor((x / width) * waveform.length));
      const wave = (waveform[index] - 128) / 128;
      const y = Math.round(mid + wave * (height * 0.42));
      if (x === 0) visualContext.moveTo(x, y);
      else visualContext.lineTo(x, y);
    }

    visualContext.stroke();
    visualContext.strokeStyle = "#6cff7a";
    visualContext.lineWidth = 2;
    visualContext.beginPath();
    for (let x = 0; x <= width; x += step * 2) {
      const index = Math.min(waveform.length - 1, Math.floor((x / width) * waveform.length));
      const wave = (waveform[index] - 128) / 128;
      const y = Math.round(mid - wave * (height * 0.3));
      if (x === 0) visualContext.moveTo(x, y);
      else visualContext.lineTo(x, y);
    }
    visualContext.stroke();
  }

  function drawBurstVisualizer(levels, width, height) {
    const centerY = Math.round(height / 2);
    const slotWidth = width / levels.length;

    levels.forEach((value, index) => {
      const strength = Math.pow(value / 255, 0.82);
      const barHeight = Math.max(4, strength * (height - 10));
      const x = Math.round(index * slotWidth + 2);
      const y = Math.round(centerY - barHeight / 2);
      visualContext.fillStyle = index % 2 ? "#6cff7a" : "#48cfff";
      visualContext.fillRect(x, y, Math.max(5, slotWidth - 5), Math.round(barHeight));
      if (strength > 0.42) {
        visualContext.fillStyle = "#ffef5d";
        visualContext.fillRect(x + 1, Math.max(3, y - 3), Math.max(3, slotWidth - 7), 2);
      }
    });
  }

  function drawVisualizer() {
    const width = visualizer.width;
    const height = visualizer.height;
    clearVisualizer(width, height);

    if (!analyser || audio.paused) {
      drawIdleVisualizer(width, height);
      window.requestAnimationFrame(drawVisualizer);
      return;
    }

    if (visualizerMode === "scope") {
      const waveform = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(waveform);
      drawScopeVisualizer(waveform, width, height);
      window.requestAnimationFrame(drawVisualizer);
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const levels = getVisualizerLevels(data);
    if (visualizerMode === "burst") drawBurstVisualizer(levels, width, height);
    else drawBarVisualizer(levels, width, height);
    window.requestAnimationFrame(drawVisualizer);
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
    play.textContent = "pause";
  });
  audio.addEventListener("pause", () => {
    play.textContent = "play";
  });
  audio.addEventListener("ended", () => loadTrack(index + 1, true));
  audio.addEventListener("error", () => {
    title.textContent = `${niceTitle(tracks[index])} - tape not found`;
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
  mount.replaceChildren(
    title,
    el("div", { className: "music-controls" }, [prev, play, next]),
    seek,
    el("label", { className: "volume-label" }, ["vol", volume]),
    visualizer,
  );
  loadTrack(0);
  drawVisualizer();
}

function render(statusOverrides = {}) {
  const app = document.querySelector("#app");
  const links = streamLinks.map((link) => ({
    ...link,
    status: normalizeStatus(statusOverrides[link.key] || link.status),
  }));

  updateSidebar(links);
  app.replaceChildren(
    panel({
      id: "links",
      title: "where to find me",
      stamp: "links",
      children: [el("div", { className: "sticker-grid" }, [...links, ...socialLinks].map(sticker))],
    }),
    multistreamGuidePanel(),
    profilePanel(),
    oldWebPanel(),
    guestbookPanel(),
    paintPanel(),
    badgesPanel(),
    el("footer", { className: "page-footer scribble-box" }, [
      el("span", {}, ["kazvt.com / press start / come back soon"]),
      createVisitCounter({ key: "kazvt-home-visits", label: "you are visitor" }),
    ]),
  );

  initializeDrawingPad();
  initializeArtCarousel();
  initializeMusicPlayer();
  initializeLanguageText();
  initializeWifeStickerEffects();
  initializeEmbeddedGuide();
  initializeWumpaGame();
  if (document.body.dataset.theme === "p16") updateCursorEffect("p16", { force: true });
}

async function loadStatus() {
  try {
    const response = await fetch("status.json", { cache: "no-store" });
    if (!response.ok) return {};
    return response.json();
  } catch {
    return {};
  }
}

initializeSiteTools();
initializeCurrentUrl();
initializeMarquee();

if (document.body.dataset.page === "home" && document.querySelector("#app")) {
  loadStatus().then(render);
} else {
  initializeMusicPlayer();
  initializeLanguageText();
  initializeWumpaGame();
}
