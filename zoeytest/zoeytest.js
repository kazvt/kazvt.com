(() => {
  const body = document.body;
  const html = document.documentElement;
  const motionButton = document.getElementById("motionToggle");
  const motionStatus = document.getElementById("motionStatus");
  const stickerField = document.getElementById("stickerField");
  const stickerResting = document.getElementById("stickerResting");
  const stickerZones = [...document.querySelectorAll("[data-sticker-zone]")];
  const gifs = [...document.querySelectorAll(".z-old-gif")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const messages = [
    "We love you, Zoey.",
    "We love you so much, Zoey.",
    "Zoey, you mean so much to us."
  ];
  let messageIndex = 0;

  function currentMotionChoice() {
    const saved = (() => {
      try { return localStorage.getItem("zoeytest-motion"); } catch { return null; }
    })();
    if (saved === "on") return true;
    if (saved === "off") return false;
    return !reduceMotion.matches;
  }

  function setMotion(enabled, saveChoice = false) {
    const value = enabled ? "on" : "off";
    body.dataset.motion = value;
    html.dataset.zoeyMotion = value;
    motionButton.setAttribute("aria-pressed", String(enabled));
    motionButton.textContent = enabled ? "Turn the GIFs off" : "Show the 100 GIFs";
    stickerField.hidden = !enabled;
    stickerResting.hidden = enabled;
    stickerZones.forEach((zone) => { zone.hidden = !enabled; });
    gifs.forEach((gif) => {
      if (enabled) {
        if (!gif.hasAttribute("src")) gif.setAttribute("src", gif.dataset.src);
      } else {
        gif.removeAttribute("src");
      }
    });
    motionStatus.textContent = enabled
      ? "All 100 archival GIFs and decorative motion are on. One switch rests them all."
      : "The GIFs and decorative motion are resting. Your page content is still here.";
    if (saveChoice) {
      try { localStorage.setItem("zoeytest-motion", value); } catch {}
    }
  }

  setMotion(currentMotionChoice());
  motionButton.addEventListener("click", () => {
    setMotion(body.dataset.motion !== "on", true);
  });

  reduceMotion.addEventListener?.("change", (event) => {
    let saved = null;
    try { saved = localStorage.getItem("zoeytest-motion"); } catch {}
    if (!saved) setMotion(!event.matches);
  });

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
  const main = document.getElementById("main-content");
  const skip = document.getElementById("skipLoader");
  const loaderFill = document.getElementById("loaderFill");
  const loaderBar = document.getElementById("loaderProgress");
  const loaderPercent = document.getElementById("loaderPercent");
  const loaderStatus = document.getElementById("loaderStatus");
  const loaderLines = [
    [0, "Finding the friend-shaped stars."],
    [28, "Tuning the tiny love-radio."],
    [57, "Polishing the pixel hearts."],
    [83, "Checking that the kindness signal is strong."],
    [100, "Ready when you are."]
  ];
  let loaderFrame = 0;
  let loaderTimer = 0;
  let loaderStarted = 0;
  const loadDuration = 1750;

  function closeLoader(restoreFocus = true) {
    if (loader.hidden || loader.classList.contains("is-closing")) return;
    cancelAnimationFrame(loaderFrame);
    clearTimeout(loaderTimer);
    loader.classList.add("is-closing");
    window.setTimeout(() => {
      loader.hidden = true;
      loader.classList.remove("is-closing");
      main.inert = false;
      if (restoreFocus) document.getElementById("pageTitle").focus({ preventScroll: true });
    }, body.dataset.motion === "on" ? 190 : 0);
  }

  function animateLoader(now) {
    const elapsed = now - loaderStarted;
    const progress = Math.min(100, Math.round((elapsed / loadDuration) * 100));
    loaderFill.style.width = progress + "%";
    loaderBar.setAttribute("aria-valuenow", String(progress));
    loaderPercent.textContent = String(progress).padStart(2, "0") + "%";
    const current = [...loaderLines].reverse().find(([at]) => progress >= at);
    if (current) loaderStatus.textContent = current[1];
    if (progress < 100) {
      loaderFrame = requestAnimationFrame(animateLoader);
    } else {
      loaderTimer = window.setTimeout(() => closeLoader(true), 190);
    }
  }

  let alreadySeen = false;
  try {
    alreadySeen = sessionStorage.getItem("zoeytest-loader-seen") === "yes";
    if (!alreadySeen) sessionStorage.setItem("zoeytest-loader-seen", "yes");
  } catch {}
  if (!alreadySeen && body.dataset.motion === "on") {
    loader.hidden = false;
    main.inert = true;
    skip.focus({ preventScroll: true });
    loaderStarted = performance.now();
    loaderFrame = requestAnimationFrame(animateLoader);
    skip.addEventListener("click", () => closeLoader(true));
    document.querySelector(".z-skip-link").addEventListener("click", (event) => {
      if (!loader.hidden) {
        event.preventDefault();
        closeLoader(true);
      }
    });
    window.addEventListener("keydown", (event) => {
      if (loader.hidden) return;
      if (event.key === "Escape") {
        closeLoader(true);
      } else if (event.key === "Tab") {
        event.preventDefault();
        skip.focus({ preventScroll: true });
      }
    });
  } else {
    main.inert = false;
  }
})();
