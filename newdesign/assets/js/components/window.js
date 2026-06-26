import { node } from "./dom.js";

export function createTitleBar(title, controls = ["Minimize", "Maximize", "Close"]) {
  return node("div", { className: "title-bar" }, [
    node("div", { className: "title-bar-text", text: title }),
    node("div", { className: "title-bar-controls" }, controls.map((label) => node("button", { "aria-label": label })))
  ]);
}

export function createWindow({ title, className = "", body = [], status = null, controls }) {
  const content = [createTitleBar(title, controls), node("div", { className: "window-body" }, body)];
  if (status) content.push(status);
  return node("section", { className: ["window", className].filter(Boolean).join(" ") }, content);
}

export function createStatusBar(fields) {
  return node("div", { className: "status-bar" }, fields.map((field) => node("p", { className: "status-bar-field", text: field })));
}
