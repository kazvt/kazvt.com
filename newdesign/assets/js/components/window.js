import { createElement } from "./dom.js";

export function createTitleBar(title, controls = ["Minimize", "Maximize", "Close"], icon = null) {
  const titleChildren = [createElement("span", { className: "title-bar-label", text: title })];
  if (icon) {
    titleChildren.unshift(createElement("span", { className: ["title-bar-icon", `title-bar-icon--${icon}`].join(" "), "aria-hidden": true }));
  }
  return createElement("div", { className: "title-bar" }, [
    createElement("div", { className: "title-bar-text" }, titleChildren),
    createElement("div", { className: "title-bar-controls" }, controls.map((label) => createElement("button", { "aria-label": label })))
  ]);
}

export function createWindow({ title, className = "", body = [], status = null, controls, icon = null }) {
  return createElement("section", { className: ["window", className].filter(Boolean).join(" ") }, [
    createTitleBar(title, controls, icon),
    createElement("div", { className: "window-body" }, body),
    status
  ]);
}

export function createStatusBar(fields) {
  return createElement("div", { className: "status-bar" }, fields.map((field) => createElement("p", { className: "status-bar-field", text: field })));
}
