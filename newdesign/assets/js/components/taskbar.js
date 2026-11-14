import { formatZonedClock, getSupportedTimeZones, getSystemTimeZone, isValidTimeZone } from "./taskbar-clock.js";
import { createElement } from "./dom.js";

const CLOCK_ZONE_KEY = "newdesign.clock.timeZone.v1";

function formatZoneLabel(zone) {
  return zone.replaceAll("_", " ").replaceAll("/", " / ");
}

function createClockWidget() {
  let systemZone = getSystemTimeZone();
  let selectedZone = systemZone;
  try {
    const savedZone = localStorage.getItem(CLOCK_ZONE_KEY);
    if (savedZone && isValidTimeZone(savedZone)) selectedZone = savedZone;
  } catch {
    // The clock still works when browser storage is disabled.
  }

  const time = createElement("time", { className: "taskbar__clock-time" });
  const compactDate = createElement("span", { className: "taskbar__clock-date" });
  const clockButton = createElement("button", {
    type: "button",
    className: "taskbar__clock-button",
    "aria-label": "Open clock and browse time zones",
    "aria-expanded": "false",
    "aria-controls": "taskbar-clock-panel",
  }, [time, compactDate]);

  const panelTime = createElement("time", { className: "taskbar__clock-large-time" });
  const panelDate = createElement("p", { className: "taskbar__clock-full-date" });
  const panelZone = createElement("code", { className: "taskbar__clock-zone-id" });
  const panelZoneName = createElement("span", { className: "taskbar__clock-zone-name" });
  const zoneList = createElement("div", {
    className: "taskbar__timezone-list",
    role: "listbox",
    "aria-label": "Scrollable time zone list",
    tabindex: "0",
  });
  const zoneSearch = createElement("input", {
    className: "taskbar__timezone-search",
    type: "search",
    placeholder: "Find a city or time zone",
    "aria-label": "Filter time zones",
    autocomplete: "off",
    spellcheck: false,
  });
  const status = createElement("p", { className: "taskbar__clock-status", role: "status", "aria-live": "polite" });
  const systemButton = createElement("button", { className: "taskbar__clock-system", type: "button", text: "USE SYSTEM TIME" });
  const closeButton = createElement("button", { className: "taskbar__clock-close", type: "button", "aria-label": "Close clock panel", text: "X" });
  const heading = createElement("div", { className: "taskbar__clock-panel-heading" }, [
    createElement("h2", { id: "taskbar-clock-heading", text: "DATE / TIME" }),
    closeButton,
  ]);
  const panel = createElement("section", {
    id: "taskbar-clock-panel",
    className: "taskbar__clock-panel",
    "aria-labelledby": "taskbar-clock-heading",
    hidden: true,
  }, [
    heading,
    createElement("div", { className: "taskbar__clock-current" }, [
      panelTime,
      panelDate,
      createElement("div", { className: "taskbar__clock-zone-line" }, [panelZoneName, panelZone]),
    ]),
    createElement("div", { className: "taskbar__timezone-tools" }, [
      systemButton,
      zoneSearch,
    ]),
    createElement("p", { className: "taskbar__timezone-hint", text: "SCROLL THE LIST OR TYPE TO FIND A TIME ZONE" }),
    zoneList,
    status,
  ]);

  function renderList(query = "") {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matchingZones = getSupportedTimeZones(systemZone).filter((zone) => {
      return !normalizedQuery || zone.toLocaleLowerCase().includes(normalizedQuery) || formatZoneLabel(zone).toLocaleLowerCase().includes(normalizedQuery);
    });
    zoneList.replaceChildren();
    if (!matchingZones.length) {
      zoneList.append(createElement("p", { className: "taskbar__timezone-empty", text: "NO TIME ZONES MATCH" }));
      return;
    }

    matchingZones.forEach((zone, index) => {
      const option = createElement("button", {
        type: "button",
        className: "taskbar__timezone-option",
        role: "option",
        "aria-selected": String(zone === selectedZone),
        tabindex: zone === selectedZone || (!matchingZones.includes(selectedZone) && index === 0) ? "0" : "-1",
        dataset: { timeZone: zone },
      }, [
        createElement("span", { text: formatZoneLabel(zone) }),
        createElement("small", { text: zone }),
      ]);
      zoneList.append(option);
    });
  }

  function updateClock() {
    const now = new Date();
    let formatted;
    try {
      formatted = formatZonedClock(now, selectedZone);
    } catch {
      selectedZone = systemZone;
      formatted = formatZonedClock(now, systemZone);
    }
    time.textContent = formatted.time;
    time.dateTime = now.toISOString();
    compactDate.textContent = formatted.compactDate;
    panelTime.textContent = formatted.time;
    panelTime.dateTime = now.toISOString();
    panelDate.textContent = formatted.fullDate;
    panelZoneName.textContent = formatted.zoneName;
    panelZone.textContent = selectedZone;
  }

  function selectZone(zone) {
    if (!isValidTimeZone(zone)) return;
    selectedZone = zone;
    try { localStorage.setItem(CLOCK_ZONE_KEY, zone); } catch { /* keep selection for this page session */ }
    updateClock();
    zoneList.querySelectorAll("[data-time-zone]").forEach((option) => {
      const selected = option.dataset.timeZone === selectedZone;
      option.setAttribute("aria-selected", String(selected));
      option.tabIndex = selected ? 0 : -1;
    });
    status.textContent = "NOW SHOWING " + zone;
  }

  function setPanelOpen(open, focusSearch = false) {
    panel.hidden = !open;
    clockButton.setAttribute("aria-expanded", String(open));
    if (open) {
      renderList(zoneSearch.value);
      updateClock();
      if (focusSearch) zoneSearch.focus({ preventScroll: true });
    } else if (document.activeElement !== clockButton && panel.contains(document.activeElement)) {
      clockButton.focus({ preventScroll: true });
    }
  }

  clockButton.addEventListener("click", () => setPanelOpen(panel.hidden, panel.hidden));
  closeButton.addEventListener("click", () => setPanelOpen(false));
  systemButton.addEventListener("click", () => {
    systemZone = getSystemTimeZone();
    selectZone(systemZone);
    zoneSearch.value = "";
    renderList();
    clockButton.focus({ preventScroll: true });
  });
  zoneSearch.addEventListener("input", () => renderList(zoneSearch.value));
  zoneSearch.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      zoneList.querySelector("[role='option']")?.focus();
    }
  });
  zoneList.addEventListener("click", (event) => {
    const option = event.target.closest("[data-time-zone]");
    if (option) selectZone(option.dataset.timeZone);
  });
  zoneList.addEventListener("keydown", (event) => {
    const options = [...zoneList.querySelectorAll("[role='option']")];
    if (!options.length) return;
    const activeIndex = options.indexOf(document.activeElement);
    let nextIndex = activeIndex;
    if (event.key === "ArrowDown") nextIndex = Math.min(options.length - 1, Math.max(0, activeIndex) + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, activeIndex < 0 ? 0 : activeIndex - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "PageDown") nextIndex = Math.min(options.length - 1, Math.max(0, activeIndex) + 8);
    else if (event.key === "PageUp") nextIndex = Math.max(0, activeIndex - 8);
    else return;
    event.preventDefault();
    options[nextIndex].focus();
    options[nextIndex].scrollIntoView({ block: "nearest" });
  });
  document.addEventListener("pointerdown", (event) => {
    if (!panel.hidden && !panel.contains(event.target) && !clockButton.contains(event.target)) setPanelOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      event.stopPropagation();
      setPanelOpen(false);
    }
  });

  let timer = 0;
  function tick() {
    window.clearTimeout(timer);
    updateClock();
    if (!document.hidden) timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
  }
  tick();
  document.addEventListener("visibilitychange", tick);
  window.addEventListener("focus", tick);
  window.addEventListener("pagehide", () => window.clearTimeout(timer), { once: true });

  return { button: clockButton, panel };
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
  const clock = createClockWidget();
  const taskbar = createElement("footer", { className: "taskbar fixed bottom-0 left-0 right-0 z-20 flex h-[42px] w-full flex-row items-center", role: "contentinfo", "aria-label": "Windows XP taskbar" }, [
    createStartButton(startLabel),
    createElement("div", { className: "flex h-full grow flex-row items-center overflow-hidden pt-1" }, [createTaskButton(activeTitle)]),
    createElement("div", { className: "taskbar__tray flex h-full max-w-[220px] shrink-0 flex-row items-center justify-end px-2 text-white" }, [
      ...trayIcons.map(createTrayIcon),
      clock.button
    ]),
    clock.panel,
  ]);
  stopTaskbarSelection(taskbar);
  return taskbar;
}
