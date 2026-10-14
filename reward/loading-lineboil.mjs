const title = document.querySelector(".loading-lineboil");
const loadingState = document.getElementById("loadingState");

if (title && loadingState) {
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const loadingText = Array.from(title.childNodes).find(node =>
    node.nodeType === Node.TEXT_NODE && node.textContent.trim()
  );
  if (loadingText) {
    const letters = document.createDocumentFragment();
    for (const character of loadingText.textContent) {
      const letter = document.createElement("span");
      letter.className = "loading-lineboil-letter";
      letter.textContent = character;
      letter.setAttribute("aria-hidden", "true");
      letters.append(letter);
    }
    loadingText.replaceWith(letters);
  }

  let phase = 0;
  let timer = 0;

  function advancePhase() {
    phase = (phase % 3) + 1;
    title.dataset.boilPhase = String(phase);
  }

  function resetTitle() {
    phase = 0;
    delete title.dataset.boilPhase;
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = 0;
    }
    resetTitle();
  }

  function syncAnimation() {
    if (loadingState.hidden) {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncAnimation);
      motionPreference.removeEventListener("change", syncAnimation);
      return;
    }

    if (document.hidden || motionPreference.matches) {
      stop();
    } else if (!timer) {
      timer = window.setInterval(advancePhase, 500);
    }
  }

  const observer = new MutationObserver(syncAnimation);
  observer.observe(loadingState, { attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("visibilitychange", syncAnimation);
  motionPreference.addEventListener("change", syncAnimation);
  syncAnimation();
}
