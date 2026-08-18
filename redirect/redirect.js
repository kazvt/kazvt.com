(() => {
  const config = window.KAZVT_LINKS || {};
  const hostNode = document.querySelector("[data-redirect-host]");
  const statusNode = document.querySelector("[data-redirect-status]");

  const parts = location.pathname.split("/").filter(Boolean);
  let slug = parts.at(-1) || "";
  if (/^index\.html?$/i.test(slug)) slug = parts.at(-2) || "";
  slug = decodeURIComponent(slug).toLowerCase();

  const params = new URLSearchParams(location.search);
  const rawTarget = params.get("to");
  const entry = config[slug] || null;

  let target = null;
  let redirectText = "warping through the old web...";
  let destinationText = "loading destination";
  let delayMs = 1000;

  // Clean shortlink mode, e.g. /bsky/ -> KAZVT_LINKS.bsky.url
  if (entry && entry.url) {
    try {
      const candidate = new URL(entry.url, location.origin);
      if (candidate.protocol === "http:" || candidate.protocol === "https:") {
        target = candidate;
        redirectText = entry.redirectText || `opening ${entry.label || slug}...`;
        destinationText = entry.destinationText || candidate.hostname.replace(/^www\./, "");
        const configuredDelay = Number(entry.delayMs);
        if (Number.isFinite(configuredDelay)) delayMs = Math.min(10000, Math.max(0, configuredDelay));
      }
    } catch {}
  }

  // Generic outbound-link mode, used by redirect.html?to=https://...
  if (!target && rawTarget) {
    try {
      const candidate = new URL(rawTarget);
      if ((candidate.protocol === "http:" || candidate.protocol === "https:") && candidate.origin !== location.origin) {
        target = candidate;
        destinationText = candidate.hostname.replace(/^www\./, "");
      }
    } catch {}
  }

  document.documentElement.style.setProperty("--redirect-delay", `${delayMs}ms`);

  if (!target) {
    if (statusNode) statusNode.textContent = "lost link! zipping back home...";
    if (hostNode) hostNode.textContent = "kazvt.com";
    setTimeout(() => location.replace("/"), Math.min(delayMs, 1000));
    return;
  }

  if (statusNode) statusNode.textContent = redirectText;
  if (hostNode) {
    hostNode.textContent = destinationText;
    hostNode.title = target.href;
  }
  document.title = `opening ${destinationText}... | kazvt`;

  // No confirmation screen: the transition simply completes and leaves.
  setTimeout(() => location.replace(target.href), delayMs);
})();
