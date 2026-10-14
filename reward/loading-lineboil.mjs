const title = document.querySelector(".loading-lineboil");
const loadingState = document.getElementById("loadingState");

if (title && loadingState) {
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const directions = [
    [-1, -1], [0, -1], [1, -1], [1, 0],
    [1, 1], [0, 1], [-1, 1], [-1, 0]
  ];
  let previousDirection = -1;
  let timer = 0;

  function nudgeTitle() {
    const pick = Math.floor(Math.random() * (directions.length - (previousDirection < 0 ? 0 : 1)));
    const directionIndex = previousDirection < 0
      ? pick
      : pick >= previousDirection ? pick + 1 : pick;
    const [x, y] = directions[directionIndex];
    const distance = Math.random() < 0.5 ? 1 : 2;
    previousDirection = directionIndex;
    title.style.transform = `translate3d(${x * distance}px, ${y * distance}px, 0)`;
  }

  function resetTitle() {
    previousDirection = -1;
    title.style.transform = "none";
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
      timer = window.setInterval(nudgeTitle, 500);
    }
  }

  const observer = new MutationObserver(syncAnimation);
  observer.observe(loadingState, { attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("visibilitychange", syncAnimation);
  motionPreference.addEventListener("change", syncAnimation);
  syncAnimation();
}
