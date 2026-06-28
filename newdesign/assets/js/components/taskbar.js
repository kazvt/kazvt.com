import { createElement } from "./dom.js";

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function startClock(clock) {
  const tick = () => {
    const now = new Date();
    clock.textContent = formatTime(now);
    clock.dateTime = now.toISOString();
  };
  tick();
  window.setInterval(tick, 30000);
}

function createStartButton(label) {
  return createElement("div", {
    className: "taskbar__start h-[30px] w-[100px] shrink-0 cursor-default",
    title: label,
    role: "button",
    "aria-label": label,
    dataset: { taskbarControl: "start" }
  });
}

function createTaskButton(title) {
  return createElement("div", {
    className: "taskbar__task is-active inline-flex h-[24px] w-[220px] min-w-[150px] max-w-[34vw] items-center gap-1 overflow-hidden rounded-[2px] px-[7px] py-0 text-[11px] font-bold leading-none",
    title,
    role: "button",
    "aria-label": title,
    dataset: { taskbarControl: "notepad" }
  }, [
    createElement("span", { className: "taskbar__task-icon", "aria-hidden": "true" }),
    createElement("span", { className: "truncate", text: title })
  ]);
}

function createTrayIcon(icon) {
  const role = icon.id === "volume" ? "button" : "img";
  return createElement("span", {
    className: ["taskbar__tray-icon", `taskbar__tray-icon--${icon.id}`].join(" "),
    title: icon.label,
    "aria-label": icon.label,
    role,
    tabindex: icon.id === "volume" ? "0" : undefined,
    dataset: { trayIcon: icon.id }
  });
}

function stopTaskbarSelection(taskbar) {
  taskbar.querySelectorAll("[role='button']").forEach((control) => {
    control.addEventListener("pointerdown", (event) => event.preventDefault());
    control.addEventListener("mousedown", (event) => event.preventDefault());
  });
}

export function createTaskbar({ startLabel, activeTitle, trayIcons }) {
  const clock = createElement("time", { className: "taskbar__clock px-1 text-[11px] leading-[30px] text-white" });
  const taskbar = createElement("footer", { className: "taskbar fixed bottom-0 left-0 right-0 flex h-[30px] w-full flex-row items-center", role: "contentinfo", "aria-label": "Windows XP taskbar" }, [
    createStartButton(startLabel),
    createElement("div", { className: "flex h-full grow flex-row items-center overflow-hidden pt-1" }, [createTaskButton(activeTitle)]),
    createElement("div", { className: "taskbar__tray flex h-full max-w-[200px] shrink-0 flex-row items-center justify-end px-2 text-white" }, [
      ...trayIcons.map(createTrayIcon),
      clock
    ])
  ]);
  startClock(clock);
  stopTaskbarSelection(taskbar);
  return taskbar;
}
