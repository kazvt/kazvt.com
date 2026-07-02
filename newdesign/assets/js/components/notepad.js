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

function copyTextMetrics(editor, mirror) {
  const style = getComputedStyle(editor);
  ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight", "textTransform", "textIndent", "textAlign", "tabSize", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "boxSizing"].forEach((property) => {
    mirror.style[property] = style[property];
  });
  mirror.style.width = `${editor.clientWidth}px`;
  mirror.style.minHeight = `${editor.scrollHeight}px`;
}

function appendPart(target, text, selected) {
  if (!text) return;
  const span = createElement("span", { className: selected ? "notepad-selection-highlight" : "notepad-selection-spacer" });
  span.textContent = text;
  target.append(span);
}

function bindSelectionOverlay(editor, mirror) {
  let frame = 0;
  const render = () => {
    frame = 0;
    copyTextMetrics(editor, mirror);
    mirror.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
    const start = editor.selectionStart || 0;
    const end = editor.selectionEnd || 0;
    mirror.replaceChildren();
    if (document.activeElement !== editor || start === end) return;
    const value = editor.value || "";
    const lower = Math.min(start, end);
    const upper = Math.max(start, end);
    appendPart(mirror, value.slice(0, lower), false);
    appendPart(mirror, value.slice(lower, upper), true);
    appendPart(mirror, value.slice(upper), false);
    if (value.endsWith("\n")) mirror.append(document.createTextNode(" "));
  };
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(render);
  };
  ["select", "selectionchange", "keyup", "keydown", "input", "mouseup", "mousedown", "mousemove", "touchstart", "touchmove", "touchend", "focus", "blur", "scroll"].forEach((eventName) => editor.addEventListener(eventName, schedule, { passive: true }));
  window.addEventListener("resize", schedule, { passive: true });
  document.addEventListener("selectionchange", schedule, { passive: true });
  schedule();
}

export function createNotepad({ title, menus, text }) {
  const editor = createElement("textarea", { className: "notepad-page", spellcheck: false, readOnly: true, value: text, "aria-label": "Welcome note" });
  const selectionMirror = createElement("div", { className: "notepad-selection-mirror", "aria-hidden": true });
  const editorWrap = createElement("div", { className: "notepad-selection-box" }, [selectionMirror, editor]);
  const status = createStatusBar(["Ln 1, Col 1", "Lines 1", "Windows XP", "UTF-8"]);
  status.classList.add("notepad-status");
  const statusFields = status.querySelectorAll(".status-bar-field");
  const windowElement = createWindow({
    title,
    controls: ["Minimize", "Maximize", "Close"],
    icon: "notepad",
    body: [
      createElement("nav", { className: "notepad-menu", role: "menubar", "aria-label": "Notepad menu" }, menus.map((item) => createElement("span", { className: "notepad-menu__item", role: "menuitem", text: item }))),
      editorWrap
    ],
    status
  });
  bindStatus(editor, { position: statusFields[0], lines: statusFields[1] });
  bindSelectionOverlay(editor, selectionMirror);
  return windowElement;
}
