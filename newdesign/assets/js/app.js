import { mount, createElement } from "./components/dom.js";
import { createArt } from "./components/art.js";
import { makeDraggable, makeResizable, keepInsideViewport, maximizeElement } from "./components/draggable.js";
import { createNotepad } from "./components/notepad.js";
import { createTaskbar } from "./components/taskbar.js";
import { home } from "./data/home.js";

const app = document.querySelector("#app");
const windowHost = createElement("div", { className: "desktop-window" }, [createNotepad(home.notepad)]);
const taskbar = createTaskbar(home.taskbar);

mount(app, [
  createElement("div", { className: "desktop-layout" }, [
    windowHost,
    createArt(home.art)
  ]),
  taskbar
]);

const titleBar = windowHost.querySelector(".title-bar");
const minimizeButton = windowHost.querySelector("button[aria-label='Minimize']");
const maximizeButton = windowHost.querySelector("button[aria-label='Maximize']");
const closeButton = windowHost.querySelector("button[aria-label='Close']");
const taskButton = taskbar.querySelector("[data-taskbar-control='notepad']");

function restoreWindow() {
  windowHost.classList.remove("is-minimized");
  taskButton.classList.add("is-active");
  keepInsideViewport(windowHost);
}

function minimizeWindow() {
  windowHost.classList.add("is-minimized");
  taskButton.classList.remove("is-active");
}

function closeWindow() {
  windowHost.classList.add("is-minimized");
  taskButton.hidden = true;
}

makeDraggable(windowHost, titleBar);
makeResizable(windowHost);

minimizeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  minimizeWindow();
});

maximizeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  maximizeElement(windowHost);
});

closeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  closeWindow();
});

taskButton.addEventListener("click", restoreWindow);
