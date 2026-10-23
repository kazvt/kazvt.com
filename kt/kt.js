(() => {
  "use strict";

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const touchPreference = window.matchMedia("(hover: none) and (pointer: coarse)");
  const touchOnly = () => touchPreference.matches && navigator.maxTouchPoints > 0;
  const flagVideo = document.querySelector(".kt-flag");
  let cursorEffect = null;

  function initializeMemberKitCopy() {
    const panel = document.querySelector(".kt-webring-kit");
    if (!panel) return;

    const status = panel.querySelector("[data-kt-copy-status]");
    const message = (key, fallback) => window.KazvtI18n?.t(key) || fallback;
    const descriptionInput = panel.querySelector("#kt-webring-plain-text");
    const previewDescription = panel.querySelector("[data-kt-panel-description-preview]");

    const badgeImageLink = panel.querySelector("#kt-panel-badge-image-link");
    const badgeImage = panel.querySelector("#kt-panel-badge-image");
    const badgeStatus = panel.querySelector("[data-kt-badge-status]");
    const previousBadge = panel.querySelector("[data-kt-badge-previous]");
    const nextBadge = panel.querySelector("[data-kt-badge-next]");

    if (badgeImageLink && badgeImage instanceof HTMLImageElement && badgeStatus && previousBadge instanceof HTMLButtonElement && nextBadge instanceof HTMLButtonElement) {
      const badgeOptions = [
        {
          src: "/kt/assets/KT-LOGO.gif",
          label: "Transparent",
          alt: "Animated KickassTransfems logo with a transparent background",
          linkLabel: "Open the transparent KickassTransfems badge GIF",
        },
        {
          src: "/kt/assets/KT-LOGO-trans-flag.gif",
          label: "Trans flag background",
          alt: "Animated KickassTransfems logo over a moving transgender pride flag",
          linkLabel: "Open the KickassTransfems badge GIF over the trans flag",
        },
      ];
      let badgeIndex = 0;

      function selectBadge(index) {
        badgeIndex = Math.max(0, Math.min(badgeOptions.length - 1, index));
        const option = badgeOptions[badgeIndex];
        badgeImage.src = option.src;
        badgeImage.alt = option.alt;
        badgeImageLink.href = option.src;
        badgeImageLink.setAttribute("aria-label", option.linkLabel);
        badgeStatus.textContent = `${option.label} · ${badgeIndex + 1} / ${badgeOptions.length}`;
        previousBadge.disabled = badgeIndex === 0;
        nextBadge.disabled = badgeIndex === badgeOptions.length - 1;
      }

      previousBadge.addEventListener("click", () => selectBadge(badgeIndex - 1));
      nextBadge.addEventListener("click", () => selectBadge(badgeIndex + 1));
      selectBadge(0);
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
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let animationFrame = 0;
    let hasPointer = false;
    const target = { x: width / 2, y: height / 2 };
    const points = Array.from({ length: 24 }, () => ({ ...target }));
    const followRate = 0.4;
    let lastDirection = { x: 1, y: 0 };

    const resize = () => {
      width = window.innerWidth + edgePadding * 2;
      height = window.innerHeight + edgePadding * 2;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const move = (event) => {
      target.x = event.clientX + edgePadding;
      target.y = event.clientY + edgePadding;
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
    window.addEventListener("pointermove", move, { passive: true });

    return {
      destroy() {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", move);
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
      "/kt/assets/trans-caturday.gif",
      "/kt/assets/transgender-favicon.gif",
      "/kt/assets/trans-flag-trapbob.gif",
      "/kt/assets/trans-support-fox-fisher.gif",
      "/kt/assets/trans-rights-intoaction.gif",
      "/kt/assets/trans-akcija-cat-flag.gif",
      "/kt/assets/trans-femme-heart-fox-fisher.gif",
      "/kt/assets/trans-love-heart-contextual.gif",
      "/kt/assets/trans-rights-taimi.gif",
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
      const tooltipLabel = card.title.trim();

      const indicator = document.createElement("span");
      indicator.className = "kt-live-indicator";
      indicator.hidden = true;
      indicator.setAttribute("role", "img");
      const scan = document.createElement("span");
      scan.className = "kt-live-scan";
      scan.setAttribute("aria-hidden", "true");
      card.prepend(scan);
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
      return [{ card, slug, indicator, scan, tooltipLabel, liveSticker }];
    });

    if (!entries.length) return;

    const memberList = document.querySelector(".kt-member-grid");
    const pinnedMemberSlugs = new Set(["kazvt", "lillie-garden"]);
    const liveStickerVariants = [
      { src: "/kt/assets/kt-live-sticker.gif", color: "pink" },
      { src: "/kt/assets/kt-live-sticker-blue.gif", color: "blue" },
    ];
    const entriesByCard = new Map(entries.map((entry) => [entry.card, entry]));
    const memberRecords = memberList
      ? [...memberList.children].map((listItem, defaultOrder) => {
        const card = listItem.querySelector(".kt-member");
        const entry = card ? entriesByCard.get(card) : null;
        return { listItem, card, entry, slug: entry?.slug || "", defaultOrder };
      })
      : [];
    let pendingMemberOrder = false;

    function applyMemberOrder() {
      if (!memberList || !memberRecords.length) return;

      const orderedMembers = [...memberRecords].sort((left, right) => {
        const leftPinned = pinnedMemberSlugs.has(left.slug);
        const rightPinned = pinnedMemberSlugs.has(right.slug);
        if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;

        const leftLive = left.card?.dataset.liveState === "live";
        const rightLive = right.card?.dataset.liveState === "live";
        if (leftLive !== rightLive) return leftLive ? -1 : 1;
        return left.defaultOrder - right.defaultOrder;
      });

      const orderChanged = orderedMembers.some((member, index) => memberList.children[index] !== member.listItem);
      if (orderChanged && memberList.contains(document.activeElement)) {
        pendingMemberOrder = true;
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

      let liveStickerIndex = 0;
      orderedMembers.forEach((member) => {
        if (member.card?.dataset.liveState !== "live" || !member.entry?.liveSticker) return;

        const variant = liveStickerVariants[liveStickerIndex % liveStickerVariants.length];
        liveStickerIndex += 1;
        if (member.entry.liveSticker.getAttribute("src") !== variant.src) {
          member.entry.liveSticker.setAttribute("src", variant.src);
        }
        member.entry.liveSticker.classList.toggle("kt-live-sticker--blue", variant.color === "blue");
      });
    }

    memberList?.addEventListener("focusout", (event) => {
      if (!pendingMemberOrder) return;
      if (event.relatedTarget instanceof Node && memberList.contains(event.relatedTarget)) return;

      window.requestAnimationFrame(() => {
        if (!memberList.contains(document.activeElement)) applyMemberOrder();
      });
    });

    const refreshInterval = 120_000;
    const requestTimeout = 8_000;
    const maxConcurrentRequests = 4;
    let inFlight = false;
    let lastRefresh = 0;
    let refreshTimer = 0;

    function setState(entry, state) {
      const { card, indicator, slug, tooltipLabel, liveSticker } = entry;
      card.dataset.liveState = state;
      const tooltip = tooltipLabel
        ? (state === "live" ? `⬤ LIVE: ${tooltipLabel}` : tooltipLabel)
        : "";
      if (tooltip) card.title = tooltip;
      else card.removeAttribute("title");

      if (state !== "live") {
        indicator.hidden = true;
        liveSticker?.remove();
        delete indicator.dataset.state;
        indicator.removeAttribute("aria-label");
        indicator.removeAttribute("title");
        return;
      }

      indicator.hidden = false;
      indicator.dataset.state = state;
      if (liveSticker && !liveSticker.isConnected) card.append(liveSticker);
      const displayName = card.querySelector(".kt-member-name, .kt-recommendation-name")
        ?.textContent?.trim() || slug;
      const i18n = window.KazvtI18n;
      const liveLabel = i18n?.format?.("kt.live_aria", { name: displayName })
        || i18n?.t?.("kt.live_aria")
        || `${displayName} is live on KICK`;
      indicator.textContent = "";
      indicator.setAttribute("aria-label", liveLabel);
      if (tooltip) indicator.title = tooltip;
      else indicator.removeAttribute("title");
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
        applyMemberOrder();
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
      const state = entry.indicator.dataset.state;
      if (!entry.indicator.hidden && state) setState(entry, state);
    });
    window.addEventListener("kazvt:i18nready", refreshIndicatorLanguage);
    window.addEventListener("kazvt:languagechange", refreshIndicatorLanguage);

    void refreshStatuses();
  }

  window.addEventListener("kazvt:i18nready", updateMemberCount);
  window.addEventListener("kazvt:languagechange", updateMemberCount);

  initializeMemberKitCopy();
  initializePrideGifStagger();
  initializeTransFlagHover();
  initializeLivePips();

  if (window.KazvtI18n?.ready) {
    window.KazvtI18n.ready.then(updateMemberCount);
  } else {
    updateMemberCount();
  }
})();
