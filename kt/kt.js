(() => {
  "use strict";

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const touchPreference = window.matchMedia("(hover: none) and (pointer: coarse)");
  const touchOnly = () => touchPreference.matches && navigator.maxTouchPoints > 0;
  const flagVideo = document.querySelector(".kt-flag");
  let cursorEffect = null;

  function initializeWeBringSteps() {
    const stepList = document.querySelector("[data-kt-webring-steps]");
    if (!(stepList instanceof HTMLOListElement) || motionPreference.matches) return;

    const revealSteps = () => stepList.classList.add("is-revealed");
    if (!("IntersectionObserver" in window)) {
      revealSteps();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      revealSteps();
      observer.disconnect();
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
    observer.observe(stepList);
  }

  function initializeMemberKitCopy() {
    const panel = document.querySelector(".kt-webring-kit");
    if (!panel) return;

    const status = panel.querySelector("[data-kt-copy-status]");
    const message = (key, fallback) => window.KazvtI18n?.t(key) || fallback;
    const descriptionInput = panel.querySelector("#kt-webring-plain-text");
    const previewDescription = panel.querySelector("[data-kt-panel-description-preview]");

    const badgeImageLink = panel.querySelector("#kt-panel-badge-image-link");
    const badgeImage = panel.querySelector("#kt-panel-badge-image");
    const badgePicker = panel.querySelector(".kt-kick-panel-mock__badge-picker");
    const badgeLoading = panel.querySelector("[data-kt-badge-loading]");
    const badgeError = panel.querySelector("[data-kt-badge-error]");
    const badgeStatus = panel.querySelector("[data-kt-badge-status]");
    const previousBadge = panel.querySelector("[data-kt-badge-previous]");
    const nextBadge = panel.querySelector("[data-kt-badge-next]");

    if (badgeImageLink && badgeImage instanceof HTMLImageElement && badgePicker && badgeLoading && badgeError && badgeStatus && previousBadge instanceof HTMLButtonElement && nextBadge instanceof HTMLButtonElement) {
      const badgeOptions = [
        {
          src: "/kt/assets/KT-K-trans-flag-panel-static-320.png",
          label: "Trans flag K PNG",
          alt: "Static KickassTransfems K monogram in transgender flag colors over a transgender pride flag background",
          linkLabel: "Open the KickassTransfems K panel PNG over the trans flag",
        },
        {
          src: "/kt/assets/KT-K-panel-static-320.png",
          label: "Transparent K PNG",
          alt: "Static KickassTransfems K monogram in transgender flag colors on a transparent background",
          linkLabel: "Open the transparent KickassTransfems K panel PNG",
        },
        {
          src: "/kt/assets/KT-LOGO-trans-flag-panel-static-320.png",
          label: "Trans flag PNG",
          alt: "Static KickassTransfems wordmark with stacked trans-color outlines over a waving transgender pride flag",
          linkLabel: "Open the KickassTransfems panel PNG over the trans flag",
        },
        {
          src: "/kt/assets/KT-LOGO-panel-static-320.png",
          label: "Transparent PNG",
          alt: "Static KickassTransfems wordmark with stacked transgender flag color outlines on a transparent background",
          linkLabel: "Open the transparent KickassTransfems panel PNG",
        },
      ];
      let badgeIndex = 0;
      let badgeRequest = 0;
      const badgePreloads = new Map();

      function waitForImageLoad(image, src) {
        return new Promise((resolve, reject) => {
          const expectedSrc = new URL(src, document.baseURI).href;
          let settled = false;

          const cleanup = () => {
            image.removeEventListener("load", onLoad);
            image.removeEventListener("error", onError);
          };
          const finish = (error = null) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (error) reject(error);
            else resolve();
          };
          const isExpectedImage = () => (image.currentSrc || image.src) === expectedSrc;
          const onLoad = () => {
            if (!isExpectedImage()) return;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) finish();
            else finish(new Error("Badge image has no decoded dimensions"));
          };
          const onError = () => {
            if (isExpectedImage()) finish(new Error("Badge image failed to load"));
          };

          image.addEventListener("load", onLoad);
          image.addEventListener("error", onError);
          image.src = src;
          if (image.complete && image.naturalWidth > 0 && isExpectedImage()) onLoad();
        });
      }

      function preloadBadge(option, priority = "low") {
        const existing = badgePreloads.get(option.src);
        if (existing) {
          if (priority === "high" && "fetchPriority" in existing.image) {
            existing.image.fetchPriority = "high";
          }
          return existing.promise;
        }

        const image = new Image();
        image.decoding = "async";
        if ("fetchPriority" in image) image.fetchPriority = priority;
        const preload = { image, promise: null };
        preload.promise = waitForImageLoad(image, option.src).catch((error) => {
          if (badgePreloads.get(option.src) === preload) badgePreloads.delete(option.src);
          throw error;
        });
        badgePreloads.set(option.src, preload);
        return preload.promise;
      }

      function selectBadge(index, activatedArrow = null) {
        const shouldRestoreArrowFocus = activatedArrow && document.activeElement === activatedArrow;
        const previousIndex = badgeIndex;
        badgeIndex = Math.max(0, Math.min(badgeOptions.length - 1, index));
        if (badgeIndex !== previousIndex) window.KazvtSfx?.play("paperFlip");
        const option = badgeOptions[badgeIndex];
        const request = ++badgeRequest;
        badgeImage.alt = option.alt;
        badgeImageLink.href = option.src;
        badgeImageLink.setAttribute("aria-label", option.linkLabel);
        badgeStatus.textContent = `Loading ${option.label.toLowerCase()} badge · ${badgeIndex + 1} / ${badgeOptions.length}`;
        previousBadge.disabled = badgeIndex === 0;
        nextBadge.disabled = badgeIndex === badgeOptions.length - 1;
        badgePicker.dataset.loading = "true";
        delete badgePicker.dataset.error;
        badgeLoading.hidden = false;
        badgeError.hidden = true;

        preloadBadge(option, "high").then(() => {
          if (request !== badgeRequest) return;
          badgeImage.loading = "eager";
          if ("fetchPriority" in badgeImage) badgeImage.fetchPriority = "high";
          return waitForImageLoad(badgeImage, option.src);
        }).then(() => {
          if (request !== badgeRequest) return;
          delete badgePicker.dataset.loading;
          badgeLoading.hidden = true;
          badgeStatus.textContent = `${option.label} · ${badgeIndex + 1} / ${badgeOptions.length}`;
        }).catch(() => {
          if (request !== badgeRequest) return;
          delete badgePicker.dataset.loading;
          badgePicker.dataset.error = "true";
          badgeLoading.hidden = true;
          badgeError.hidden = false;
          badgeStatus.textContent = `Couldn’t load the ${option.label.toLowerCase()} badge preview. Go back and try again.`;
        });

        if (shouldRestoreArrowFocus && activatedArrow.disabled) {
          const remainingArrow = badgeIndex === 0 ? nextBadge : previousBadge;
          remainingArrow.focus({ preventScroll: true });
        }
      }

      previousBadge.addEventListener("click", () => selectBadge(badgeIndex - 1, previousBadge));
      nextBadge.addEventListener("click", () => selectBadge(badgeIndex + 1, nextBadge));
      // Preload the three alternate 320px variants at low priority, then prioritize
      // whichever one is selected. Keep the truthful loading state until it displays.
      badgeOptions.slice(1).forEach((option) => {
        void preloadBadge(option, "low").catch(() => {});
      });
    }

    if (descriptionInput instanceof HTMLInputElement && previewDescription) {
      const syncPanelDescription = () => {
        previewDescription.textContent = descriptionInput.value;
      };
      syncPanelDescription();
      descriptionInput.addEventListener("input", syncPanelDescription);
      descriptionInput.addEventListener("change", syncPanelDescription);
    }

    async function copyField(input) {
      if (!(input instanceof HTMLInputElement) || !input.readOnly) return;

      input.focus({ preventScroll: true });
      input.select();
      let copied = false;

      try {
        if (navigator.clipboard?.writeText && window.isSecureContext) {
          await navigator.clipboard.writeText(input.value);
          copied = true;
        }
      } catch {}

      if (!copied) {
        try { copied = document.execCommand("copy"); } catch {}
      }

      if (!copied) {
        input.focus({ preventScroll: true });
        input.select();
      }

      if (copied) window.KazvtSfx?.play("copy");

      if (status) {
        status.dataset.state = copied ? "copied" : "fallback";
        status.textContent = copied
          ? message("kt.webring_copied", "Copied! Thanks for linking us.")
          : message("kt.webring_copy_failed", "Couldn't copy automatically - the text is selected. Press Ctrl+C or Command+C.");
      }
    }

    panel.addEventListener("focusin", (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.hasAttribute("data-kt-copy-input")) target.select();
    });

    panel.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const input = target.closest("[data-kt-copy-input]");
      if (input instanceof HTMLInputElement) {
        void copyField(input);
        return;
      }

      const button = target.closest("[data-kt-copy-target]");
      if (!(button instanceof HTMLButtonElement)) return;
      const destination = document.getElementById(button.dataset.ktCopyTarget || "");
      if (destination instanceof HTMLInputElement) void copyField(destination);
    });

    panel.addEventListener("keydown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.hasAttribute("data-kt-copy-input")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      void copyField(target);
    });
  }

  function initializeNewMemberBadges() {
    const newMemberWindowMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    document.querySelectorAll(".kt-member-grid > li > .kt-member").forEach((card) => {
      let statusRail = card.querySelector(".kt-member-status-rail");
      if (!statusRail) {
        statusRail = document.createElement("span");
        statusRail.className = "kt-member-status-rail";
        card.append(statusRail);
      }

      const addedDate = card.dataset.memberAdded || "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(addedDate)) return;

      const addedAt = Date.parse(`${addedDate}T00:00:00Z`);
      if (!Number.isFinite(addedAt) || addedAt > now || now - addedAt >= newMemberWindowMs) return;

      if (card.querySelector(".kt-member-new-badge")) {
        return;
      }

      const badge = document.createElement("img");
      badge.className = "kt-member-new-badge";
      badge.src = "/kt/assets/new-member-burst.gif";
      badge.alt = "New member";
      badge.width = 36;
      badge.height = 24;
      badge.loading = "lazy";
      badge.decoding = "async";
      statusRail.append(badge);
    });
  }

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
      if (sprite.naturalHeight !== frameSize || frameCount < 2 || sprite.naturalWidth % frameSize !== 0) return;

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
    sprite.src = "/kt/assets/transgender-favicon-sprite.png";
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
    const stripeColors = ["#5bcefa", "#f5a9b8", "#ffffff", "#f5a9b8", "#5bcefa"];
    const bandWidth = 5;
    const edgePadding = bandWidth * stripeColors.length + 4;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;

    canvas.dataset.ktTransCursor = "true";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed",
      top: `${-edgePadding}px`,
      left: `${-edgePadding}px`,
      width: `calc(100% + ${edgePadding * 2}px)`,
      height: `calc(100% + ${edgePadding * 2}px)`,
      pointerEvents: "none",
      zIndex: "2147483646",
    });
    document.body.append(canvas);

    let width = window.innerWidth + edgePadding * 2;
    let height = window.innerHeight + edgePadding * 2;
    // This decorative trail only needs CSS-pixel detail; a 1x backing store
    // avoids allocating a multi-DPR full-viewport surface on software renderers.
    const pixelRatio = 1;
    let animationFrame = 0;
    let hasPointer = false;
    let lastDrawBounds = null;
    const target = { x: width / 2, y: height / 2 };
    const points = Array.from({ length: 24 }, () => ({ ...target }));
    const followRate = 0.4;
    let lastDirection = { x: 1, y: 0 };

    const resize = () => {
      width = window.innerWidth + edgePadding * 2;
      height = window.innerHeight + edgePadding * 2;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      lastDrawBounds = null;
    };

    const move = (event) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;

      const nextX = event.clientX + edgePadding;
      const nextY = event.clientY + edgePadding;
      if (!hasPointer) {
        hasPointer = true;
        target.x = nextX;
        target.y = nextY;
        points.forEach((point) => {
          point.x = target.x;
          point.y = target.y;
        });
      } else {
        if (nextX === target.x && nextY === target.y) return;
        target.x = nextX;
        target.y = nextY;
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

    function getTrailBounds() {
      const padding = bandWidth * stripeColors.length / 2 + 4;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });

      const left = Math.floor(minX - padding);
      const top = Math.floor(minY - padding);
      return {
        left,
        top,
        width: Math.ceil(maxX + padding) - left,
        height: Math.ceil(maxY + padding) - top,
      };
    }

    function clearTrail(bounds) {
      if (!bounds) return;
      context.clearRect(bounds.left, bounds.top, bounds.width, bounds.height);
    }

    function draw() {
      animationFrame = 0;
      clearTrail(lastDrawBounds);
      lastDrawBounds = null;
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
      if (stillMoving) {
        lastDrawBounds = getTrailBounds();
        animationFrame = window.requestAnimationFrame(draw);
      } else {
        clearTrail(getTrailBounds());
      }
    }

    function pauseWhenHidden() {
      if (!document.hidden) return;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      clearTrail(lastDrawBounds);
      lastDrawBounds = null;
      hasPointer = false;
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", pauseWhenHidden);

    return {
      destroy() {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", move);
        document.removeEventListener("visibilitychange", pauseWhenHidden);
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

  function initializePrideGifStagger() {
    const rail = document.querySelector("[data-kt-pride-gif-stagger]");
    const frame = document.querySelector(".kt-frame");
    if (!rail || !frame) return;

    const sourcePool = [
      "/kt/assets/trans-you-matter.gif",
      "/kt/assets/trans-flag-heart.gif",
      "/kt/assets/trans-power.gif",
      "/kt/assets/community/fluent-transgender-flag.gif",
      "/kt/assets/transgender-favicon.gif",
      "/kt/assets/trans-flag-trapbob.gif",
      "/kt/assets/trans-support-fox-fisher.gif",
      "/kt/assets/trans-akcija-cat-flag.gif",
      "/kt/assets/trans-femme-heart-fox-fisher.gif",
      "/kt/assets/trans-love-heart-contextual.gif",
      "/kt/assets/community/fluent-pink-heart.gif",
    ];
    const shuffledPool = [...sourcePool];
    for (let index = shuffledPool.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffledPool[index], shuffledPool[swapIndex]] = [shuffledPool[swapIndex], shuffledPool[index]];
    }

    const desktopPreference = window.matchMedia("(min-width: 1280px)");
    const approximateSlotSpacing = 190;
    let renderedCount = -1;

    function renderRail() {
      const railHeight = rail.clientHeight;
      const count = desktopPreference.matches && !motionPreference.matches && railHeight > 0
        ? Math.ceil(railHeight / approximateSlotSpacing) + 1
        : 0;
      if (count === renderedCount) {
        rail.querySelectorAll(".kt-pride-gif-slot--scan").forEach((slot) => {
          const image = slot.querySelector(".kt-pride-gif-art");
          if (!(image instanceof HTMLImageElement)) return;
          setScanDistance(slot, image);
        });
        return;
      }
      renderedCount = count;

      const fragment = document.createDocumentFragment();
      for (let index = 0; index < count; index += 1) {
        const slot = document.createElement("span");
        slot.className = `kt-pride-gif-slot ${index % 2 === 0 ? "kt-pride-gif--left" : "kt-pride-gif--right"}`;

        const image = document.createElement("img");
        image.className = "kt-pride-gif-art";
        image.width = 200;
        image.height = 200;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.addEventListener("load", () => setScanDistance(slot, image), { once: true });
        slot.append(image);
        fragment.append(slot);
        image.src = shuffledPool[index % shuffledPool.length];
      }
      rail.replaceChildren(fragment);
      rail.querySelectorAll(".kt-pride-gif-slot").forEach((slot) => {
        const image = slot.querySelector(".kt-pride-gif-art");
        if (image instanceof HTMLImageElement && image.complete) setScanDistance(slot, image);
      });
    }

    function setScanDistance(slot, image) {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const frameWidth = slot.clientWidth;
      const frameHeight = slot.clientHeight;
      if (!frameWidth || !frameHeight) return;

      const naturalRatio = image.naturalWidth / image.naturalHeight;
      const renderedWidth = frameHeight * naturalRatio;
      const overflow = renderedWidth - frameWidth;
      if (overflow <= 2) {
        slot.classList.remove("kt-pride-gif-slot--scan");
        image.style.removeProperty("--kt-pride-gif-pan-end");
        image.style.removeProperty("--kt-pride-gif-scan-duration");
        return;
      }

      const scanDuration = Math.max(5, Math.min(9, 4.5 + (overflow / frameWidth) * 1.4));
      image.style.setProperty("--kt-pride-gif-pan-end", `${-overflow}px`);
      image.style.setProperty("--kt-pride-gif-scan-duration", `${scanDuration.toFixed(1)}s`);
      slot.classList.add("kt-pride-gif-slot--scan");
    }

    renderRail();
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(renderRail);
      observer.observe(frame);
      window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
    } else {
      window.addEventListener("resize", renderRail, { passive: true });
    }
    desktopPreference.addEventListener("change", renderRail);
    motionPreference.addEventListener("change", renderRail);
  }

  function initializeTransFlagHover() {
    const selector = ".kt-member";
    const directions = [
      { angle: "90deg", x: "48px", y: "0px", tile: "240px" },
      { angle: "90deg", x: "-48px", y: "0px", tile: "240px" },
      { angle: "0deg", x: "0px", y: "48px", tile: "240px" },
      { angle: "0deg", x: "0px", y: "-48px", tile: "240px" },
      { angle: "225deg", x: "-33.941125497px", y: "33.941125497px", tile: "407.293505963px" },
      { angle: "135deg", x: "33.941125497px", y: "33.941125497px", tile: "407.293505963px" },
      { angle: "45deg", x: "33.941125497px", y: "-33.941125497px", tile: "407.293505963px" },
      { angle: "315deg", x: "-33.941125497px", y: "-33.941125497px", tile: "407.293505963px" },
    ];

    function randomizeDirection(card) {
      const direction = directions[Math.floor(Math.random() * directions.length)];
      card.style.setProperty("--kt-hover-flag-angle", direction.angle);
      card.style.setProperty("--kt-hover-flag-x", direction.x);
      card.style.setProperty("--kt-hover-flag-y", direction.y);
      card.style.setProperty("--kt-hover-flag-tile", direction.tile);
    }

    function handleEntry(event) {
      if (!(event.target instanceof Element)) return;
      const card = event.target.closest(selector);
      if (!card || (event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) return;
      randomizeDirection(card);
    }

    document.addEventListener("pointerover", handleEntry);
    document.addEventListener("focusin", (event) => {
      if (!(event.target instanceof Element)) return;
      const card = event.target.closest(selector);
      if (card && !card.matches(":hover")) randomizeDirection(card);
    });
  }

  function initializeLivePips() {
    const cards = [...document.querySelectorAll(
      ".kt-member-grid > li > .kt-member, .kt-recommendation-grid > li > .kt-recommendation-link"
    )];
    const entries = cards.flatMap((card) => {
      const title = card.querySelector(".kt-member-title");
      const copy = card.querySelector(".kt-member-copy, .kt-recommendation-copy");
      const handle = card.querySelector(".kt-member-handle, .kt-recommendation-handle");
      let profile;
      try {
        profile = new URL(card.href);
      } catch {
        return [];
      }

      const slug = profile.hostname === "kick.com"
        ? profile.pathname.split("/").filter(Boolean)[0]
        : "";
      if (!slug || !title || !copy || !handle) return [];

      const languages = document.createElement("span");
      languages.className = "kt-streamer-languages";
      languages.setAttribute("role", "group");
      languages.setAttribute("aria-label", window.KazvtI18n?.t?.("kt.languages_label") || "Spoken languages");
      const spokenLanguages = slug.toLowerCase() === "vestaphoenix"
        ? [{ code: "en", label: "EN", name: "English" }, { code: "es", label: "ESP", name: "Spanish" }]
        : [{ code: "en", label: "EN", name: "English" }];
      spokenLanguages.forEach(({ code, label, name: languageName }) => {
        const language = document.createElement("abbr");
        language.className = "kt-streamer-language";
        language.lang = code;
        language.title = languageName;
        language.textContent = label;
        languages.append(language);
      });
      if (card.matches(".kt-recommendation-link")) title.append(languages);
      else copy.append(languages);

      const tooltipLabel = card.title.trim();
      const statusRail = card.matches(".kt-member")
        ? card.querySelector(".kt-member-status-rail")
        : null;

      const indicator = document.createElement("span");
      indicator.className = "kt-live-indicator";
      indicator.hidden = true;
      indicator.setAttribute("role", "img");
      const scan = document.createElement("span");
      scan.className = "kt-live-scan";
      scan.setAttribute("aria-hidden", "true");
      card.prepend(scan);
      const lastLiveBadge = document.createElement("span");
      lastLiveBadge.className = "kt-last-live";
      lastLiveBadge.hidden = true;
      lastLiveBadge.setAttribute("role", "img");
      lastLiveBadge.setAttribute("dir", "auto");
      const clockIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      clockIcon.setAttribute("viewBox", "0 0 16 16");
      clockIcon.setAttribute("aria-hidden", "true");
      clockIcon.setAttribute("focusable", "false");
      const clockFace = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      clockFace.setAttribute("cx", "8");
      clockFace.setAttribute("cy", "8");
      clockFace.setAttribute("r", "6");
      const clockHands = document.createElementNS("http://www.w3.org/2000/svg", "path");
      clockHands.setAttribute("d", "M8 4.5v3.8l2.4 1.4");
      clockIcon.append(clockFace, clockHands);
      const lastLiveText = document.createElement("span");
      lastLiveText.className = "kt-last-live__text";
      lastLiveBadge.append(clockIcon, lastLiveText);
      (statusRail || card).append(lastLiveBadge);
      const liveSticker = card.matches(".kt-member") ? document.createElement("img") : null;
      if (liveSticker) {
        liveSticker.className = "kt-live-sticker";
        liveSticker.src = "/kt/assets/kt-live-sticker.gif";
        liveSticker.alt = "";
        liveSticker.setAttribute("aria-hidden", "true");
        liveSticker.decoding = "async";
      }
      const name = title.querySelector(".kt-member-name, .kt-recommendation-name");
      title.insertBefore(indicator, name || title.firstChild);
      return [{
        card,
        slug,
        languages,
        indicator,
        scan,
        tooltipLabel,
        liveSticker,
        statusRail,
        lastLiveBadge,
        lastLiveText,
        originalAriaDescription: card.getAttribute("aria-description"),
        cachedStatus: null,
      }];
    });

    if (!entries.length) return;

    // Anchor every live pip to the same document-timeline phase, even when
    // status requests resolve at different times. The glow alternates, so its
    // full visual cycle is twice the shared 900ms animation duration.
    const livePipVisualCycle = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--kt-live-pip-visual-cycle")
    ) || 1800;
    function synchronizeLivePip(indicator) {
      const timelineTime = document.timeline?.currentTime;
      const now = Number.isFinite(timelineTime) ? timelineTime : performance.now();
      const phase = ((now % livePipVisualCycle) + livePipVisualCycle) % livePipVisualCycle;
      indicator.style.setProperty("--kt-live-pip-phase", `${-phase}ms`);
    }

    const memberList = document.querySelector(".kt-member-grid");
    const guestList = document.querySelector(".kt-recommendation-grid");
    const pinnedMemberSlugs = new Set(["kazvt", "lillie-garden"]);
    const liveStickerVariants = {
      pink: "/kt/assets/kt-live-sticker.gif",
      blue: "/kt/assets/kt-live-sticker-blue.gif",
    };
    const entriesByCard = new Map(entries.map((entry) => [entry.card, entry]));
    const memberRecords = memberList
      ? [...memberList.children].map((listItem, defaultOrder) => {
        const card = listItem.querySelector(".kt-member");
        const entry = card ? entriesByCard.get(card) : null;
        return { listItem, card, entry, slug: entry?.slug || "", defaultOrder };
      })
      : [];
    const guestRecords = guestList
      ? [...guestList.children].map((listItem, defaultOrder) => {
        const card = listItem.querySelector(".kt-recommendation-link");
        const entry = card ? entriesByCard.get(card) : null;
        return { listItem, card, entry, defaultOrder };
      })
      : [];
    let pendingMemberOrder = false;
    let pendingGuestOrder = false;

    function compareStatusAndRecency(left, right) {
      const rank = (record) => {
        const state = record.card?.dataset.liveState;
        if (state === "live") return 0;
        if (state === "offline") return 1;
        return 2;
      };
      const leftRank = rank(left);
      const rightRank = rank(right);
      if (leftRank !== rightRank) return leftRank - rightRank;

      if (leftRank === 1) {
        const leftEstimate = left.entry?.lastLiveSource === "retention-estimate";
        const rightEstimate = right.entry?.lastLiveSource === "retention-estimate";
        if (leftEstimate && rightEstimate
          && left.entry.lastLiveEstimateDays === right.entry.lastLiveEstimateDays) return 0;
        const leftTimestamp = Number(left.entry?.lastLiveAt) || 0;
        const rightTimestamp = Number(right.entry?.lastLiveAt) || 0;
        if (leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp;
      }
      return 0;
    }

    function syncLiveStickers() {
      memberRecords.forEach((member) => {
        if (member.card?.dataset.liveState !== "live" || !member.entry?.liveSticker) return;

        const stickerTone = getComputedStyle(member.card)
          .getPropertyValue("--kt-live-sticker-tone")
          .trim();
        const stickerColor = stickerTone === "blue" ? "blue" : "pink";
        const src = liveStickerVariants[stickerColor];
        if (member.entry.liveSticker.getAttribute("src") !== src) {
          member.entry.liveSticker.setAttribute("src", src);
        }
        member.entry.liveSticker.classList.toggle("kt-live-sticker--blue", stickerColor === "blue");
      });
    }

    function applyMemberOrder() {
      if (!memberList || !memberRecords.length) {
        syncLiveStickers();
        return;
      }

      const orderedMembers = [...memberRecords].sort((left, right) => {
        const leftPinned = pinnedMemberSlugs.has(left.slug);
        const rightPinned = pinnedMemberSlugs.has(right.slug);
        if (leftPinned || rightPinned) {
          if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
          return left.defaultOrder - right.defaultOrder;
        }

        return compareStatusAndRecency(left, right) || left.defaultOrder - right.defaultOrder;
      });

      const orderChanged = orderedMembers.some((member, index) => memberList.children[index] !== member.listItem);
      if (orderChanged && memberList.contains(document.activeElement)) {
        pendingMemberOrder = true;
        syncLiveStickers();
        return;
      }

      orderedMembers.forEach((member, index) => {
        const currentItem = memberList.children[index] || null;
        if (currentItem !== member.listItem) memberList.insertBefore(member.listItem, currentItem);

        const number = member.card?.querySelector(".kt-member-number");
        const displayNumber = String(index + 1).padStart(2, "0");
        if (number && number.textContent !== displayNumber) number.textContent = displayNumber;
      });
      pendingMemberOrder = false;
      syncLiveStickers();
    }

    function applyGuestOrder() {
      if (!guestList || !guestRecords.length) return;

      const orderedGuests = [...guestRecords].sort((left, right) => {
        return compareStatusAndRecency(left, right) || left.defaultOrder - right.defaultOrder;
      });

      const orderChanged = orderedGuests.some((guest, index) => guestList.children[index] !== guest.listItem);
      if (orderChanged && guestList.contains(document.activeElement)) {
        pendingGuestOrder = true;
        return;
      }

      orderedGuests.forEach((guest, index) => {
        const currentItem = guestList.children[index] || null;
        if (currentItem !== guest.listItem) guestList.insertBefore(guest.listItem, currentItem);
      });
      pendingGuestOrder = false;
    }

    function syncMemberAvatarAvailability() {
      const hasOnlineMember = memberRecords.some(
        (member) => member.card?.dataset.liveState === "live"
      );
      memberList?.classList.toggle("has-online-member", hasOnlineMember);
    }

    memberList?.addEventListener("focusout", (event) => {
      if (!pendingMemberOrder) return;
      if (event.relatedTarget instanceof Node && memberList.contains(event.relatedTarget)) return;

      window.requestAnimationFrame(() => {
        if (!memberList.contains(document.activeElement)) applyMemberOrder();
      });
    });

    guestList?.addEventListener("focusout", (event) => {
      if (!pendingGuestOrder) return;
      if (event.relatedTarget instanceof Node && guestList.contains(event.relatedTarget)) return;

      window.requestAnimationFrame(() => {
        if (!guestList.contains(document.activeElement)) applyGuestOrder();
      });
    });

    const refreshInterval = 120_000;
    const requestTimeout = 8_000;
    const historyRequestTimeout = 5_000;
    const historyCacheTtl = 4 * 60 * 60 * 1000;
    const historyFailureTtl = 10 * 60 * 1000;
    const maxConcurrentRequests = 4;
    let inFlight = false;
    let lastRefresh = 0;
    let refreshTimer = 0;
    const lastLiveCache = new Map();

    function parseKickTimestamp(value) {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value < 100_000_000_000 ? value * 1000 : value;
      }
      if (typeof value !== "string" || !value.trim()) return 0;
      const text = value.trim();
      const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(text)
        && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)
        ? `${text.replace(" ", "T")}Z`
        : text;
      const parsed = Date.parse(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function kickDurationMilliseconds(value) {
      const duration = Number(value);
      if (!Number.isFinite(duration) || duration <= 0) return 0;
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      // The public channel-videos response reports duration in milliseconds.
      return duration <= fourteenDaysMs ? duration : 0;
    }

    function lastLiveRecord(videos) {
      const records = Array.isArray(videos)
        ? videos
        : Array.isArray(videos?.data) ? videos.data : null;
      if (!records) return { valid: false, hasVideos: false, record: null };
      const candidates = records
        .filter((video) => video && typeof video === "object" && video.is_live !== true)
        .map((video) => {
          const endedAt = parseKickTimestamp(video.ended_at || video.end_time);
          if (endedAt) return { timestamp: endedAt, approximate: false };
          const startedAt = parseKickTimestamp(video.start_time || video.started_at);
          const durationMs = kickDurationMilliseconds(video.duration);
          const createdAt = parseKickTimestamp(video.created_at);
          if (startedAt) return { timestamp: startedAt + durationMs, approximate: !durationMs };
          return { timestamp: createdAt, approximate: true };
        })
        .filter(({ timestamp }) => timestamp > 0 && timestamp <= Date.now() + 5 * 60 * 1000);
      return {
        valid: true,
        hasVideos: records.length > 0,
        record: candidates.reduce((latest, candidate) => candidate.timestamp > (latest?.timestamp || 0) ? candidate : latest, null),
      };
    }

    function readLastLiveCache(slug) {
      const memoryValue = lastLiveCache.get(slug);
      if (memoryValue && memoryValue.expiresAt > Date.now()) return memoryValue;
      try {
        const stored = JSON.parse(localStorage.getItem(`kt:last-live:v2:${slug}`) || "null");
        const validVod = stored?.kind === "vod" && Number.isFinite(stored.timestamp) && stored.timestamp > 0
          && typeof stored.approximate === "boolean"
          && (stored.lastKnownOnly === undefined || typeof stored.lastKnownOnly === "boolean");
        const validEstimate = stored?.kind === "retention-estimate"
          && (stored.retentionDays === 7 || stored.retentionDays === 30);
        const validUnavailable = stored?.kind === "unavailable";
        const cacheIsFresh = Number.isFinite(stored?.expiresAt) && stored.expiresAt > Date.now();
        if (stored && Number.isFinite(stored.checkedAt) && Number.isFinite(stored.expiresAt)
          && (validVod || (cacheIsFresh && (validEstimate || validUnavailable)))) {
          const cacheValue = {
            ...stored,
            lastKnownOnly: Boolean(stored.lastKnownOnly),
            stale: !cacheIsFresh,
          };
          if (cacheIsFresh) lastLiveCache.set(slug, cacheValue);
          return cacheValue;
        }
      } catch {}
      return null;
    }

    function writeLastLiveCache(slug, record, ttl) {
      const cacheValue = {
        checkedAt: Date.now(),
        expiresAt: Date.now() + ttl,
        kind: record?.kind || "unavailable",
        timestamp: record?.timestamp || null,
        approximate: Boolean(record?.approximate),
        lastKnownOnly: Boolean(record?.lastKnownOnly),
        retentionDays: record?.retentionDays || null,
        stale: false,
      };
      lastLiveCache.set(slug, cacheValue);
      try {
        localStorage.setItem(`kt:last-live:v2:${slug}`, JSON.stringify(cacheValue));
      } catch {}
      return cacheValue;
    }

    function clearLastLiveCache(slug) {
      lastLiveCache.delete(slug);
      try {
        localStorage.removeItem(`kt:last-live:v2:${slug}`);
      } catch {}
    }

    const channelVerificationCache = new Map();
    const channelVerificationCacheTtl = 4 * 60 * 60 * 1000;

    async function channelIsVerified(slug, signal) {
      const cached = channelVerificationCache.get(slug);
      if (cached && cached.expiresAt > Date.now()) return cached.verified;
      try {
        const stored = JSON.parse(localStorage.getItem(`kt:channel-verification:v1:${slug}`) || "null");
        if (stored && typeof stored.verified === "boolean" && Number.isFinite(stored.expiresAt)
          && stored.expiresAt > Date.now()) {
          channelVerificationCache.set(slug, stored);
          return stored.verified;
        }
      } catch {}

      const response = await fetch(
        `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`,
        { headers: { Accept: "application/json" }, signal }
      );
      if (!response.ok) throw new Error(`Kick returned ${response.status}`);
      const channel = await response.json();
      const verified = typeof channel?.verified === "boolean"
        ? channel.verified
        : typeof channel?.is_verified === "boolean" ? channel.is_verified : null;
      if (verified === null) throw new Error("Kick did not provide channel verification status");

      const verification = { verified, expiresAt: Date.now() + channelVerificationCacheTtl };
      channelVerificationCache.set(slug, verification);
      try {
        localStorage.setItem(`kt:channel-verification:v1:${slug}`, JSON.stringify(verification));
      } catch {}
      return verified;
    }

    function readStatusCache(slug) {
      try {
        const stored = JSON.parse(localStorage.getItem(`kt:live-status:v1:${slug}`) || "null");
        if (stored && (stored.state === "live" || stored.state === "offline")
          && Number.isFinite(stored.checkedAt)
          && stored.checkedAt > 0
          && stored.checkedAt <= Date.now() + 5 * 60 * 1000) {
          return stored;
        }
      } catch {}
      return null;
    }

    function writeStatusCache(slug, state) {
      const status = { state, checkedAt: Date.now() };
      try {
        localStorage.setItem(`kt:live-status:v1:${slug}`, JSON.stringify(status));
      } catch {}
      return status;
    }

    function formatRelativeTime(timestamp, style) {
      const age = Math.max(0, Date.now() - timestamp);
      const minute = 60_000;
      const hour = 60 * minute;
      const day = 24 * hour;
      let unit = "second";
      let amount = 0;
      if (age >= minute && age < hour) {
        unit = "minute";
        amount = -Math.floor(age / minute);
      } else if (age >= hour && age < day) {
        unit = "hour";
        amount = -Math.floor(age / hour);
      } else if (age >= day && age < 7 * day) {
        unit = "day";
        amount = -Math.floor(age / day);
      } else if (age >= 7 * day && age < 30 * day) {
        unit = "week";
        amount = -Math.floor(age / (7 * day));
      } else if (age >= 30 * day && age < 365 * day) {
        unit = "month";
        amount = -Math.floor(age / (30 * day));
      } else if (age >= 365 * day) {
        unit = "year";
        amount = -Math.floor(age / (365 * day));
      }

      const locale = window.KazvtI18n?.language?.code || document.documentElement.lang || "en";
      try {
        return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style }).format(amount, unit);
      } catch {
        const fallbackUnits = { second: "s", minute: "m", hour: "h", day: "d", week: "w", month: "mo", year: "y" };
        return amount === 0 ? "now" : `${Math.abs(amount)}${fallbackUnits[unit]} ago`;
      }
    }

    function showLastLive(entry, timestamp, approximate = false, lastKnownOnly = false) {
      if (!timestamp || entry.card.dataset.liveState !== "offline") return;
      entry.lastLiveAt = timestamp;
      entry.lastLiveApproximate = approximate;
      entry.lastLiveKnownOnly = lastKnownOnly;
      entry.lastLiveSource = lastKnownOnly ? "cached-vod" : "vod";
      entry.lastLiveEstimateDays = 0;
      entry.lastLiveCheckedAt = 0;
      const uncertain = approximate || lastKnownOnly;
      entry.lastLiveText.textContent = `${uncertain ? "~" : ""}${formatRelativeTime(timestamp, "narrow")}`;
      const displayName = entry.card.querySelector(".kt-member-name, .kt-recommendation-name")
        ?.textContent?.trim() || entry.slug;
      const fullTime = `${uncertain ? "~" : ""}${formatRelativeTime(timestamp, "long")}`;
      const i18n = window.KazvtI18n;
      const label = lastKnownOnly
        ? i18n?.format?.("kt.last_live_cached_aria", { name: displayName, time: fullTime })
          || `${displayName}'s last known public KICK VOD was ${fullTime}; later streams without a public replay may not be reflected.`
        : i18n?.format?.("kt.last_live_aria", { name: displayName, time: fullTime })
          || `${displayName} was last live ${fullTime}`;
      entry.lastLiveBadge.setAttribute("aria-label", label);
      entry.lastLiveBadge.title = label;
      entry.lastLiveBadge.hidden = false;
      entry.card.dataset.lastLive = "true";
      if (lastKnownOnly) entry.card.dataset.lastLiveKnownOnly = "true";
      else delete entry.card.dataset.lastLiveKnownOnly;
      delete entry.card.dataset.lastLiveEstimate;
    }

    function showRetentionEstimate(entry, retentionDays, checkedAt = Date.now()) {
      if (!retentionDays || entry.card.dataset.liveState !== "offline") return;
      entry.lastLiveAt = checkedAt - retentionDays * 24 * 60 * 60 * 1000;
      entry.lastLiveApproximate = true;
      entry.lastLiveKnownOnly = false;
      entry.lastLiveSource = "retention-estimate";
      entry.lastLiveEstimateDays = retentionDays;
      entry.lastLiveCheckedAt = checkedAt;
      entry.lastLiveText.textContent = `${retentionDays}d+`;
      const displayName = entry.card.querySelector(".kt-member-name, .kt-recommendation-name")
        ?.textContent?.trim() || entry.slug;
      const label = window.KazvtI18n?.format?.("kt.last_live_retention_aria", {
        name: displayName,
        days: retentionDays,
      }) || `${displayName}: no public VOD is available; showing ${retentionDays}d+ from Kick's retention window. Last live may be older or unknown.`;
      entry.lastLiveBadge.setAttribute("aria-label", label);
      entry.lastLiveBadge.title = label;
      entry.lastLiveBadge.hidden = false;
      entry.card.dataset.lastLive = "true";
      delete entry.card.dataset.lastLiveKnownOnly;
      entry.card.dataset.lastLiveEstimate = "retention-window";
    }

    function refreshLastLiveDisplay(entry) {
      if (entry.lastLiveSource === "retention-estimate") {
        showRetentionEstimate(entry, entry.lastLiveEstimateDays, entry.lastLiveCheckedAt);
      } else if (entry.lastLiveAt) {
        showLastLive(entry, entry.lastLiveAt, entry.lastLiveApproximate, entry.lastLiveKnownOnly);
      }
    }

    function cachedStatusDescription(entry, checkedAt) {
      const displayName = entry.card.querySelector(".kt-member-name, .kt-recommendation-name")
        ?.textContent?.trim() || entry.slug;
      const time = formatRelativeTime(checkedAt, "long");
      return window.KazvtI18n?.format?.("kt.status_cached_aria", { name: displayName, time })
        || `${displayName}'s status was last checked ${time}; checking again now`;
    }

    async function loadLastLive(entry, requestId) {
      const cached = readLastLiveCache(entry.slug);
      if (cached) {
        if (cached.kind === "vod") {
          showLastLive(entry, cached.timestamp, cached.approximate, cached.lastKnownOnly || cached.stale);
        }
        if (cached.kind === "retention-estimate") {
          showRetentionEstimate(entry, cached.retentionDays, cached.checkedAt);
        }
        if (!cached.stale) return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), historyRequestTimeout);
      try {
        const response = await fetch(
          `https://kick.com/api/v2/channels/${encodeURIComponent(entry.slug)}/videos`,
          { headers: { Accept: "application/json" }, signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Kick returned ${response.status}`);
        const history = lastLiveRecord(await response.json());
        if (entry.statusRequestId !== requestId) return;
        if (!history.valid) throw new Error("Unexpected Kick VOD history response");
        if (history.record) {
          const record = { ...history.record, kind: "vod" };
          writeLastLiveCache(entry.slug, record, historyCacheTtl);
          showLastLive(entry, record.timestamp, record.approximate);
        } else if (cached?.kind === "vod") {
          const retained = writeLastLiveCache(entry.slug, {
            kind: "vod",
            timestamp: cached.timestamp,
            approximate: cached.approximate,
            lastKnownOnly: true,
          }, historyCacheTtl);
          showLastLive(entry, retained.timestamp, retained.approximate, true);
        } else if (!history.hasVideos) {
          const verified = await channelIsVerified(entry.slug, controller.signal);
          if (entry.statusRequestId !== requestId) return;
          const retentionDays = verified ? 30 : 7;
          const estimate = { kind: "retention-estimate", retentionDays };
          const cachedEstimate = writeLastLiveCache(entry.slug, estimate, historyCacheTtl);
          showRetentionEstimate(entry, retentionDays, cachedEstimate.checkedAt);
        } else {
          writeLastLiveCache(entry.slug, null, historyFailureTtl);
        }
      } catch {
        if (entry.statusRequestId === requestId) {
          if (cached?.kind === "vod") {
            const retained = writeLastLiveCache(entry.slug, {
              kind: "vod",
              timestamp: cached.timestamp,
              approximate: cached.approximate,
              lastKnownOnly: true,
            }, historyFailureTtl);
            showLastLive(entry, retained.timestamp, retained.approximate, true);
          } else {
            writeLastLiveCache(entry.slug, null, historyFailureTtl);
          }
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }

    function setState(entry, state, { fromCache = false, checkedAt = entry.cachedStatus?.checkedAt } = {}) {
      const { card, indicator, slug, tooltipLabel, liveSticker } = entry;
      const previousState = card.dataset.liveState;
      card.dataset.liveState = state;
      const preserveOfflineHistory = state === "offline" && previousState === "offline" && entry.lastLiveAt;
      if (!preserveOfflineHistory) {
        entry.lastLiveBadge.hidden = true;
        delete card.dataset.lastLive;
        delete card.dataset.lastLiveKnownOnly;
        delete card.dataset.lastLiveEstimate;
        entry.lastLiveBadge.removeAttribute("aria-label");
        entry.lastLiveBadge.removeAttribute("title");
      }
      const cacheNote = fromCache && checkedAt ? cachedStatusDescription(entry, checkedAt) : "";
      if (cacheNote) {
        card.dataset.liveStatusCached = "true";
        indicator.dataset.cached = "true";
        const originalDescription = entry.originalAriaDescription?.trim();
        card.setAttribute("aria-description", [originalDescription, cacheNote].filter(Boolean).join(". "));
      } else {
        delete card.dataset.liveStatusCached;
        delete indicator.dataset.cached;
        if (entry.originalAriaDescription) card.setAttribute("aria-description", entry.originalAriaDescription);
        else card.removeAttribute("aria-description");
      }
      if (memberList?.contains(card)) syncMemberAvatarAvailability();
      const tooltip = tooltipLabel
        ? (state === "live" ? `⬤ LIVE: ${tooltipLabel}` : tooltipLabel)
        : "";
      const cardTitle = [tooltip, cacheNote].filter(Boolean).join(" · ");
      if (cardTitle) card.title = cardTitle;
      else card.removeAttribute("title");

      if (state !== "live") {
        indicator.hidden = true;
        indicator.style.removeProperty("--kt-live-pip-phase");
        liveSticker?.remove();
        delete indicator.dataset.state;
        indicator.removeAttribute("aria-label");
        indicator.removeAttribute("title");
        if (!preserveOfflineHistory) {
          entry.lastLiveAt = 0;
          entry.lastLiveSource = "";
          entry.lastLiveKnownOnly = false;
          entry.lastLiveEstimateDays = 0;
          entry.lastLiveCheckedAt = 0;
        }
        return;
      }

      if (state === "live" && previousState !== "live" && !fromCache) clearLastLiveCache(slug);
      entry.lastLiveAt = 0;
      entry.lastLiveSource = "";
      entry.lastLiveKnownOnly = false;
      entry.lastLiveEstimateDays = 0;
      entry.lastLiveCheckedAt = 0;

      synchronizeLivePip(indicator);
      indicator.hidden = false;
      indicator.dataset.state = state;
      if (liveSticker && !liveSticker.isConnected) (entry.statusRail || card).append(liveSticker);
      syncLiveStickers();
      const displayName = card.querySelector(".kt-member-name, .kt-recommendation-name")
        ?.textContent?.trim() || slug;
      const i18n = window.KazvtI18n;
      const liveLabel = i18n?.format?.("kt.live_aria", { name: displayName })
        || i18n?.t?.("kt.live_aria")
        || `${displayName} is live on KICK`;
      indicator.textContent = "";
      indicator.setAttribute("aria-label", cacheNote ? `${liveLabel}. ${cacheNote}` : liveLabel);
      if (cardTitle) indicator.title = cardTitle;
      else indicator.removeAttribute("title");
    }

    function restoreStatusCache() {
      entries.forEach((entry) => {
        const cached = readStatusCache(entry.slug);
        if (!cached) return;
        entry.cachedStatus = cached;
        entry.statusRequestId = 0;
        setState(entry, cached.state, { fromCache: true, checkedAt: cached.checkedAt });
        if (cached.state === "offline") {
          const lastLive = readLastLiveCache(entry.slug);
          if (lastLive?.kind === "vod") {
            showLastLive(entry, lastLive.timestamp, lastLive.approximate, lastLive.lastKnownOnly || lastLive.stale);
          }
          if (lastLive?.kind === "retention-estimate") {
            showRetentionEstimate(entry, lastLive.retentionDays, lastLive.checkedAt);
          }
        }
      });
      applyMemberOrder();
      applyGuestOrder();
    }

    async function checkEntry(entry) {
      const requestId = (entry.statusRequestId || 0) + 1;
      entry.statusRequestId = requestId;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), requestTimeout);
      let state = "unknown";
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
        state = payload.data ? "live" : "offline";
        if (entry.statusRequestId !== requestId) return;
        entry.cachedStatus = writeStatusCache(entry.slug, state);
        setState(entry, state);
      } catch {
        if (entry.statusRequestId === requestId) {
          if (entry.cachedStatus) {
            setState(entry, entry.cachedStatus.state, {
              fromCache: true,
              checkedAt: entry.cachedStatus.checkedAt,
            });
          } else {
            setState(entry, "unknown");
          }
        }
      } finally {
        window.clearTimeout(timeout);
      }
      if (state === "offline" && entry.statusRequestId === requestId) await loadLastLive(entry, requestId);
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
        applyMemberOrder();
        applyGuestOrder();
      } finally {
        inFlight = false;
        scheduleRefresh(Math.max(0, refreshInterval - (Date.now() - lastRefresh)));
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
      entry.languages.setAttribute(
        "aria-label",
        window.KazvtI18n?.t?.("kt.languages_label") || "Spoken languages"
      );
      const state = entry.card.dataset.liveState;
      const fromCache = entry.card.dataset.liveStatusCached === "true";
      if (state === "live" || (state === "offline" && fromCache)) {
        setState(entry, state, { fromCache, checkedAt: entry.cachedStatus?.checkedAt });
      }
      if (state === "offline" && entry.lastLiveAt) refreshLastLiveDisplay(entry);
    });
    window.addEventListener("kazvt:i18nready", refreshIndicatorLanguage);
    window.addEventListener("kazvt:languagechange", refreshIndicatorLanguage);
    window.setInterval(() => {
      entries.forEach((entry) => {
        if (entry.card.dataset.liveStatusCached === "true" && entry.cachedStatus) {
          setState(entry, entry.cachedStatus.state, {
            fromCache: true,
            checkedAt: entry.cachedStatus.checkedAt,
          });
        }
        if (entry.card.dataset.liveState === "offline" && entry.lastLiveAt) refreshLastLiveDisplay(entry);
      });
    }, 60_000);

    restoreStatusCache();
    void refreshStatuses();
  }

  window.addEventListener("kazvt:i18nready", updateMemberCount);
  window.addEventListener("kazvt:languagechange", updateMemberCount);

  initializeMemberKitCopy();
  initializeNewMemberBadges();
  initializeWeBringSteps();
  initializePrideGifStagger();
  initializeTransFlagHover();
  initializeLivePips();

  if (window.KazvtI18n?.ready) {
    window.KazvtI18n.ready.then(updateMemberCount);
  } else {
    updateMemberCount();
  }
})();
