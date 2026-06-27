import { createElement } from "./dom.js";

function clampPercent(value) {
  return Math.min(Math.max(Math.round(Number(value) || 0), 0), 100);
}

function createVolumePopup(initialVolume, initialMuted) {
  const slider = createElement("div", {
    className: "volume-popup__fader",
    role: "slider",
    tabindex: "0",
    "aria-label": "Volume",
    "aria-orientation": "vertical",
    "aria-valuemin": "0",
    "aria-valuemax": "100",
    "aria-valuenow": String(clampPercent(initialVolume * 100))
  }, [
    createElement("div", { className: "volume-popup__track", "aria-hidden": "true" }, [
      createElement("span", { className: "volume-popup__thumb" })
    ])
  ]);
  const muteId = `mute-${Math.random().toString(36).slice(2)}`;
  const mute = createElement("input", {
    className: "volume-popup__mute-input",
    id: muteId,
    type: "checkbox",
    checked: Boolean(initialMuted)
  });
  const popup = createElement("section", { className: "window volume-popup is-hidden", role: "dialog", "aria-label": "Volume Control" }, [
    createElement("div", { className: "window-body volume-popup__body" }, [
      createElement("p", { className: "volume-popup__title", text: "Volume" }),
      slider,
      createElement("div", { className: "field-row volume-popup__mute" }, [
        mute,
        createElement("label", { htmlFor: muteId, text: "Mute" })
      ])
    ])
  ]);
  return { popup, slider, mute };
}

function positionPopup(popup, anchor) {
  const rect = anchor.getBoundingClientRect();
  const width = popup.offsetWidth || 126;
  const left = Math.min(Math.max(2, rect.left - width + 44), window.innerWidth - width - 2);
  popup.style.left = `${left}px`;
  popup.style.bottom = "var(--taskbar-height)";
}

function setFaderValue(slider, percent) {
  const value = clampPercent(percent);
  slider.dataset.value = String(value);
  slider.setAttribute("aria-valuenow", String(value));
  slider.style.setProperty("--volume-value", String(value));
}

function faderPercentFromPointer(slider, event) {
  const track = slider.querySelector(".volume-popup__track");
  const rect = track.getBoundingClientRect();
  const position = (event.clientY - rect.top) / rect.height;
  return clampPercent((1 - position) * 100);
}

function bindFader(slider, callback) {
  const commit = (value) => {
    setFaderValue(slider, value);
    callback(clampPercent(value));
  };
  slider.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    slider.setPointerCapture(event.pointerId);
    commit(faderPercentFromPointer(slider, event));
  });
  slider.addEventListener("pointermove", (event) => {
    if (!slider.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    commit(faderPercentFromPointer(slider, event));
  });
  slider.addEventListener("keydown", (event) => {
    const current = clampPercent(slider.dataset.value);
    const keys = {
      ArrowUp: current + 5,
      ArrowRight: current + 5,
      ArrowDown: current - 5,
      ArrowLeft: current - 5,
      PageUp: current + 10,
      PageDown: current - 10,
      Home: 0,
      End: 100
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    commit(keys[event.key]);
  });
}

export function bindVolumeControl(taskbar, music) {
  const icon = taskbar.querySelector("[data-tray-icon='volume']");
  if (!icon) return null;
  const { popup, slider, mute } = createVolumePopup(music ? music.getVolume() : 0.5, music ? music.getMuted() : false);
  document.body.append(popup);

  const applyVolume = (percent) => {
    if (!music) return;
    music.setVolume(percent / 100);
  };

  const applyMute = () => {
    if (!music) return;
    music.setMuted(mute.checked);
  };

  const open = () => {
    positionPopup(popup, icon);
    popup.classList.remove("is-hidden");
    if (music) music.play();
  };

  const close = () => {
    popup.classList.add("is-hidden");
  };

  const toggle = () => {
    if (popup.classList.contains("is-hidden")) open();
    else close();
  };

  setFaderValue(slider, music ? music.getVolume() * 100 : 50);
  bindFader(slider, applyVolume);
  mute.addEventListener("change", applyMute);
  icon.addEventListener("pointerdown", (event) => event.preventDefault());
  icon.addEventListener("click", (event) => {
    event.stopPropagation();
    toggle();
  });
  icon.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  });
  document.addEventListener("pointerdown", (event) => {
    if (popup.classList.contains("is-hidden")) return;
    if (popup.contains(event.target) || icon.contains(event.target)) return;
    close();
  }, true);
  window.addEventListener("resize", () => {
    if (!popup.classList.contains("is-hidden")) positionPopup(popup, icon);
  });
  applyVolume(clampPercent(slider.dataset.value));
  applyMute();
  return popup;
}
