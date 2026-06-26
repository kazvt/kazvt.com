import { node } from "./dom.js";
import { createStatusBar, createWindow } from "./window.js";

export function createNotepad({ title, menus, text, status }) {
  const menuBar = node("nav", { className: "notepad-menu", role: "menubar", "aria-label": "Notepad menu" }, menus.map((item) => node("span", { className: "notepad-menu__item", role: "menuitem", text: item })));
  const page = node("textarea", { className: "notepad-page", readOnly: true, spellcheck: false, value: text, "aria-label": "Welcome note" });
  return createWindow({
    title,
    className: "notepad-window",
    body: [menuBar, page],
    status: createStatusBar(status),
    controls: ["Minimize", "Maximize", "Close"]
  });
}
