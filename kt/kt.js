(() => {
  "use strict";

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const touchPreference = window.matchMedia("(hover: none) and (pointer: coarse)");
  const touchOnly = () => touchPreference.matches && navigator.maxTouchPoints > 0;
  let cursorEffect = null;

  function createTransStripeCursor() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;

    canvas.dataset.ktTransCursor = "true";
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
    const stripeColors = ["#5bcefa", "#f5a9b8", "#ffffff", "#f5a9b8", "#5bcefa"];
    const bandWidth = 5;
    const followRate = 0.4;
    let lastDirection = { x: 1, y: 0 };

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

        return { x: dy, y: -dx };
      });
    }

    function strokeBand(trail, normals, offset, color, lineWidth) {
      context.beginPath();
      trail.forEach((point, index) => {
        const x = point.x + normals[index].x * offset;
        const y = point.y + normals[index].y * offset;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.lineCap = "butt";
      context.lineJoin = "round";
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

      const normals = getNormals(points);
      strokeBand(points, normals, 0, "rgba(16, 21, 34, 0.82)", bandWidth * stripeColors.length + 2);
      stripeColors.forEach((color, index) => {
        strokeBand(points, normals, (index - 2) * bandWidth, color, bandWidth);
      });

      const stillMoving = points.some((point, index) => index > 0 && (
        Math.abs(points[index - 1].x - point.x) > 0.2
        || Math.abs(points[index - 1].y - point.y) > 0.2
      ));
      if (stillMoving) animationFrame = window.requestAnimationFrame(draw);
      else context.clearRect(0, 0, width, height);
    }

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

  function updateCursorEffect() {
    cursorEffect?.destroy?.();
    cursorEffect = null;
    if (motionPreference.matches || touchOnly()) return;
    cursorEffect = createTransStripeCursor();
  }

  updateCursorEffect();
  motionPreference.addEventListener("change", updateCursorEffect);
  touchPreference.addEventListener("change", updateCursorEffect);

  function updateMemberCount() {
    const label = document.querySelector("[data-kt-kicker]");
    const roster = document.querySelector(".kt-member-grid");
    if (!label || !roster) return;

    const count = roster.querySelectorAll(":scope > li > .kt-member").length;
    const i18n = window.KazvtI18n;
    if (!i18n?.format) {
      label.textContent = label.textContent.replace(/\d+/, String(count));
      return;
    }

    const languageCode = i18n.language?.code || document.documentElement.lang || "en";
    let displayCount = String(count);
    try {
      displayCount = new Intl.NumberFormat(languageCode).format(count);
    } catch {}

    const key = count === 1 ? "kt.kicker_one" : "kt.kicker";
    const formatted = i18n.format(key, { count: displayCount });
    if (formatted) label.textContent = formatted;
  }

  window.addEventListener("kazvt:i18nready", updateMemberCount);
  window.addEventListener("kazvt:languagechange", updateMemberCount);

  if (window.KazvtI18n?.ready) {
    window.KazvtI18n.ready.then(updateMemberCount);
  } else {
    updateMemberCount();
  }
})();
