import { createElement } from "./dom.js";
import { createStatusBar, createWindow } from "./window.js";

function getCaretStatus(editor) {
  const position = editor.selectionStart || 0;
  const beforeCaret = editor.value.slice(0, position);
  const line = beforeCaret.split("\n").length;
  const column = beforeCaret.length - beforeCaret.lastIndexOf("\n");
  return `Ln ${line}, Col ${column}`;
}

function bindStatus(editor, statusField) {
  const update = () => {
    statusField.textContent = getCaretStatus(editor);
  };
  ["input", "keyup", "click", "mouseup", "touchend", "select", "focus"].forEach((eventName) => editor.addEventListener(eventName, update));
  document.addEventListener("selectionchange", () => {
    if (document.activeElement === editor) update();
  });
  update();
}

export function createNotepad({ title, menus, text }) {
  const editor = createElement("textarea", { className: "notepad-page", spellcheck: false, value: text, "aria-label": "Welcome note" });
  const status = createStatusBar(["Ln 1, Col 1"]);
  status.classList.add("notepad-status");
  const statusField = status.querySelector(".status-bar-field");
  const windowElement = createWindow({
    title,
    controls: ["Minimize", "Maximize", "Close"],
    body: [
      createElement("nav", { className: "notepad-menu", role: "menubar", "aria-label": "Notepad menu" }, menus.map((item) => createElement("span", { className: "notepad-menu__item", role: "menuitem", text: item }))),
      editor
    ],
    status
  });
  bindStatus(editor, statusField);
  return windowElement;
}
