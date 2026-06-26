import { mount, createElement } from "./components/dom.js";
import { createArt } from "./components/art.js";
import { makeDraggable } from "./components/draggable.js";
import { createNotepad } from "./components/notepad.js";
import { createTaskbar } from "./components/taskbar.js";
import { home } from "./data/home.js";

const app = document.querySelector("#app");
const windowHost = createElement("div", { className: "desktop-window" }, [createNotepad(home.notepad)]);

mount(app, [
  createElement("div", { className: "desktop-layout" }, [
    windowHost,
    createArt(home.art)
  ]),
  createTaskbar(home.taskbar)
]);

makeDraggable(windowHost, windowHost.querySelector(".title-bar"));
