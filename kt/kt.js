(() => {
  "use strict";

  function updateMemberCount() {
    const label = document.querySelector("[data-kt-kicker]");
    const roster = document.querySelector(".kt-member-grid");
    if (!label || !roster) return;

    const count = roster.querySelectorAll(":scope > li > .kt-member").length;
    const i18n = window.KazvtI18n;
    if (!i18n?.format) {
      label.textContent = label.textContent.replace(/\d+/, String(count));
      return;
    }

    const languageCode = i18n.language?.code || document.documentElement.lang || "en";
    let displayCount = String(count);
    try {
      displayCount = new Intl.NumberFormat(languageCode).format(count);
    } catch {}

    const key = count === 1 ? "kt.kicker_one" : "kt.kicker";
    const formatted = i18n.format(key, { count: displayCount });
    if (formatted) label.textContent = formatted;
  }

  window.addEventListener("kazvt:i18nready", updateMemberCount);
  window.addEventListener("kazvt:languagechange", updateMemberCount);

  if (window.KazvtI18n?.ready) {
    window.KazvtI18n.ready.then(updateMemberCount);
  } else {
    updateMemberCount();
  }
})();
