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

function createStartButton(start) {
  return node("button", {
    className: "taskbar-start h-[30px] w-[100px] shrink-0 cursor-pointer hover:brightness-110",
    type: "button",
    title: start.label,
    "aria-label": start.label,
    style: `--start-button-image: url("${start.icon}")`
  });
}

function createActiveApp(activeApp) {
  return node("button", { className: "taskbar-app is-active inline-flex h-[24px] w-[220px] min-w-[150px] max-w-[34vw] items-center gap-1 overflow-hidden rounded-[2px] px-[7px] py-0 text-[11px] font-bold leading-none", type: "button" }, [
    node("img", { className: "h-4 w-4 shrink-0", src: activeApp.icon, alt: "", width: 16, height: 16, decoding: "async" }),
    node("span", { className: "truncate", text: activeApp.title })
  ]);
}

function createTrayIcon(icon) {
  return node("img", { className: "mr-1 h-4 w-4 shrink-0 bg-contain bg-center bg-no-repeat", src: icon.src, alt: icon.alt, width: 16, height: 16, decoding: "async" });
}

export function createTaskbar({ start, activeApp, tray }) {
  const clock = node("time", { className: "taskbar-clock px-1 text-[11px] leading-[30px] text-white", text: tray.time });
  const taskbar = node("footer", { className: "taskbar-shell fixed bottom-0 left-0 right-0 z-20 flex h-[30px] w-full flex-row items-center", role: "contentinfo", "aria-label": "Windows XP taskbar" }, [
    createStartButton(start),
    node("div", { className: "flex h-full grow flex-row items-center overflow-hidden pt-1" }, [createActiveApp(activeApp)]),
    node("div", { className: "taskbar-tray flex h-full max-w-[200px] shrink-0 flex-row items-center justify-end px-2 text-white" }, [
      ...tray.icons.map(createTrayIcon),
      clock
    ])
  ]);
  bindClock(clock);
  return taskbar;
}
