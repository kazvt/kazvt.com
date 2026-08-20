(() => {
  "use strict";

  const STORAGE_KEY = "kazvt-lineboil";
  const SELECTOR = "[data-tool-lineboil]";
  const BOIL_NAME = /boil/i;
  let syncQueued = false;

  function storedEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) !== "off"; }
    catch { return true; }
  }

  function isEnabled() {
    return document.documentElement.dataset.lineboil !== "off";
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

  function matchingAnimations() {
    if (typeof document.getAnimations !== "function") return [];
    return document.getAnimations({ subtree: true }).filter((animation) =>
      BOIL_NAME.test(typeof animation.animationName === "string" ? animation.animationName : "")
    );
  }

  function syncAnimations() {
    const enabled = isEnabled();
    matchingAnimations().forEach((animation) => {
      try {
        if (enabled) {
          if (animation.playState === "paused") animation.play();
        } else {
          animation.pause();
          animation.currentTime = 0;
        }
      } catch {}
    });
  }

  function queueAnimationSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      syncAnimations();
    });
  }

  function apply(enabled, { persist = true } = {}) {
    document.documentElement.dataset.lineboil = enabled ? "on" : "off";
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off"); }
      catch {}
    }
    syncButtons();
    queueAnimationSync();
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

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(SELECTOR) : null;
    if (!target) return;
    event.preventDefault();
    apply(!isEnabled());
  });

  document.addEventListener("animationstart", (event) => {
    if (!isEnabled() && BOIL_NAME.test(event.animationName || "")) queueAnimationSync();
  }, true);

  const observer = new MutationObserver((records) => {
    let ensure = false;
    let resync = false;
    for (const record of records) {
      if (record.type === "childList") { ensure = true; resync = true; }
      if (record.type === "attributes" && record.attributeName === "open") resync = true;
    }
    if (ensure) ensureControls();
    if (resync && !isEnabled()) queueAnimationSync();
  });

  async function start() {
    await window.KazvtI18n?.ready;
    if (!document.documentElement.dataset.lineboil) {
      document.documentElement.dataset.lineboil = storedEnabled() ? "on" : "off";
    }
    ensureControls();
    syncAnimations();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    window.addEventListener("kazvt:languagechange", () => {
      syncButtons();
      refreshPaletteInvites();
    });
  }

  window.KazvtLineboil = {
    get enabled() { return isEnabled(); },
    set enabled(value) { apply(Boolean(value)); },
    sync() { ensureControls(); syncAnimations(); },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
