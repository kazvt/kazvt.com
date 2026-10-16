export function isPageBackgroundTarget(target, body, documentElement) {
  return target === body || target === documentElement;
}

export function suppressPageBackgroundContextMenu(doc = document) {
  const handleContextMenu = event => {
    if (isPageBackgroundTarget(event.target, doc.body, doc.documentElement)) {
      event.preventDefault();
    }
  };

  doc.addEventListener("contextmenu", handleContextMenu, true);
  return () => doc.removeEventListener("contextmenu", handleContextMenu, true);
}

if (typeof document !== "undefined") {
  suppressPageBackgroundContextMenu(document);
}
