import { createElement } from "./dom.js";
import { createStatusBar, createWindow } from "./window.js";

export function createNotepad({ title, menus, text, status }) {
  return createWindow({
    title,
    controls: ["Minimize", "Maximize", "Close"],
    body: [
      createElement("nav", { className: "notepad-menu", role: "menubar", "aria-label": "Notepad menu" }, menus.map((item) => createElement("span", { className: "notepad-menu__item", role: "menuitem", text: item }))),
      createElement("textarea", { className: "notepad-page", readOnly: true, spellcheck: false, value: text, "aria-label": "Welcome note" })
    ],
    status: createStatusBar(status)
  });
}
