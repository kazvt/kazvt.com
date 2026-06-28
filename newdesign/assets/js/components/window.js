import { createElement } from "./dom.js";

export function createTitleBar(title, controls = ["Minimize", "Maximize", "Close"]) {
  return createElement("div", { className: "title-bar" }, [
    createElement("div", { className: "title-bar-text", text: title }),
    createElement("div", { className: "title-bar-controls" }, controls.map((label) => createElement("button", { "aria-label": label })))
  ]);
}

export function createWindow({ title, className = "", body = [], status = null, controls }) {
  return createElement("section", { className: ["window", className].filter(Boolean).join(" ") }, [
    createTitleBar(title, controls),
    createElement("div", { className: "window-body" }, body),
    status
  ]);
}

export function createStatusBar(fields) {
  return createElement("div", { className: "status-bar" }, fields.map((field) => createElement("p", { className: "status-bar-field", text: field })));
}
