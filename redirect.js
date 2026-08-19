(() => {
  "use strict";

  async function start() {
    const i18n = window.KazvtI18n;
    if (!i18n) return;
    await i18n.ready;

    const statusNode = document.querySelector("[data-redirect-status]");
    const hostNode = document.querySelector("[data-redirect-host]");
    const params = new URLSearchParams(window.location.search);
    const rawTarget = params.get("to") || "";
    let target;

    try {
      target = new URL(rawTarget, window.location.href);
      if (!/^(https?:)$/.test(target.protocol)) throw new Error();
    } catch {
      if (statusNode) statusNode.textContent = i18n.t("redirect.invalid");
      if (hostNode) hostNode.textContent = i18n.t("redirect.invalid_destination");
      return;
    }

    let matchKey = "";
    let delayMs = 1000;
    for (const [key, entry] of Object.entries(window.KAZVT_LINKS || {})) {
      if (!entry?.url) continue;
      try {
        if (new URL(entry.url, window.location.href).href === target.href) {
          matchKey = key;
          delayMs = Number(entry.delayMs) || delayMs;
          break;
        }
      } catch {}
    }

    const statusKey = matchKey && i18n.t(`redirect.${matchKey}.status`) ? `redirect.${matchKey}.status` : "redirect.status.generic";
    const destinationKey = matchKey && i18n.t(`redirect.${matchKey}.destination`) ? `redirect.${matchKey}.destination` : "redirect.destination.generic";
    if (statusNode) statusNode.textContent = i18n.t(statusKey);
    if (hostNode) hostNode.textContent = i18n.format(destinationKey, { host: target.host });

    window.setTimeout(() => window.location.assign(target.href), Math.max(0, delayMs));
  }

  start();
})();
