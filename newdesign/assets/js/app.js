import { mount, createElement } from "./components/dom.js";
import { createArt } from "./components/art.js";
import { createNotepad } from "./components/notepad.js";
import { createTaskbar } from "./components/taskbar.js";
import { home } from "./data/home.js";

const app = document.querySelector("#app");

mount(app, [
  createElement("div", { className: "desktop-layout" }, [
    createElement("div", { className: "desktop-window" }, [createNotepad(home.notepad)]),
    createArt(home.art)
  ]),
  createTaskbar(home.taskbar)
]);
