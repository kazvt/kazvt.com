(() => {
  "use strict";

  const config = window.KAZVT_LINKS || {};
  const defaults = window.KAZVT_REDIRECT_DEFAULTS || {};

  function cleanPath(value) {
    return String(value || "").trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  }

  function currentSlug() {
    const parts = location.pathname.split("/").filter(Boolean);
    let slug = parts.at(-1) || "";
    if (/^index\.html?$/i.test(slug)) slug = parts.at(-2) || "";
    return cleanPath(decodeURIComponent(slug));
  }

  function configuredRoute(slug) {
    for (const [key, entry] of Object.entries(config)) {
      if (!entry) continue;
      if (cleanPath(entry.shortPath || key) === slug && entry.url) {
        return { key, entry, rawTarget: entry.url };
      }
      if (entry.liveUrl && cleanPath(entry.liveShortPath) === slug) {
        return { key, entry, rawTarget: entry.liveUrl };
      }
    }
    return null;
  }

  function legacyRoute() {
    const rawTarget = new URLSearchParams(location.search).get("to");
    return rawTarget ? { key: "", entry: {}, rawTarget } : null;
  }

  function safeTarget(rawTarget) {
    try {
      const candidate = new URL(rawTarget, location.origin);
      if (candidate.protocol !== "http:" && candidate.protocol !== "https:") return null;
      return candidate;
    } catch {
      return null;
    }
  }

  async function start() {
    const i18n = window.KazvtI18n;
    if (!i18n) return;
    await i18n.ready;

    const statusNode = document.querySelector("[data-redirect-status]");
    const hostNode = document.querySelector("[data-redirect-host]");
    const logoNode = document.querySelector("[data-redirect-logo]");
    const route = configuredRoute(currentSlug()) || legacyRoute();
    const target = route ? safeTarget(route.rawTarget) : null;

    if (!target) {
      if (statusNode) statusNode.textContent = i18n.t("redirect.invalid");
      if (hostNode) hostNode.textContent = i18n.t("redirect.invalid_destination");
      document.title = i18n.t("title.redirect");
      return;
    }

    const key = route?.key || "";
    const entry = route?.entry || {};
    const statusKey = key && i18n.t(`redirect.${key}.status`) ? `redirect.${key}.status` : "redirect.status.generic";
    const destinationKey = key && i18n.t(`redirect.${key}.destination`) ? `redirect.${key}.destination` : "";
    const destinationText = destinationKey
      ? i18n.t(destinationKey)
      : target.hostname.replace(/^www\./i, "");

    if (statusNode) statusNode.textContent = i18n.t(statusKey);
    if (hostNode) {
      hostNode.textContent = destinationText || i18n.format("redirect.destination.generic", { host: target.host });
      hostNode.title = target.href;
    }

    if (logoNode) {
      const fallbackLogo = defaults.logo || "/zzz_assets/kazvt-transparent.gif";
      const configuredLogo = typeof entry.logo === "string" && entry.logo.trim() ? entry.logo.trim() : fallbackLogo;
      logoNode.src = configuredLogo;
      logoNode.addEventListener("error", () => {
        if (logoNode.src.endsWith(fallbackLogo)) return;
        logoNode.src = fallbackLogo;
      }, { once: true });
    }

    const delayCandidate = Number(entry.delayMs ?? defaults.delayMs ?? 1000);
    const delayMs = Number.isFinite(delayCandidate) ? Math.min(10000, Math.max(0, delayCandidate)) : 1000;
    document.documentElement.style.setProperty("--redirect-delay", `${delayMs}ms`);

    const title = i18n.format("redirect.title_to", { destination: destinationText });
    document.title = title || i18n.t("title.redirect");

    window.setTimeout(() => window.location.replace(target.href), delayMs);
  }

  start();
})();
