(() => {
  "use strict";

  const STORAGE_KEY = "kazvt-color-mode";
  const CONTROL_ID = "kazvt-appearance-toggle";
  const DARK_CHROME = "#15131f";
  let currentMode = "light";

  function readSavedMode() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function translated(key, fallback) {
    try {
      const value = window.KazvtI18n?.t?.(key);
      return typeof value === "string" && value && value !== key ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function syncButton() {
    const button = document.getElementById(CONTROL_ID);
    if (!button) return;

    const dark = currentMode === "dark";
    button.setAttribute("aria-pressed", String(dark));
    const label = translated(
      dark ? "appearance.switch_light" : "appearance.switch_dark",
      dark ? "Switch to light mode" : "Switch to dark mode"
    );
    button.title = label;
    button.dataset.tooltip = label;
  }

  function syncBrowserChrome() {
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) return;

    if (!themeColor.dataset.colorModeLight) {
      themeColor.dataset.colorModeLight = themeColor.content || "";
    }
    themeColor.content = currentMode === "dark"
      ? DARK_CHROME
      : themeColor.dataset.colorModeLight;
  }

  function apply(mode, { persist = false } = {}) {
    currentMode = mode === "dark" ? "dark" : "light";
    document.documentElement.dataset.colorMode = currentMode;
    syncBrowserChrome();
    syncButton();

    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, currentMode); } catch {}
    }

    window.dispatchEvent(new CustomEvent("kazvt:colormodechange", {
      detail: { mode: currentMode },
    }));
  }

  function createButton() {
    if (!document.body || document.getElementById(CONTROL_ID)) return;

    const button = document.createElement("button");
    button.id = CONTROL_ID;
    button.type = "button";
    button.className = "kazvt-mode-toggle";
    button.setAttribute("aria-label", "Color appearance");
    button.setAttribute("data-i18n-aria-label", "appearance.toggle");
    button.setAttribute("aria-pressed", "false");
    button.title = "Switch to dark mode";
    button.dataset.tooltip = "Switch to dark mode";
    button.innerHTML = `
      <svg class="kazvt-mode-toggle__icon kazvt-mode-toggle__icon--moon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M21.7 4.2a11.8 11.8 0 1 0 6.1 20.1A12.4 12.4 0 0 1 21.7 4.2Z" fill="currentColor"/>
        <path d="m8 5 .8 2.2L11 8l-2.2.8L8 11l-.8-2.2L5 8l2.2-.8L8 5Zm15 15 .7 1.8 1.8.7-1.8.7L23 25l-.7-1.8-1.8-.7 1.8-.7L23 20Z" fill="currentColor"/>
      </svg>
      <svg class="kazvt-mode-toggle__icon kazvt-mode-toggle__icon--sun" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <circle cx="16" cy="16" r="5.1" fill="currentColor"/>
        <path d="M16 2.8v4M16 25.2v4M2.8 16h4m18.4 0h4M6.65 6.65l2.83 2.83m13.04 13.04 2.83 2.83m0-18.7-2.83 2.83M9.48 22.52l-2.83 2.83" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.5"/>
        <path d="m25.5 4.5.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6.6-1.5Z" fill="currentColor"/>
      </svg>`;
    button.addEventListener("click", () => {
      apply(currentMode === "dark" ? "light" : "dark", { persist: true });
    });

    document.body.append(button);
    syncButton();
  }

  apply(readSavedMode());

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createButton, { once: true });
  } else {
    createButton();
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      apply(event.newValue === "dark" ? "dark" : "light");
    }
  });

  window.addEventListener("kazvt:i18nready", syncButton);
  window.addEventListener("kazvt:languagechange", syncButton);
  window.KazvtColorMode = Object.freeze({
    get mode() { return currentMode; },
    set(mode) { apply(mode, { persist: true }); },
  });
})();
