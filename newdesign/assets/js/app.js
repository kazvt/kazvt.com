import { mount, node } from "./components/dom.js";
import { createArt } from "./components/art.js";
import { createNotepad } from "./components/notepad.js";
import { createTaskbar } from "./components/taskbar.js";
import { home } from "./data/home.js";

const app = document.querySelector("#app");
const windowWrap = node("div", { className: "desktop__window-wrap" }, [createNotepad(home.notepad)]);
const art = createArt(home.art);
const taskbar = createTaskbar(home.taskbar);

mount(app, [windowWrap, art, taskbar]);
