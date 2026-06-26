import { node } from "./dom.js";

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function bindClock(clock) {
  const tick = () => {
    const now = new Date();
    clock.textContent = formatTime(now);
    clock.dateTime = now.toISOString();
  };
  tick();
  window.setInterval(tick, 30000);
}

export function createTaskbar({ start, activeApp, tray }) {
  const startButton = node("button", { className: "taskbar__start", type: "button", "aria-label": start.label }, [
    node("img", { className: "taskbar__start-icon", src: start.icon, alt: "", width: 22, height: 22, decoding: "async" }),
    node("span", { className: "taskbar__start-text", text: start.label })
  ]);
  const activeButton = node("button", { className: "taskbar__app taskbar__app--active", type: "button" }, [
    node("img", { className: "taskbar__app-icon", src: activeApp.icon, alt: "", width: 18, height: 18, decoding: "async" }),
    node("span", { className: "taskbar__app-title", text: activeApp.title })
  ]);
  const trayIcons = tray.icons.map((icon) => node("img", { className: "taskbar__tray-icon", src: icon.src, alt: icon.alt, width: 16, height: 16, decoding: "async" }));
  const clock = node("time", { className: "taskbar__clock", text: tray.time });
  const taskbar = node("footer", { className: "taskbar", role: "contentinfo", "aria-label": "Windows XP taskbar" }, [
    startButton,
    node("div", { className: "taskbar__separator" }),
    node("div", { className: "taskbar__tasks" }, [activeButton]),
    node("div", { className: "taskbar__tray" }, [
      ...trayIcons,
      clock
    ])
  ]);
  bindClock(clock);
  return taskbar;
}
