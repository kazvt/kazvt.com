(() => {
  "use strict";

function initializeKtLoadingScreen() {
  if (document.body.dataset.page !== "kt" || document.querySelector("[data-kt-loading-screen]")) return;

  const messages = [
    "Verifying oestrogen levels...",
    "Doll inspection...",
    "Princesses loading...",
    "Beautiful girls inbound...",
    "Waking up the dollhouse...",
    "Tuning the trans frequency...",
    "Brushing the princess hair...",
    "Dialling the girl internet...",
    "Reapplying pink glitter...",
    "Polishing the princess boot...",
    "Loading cute girls...",
    "Sending the girls over...",
  ];
  const firstIndex = Math.floor(Math.random() * messages.length);
  const remainingMessages = messages.filter((_, index) => index !== firstIndex);
  const secondMessage = remainingMessages[Math.floor(Math.random() * remainingMessages.length)];

  const host = document.createElement("div");
  host.dataset.ktLoadingScreen = "true";
  host.setAttribute("aria-label", "Loading KickassTransfems");
  const shadow = host.attachShadow({ mode: "open" });

  const xpStyles = document.createElement("link");
  xpStyles.rel = "stylesheet";
  xpStyles.href = "/zzz_shared/xp.css?v=0.2.6";

  const styles = document.createElement("style");
  styles.textContent = `
    :host {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      box-sizing: border-box;
      padding: 18px;
      overflow: auto;
      color: #282334;
      font: 14px "04b_30", Tahoma, sans-serif;
      font-synthesis: none;
      background-color: #fceaf3;
      background-image:
        linear-gradient(90deg, transparent 0 23px, rgb(87 202 239 / 15%) 23px 24px),
        linear-gradient(transparent 0 23px, rgb(87 202 239 / 15%) 23px 24px),
        radial-gradient(circle, rgb(238 151 189 / 26%) 1px, transparent 1.5px);
      background-size: 24px 24px, 24px 24px, 12px 12px;
      opacity: 1;
      transition: opacity 180ms ease;
      pointer-events: auto;
    }
    :host(.is-exiting) { opacity: 0; }
    *, *::before, *::after { box-sizing: border-box; }
    .loading-window {
      width: min(640px, calc(100vw - 36px));
      margin: auto;
      border-radius: 0;
      box-shadow: 8px 8px 0 rgb(65 43 71 / 22%), 0 0 0 3px #fff;
      font-family: "04b_30", Tahoma, sans-serif;
    }
    .loading-window, .loading-window * {
      font-family: "04b_30", Tahoma, sans-serif;
      font-weight: 400;
      font-synthesis: none;
    }
    .title-bar { min-height: 32px; }
    .title-bar-text { display: flex; align-items: center; gap: 8px; }
    .window-icon {
      display: block;
      flex: 0 0 18px;
      width: 18px;
      height: 14px;
      object-fit: contain;
      background: transparent;
    }
    .window-body { padding: 22px 24px 16px; }
    .loading-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 22px;
      min-height: 100px;
    }
    .loading-copy { min-width: 0; flex: 1 1 auto; }
    .loading-kicker {
      margin: 0 0 9px;
      color: #666077;
      font-size: 11px;
      letter-spacing: .045em;
      text-transform: uppercase;
    }
    .loading-message {
      min-height: 2.7em;
      margin: 0;
      color: #272136;
      font-size: clamp(17px, 3.5vw, 24px);
      line-height: 1.35;
      text-shadow: 1px 1px #f5a9b8;
      overflow-wrap: anywhere;
    }
    .buffer-machine {
      flex: 0 0 142px;
      padding: 7px;
      border: 2px solid #302638;
      background: #fffafc;
      box-shadow: 3px 3px 0 #e99ab9;
      transform: rotate(2deg);
    }
    .buffer-label {
      display: block;
      margin-bottom: 6px;
      color: #302638;
      font-size: 10px;
      text-align: center;
    }
    .buffer-display {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 39px;
      padding: 5px;
      border: 2px inset #9b91a2;
      background: repeating-linear-gradient(0deg, #f7f3f8 0 5px, #e8e1ec 5px 6px);
    }
    .buffer-segment {
      width: 13px;
      height: 23px;
      border: 1px solid #292332;
      box-shadow: 1px 1px 0 #b7aebc;
      background: #5bcefa;
      animation: buffer-blink 700ms steps(2, end) infinite;
    }
    .buffer-segment:nth-child(even) { background: #f5a9b8; }
    .buffer-segment:nth-child(2) { animation-delay: 100ms; }
    .buffer-segment:nth-child(3) { animation-delay: 200ms; }
    .buffer-segment:nth-child(4) { animation-delay: 300ms; }
    .buffer-segment:nth-child(5) { animation-delay: 400ms; }
    .buffer-segment:nth-child(6) { animation-delay: 500ms; }
    @keyframes buffer-blink {
      0%, 100% { transform: translateY(2px); filter: brightness(.82); }
      50% { transform: translateY(-2px); filter: brightness(1.12); }
    }
    .loading-progress { display: block; width: 100%; margin-top: 20px; }
    .loading-progress[value]::-webkit-progress-value {
      background:
        repeating-linear-gradient(90deg, #fff 0, #fff 2px, transparent 0, transparent 10px),
        linear-gradient(180deg, #acedad 0, #7be47d 14%, #4cda50 28%, #2ed330 42%, #42d845 57%, #76e275 71%, #8fe791 85%, #fff),
        repeating-linear-gradient(90deg, #5bcefa 0 10px, #f5a9b8 10px 20px);
      background-blend-mode: normal, luminosity, normal;
    }
    .loading-progress[value]::-moz-progress-bar {
      background:
        repeating-linear-gradient(90deg, #fff 0, #fff 2px, transparent 0, transparent 10px),
        linear-gradient(180deg, #acedad 0, #7be47d 14%, #4cda50 28%, #2ed330 42%, #42d845 57%, #76e275 71%, #8fe791 85%, #fff),
        repeating-linear-gradient(90deg, #5bcefa 0 10px, #f5a9b8 10px 20px);
      background-blend-mode: normal, luminosity, normal;
    }
    .progress-caption {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 7px;
      color: #51475b;
      font-size: 11px;
    }
    .loading-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 14px 0 0;
      color: #7a5272;
      font-size: 12px;
      text-align: center;
    }
    .loading-footer span { color: #e66e9a; }
    @media (max-width: 520px) {
      .window-body { padding: 16px; }
      .loading-row { gap: 12px; min-height: 90px; }
      .buffer-machine { flex-basis: 112px; padding: 5px; }
      .buffer-segment { width: 10px; height: 20px; }
    }
    @media (max-width: 370px) {
      :host { padding: 10px; }
      .loading-window { width: calc(100vw - 20px); }
      .loading-row { align-items: flex-start; flex-direction: column-reverse; }
      .buffer-machine { align-self: flex-end; }
      .loading-message { min-height: 2.2em; }
    }
    @media (prefers-reduced-motion: reduce) {
      :host { transition: none; }
      .buffer-segment { animation: none; }
    }
  `;

  const windowPanel = document.createElement("section");
  windowPanel.className = "window loading-window";
  windowPanel.setAttribute("aria-label", "Loading KickassTransfems");
  windowPanel.innerHTML = `
    <div class="title-bar">
      <div class="title-bar-text"><img class="window-icon" src="/kt/assets/transgender-favicon.gif?v=transgender-favicon-transparent-20261023-v3" width="18" height="14" alt="" aria-hidden="true">KICKASSTRANSFEMS - PLEASE WAIT</div>
    </div>
    <div class="window-body">
      <div class="loading-row">
        <div class="loading-copy">
          <p class="loading-kicker">Dollhouse dial-up is connecting</p>
          <p class="loading-message" data-loading-message aria-live="polite" aria-atomic="true"></p>
        </div>
        <div class="buffer-machine" aria-hidden="true">
          <span class="buffer-label">TRANS GIRL SIGNAL</span>
          <div class="buffer-display">
            <i class="buffer-segment"></i><i class="buffer-segment"></i><i class="buffer-segment"></i>
            <i class="buffer-segment"></i><i class="buffer-segment"></i><i class="buffer-segment"></i>
          </div>
        </div>
      </div>
      <progress class="loading-progress" max="100" value="0" aria-label="KickassTransfems loading progress" aria-valuetext="0 percent"></progress>
      <div class="progress-caption" aria-hidden="true"><span>BUFFERING THE GIRL INTERNET</span><span data-loading-percent>0%</span></div>
      <p class="loading-footer" aria-hidden="true"><span>♡</span> hold tight, sweetie <span>♡</span></p>
    </div>
  `;

  shadow.append(xpStyles, styles, windowPanel);
  document.body.append(host);
  const previousBusy = document.body.getAttribute("aria-busy");
  document.body.setAttribute("aria-busy", "true");

  const startedAt = performance.now();
  const message = shadow.querySelector("[data-loading-message]");
  const progress = shadow.querySelector(".loading-progress");
  const percentLabel = shadow.querySelector("[data-loading-percent]");
  message.textContent = messages[firstIndex];

  const showSecondMessage = window.setTimeout(() => {
    message.textContent = secondMessage;
  }, 2000);

  let progressFrame = 0;
  let lastDisplayedPercent = -1;
  const updateProgress = () => {
    const percent = Math.min(100, ((performance.now() - startedAt) / 3000) * 100);
    progress.value = percent;
    const roundedPercent = Math.round(percent);
    if (roundedPercent !== lastDisplayedPercent) {
      progress.setAttribute("aria-valuetext", `${roundedPercent} percent`);
      percentLabel.textContent = `${roundedPercent}%`;
      lastDisplayedPercent = roundedPercent;
    }
    if (percent < 100) progressFrame = window.requestAnimationFrame(updateProgress);
  };
  const stopProgress = () => {
    window.cancelAnimationFrame(progressFrame);
    progressFrame = 0;
  };
  progressFrame = window.requestAnimationFrame(updateProgress);

  const finishFade = window.setTimeout(() => {
    stopProgress();
    progress.value = 100;
    progress.setAttribute("aria-valuetext", "100 percent");
    percentLabel.textContent = "100%";
    host.classList.add("is-exiting");
  }, 2820);

  window.setTimeout(() => {
    window.clearTimeout(showSecondMessage);
    window.clearTimeout(finishFade);
    stopProgress();
    host.remove();
    if (previousBusy === null) document.body.removeAttribute("aria-busy");
    else document.body.setAttribute("aria-busy", previousBusy);
    document.dispatchEvent(new Event("kt-loading-complete"));
  }, 3000);
}

  initializeKtLoadingScreen();
})();

