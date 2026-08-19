(() => {
  "use strict";

  const CONFIG = Object.freeze({
    manifestUrl: "/languages.txt",
    defaultName: "english",
    defaultCode: "en",
    storageKey: "kazvt-language",
    mountClass: "language-dock",
  });

  const parseKeyValue = (text) => {
    const result = new Map();
    String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .flatMap((line) => line.split(","))
      .forEach((line) => {
        const separator = line.indexOf("=");
        if (separator < 0) return;
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replaceAll("\\n", "\n");
        if (key && value) result.set(key, value);
      });
    return result;
  };

  async function fetchText(url) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      return response.ok ? await response.text() : "";
    } catch {
      return "";
    }
  }

  async function loadManifest() {
    const values = parseKeyValue(await fetchText(CONFIG.manifestUrl));
    const languages = [...values.entries()].map(([name, code]) => ({ name, code }));
    return languages.length
      ? languages
      : [{ name: CONFIG.defaultName, code: CONFIG.defaultCode }];
  }

  function selectedLanguage(languages) {
    let stored = "";
    try { stored = sessionStorage.getItem(CONFIG.storageKey) || ""; } catch {}
    return languages.find((language) => language.name === stored || language.code === stored)
      || languages[0];
  }

  async function mount() {
    const existing = document.querySelector(`.${CONFIG.mountClass}`);
    if (existing) return existing;

    /* Paint the selector immediately so even one-second redirect pages show it.
       The manifest/translated labels hydrate in-place as soon as the tiny text
       files return from the same host. */
    const dock = document.createElement("section");
    dock.className = CONFIG.mountClass;
    dock.setAttribute("aria-label", "language selector");

    const title = document.createElement("span");
    title.className = "language-title";
    title.textContent = "language";

    const options = document.createElement("div");
    options.className = "language-options";

    const fallbackButton = document.createElement("button");
    fallbackButton.type = "button";
    fallbackButton.className = "language-button";
    fallbackButton.dataset.languageName = CONFIG.defaultName;
    fallbackButton.dataset.languageCode = CONFIG.defaultCode;
    fallbackButton.setAttribute("aria-pressed", "true");
    fallbackButton.textContent = CONFIG.defaultName;
    options.append(fallbackButton);

    dock.append(title, options);

    dock.addEventListener("click", (event) => {
      const button = event.target.closest("[data-language-name]");
      if (!button) return;
      try {
        sessionStorage.setItem(CONFIG.storageKey, button.dataset.languageName || CONFIG.defaultName);
      } catch {}
      window.location.reload();
    });

    const siteWrap = document.querySelector(".site-wrap");
    if (siteWrap) siteWrap.insertAdjacentElement("afterend", dock);
    else document.body.append(dock);

    const languages = await loadManifest();
    const selected = selectedLanguage(languages);
    const labels = parseKeyValue(await fetchText(`/${selected.name}.txt`));

    document.documentElement.lang = selected.code || CONFIG.defaultCode;
    dock.setAttribute("aria-label", labels.get("language.aria") || "language selector");
    title.textContent = labels.get("language.title") || "language";
    options.replaceChildren();

    languages.forEach((language) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "language-button";
      button.dataset.languageName = language.name;
      button.dataset.languageCode = language.code;
      button.setAttribute("aria-pressed", String(language.name === selected.name));
      button.textContent = labels.get(`language.${language.name}`) || language.name;
      options.append(button);
    });

    return dock;
  }

  window.KazvtLanguageDock = Object.freeze({ mount, config: CONFIG });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { mount(); }, { once: true });
  } else {
    mount();
  }
})();
