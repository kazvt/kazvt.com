(() => {
  "use strict";

  const LANGUAGE_STORAGE_KEY = "kazvt-language";
  const DEFAULT_LANGUAGE_NAME = "english";
  const DEFAULT_LANGUAGE_CODE = "en";
  let currentLanguage = { name: DEFAULT_LANGUAGE_NAME, code: DEFAULT_LANGUAGE_CODE };
  let languages = [];
  let fallbackValues = new Map();
  let values = new Map();
  let manifestObjectUrl = "";

  async function loadTextLines(file) {
    try {
      const url = /^(?:https?:|data:|blob:|\/)/i.test(file) ? file : `/${file}`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return [];
      const text = await response.text();
      return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
    } catch {
      return [];
    }
  }

  function parseKeyValueLines(lines) {
    const map = new Map();
    lines.forEach((line) => {
      const separator = line.indexOf("=");
      if (separator === -1) return;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replaceAll("\\n", "\n");
      if (key) map.set(key, value);
    });
    return map;
  }

  function storedLanguageName() {
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const stored = storage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored) return stored;
      } catch {}
    }
    return "";
  }

  async function loadManifest() {
    const manifest = parseKeyValueLines((await loadTextLines("languages.txt")).flatMap((line) => line.split(",")));
    languages = [...manifest.entries()].map(([name, code]) => ({ name, code }));
    if (!languages.length) languages = [{ name: DEFAULT_LANGUAGE_NAME, code: DEFAULT_LANGUAGE_CODE }];

    const stored = storedLanguageName();
    currentLanguage = languages.find((item) => item.name === stored || item.code === stored) || languages[0];
    return currentLanguage;
  }

  function t(key) {
    return values.get(key) ?? fallbackValues.get(key) ?? "";
  }

  function setDocumentLanguage(language) {
    const code = language?.code || DEFAULT_LANGUAGE_CODE;
    document.documentElement.lang = code;
    document.documentElement.dir = code.toLowerCase().startsWith("ar") ? "rtl" : "ltr";
  }

  async function loadValues(language) {
    const english = language?.name === DEFAULT_LANGUAGE_NAME
      ? fallbackValues
      : parseKeyValueLines(await loadTextLines(`${DEFAULT_LANGUAGE_NAME}.txt`));
    if (english.size) fallbackValues = english;
    const localized = language?.name === DEFAULT_LANGUAGE_NAME
      ? fallbackValues
      : parseKeyValueLines(await loadTextLines(`${language.name}.txt`));
    return new Map([...fallbackValues, ...localized]);
  }

  function list(key) {
    const value = t(key);
    return value ? value.split("|").map((item) => item.trim()).filter(Boolean) : [];
  }

  function format(key, replacements = {}) {
    let text = t(key);
    Object.entries(replacements).forEach(([name, value]) => {
      text = text.replaceAll(`{${name}}`, String(value));
    });
    return text;
  }


  function applyLocalizedWebManifest() {
    const links = document.querySelectorAll?.('link[rel="manifest"][data-i18n-manifest]');
    if (!links?.length) return;

    const name = t("manifest.name");
    const shortName = t("manifest.short_name");
    if (!name && !shortName) return;

    const manifest = {
      name,
      short_name: shortName || name,
      description: t("manifest.description"),
      icons: [
        { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      theme_color: "#ffffff",
      background_color: "#ffffff",
      display: "standalone",
    };

    const nextUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
    const previousUrl = manifestObjectUrl;
    manifestObjectUrl = nextUrl;
    links.forEach((link) => link.setAttribute("href", nextUrl));
    if (previousUrl) setTimeout(() => URL.revokeObjectURL(previousUrl), 0);
  }

  function apply(root = document) {
    if (!root) return;

    root.querySelectorAll?.("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (!key || !values.has(key)) return;
      node.textContent = values.get(key);
    });

    ["aria-label", "title", "alt", "placeholder", "content"].forEach((attribute) => {
      const marker = `data-i18n-${attribute}`;
      root.querySelectorAll?.(`[${marker}]`).forEach((node) => {
        const key = node.getAttribute(marker);
        if (!key || !values.has(key)) return;
        node.setAttribute(attribute, values.get(key));
      });
    });

    const page = document.body?.dataset.page;
    if (page) {
      const pageTitle = t(`title.${page}`);
      if (pageTitle) document.title = pageTitle;
    }

    if (root === document) applyLocalizedWebManifest();
  }

  async function select(nameOrCode) {
    const language = languages.find((item) => item.name === nameOrCode || item.code === nameOrCode);
    if (!language) return false;
    try { sessionStorage.setItem(LANGUAGE_STORAGE_KEY, language.name); } catch {}
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language.name); } catch {}
    currentLanguage = language;
    values = await loadValues(language);
    setDocumentLanguage(language);
    apply(document);
    window.dispatchEvent(new CustomEvent("kazvt:languagechange", { detail: { language } }));
    return true;
  }

  async function init() {
    await loadManifest();
    fallbackValues = parseKeyValueLines(await loadTextLines(`${DEFAULT_LANGUAGE_NAME}.txt`));
    values = await loadValues(currentLanguage);
    if (!fallbackValues.size && currentLanguage.name !== DEFAULT_LANGUAGE_NAME) {
      currentLanguage = languages.find((item) => item.name === DEFAULT_LANGUAGE_NAME) || languages[0];
      values = await loadValues(currentLanguage);
    }
    setDocumentLanguage(currentLanguage);
    apply(document);
    window.dispatchEvent(new CustomEvent("kazvt:i18nready", { detail: { language: currentLanguage } }));
    return values;
  }

  window.addEventListener("pagehide", () => {
    if (manifestObjectUrl) URL.revokeObjectURL(manifestObjectUrl);
  }, { once: true });

  const ready = init();
  window.KazvtI18n = {
    ready,
    t,
    list,
    format,
    apply,
    select,
    entries: () => [...values.entries()],
    get language() { return { ...currentLanguage }; },
    get languages() { return languages.map((item) => ({ ...item })); },
  };
})();
