import { createElement } from "./dom.js";

const volumePanelMax = 100;
const volumeInternalMax = 10;

function clampPanelVolume(value) {
  return Math.min(Math.max(Math.round(Number(value) || 0), 0), volumePanelMax);
}

function panelToInternalVolume(value) {
  return Math.min(Math.max(clampPanelVolume(value) / 10, 0), volumeInternalMax);
}

function internalToPanelVolume(value) {
  return clampPanelVolume((Number(value) || 0) * 10);
}

function createVolumePopup(initialVolume, initialMuted) {
  const volumeId = `volume-${Math.random().toString(36).slice(2)}`;
  const muteId = `mute-${Math.random().toString(36).slice(2)}`;
  const slider = createElement("input", {
    className: "has-box-indicator volume-popup__range",
    id: volumeId,
    type: "range",
    orient: "vertical",
    min: "0",
    max: String(volumePanelMax),
    step: "1",
    value: String(internalToPanelVolume(initialVolume)),
    "aria-label": "Volume"
  });
  const mute = createElement("input", {
    className: "volume-popup__mute-input",
    id: muteId,
    type: "checkbox",
    checked: Boolean(initialMuted)
  });
  const popup = createElement("section", { className: "window volume-popup is-hidden", role: "dialog", "aria-label": "Volume Control" }, [
    createElement("div", { className: "window-body volume-popup__body" }, [
      createElement("p", { className: "volume-popup__title", text: "Volume" }),
      createElement("div", { className: "field-row volume-popup__slider-row" }, [
        createElement("div", { className: "is-vertical volume-popup__slider" }, [slider])
      ]),
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
  const width = popup.offsetWidth || 112;
  const left = Math.min(Math.max(2, rect.left - width + 38), window.innerWidth - width - 2);
  popup.style.left = `${left}px`;
  popup.style.bottom = "var(--taskbar-height)";
}

export function bindVolumeControl(taskbar, music) {
  const icon = taskbar.querySelector("[data-tray-icon='volume']");
  if (!icon) return null;
  const { popup, slider, mute } = createVolumePopup(music ? music.getVolume() : 5, music ? music.getMuted() : false);
  document.body.append(popup);

  const applyVolume = () => {
    if (!music) return;
    music.setVolume(panelToInternalVolume(slider.value));
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

  slider.value = String(internalToPanelVolume(music ? music.getVolume() : 5));
  slider.addEventListener("input", applyVolume);
  slider.addEventListener("change", applyVolume);
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
  applyVolume();
  applyMute();
  return popup;
}
