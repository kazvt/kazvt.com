(() => {
  "use strict";

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const touchPreference = window.matchMedia("(hover: none) and (pointer: coarse)");
  const touchOnly = () => touchPreference.matches && navigator.maxTouchPoints > 0;
  const flagVideo = document.querySelector(".kt-flag");
  let cursorEffect = null;

  function initializeAnimatedFavicon() {
    const iconLink = document.getElementById("ktFavicon");
    if (!(iconLink instanceof HTMLLinkElement)) return;

    const gifUrl = iconLink.href;
    const sprite = new Image();
    sprite.decoding = "async";
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    context.imageSmoothingEnabled = false;
    const frameSize = canvas.width;
    let frameIcons = [];
    let frameIndex = 0;
    let interval = 0;

    function showFaviconFrame(index) {
      frameIndex = index % frameIcons.length;
      iconLink.type = "image/png";
      iconLink.href = frameIcons[frameIndex];
    }

    function syncFaviconMotion() {
      if (!frameIcons.length) return;
      window.clearInterval(interval);
      interval = 0;
      showFaviconFrame(0);
      if (motionPreference.matches) return;
      interval = window.setInterval(() => {
        showFaviconFrame((frameIndex + 1) % frameIcons.length);
      }, 90);
    }

    sprite.addEventListener("load", () => {
      const frameCount = Math.floor(sprite.naturalWidth / frameSize);
      if (sprite.naturalHeight !== frameSize || frameCount < 2) return;

      frameIcons = Array.from({ length: frameCount }, (_, index) => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(sprite, index * frameSize, 0, frameSize, frameSize, 0, 0, frameSize, frameSize);
        return canvas.toDataURL("image/png");
      });
      syncFaviconMotion();
    }, { once: true });
    sprite.addEventListener("error", () => {
      iconLink.type = "image/gif";
      iconLink.href = gifUrl;
    }, { once: true });
    sprite.src = "/kt/assets/transgender-favicon-sprite.png?v=transgender-favicon-20261023-v1";
    motionPreference.addEventListener("change", syncFaviconMotion);
    window.addEventListener("pagehide", () => window.clearInterval(interval), { once: true });
  }

  function syncFlagPlayback() {
    if (!(flagVideo instanceof HTMLVideoElement)) return;
    if (motionPreference.matches) {
      flagVideo.pause();
      return;
    }
    flagVideo.play().catch(() => {});
  }

  syncFlagPlayback();
  motionPreference.addEventListener("change", syncFlagPlayback);
  initializeAnimatedFavicon();

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

  function initializeLivePips() {
    const cards = [...document.querySelectorAll(
      ".kt-member-grid > li > .kt-member, .kt-recommendation-grid > li > .kt-recommendation-link"
    )];
    const entries = cards.flatMap((card) => {
      const title = card.querySelector(".kt-member-title");
      let profile;
      try {
        profile = new URL(card.href);
      } catch {
        return [];
      }

      const slug = profile.hostname === "kick.com"
        ? profile.pathname.split("/").filter(Boolean)[0]
        : "";
      if (!slug || !title) return [];

      const indicator = document.createElement("span");
      indicator.className = "kt-live-indicator";
      indicator.hidden = true;
      indicator.setAttribute("role", "img");
      const name = title.querySelector(".kt-member-name, .kt-recommendation-name");
      title.insertBefore(indicator, name || title.firstChild);
      return [{ card, slug, indicator }];
    });

    if (!entries.length) return;

    const refreshInterval = 120_000;
    const requestTimeout = 8_000;
    const maxConcurrentRequests = 4;
    let inFlight = false;
    let lastRefresh = 0;
    let refreshTimer = 0;

    function setState(entry, state) {
      const { card, indicator, slug } = entry;
      card.dataset.liveState = state;
      if (state === "offline") {
        indicator.hidden = true;
        delete indicator.dataset.state;
        indicator.removeAttribute("aria-label");
        indicator.removeAttribute("title");
        return;
      }

      indicator.hidden = false;
      indicator.dataset.state = state;
      const translate = (key, fallback, replacements = {}) => {
        const i18n = window.KazvtI18n;
        return i18n?.format?.(key, replacements) || i18n?.t?.(key) || fallback;
      };
      const displayName = card.querySelector(".kt-member-name, .kt-recommendation-name")
        ?.textContent?.trim() || slug;
      indicator.textContent = state === "live"
        ? ""
        : translate("kt.unknown_label", "?");
      indicator.setAttribute(
        "aria-label",
        state === "live"
          ? translate("kt.live_aria", `${displayName} is live on KICK`, { name: displayName })
          : translate("kt.unknown_aria", `Couldn't check ${slug}'s KICK status`, { name: slug })
      );
      if (state === "live") {
        indicator.removeAttribute("title");
      } else {
        indicator.title = translate("kt.unknown_title", "KICK status unavailable");
      }
    }

    async function checkEntry(entry) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), requestTimeout);
      try {
        const response = await fetch(
          `https://kick.com/api/v2/channels/${encodeURIComponent(entry.slug)}/livestream`,
          { headers: { Accept: "application/json" }, signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Kick returned ${response.status}`);

        const payload = await response.json();
        if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
          throw new Error("Unexpected Kick status response");
        }
        setState(entry, payload.data ? "live" : "offline");
      } catch {
        setState(entry, "unknown");
      } finally {
        window.clearTimeout(timeout);
      }
    }

    async function refreshStatuses() {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      lastRefresh = Date.now();
      let nextEntry = 0;

      try {
        await Promise.all(Array.from({ length: Math.min(maxConcurrentRequests, entries.length) }, async () => {
          while (nextEntry < entries.length) {
            const entry = entries[nextEntry];
            nextEntry += 1;
            await checkEntry(entry);
          }
        }));
      } finally {
        inFlight = false;
        scheduleRefresh(refreshInterval);
      }
    }

    function scheduleRefresh(delay) {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          void refreshStatuses();
        } else {
          scheduleRefresh(refreshInterval);
        }
      }, delay);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const elapsed = Date.now() - lastRefresh;
      if (elapsed >= refreshInterval) void refreshStatuses();
      else scheduleRefresh(refreshInterval - elapsed);
    });

    const refreshIndicatorLanguage = () => entries.forEach((entry) => {
      const state = entry.indicator.dataset.state;
      if (!entry.indicator.hidden && state) setState(entry, state);
    });
    window.addEventListener("kazvt:i18nready", refreshIndicatorLanguage);
    window.addEventListener("kazvt:languagechange", refreshIndicatorLanguage);

    void refreshStatuses();
  }

  window.addEventListener("kazvt:i18nready", updateMemberCount);
  window.addEventListener("kazvt:languagechange", updateMemberCount);

  initializeLivePips();

  if (window.KazvtI18n?.ready) {
    window.KazvtI18n.ready.then(updateMemberCount);
  } else {
    updateMemberCount();
  }
})();
