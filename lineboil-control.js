(() => {
  "use strict";

  const STORAGE_KEY = "kazvt-lineboil";
  const SELECTOR = "[data-tool-lineboil]";
  const SEEDS = [4, 11];
  const DESKTOP_TICK_MS = 260;
  const COARSE_TICK_MS = 360;

  let boilTimer = 0;
  let seedIndex = 0;
  let controlsQueued = false;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia?.("(hover: none) and (pointer: coarse)");

  function storedEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === "on"; }
    catch { return false; }
  }

  function isEnabled() {
    return document.documentElement.dataset.lineboil !== "off";
  }

  function noiseNode() {
    return document.getElementById("page-lineboil-noise");
  }

  function shouldAnimate() {
    return isEnabled() && !document.hidden && !reducedMotion?.matches && Boolean(noiseNode());
  }

  function stopBoilTimer() {
    if (!boilTimer) return;
    window.clearTimeout(boilTimer);
    boilTimer = 0;
  }

  function scheduleBoilTick() {
    stopBoilTimer();
    if (!shouldAnimate()) return;
    const delay = coarsePointer?.matches ? COARSE_TICK_MS : DESKTOP_TICK_MS;
    boilTimer = window.setTimeout(tickBoil, delay);
  }

  function tickBoil() {
    boilTimer = 0;
    if (!shouldAnimate()) return;
    seedIndex = (seedIndex + 1) % SEEDS.length;
    noiseNode()?.setAttribute("seed", String(SEEDS[seedIndex]));
    scheduleBoilTick();
  }

  function syncBoilEngine() {
    const noise = noiseNode();
    if (noise && !isEnabled()) {
      seedIndex = 0;
      noise.setAttribute("seed", String(SEEDS[0]));
    }
    scheduleBoilTick();
  }

  function syncButtons() {
    const enabled = isEnabled();
    const i18n = window.KazvtI18n;
    const label = i18n?.t(enabled ? "lineboil.on" : "lineboil.off") || "";
    const ariaLabel = i18n?.t(enabled ? "lineboil.disable_aria" : "lineboil.enable_aria") || "";
    document.querySelectorAll(SELECTOR).forEach((button) => {
      button.setAttribute("aria-pressed", String(enabled));
      if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
      else button.removeAttribute("aria-label");
      if (button.textContent !== label) button.textContent = label;
    });
  }

  function apply(enabled, { persist = true } = {}) {
    document.documentElement.dataset.lineboil = enabled ? "on" : "off";
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off"); }
      catch {}
    }
    syncButtons();
    syncBoilEngine();
    window.dispatchEvent(new CustomEvent("kazvt:lineboilchange", { detail: { enabled } }));
  }

  function createToggle(className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lineboil-toggle ${className}`;
    button.dataset.toolLineboil = "true";
    return button;
  }

  function renderPaletteInvite(invite) {
    const text = window.KazvtI18n?.t("palette.invite") || "pick a vibe! ✦ tap / click a color → remix the whole site!";
    if (invite.dataset.renderedPaletteInvite === text) return;

    const parts = text.split(/\s*✦\s*/, 2);
    const leadText = parts.length > 1 ? parts[0].trim() : "pick a vibe!";
    const actionText = parts.length > 1 ? parts[1].trim() : text;
    const lead = document.createElement("span");
    const action = document.createElement("span");
    lead.className = "palette-invite-lead";
    action.className = "palette-invite-action";
    lead.textContent = leadText;
    action.textContent = actionText;

    invite.removeAttribute("data-i18n");
    invite.setAttribute("aria-label", text);
    invite.replaceChildren(lead, action);
    invite.dataset.renderedPaletteInvite = text;
  }

  function refreshPaletteInvites() {
    document.querySelectorAll(".palette-invite").forEach(renderPaletteInvite);
  }

  function ensureControls() {
    document.querySelectorAll(".big-palette").forEach((palette) => {
      let invite = palette.parentElement?.querySelector(":scope > .palette-invite");
      if (!invite) {
        invite = document.createElement("p");
        invite.className = "palette-invite";
        palette.insertAdjacentElement("beforebegin", invite);
      }
      renderPaletteInvite(invite);
      if (!palette.parentElement?.querySelector(":scope > .lineboil-toggle-sidebar")) {
        palette.insertAdjacentElement("afterend", createToggle("lineboil-toggle-sidebar"));
      }
    });
    document.querySelectorAll(".language-dock").forEach((dock) => {
      if (!dock.querySelector(".lineboil-toggle-language")) {
        dock.append(createToggle("lineboil-toggle-language"));
      }
    });
    syncButtons();
  }

  function queueEnsureControls() {
    if (controlsQueued) return;
    controlsQueued = true;
    queueMicrotask(() => {
      controlsQueued = false;
      ensureControls();
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(SELECTOR) : null;
    if (!target) return;
    event.preventDefault();
    apply(!isEnabled());
  });

  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === "childList" && record.addedNodes.length)) {
      queueEnsureControls();
    }
  });

  async function start() {
    await window.KazvtI18n?.ready;
    if (!document.documentElement.dataset.lineboil) {
      document.documentElement.dataset.lineboil = storedEnabled() ? "on" : "off";
    }
    ensureControls();
    syncBoilEngine();
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("visibilitychange", syncBoilEngine);
    reducedMotion?.addEventListener?.("change", syncBoilEngine);
    coarsePointer?.addEventListener?.("change", syncBoilEngine);
    window.addEventListener("kazvt:languagechange", () => {
      syncButtons();
      refreshPaletteInvites();
    });
  }

  window.KazvtLineboil = {
    get enabled() { return isEnabled(); },
    set enabled(value) { apply(Boolean(value)); },
    sync() { ensureControls(); syncBoilEngine(); },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
