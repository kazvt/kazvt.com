import { createElement } from "./dom.js";

function clampPercent(value) {
  return Math.min(Math.max(Math.round(Number(value) || 0), 0), 100);
}

function createVolumePopup(initialVolume) {
  const slider = createElement("input", {
    className: "volume-popup__slider",
    type: "range",
    min: "0",
    max: "100",
    value: String(clampPercent(initialVolume * 100)),
    "aria-label": "Volume"
  });
  const mute = createElement("input", {
    className: "volume-popup__mute-input",
    type: "checkbox",
    "aria-label": "Mute"
  });
  const popup = createElement("div", { className: "volume-popup is-hidden", role: "dialog", "aria-label": "Volume Control" }, [
    createElement("div", { className: "volume-popup__title", text: "Volume" }),
    createElement("div", { className: "volume-popup__slider-space" }, [slider]),
    createElement("label", { className: "volume-popup__mute" }, [
      mute,
      createElement("span", { text: "Mute" })
    ])
  ]);
  return { popup, slider, mute };
}

function positionPopup(popup, anchor) {
  const rect = anchor.getBoundingClientRect();
  const width = popup.offsetWidth || 160;
  const left = Math.min(Math.max(4, rect.right - width + 18), window.innerWidth - width - 4);
  popup.style.left = `${left}px`;
  popup.style.bottom = "var(--taskbar-height)";
}

export function bindVolumeControl(taskbar, music) {
  const icon = taskbar.querySelector("[data-tray-icon='volume']");
  if (!icon) return null;
  const { popup, slider, mute } = createVolumePopup(music ? music.getVolume() : 0.5);
  document.body.append(popup);

  const apply = () => {
    if (!music) return;
    music.setVolume(Number(slider.value) / 100);
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
  slider.addEventListener("input", apply);
  mute.addEventListener("change", apply);
  document.addEventListener("pointerdown", (event) => {
    if (popup.classList.contains("is-hidden")) return;
    if (popup.contains(event.target) || icon.contains(event.target)) return;
    close();
  }, true);
  window.addEventListener("resize", () => {
    if (!popup.classList.contains("is-hidden")) positionPopup(popup, icon);
  });
  apply();
  return popup;
}
