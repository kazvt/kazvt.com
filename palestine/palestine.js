(() => {
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const touchPreference = window.matchMedia("(hover: none) and (pointer: coarse)");
  const touchOnly = () => touchPreference.matches && navigator.maxTouchPoints > 0;
  const cursorColors = ["#ce1126", "#171a18", "#fffdf3", "#087a3f"];
  let cursorEffect = null;

  function createStripedCursorFallback() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;

    canvas.dataset.palestineCursor = "true";
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "2147483646",
    });
    document.body.append(canvas);

    let width = window.innerWidth;
    let height = window.innerHeight;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let animationFrame = 0;
    let started = false;
    const target = { x: width / 2, y: height / 2 };
    const points = Array.from({ length: 24 }, () => ({ ...target }));

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const move = (event) => {
      target.x = event.clientX;
      target.y = event.clientY;
      if (!started) {
        started = true;
        points.forEach((point) => {
          point.x = target.x;
          point.y = target.y;
        });
      }
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      if (started) {
        const trail = [];
        let x = target.x;
        let y = target.y;

        points.forEach((point, index) => {
          const next = points[index + 1] || points[0];
          point.x = x;
          point.y = y;
          trail.push({ x, y });
          x += 0.4 * (next.x - point.x);
          y += 0.4 * (next.y - point.y);
        });

        cursorColors.forEach((color, colorIndex) => {
          context.beginPath();
          context.strokeStyle = color;
          context.lineWidth = 5;
          trail.forEach((point, pointIndex) => {
            const offset = pointIndex === 0 ? colorIndex * 4 : colorIndex * 5;
            if (pointIndex === 0) context.moveTo(point.x, point.y + offset);
            else context.lineTo(point.x, point.y + offset);
          });
          context.stroke();
        });
      }
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    document.body.addEventListener("mousemove", move);
    draw();

    return {
      destroy() {
        window.cancelAnimationFrame(animationFrame);
        window.removeEventListener("resize", resize);
        document.body.removeEventListener("mousemove", move);
        canvas.remove();
      },
    };
  }

  function updateCursor() {
    cursorEffect?.destroy?.();
    cursorEffect = null;
    if (motionPreference.matches || touchOnly()) return;

    const rainbowCursor = window.cursoreffects?.rainbowCursor
      || (typeof cursoreffects !== "undefined" ? cursoreffects.rainbowCursor : null);
    if (typeof rainbowCursor === "function") {
      cursorEffect = rainbowCursor({ colors: cursorColors, length: 24, size: 5 });
    } else {
      cursorEffect = createStripedCursorFallback();
    }
  }

  updateCursor();
  motionPreference.addEventListener("change", updateCursor);
  touchPreference.addEventListener("change", updateCursor);

  const toggle = document.querySelector("[data-gif-toggle]");
  const images = [...document.querySelectorAll(".gif-grid img[data-gif]")];
  if (!toggle || !images.length) return;

  const label = toggle.querySelector("[data-gif-toggle-label]");
  const mark = toggle.querySelector(".toggle-mark");
  const staticSources = new Map(images.map((image) => [image, image.getAttribute("src")]));
  let visitorChoice = null;

  function setGifMotion(playing) {
    images.forEach((image) => {
      const source = playing ? image.dataset.gif : staticSources.get(image);
      if (source && image.getAttribute("src") !== source) image.setAttribute("src", source);
    });

    toggle.setAttribute("aria-pressed", String(playing));
    toggle.setAttribute("aria-label", playing ? "Pause Palestine GIFs" : "Play Palestine GIFs");
    if (label) label.textContent = playing ? "Pause GIFs" : "Play GIFs";
    if (mark) mark.textContent = playing ? "Ⅱ" : "▶";
  }

  setGifMotion(!motionPreference.matches);

  toggle.addEventListener("click", () => {
    visitorChoice = toggle.getAttribute("aria-pressed") !== "true";
    setGifMotion(visitorChoice);
  });

  motionPreference.addEventListener("change", (event) => {
    if (visitorChoice !== null) return;
    setGifMotion(!event.matches);
  });
})();
