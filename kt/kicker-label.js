(() => {
  function formatKickerLabel(label) {
    const text = label.textContent || "";
    const brand = label.querySelector(".kt-topbar-label__brand");
    const group = label.querySelector(".kt-topbar-label__group");
    if (brand && group && !/\bKICK\.COM\b/i.test(text)) return;

    const fragment = document.createDocumentFragment();
    const brandPattern = /\bKICK(?:\.COM)?\b/gi;
    let cursor = 0;
    let match;
    let foundBrand = false;

    while ((match = brandPattern.exec(text))) {
      if (match.index > cursor) {
        const groupText = document.createElement("span");
        groupText.className = "kt-topbar-label__group";
        groupText.textContent = text.slice(cursor, match.index);
        fragment.append(groupText);
      }

      const brandText = document.createElement("span");
      brandText.className = "kt-topbar-label__brand";
      brandText.textContent = "KICK";
      fragment.append(brandText);
      cursor = brandPattern.lastIndex;
      foundBrand = true;
    }

    if (cursor < text.length || !foundBrand) {
      const groupText = document.createElement("span");
      groupText.className = "kt-topbar-label__group";
      groupText.textContent = text.slice(cursor) || text;
      fragment.append(groupText);
    }

    label.replaceChildren(fragment);
  }

  function initializeKickerLabel() {
    const label = document.querySelector("[data-kt-kicker]");
    if (!label) return;

    const observer = new MutationObserver(() => formatKickerLabel(label));
    observer.observe(label, { childList: true, characterData: true, subtree: true });
    formatKickerLabel(label);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeKickerLabel, { once: true });
  } else {
    initializeKickerLabel();
  }
})();
