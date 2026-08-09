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
    key: "youtube",
    label: "YouTube",
    href: "https://www.youtube.com/@kazvt",
    liveHref: "https://www.youtube.com/@kazvt/live",
    icon: "youtube",
    note: "streaming & archive",
    status: "offline",
    color: "#ffc6b7",
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
];

const socialLinks = [
  {
    key: "twitter",
    label: "Twitter",
    href: "https://twitter.com/monkevt",
    icon: "twitter",
    note: "short thoughts",
    color: "#c9f0ff",
  },
  {
    key: "bsky",
    label: "BSky",
    href: "https://bsky.app/profile/kazvt.com",
    icon: "bsky",
    note: "sky posting",
    color: "#bde8ff",
  },
  {
    key: "tumblr",
    label: "Tumblr",
    href: "https://www.tumblr.com/kazvt",
    icon: "tumblr",
    note: "old-web nest",
    color: "#d8d4ff",
  },
  {
    key: "discord",
    label: "Discord",
    href: "https://discord.com/invite/huzMpfJZ4J",
    icon: "discord",
    note: "community room",
    color: "#ffc7ee",
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
      className: `sticker scribble-box ${hasStatus ? `has-status is-${status}` : ""} ${extraClass}`,
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
      el("span", { className: "sticker-glyph", ariaHidden: "true" }, [platformIcon(link.icon || link.key)]),
      el("span", { className: "sticker-label" }, [link.label]),
      el("span", { className: "sticker-note" }, [link.note]),
    ],
  );
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
        el("p", {}, ["mood: caught between a save file and a snack break"]),
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
        el("p", {}, ["site mood: orange soda, old save files, and a browser tab from 2007"]),
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

function initializeSiteTools() {
  const themeButtons = [...document.querySelectorAll("[data-tool-theme]")];
  const boilButton = document.querySelector("[data-tool-boil]");

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const theme = button.getAttribute("data-tool-theme");
      document.body.dataset.theme = theme || "p1";
      themeButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
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
  const visualizer = el("canvas", { width: "150", height: "44", className: "visualizer", ariaLabel: "Music visualizer" });
  const visualContext = visualizer.getContext("2d");
  const visualizerBinCrop = 0.58;

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
    analyser.fftSize = 64;
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
  }

  function drawVisualizer() {
    const width = visualizer.width;
    const height = visualizer.height;
    visualContext.fillStyle = "#16111a";
    visualContext.fillRect(0, 0, width, height);

    if (!analyser || audio.paused) {
      visualContext.fillStyle = "#6cff7a";
      for (let x = 5; x < width; x += 12) {
        const bar = 4 + ((x / 12) % 4) * 4;
        visualContext.fillRect(x, height - bar - 5, 7, bar);
      }
      window.requestAnimationFrame(drawVisualizer);
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const activeBins = data.slice(0, Math.max(1, Math.ceil(data.length * visualizerBinCrop)));
    const barWidth = width / activeBins.length;
    activeBins.forEach((value, bar) => {
      const barHeight = Math.max(3, (value / 255) * (height - 8));
      visualContext.fillStyle = bar % 2 ? "#48cfff" : "#6cff7a";
      visualContext.fillRect(bar * barWidth + 1, height - barHeight - 4, Math.max(3, barWidth - 2), barHeight);
    });
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
    audio.volume = Number(volume.value);
  });

  audio.volume = Number(volume.value);
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
    status: statusOverrides[link.key] || link.status,
  }));

  updateSidebar(links);
  app.replaceChildren(
    panel({
      id: "links",
      title: "where to find me",
      stamp: "live pips",
      children: [el("div", { className: "sticker-grid" }, [...links, ...socialLinks].map(sticker))],
    }),
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
loadStatus().then(render);
