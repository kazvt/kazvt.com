import { mount, createElement } from "./components/dom.js";
import { createArt } from "./components/art.js";
import { makeDraggable, makeResizable, keepInsideViewport, maximizeElement } from "./components/draggable.js";
import { createNotepad } from "./components/notepad.js";
import { createTaskbar } from "./components/taskbar.js";
import { startMusic } from "./components/music.js";
import { bindVolumeControl } from "./components/volume.js";
import { createEdgePeek } from "./components/edge-peek.js";
import { createSiteTitle } from "./components/site-title.js";
import { createImageMarquee } from "./components/image-marquee.js";
import { animateWindowFlip, animateWindowMinimize, animateWindowRestoreFromTaskbar } from "./components/window-animation.js";
import { loadSecrets, getSecretTitle, getSecretMusicConfig, getSecretMarqueeConfig } from "./components/private-config.js";
import { home } from "./data/home.js";

const app = document.querySelector("#app");
const siteTitle = createSiteTitle();
const marqueeHost = createElement("div", { className: "image-marquee-host" });
const edgePeek = createEdgePeek(home.edgePeek);
const windowHost = createElement("div", { className: "desktop-window" }, [createNotepad(home.notepad)]);
const taskbar = createTaskbar(home.taskbar);

mount(app, [
  createElement("div", { className: "desktop-layout" }, [
    siteTitle.element,
    windowHost,
    createArt(home.art)
  ]),
  marqueeHost,
  edgePeek,
  taskbar
]);

const titleBar = windowHost.querySelector(".title-bar");
const minimizeButton = windowHost.querySelector("button[aria-label='Minimize']");
const maximizeButton = windowHost.querySelector("button[aria-label='Maximize']");
const closeButton = windowHost.querySelector("button[aria-label='Close']");
const taskButton = taskbar.querySelector("[data-taskbar-control='notepad']");

function setMaximizeButtonLabel() {
  maximizeButton.setAttribute("aria-label", windowHost.classList.contains("is-maximized") ? "Restore" : "Maximize");
}

let windowAnimationBusy = false;

function finishWindowAnimation() {
  windowAnimationBusy = false;
}

function restoreWindow() {
  if (windowAnimationBusy) return;
  const wasMinimized = windowHost.classList.contains("is-minimized");
  windowHost.classList.remove("is-minimized");
  taskButton.classList.add("is-active");
  keepInsideViewport(windowHost);
  setMaximizeButtonLabel();
  if (!wasMinimized) return;
  windowAnimationBusy = true;
  animateWindowRestoreFromTaskbar(windowHost, taskButton, finishWindowAnimation);
}

function minimizeWindow() {
  if (windowAnimationBusy || windowHost.classList.contains("is-minimized")) return;
  windowAnimationBusy = true;
  taskButton.classList.remove("is-active");
  animateWindowMinimize(windowHost, taskButton, () => {
    windowHost.classList.add("is-minimized");
    finishWindowAnimation();
  });
}

function closeWindow() {
  if (windowAnimationBusy) return;
  windowHost.classList.add("is-minimized");
  taskButton.hidden = true;
}

function toggleMaximize() {
  if (windowAnimationBusy || windowHost.classList.contains("is-minimized")) return;
  windowAnimationBusy = true;
  const beforeRect = windowHost.getBoundingClientRect();
  maximizeElement(windowHost);
  setMaximizeButtonLabel();
  animateWindowFlip(windowHost, beforeRect, finishWindowAnimation);
}

function toggleTaskbarWindow() {
  if (windowHost.classList.contains("is-minimized")) restoreWindow();
  else minimizeWindow();
}

makeDraggable(windowHost, titleBar);
makeResizable(windowHost);

minimizeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  minimizeWindow();
});

maximizeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMaximize();
});

closeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  closeWindow();
});

titleBar.addEventListener("dblclick", (event) => {
  if (event.target.closest(".title-bar-controls")) return;
  toggleMaximize();
});

taskButton.addEventListener("click", toggleTaskbarWindow);
windowHost.addEventListener("windowstatechange", setMaximizeButtonLabel);

loadSecrets().then((secrets) => {
  const resolvedTitle = getSecretTitle(secrets);
  siteTitle.setTitle(resolvedTitle);
  document.title = resolvedTitle ? `${resolvedTitle} - ${home.notepad.title}` : home.notepad.title;
  startMusic({ ...home.music, ...getSecretMusicConfig(secrets) }).then((music) => bindVolumeControl(taskbar, music));
  createImageMarquee({ ...home.imageMarquee, ...getSecretMarqueeConfig(secrets) }).then((marquee) => marqueeHost.replaceChildren(marquee));
});

function isEditableTarget(target) {
  return Boolean(target.closest && target.closest(".notepad-page"));
}

function clearPageSelection() {
  const selection = window.getSelection();
  if (selection && selection.rangeCount) selection.removeAllRanges();
}

function preventSelectionOutsideEditor(event) {
  if (isEditableTarget(event.target)) return;
  event.preventDefault();
  clearPageSelection();
}

["selectstart", "dragstart"].forEach((eventName) => {
  document.addEventListener(eventName, preventSelectionOutsideEditor, { capture: true });
});

["dragover", "drop"].forEach((eventName) => {
  document.addEventListener(eventName, (event) => {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
  }, { capture: true });
});

document.addEventListener("selectionchange", () => {
  if (document.activeElement && document.activeElement.classList.contains("notepad-page")) return;
  clearPageSelection();
});
