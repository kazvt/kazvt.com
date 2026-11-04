(() => {
  const body = document.body;
  const html = document.documentElement;
  const motionButton = document.getElementById("motionToggle");
  const motionStatus = document.getElementById("motionStatus");
  const gifSky = document.getElementById("gifSky");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const messages = [
    "We love you, Zoey.",
    "We love you so much, Zoey.",
    "Zoey, you mean so much to us."
  ];
  let messageIndex = 0;
  let gifEntries = null;
  let gifImages = [];
  let catalogPromise = null;

  function motionChoice() {
    try {
      const saved = localStorage.getItem("zoeytest-motion");
      if (saved === "on") return true;
      if (saved === "off") return false;
    } catch {}
    return !reduceMotion.matches;
  }

  function seeded(index, salt) {
    const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function layoutGifSky() {
    if (!gifImages.length) return;
    const compact = window.matchMedia("(max-width: 760px)").matches;
    gifImages.forEach((image, index) => {
      image.hidden = false;
      if (body.dataset.motion !== "on") {
        image.removeAttribute("src");
        return;
      }

      const a = seeded(index, 1);
      const b = seeded(index, 2);
      const x = 3 + a * 94;
      const y = 3 + b * 94;
      const base = compact ? 12 + seeded(index, 3) * 16 : 18 + seeded(index, 3) * 32;
      const longest = Math.max(gifEntries[index].width, gifEntries[index].height) || 1;
      const scale = base / longest;
      const width = Math.max(12, gifEntries[index].width * scale);
      const height = Math.max(12, gifEntries[index].height * scale);
      const xInset = Math.min(10, width / Math.max(1, window.innerWidth) * 50);
      const yInset = Math.min(10, height / Math.max(1, window.innerHeight) * 50);
      image.style.left = Math.max(xInset, Math.min(100 - xInset, x)) + "%";
      image.style.top = Math.max(yInset, Math.min(100 - yInset, y)) + "%";
      image.style.setProperty("--z-gif-width", width.toFixed(1) + "px");
      image.style.setProperty("--z-gif-height", height.toFixed(1) + "px");
      image.style.setProperty("--z-gif-opacity", (0.58 + seeded(index, 4) * 0.3).toFixed(2));
      image.style.setProperty("--z-gif-tilt", ((seeded(index, 5) - 0.5) * 18).toFixed(1) + "deg");
      if (!image.hasAttribute("src")) image.src = image.dataset.src;
    });
  }

  async function loadGifCatalog() {
    if (gifEntries) return gifEntries;
    if (catalogPromise) return catalogPromise;
    catalogPromise = fetch("/zoeytest/gif-manifest.json", { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("GIF list unavailable");
        return response.json();
      })
      .then((entries) => {
        if (!Array.isArray(entries) || entries.length !== 100) throw new Error("Unexpected GIF list");
        gifEntries = entries;
        const fragment = document.createDocumentFragment();
        entries.forEach((entry) => {
          const image = document.createElement("img");
          image.className = "z-float-gif";
          image.alt = "";
          image.setAttribute("aria-hidden", "true");
          image.width = entry.width;
          image.height = entry.height;
          image.loading = "lazy";
          image.decoding = "async";
          image.dataset.src = "/zoeytest/assets/gifs/" + entry.file;
          fragment.append(image);
          gifImages.push(image);
        });
        gifSky.append(fragment);
        gifSky.hidden = body.dataset.motion !== "on";
        layoutGifSky();
        motionStatus.textContent = "The galaxy has 100 original animated GIFs, lightly sprinkled around the edges.";
        return entries;
      })
      .catch(() => {
        catalogPromise = null;
        motionStatus.textContent = "The love radio still works; the old-web GIFs couldn't tune in just now. Try the motion switch again.";
        return null;
      });
    return catalogPromise;
  }

  function setMotion(enabled, saveChoice = false) {
    body.dataset.motion = enabled ? "on" : "off";
    html.dataset.zoeyMotion = enabled ? "on" : "off";
    motionButton.setAttribute("aria-pressed", String(enabled));
    motionButton.textContent = enabled ? "Pause the GIFs" : "Resume the GIFs";
    gifSky.hidden = !enabled;
    if (enabled) {
      if (gifEntries) layoutGifSky();
      else void loadGifCatalog();
      if (gifEntries) motionStatus.textContent = "The old-web starfield is twinkling. One button rests the whole sky.";
    } else {
      gifImages.forEach((image) => image.removeAttribute("src"));
      motionStatus.textContent = "The starfield is resting. The love note stays right here.";
    }
    if (saveChoice) {
      try { localStorage.setItem("zoeytest-motion", enabled ? "on" : "off"); } catch {}
    }
  }

  setMotion(motionChoice());
  motionButton.addEventListener("click", () => setMotion(body.dataset.motion !== "on", true));
  reduceMotion.addEventListener?.("change", (event) => {
    let saved = null;
    try { saved = localStorage.getItem("zoeytest-motion"); } catch {}
    if (!saved) setMotion(!event.matches);
  });
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(layoutGifSky);
  }, { passive: true });

  document.getElementById("messageButton").addEventListener("click", () => {
    messageIndex = (messageIndex + 1) % messages.length;
    const message = document.getElementById("messagePreview");
    message.textContent = messages[messageIndex];
    if (body.dataset.motion === "on") {
      message.classList.remove("z-pop");
      void message.offsetWidth;
      message.classList.add("z-pop");
    }
  });

  const loader = document.getElementById("fakeLoader");
  const world = document.querySelector(".z-world");
  const skip = document.getElementById("skipLoader");
  const loaderFill = document.getElementById("loaderFill");
  const loaderBar = document.getElementById("loaderProgress");
  const loaderPercent = document.getElementById("loaderPercent");
  const loaderStatus = document.getElementById("loaderStatus");
  const loaderLines = [
    [0, "Finding the friend-shaped constellations."],
    [30, "Tuning the tiny love-radio."],
    [62, "Polishing a few pixel hearts."],
    [86, "Checking that the kindness signal is strong."],
    [100, "Ready when you are." ]
  ];
  let loaderFrame = 0;
  let loaderTimer = 0;
  let loaderStarted = 0;
  let loaderClosing = false;
  const loadDuration = 1650;

  function closeLoader() {
    if (loader.hidden || loaderClosing) return;
    loaderClosing = true;
    cancelAnimationFrame(loaderFrame);
    clearTimeout(loaderTimer);
    loader.classList.add("is-closing");
    window.setTimeout(() => {
      loader.hidden = true;
      loader.classList.remove("is-closing");
      loaderClosing = false;
      world.inert = false;
      document.getElementById("pageTitle").focus({ preventScroll: true });
    }, body.dataset.motion === "on" ? 190 : 0);
  }

  function animateLoader(now) {
    const progress = Math.min(100, Math.round(((now - loaderStarted) / loadDuration) * 100));
    loaderFill.style.width = progress + "%";
    loaderBar.setAttribute("aria-valuenow", String(progress));
    loaderPercent.textContent = String(progress).padStart(2, "0") + "%";
    const current = [...loaderLines].reverse().find(([at]) => progress >= at);
    if (current) loaderStatus.textContent = current[1];
    if (progress < 100) loaderFrame = requestAnimationFrame(animateLoader);
    else loaderTimer = window.setTimeout(closeLoader, 180);
  }

  let alreadySeen = false;
  try {
    alreadySeen = sessionStorage.getItem("zoeytest-loader-seen") === "yes";
    if (!alreadySeen) sessionStorage.setItem("zoeytest-loader-seen", "yes");
  } catch {}
  if (!alreadySeen && body.dataset.motion === "on") {
    loader.hidden = false;
    world.inert = true;
    skip.focus({ preventScroll: true });
    loaderStarted = performance.now();
    loaderFrame = requestAnimationFrame(animateLoader);
    skip.addEventListener("click", closeLoader);
    document.querySelector(".z-skip-link").addEventListener("click", (event) => {
      if (!loader.hidden) { event.preventDefault(); closeLoader(); }
    });
    window.addEventListener("keydown", (event) => {
      if (loader.hidden) return;
      if (event.key === "Escape") closeLoader();
      else if (event.key === "Tab") { event.preventDefault(); skip.focus({ preventScroll: true }); }
    });
  } else {
    world.inert = false;
  }
})();
