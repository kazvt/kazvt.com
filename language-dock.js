(() => {
  "use strict";

  function findOrCreatePageFooter() {
    const preferred = document.querySelector("[data-page-footer]")
      || document.querySelector(".page-footer")
      || document.querySelector(".site-footer")
      || document.querySelector(".archive-footer")
      || document.querySelector(".language-footer");
    if (preferred) return preferred;

    const semanticFooter = [...document.querySelectorAll("footer")].find(
      (footer) => !footer.closest("article, aside, main, nav, section"),
    );
    if (semanticFooter) return semanticFooter;

    const footer = document.createElement("footer");
    footer.className = "language-footer";
    footer.dataset.pageFooter = "true";
    document.body.append(footer);
    return footer;
  }

  async function mount() {
    const i18n = window.KazvtI18n;
    if (!i18n) return null;
    await i18n.ready;

    let dock = document.querySelector(".language-dock");
    if (!dock) {
      dock = document.createElement("div");
      dock.className = "language-dock";
      dock.dataset.languageDock = "true";
    }

    const footer = findOrCreatePageFooter();
    footer.classList.add("has-language-dock");
    if (dock.parentElement !== footer) footer.append(dock);

    if (dock.dataset.languageMounted === "true") {
      dock.querySelectorAll("[data-language]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.language === i18n.language.name));
      });
      i18n.apply(dock);
      window.KazvtLineboil?.sync?.();
      return dock;
    }

    dock.replaceChildren();

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "language-button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.dataset.i18n = "language.title";
    toggle.dataset.i18nAriaLabel = "language.aria";

    const options = document.createElement("div");
    options.className = "language-options";
    options.hidden = true;

    i18n.languages.forEach((language) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "language-option";
      button.dataset.language = language.name;
      button.dataset.i18n = `language.${language.name}`;
      button.setAttribute("aria-pressed", String(language.name === i18n.language.name));
      button.addEventListener("click", async () => {
        const changed = await i18n.select(language.name);
        if (changed) {
          const soundCuePending = document.body.dataset.page === "kt"
            && document.querySelector("[data-kt-music-toggle]")?.dataset.muted !== "true";
          if (soundCuePending) window.setTimeout(() => window.location.reload(), 200);
          else window.location.reload();
        }
      });
      options.append(button);
    });

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      options.hidden = !open;
    });

    dock.append(toggle, options);
    dock.dataset.languageMounted = "true";
    i18n.apply(dock);
    window.KazvtLineboil?.sync?.();
    return dock;
  }

  window.KazvtLanguageDock = { mount };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
