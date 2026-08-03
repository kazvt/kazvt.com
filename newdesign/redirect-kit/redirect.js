(function () {
  const fallback = {
    target: "./",
    delay: 1.5,
    title: "Redirecting...",
    heading: "Preparing your shortcut",
    message: "Windows XP is opening the destination. Click the link if it does not continue automatically.",
    linkLabel: "Redirecting...",
    buttonLabel: "Open now"
  };

  function firstValue() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return undefined;
  }

  function decodeHashTarget() {
    const hash = window.location.hash.replace(/^#/, "").trim();
    if (!hash) return "";
    if (hash.startsWith("to=")) return hash.slice(3);
    return hash;
  }

  function paramsFromLocation() {
    const params = new URLSearchParams(window.location.search);
    return {
      target: firstValue(params.get("to"), params.get("url"), params.get("target"), params.get("href"), decodeHashTarget()),
      delay: firstValue(params.get("delay"), params.get("seconds"), params.get("wait")),
      title: params.get("title"),
      heading: params.get("heading"),
      message: params.get("message"),
      linkLabel: params.get("label"),
      buttonLabel: params.get("button")
    };
  }

  function datasetConfig() {
    const root = document.querySelector("[data-redirect-root]") || document.body;
    const data = root ? root.dataset : {};
    return {
      target: firstValue(data.target, data.url, data.href, data.to),
      delay: firstValue(data.delay, data.seconds, data.wait),
      title: data.title,
      heading: data.heading,
      message: data.message,
      linkLabel: data.linkLabel,
      buttonLabel: data.buttonLabel
    };
  }

  function safeTarget(value) {
    const raw = String(value || "").trim() || "./";
    try {
      const url = new URL(raw, window.location.href);
      if (["http:", "https:", "mailto:", "tel:", "file:"].includes(url.protocol)) return url.href;
    } catch (error) {}
    return "./";
  }

  function safeDelay(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds)) return fallback.delay;
    return Math.max(0, Math.min(seconds, 30));
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function setHref(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.href = value;
  }

  function setMeta(target, delay) {
    const refresh = document.querySelector("meta[http-equiv='refresh']");
    const canonical = document.querySelector("link[rel='canonical']");
    if (refresh) refresh.setAttribute("content", delay + "; url=" + target);
    if (canonical) canonical.href = target;
  }

  function startProgress(delay) {
    const progress = document.querySelector("[data-redirect-progress]");
    if (!progress) return;
    if (delay <= 0) {
      progress.style.width = "100%";
      return;
    }
    const start = performance.now();
    const duration = delay * 1000;
    function tick(now) {
      const amount = Math.min(((now - start) / duration) * 100, 100);
      progress.style.width = amount + "%";
      if (amount < 100) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function redirectTo(target) {
    window.location.assign(target);
  }

  function initRedirect() {
    const explicit = window.REDIRECT_SETTINGS || {};
    const config = Object.assign({}, fallback, explicit, datasetConfig(), paramsFromLocation());
    const target = safeTarget(firstValue(config.target, config.url, config.href, config.to));
    const delay = safeDelay(config.delay);
    document.title = config.title || fallback.title;
    setMeta(target, delay);
    setText("[data-redirect-title]", config.title || fallback.title);
    setText("[data-redirect-heading]", config.heading || fallback.heading);
    setText("[data-redirect-message]", config.message || fallback.message);
    setText("[data-redirect-link]", config.linkLabel || fallback.linkLabel);
    setText("[data-redirect-button]", config.buttonLabel || fallback.buttonLabel);
    setText("[data-redirect-task]", config.title || fallback.title);
    setHref("[data-redirect-link]", target);
    setHref("[data-redirect-button]", target);
    startProgress(delay);
    document.querySelectorAll("[data-redirect-now]").forEach(function (element) {
      element.addEventListener("click", function () {
        redirectTo(target);
      });
    });
    window.setTimeout(function () {
      redirectTo(target);
    }, delay * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRedirect);
  } else {
    initRedirect();
  }
})();
