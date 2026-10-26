(() => {
  "use strict";

  const countNode = document.querySelector("[data-kt-discord-count]");
  const unavailableNote = document.querySelector("[data-kt-discord-count-note]");
  if (!(countNode instanceof HTMLElement) || !(unavailableNote instanceof HTMLElement)) return;

  const cacheKey = "kt-discord-personal-server-member-count";
  const cacheLifetime = 15 * 60 * 1000;
  let currentCount = null;

  const translate = (key, fallback) => window.KazvtI18n?.t?.(key) || fallback;
  const formatCount = (value) => {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || undefined, { maximumFractionDigits: 0 }).format(value);
    } catch {
      return String(value);
    }
  };

  function showLoading() {
    countNode.dataset.state = "loading";
    countNode.textContent = "~ …";
    countNode.setAttribute("aria-label", translate("kt.discord_count_loading", "Loading the approximate Discord member count"));
    unavailableNote.hidden = true;
  }

  function showUnavailable() {
    currentCount = null;
    countNode.dataset.state = "unavailable";
    countNode.textContent = "-";
    countNode.setAttribute("aria-label", translate("kt.discord_count_unavailable", "Discord member count unavailable"));
    unavailableNote.hidden = false;
  }

  function showCount(value) {
    currentCount = value;
    const formatted = formatCount(value);
    countNode.dataset.state = "loaded";
    countNode.textContent = `~ ${formatted}`;
    countNode.setAttribute("aria-label", `${translate("kt.discord_count_label", "Approximate Discord server member count")}: ${formatted}`);
    unavailableNote.hidden = true;
  }

  function refreshLocalizedCount() {
    if (currentCount !== null) showCount(currentCount);
    else if (countNode.dataset.state === "unavailable") showUnavailable();
    else showLoading();
  }

  window.addEventListener("kazvt:i18nready", refreshLocalizedCount);
  window.addEventListener("kazvt:languagechange", refreshLocalizedCount);

  let cached = null;
  try {
    const stored = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (Number.isSafeInteger(stored?.count) && stored.count >= 0 && Number.isFinite(stored.savedAt)) {
      const age = Date.now() - stored.savedAt;
      if (age >= 0 && age < cacheLifetime) cached = stored;
    }
  } catch {}

  if (cached) {
    showCount(cached.count);
    return;
  }

  showLoading();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 7000);

  fetch("https://discord.com/api/v10/invites/huzMpfJZ4J?with_counts=true", {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Discord invite lookup returned ${response.status}`);
      return response.json();
    })
    .then((invite) => {
      const memberCount = invite?.approximate_member_count;
      if (!Number.isSafeInteger(memberCount) || memberCount < 0) throw new Error("Discord did not return an approximate member count");
      showCount(memberCount);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ count: memberCount, savedAt: Date.now() }));
      } catch {}
    })
    .catch(() => showUnavailable())
    .finally(() => window.clearTimeout(timeout));
})();
