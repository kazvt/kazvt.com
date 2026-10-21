(() => {
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const touchPreference = window.matchMedia("(hover: none) and (pointer: coarse)");
  const sideRailPreference = window.matchMedia("(min-width: 600px)");
  const touchOnly = () => touchPreference.matches && navigator.maxTouchPoints > 0;
  let cursorEffect = null;

  function createPalestinianFlagCursor() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;

    canvas.dataset.palestineCursor = "true";
    canvas.setAttribute("aria-hidden", "true");
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
    let hasPointer = false;
    const target = { x: width / 2, y: height / 2 };
    const points = Array.from({ length: 24 }, () => ({ ...target }));
    let lastDirection = { x: 1, y: 0 };
    const bandHeight = 6;
    const halfHeight = bandHeight * 1.5;
    const followRate = 0.4;

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
      if (!hasPointer) {
        hasPointer = true;
        points.forEach((point) => {
          point.x = target.x;
          point.y = target.y;
        });
      }
      scheduleDraw();
    };

    function scheduleDraw() {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(draw);
    }

    function getNormals(trail) {
      return trail.map((point, index) => {
        const before = trail[Math.max(0, index - 1)];
        const after = trail[Math.min(trail.length - 1, index + 1)];
        let dx = before.x - after.x;
        let dy = before.y - after.y;
        const magnitude = Math.hypot(dx, dy);

        if (magnitude > 0.001) {
          dx /= magnitude;
          dy /= magnitude;
          lastDirection = { x: dx, y: dy };
        } else {
          dx = lastDirection.x;
          dy = lastDirection.y;
        }

        let normal = { x: dy, y: -dx };
        // Keep black above green on screen even when the cursor reverses direction.
        if (normal.y > 0 || (Math.abs(normal.y) < 0.001 && normal.x > 0)) {
          normal = { x: -normal.x, y: -normal.y };
        }
        return normal;
      });
    }

    function fillBand(trail, normals, outerOffset, innerOffset, color) {
      context.beginPath();
      trail.forEach((point, index) => {
        const edge = {
          x: point.x + normals[index].x * outerOffset,
          y: point.y + normals[index].y * outerOffset,
        };
        if (index === 0) context.moveTo(edge.x, edge.y);
        else context.lineTo(edge.x, edge.y);
      });
      for (let index = trail.length - 1; index >= 0; index -= 1) {
        const point = trail[index];
        context.lineTo(
          point.x + normals[index].x * innerOffset,
          point.y + normals[index].y * innerOffset,
        );
      }
      context.closePath();
      context.fillStyle = color;
      context.fill();
    }

    function findTriangleTip(trail, baseIndex) {
      let totalLength = 0;
      for (let index = 1; index < trail.length; index += 1) {
        totalLength += Math.hypot(
          trail[index - 1].x - trail[index].x,
          trail[index - 1].y - trail[index].y,
        );
      }

      if (totalLength < 2) return null;
      let distanceFromBase = totalLength / 3;
      const step = baseIndex === 0 ? 1 : -1;
      const endIndex = baseIndex === 0 ? trail.length - 1 : 0;

      for (let index = baseIndex; index !== endIndex; index += step) {
        const base = trail[index];
        const next = trail[index + step];
        const segmentLength = Math.hypot(next.x - base.x, next.y - base.y);
        if (segmentLength < 0.001) continue;
        if (distanceFromBase <= segmentLength) {
          const fraction = distanceFromBase / segmentLength;
          return {
            x: base.x + (next.x - base.x) * fraction,
            y: base.y + (next.y - base.y) * fraction,
          };
        }
        distanceFromBase -= segmentLength;
      }
      return null;
    }

    function drawFlag(trail) {
      const normals = getNormals(trail);
      context.lineJoin = "round";
      context.lineCap = "round";

      fillBand(trail, normals, halfHeight, bandHeight / 2, "#171a18");
      fillBand(trail, normals, bandHeight / 2, -bandHeight / 2, "#fffdf3");
      fillBand(trail, normals, -bandHeight / 2, -halfHeight, "#087a3f");

      const baseIndex = trail[0].x <= trail[trail.length - 1].x ? 0 : trail.length - 1;
      const tip = findTriangleTip(trail, baseIndex);
      if (!tip) return;

      const base = trail[baseIndex];
      const baseNormal = normals[baseIndex];
      context.beginPath();
      context.moveTo(base.x + baseNormal.x * halfHeight,
        base.y + baseNormal.y * halfHeight);
      context.lineTo(tip.x, tip.y);
      context.lineTo(base.x - baseNormal.x * halfHeight,
        base.y - baseNormal.y * halfHeight);
      context.closePath();
      context.fillStyle = "#ce1126";
      context.fill();

      context.beginPath();
      context.moveTo(base.x + baseNormal.x * halfHeight,
        base.y + baseNormal.y * halfHeight);
      context.lineTo(tip.x, tip.y);
      context.lineTo(base.x - baseNormal.x * halfHeight,
        base.y - baseNormal.y * halfHeight);
      context.closePath();
      context.strokeStyle = "rgba(23, 26, 24, 0.65)";
      context.lineWidth = 0.8;
      context.stroke();

      context.beginPath();
      trail.forEach((point, index) => {
        const edge = {
          x: point.x + normals[index].x * halfHeight,
          y: point.y + normals[index].y * halfHeight,
        };
        if (index === 0) context.moveTo(edge.x, edge.y);
        else context.lineTo(edge.x, edge.y);
      });
      for (let index = trail.length - 1; index >= 0; index -= 1) {
        context.lineTo(
          trail[index].x - normals[index].x * halfHeight,
          trail[index].y - normals[index].y * halfHeight,
        );
      }
      context.closePath();
      context.strokeStyle = "rgba(23, 26, 24, 0.55)";
      context.lineWidth = 1;
      context.stroke();
    }

    function draw() {
      animationFrame = 0;
      context.clearRect(0, 0, width, height);
      if (!hasPointer) return;

      points[0].x = target.x;
      points[0].y = target.y;
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const point = points[index];
        point.x += followRate * (previous.x - point.x);
        point.y += followRate * (previous.y - point.y);
      }

      drawFlag(points);

      const stillMoving = points.some((point, index) => index > 0 && (
        Math.abs(points[index - 1].x - point.x) > 0.2
        || Math.abs(points[index - 1].y - point.y) > 0.2
      ));
      if (stillMoving) animationFrame = window.requestAnimationFrame(draw);
      else context.clearRect(0, 0, width, height);
    };

    resize();
    window.addEventListener("resize", resize);
    document.body.addEventListener("mousemove", move);

    return {
      destroy() {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
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
    cursorEffect = createPalestinianFlagCursor();
  }

  updateCursor();
  motionPreference.addEventListener("change", updateCursor);
  touchPreference.addEventListener("change", updateCursor);

  const toggle = document.querySelector("[data-gif-toggle]");
  const images = [...document.querySelectorAll(".palestine-sprinkles img[data-gif]")];
  if (!toggle || !images.length) return;

  const label = toggle.querySelector("[data-gif-toggle-label]");
  const mark = toggle.querySelector(".toggle-mark");
  const staticSources = new Map(images.map((image) => [image, image.getAttribute("src")]));
  let visitorChoice = null;

  toggle.hidden = !sideRailPreference.matches;

  function translated(key, fallback) {
    return window.KazvtI18n?.t?.(key) || fallback;
  }

  function setGifMotion(playing) {
    const shouldPlay = playing && sideRailPreference.matches;
    images.forEach((image) => {
      const source = shouldPlay ? image.dataset.gif : staticSources.get(image);
      if (source && image.getAttribute("src") !== source) image.setAttribute("src", source);
    });

    toggle.setAttribute("aria-pressed", String(shouldPlay));
    toggle.setAttribute(
      "aria-label",
      translated(shouldPlay ? "palestine.pause_aria" : "palestine.play_aria", shouldPlay ? "Pause Palestine GIFs" : "Play Palestine GIFs"),
    );
    if (label) label.textContent = translated(shouldPlay ? "palestine.pause" : "palestine.play", shouldPlay ? "Pause GIFs" : "Play GIFs");
    if (mark) mark.textContent = shouldPlay ? "Ⅱ" : "▶";
  }

  setGifMotion(!motionPreference.matches && sideRailPreference.matches);
  window.KazvtI18n?.ready?.then(() => {
    setGifMotion(toggle.getAttribute("aria-pressed") === "true");
  });

  toggle.addEventListener("click", () => {
    visitorChoice = toggle.getAttribute("aria-pressed") !== "true";
    setGifMotion(visitorChoice);
  });

  motionPreference.addEventListener("change", (event) => {
    if (visitorChoice !== null) return;
    setGifMotion(!event.matches && sideRailPreference.matches);
  });

  sideRailPreference.addEventListener("change", (event) => {
    toggle.hidden = !event.matches;
    const shouldPlay = visitorChoice === null ? !motionPreference.matches : visitorChoice;
    setGifMotion(shouldPlay && event.matches);
  });

  window.addEventListener("kazvt:languagechange", () => {
    setGifMotion(toggle.getAttribute("aria-pressed") === "true");
  });
})();
