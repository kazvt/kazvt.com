import { createElement } from "./dom.js";
import { createStatusBar, createWindow } from "./window.js";

function getCaretInfo(editor) {
  const position = editor.selectionStart || 0;
  const value = editor.value || "";
  const beforeCaret = value.slice(0, position);
  const line = beforeCaret.split("\n").length;
  const column = beforeCaret.length - beforeCaret.lastIndexOf("\n");
  const totalLines = value.length ? value.split("\n").length : 1;
  return { line, column, totalLines };
}

function bindStatus(editor, fields) {
  const update = () => {
    const info = getCaretInfo(editor);
    fields.position.textContent = `Ln ${info.line}, Col ${info.column}`;
    fields.lines.textContent = `Lines ${info.totalLines}`;
  };
  ["input", "keyup", "click", "mouseup", "touchend", "select", "focus", "blur"].forEach((eventName) => editor.addEventListener(eventName, update));
  document.addEventListener("selectionchange", () => {
    if (document.activeElement === editor) update();
  });
  update();
}

export function createNotepad({ title, menus, text }) {
  const editor = createElement("textarea", { className: "notepad-page", spellcheck: false, readOnly: true, value: text, "aria-label": "Welcome note" });
  const status = createStatusBar(["Ln 1, Col 1", "Lines 1", "Windows XP", "UTF-8"]);
  status.classList.add("notepad-status");
  const statusFields = status.querySelectorAll(".status-bar-field");
  const windowElement = createWindow({
    title,
    controls: ["Minimize", "Maximize", "Close"],
    icon: "notepad",
    body: [
      createElement("nav", { className: "notepad-menu", role: "menubar", "aria-label": "Notepad menu" }, menus.map((item) => createElement("span", { className: "notepad-menu__item", role: "menuitem", text: item }))),
      editor
    ],
    status
  });
  bindStatus(editor, { position: statusFields[0], lines: statusFields[1] });
  return windowElement;
}
