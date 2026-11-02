(() => {
  const scene = document.querySelector("[data-parallax-scene]");
  const background = scene?.querySelector("[data-parallax-background]");
  const character = scene?.querySelector("[data-parallax-character]");
  if (!scene || !background || !character || !window.matchMedia || !window.requestAnimationFrame) return;

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointerCapability = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (motionPreference.matches || !pointerCapability.matches) return;

  let bounds = null;
  let pointerX = 0;
  let pointerY = 0;
  let currentX = 0;
  let currentY = 0;
  let frame = null;
  let lastFrameTime = null;

  const applyPosition = (timestamp) => {
    frame = null;
    if (motionPreference.matches || !pointerCapability.matches) {
      currentX = pointerX = 0;
      currentY = pointerY = 0;
      lastFrameTime = null;
      background.style.transform = "translate3d(0, 0, 0)";
      character.style.transform = "translate3d(0, 0, 0)";
      return;
    }

    const elapsed = lastFrameTime === null ? 16.67 : Math.max(1, Math.min(32, timestamp - lastFrameTime));
    lastFrameTime = timestamp;
    const easing = 1 - Math.exp(-elapsed / 60);
    currentX += (pointerX - currentX) * easing;
    currentY += (pointerY - currentY) * easing;
    background.style.transform = `translate3d(${-currentX * 7}px, ${-currentY * 5}px, 0)`;
    character.style.transform = `translate3d(${currentX * 3}px, ${currentY * 2}px, 0)`;

    if (Math.abs(pointerX - currentX) > 0.015 || Math.abs(pointerY - currentY) > 0.015) {
      frame = window.requestAnimationFrame(applyPosition);
    }
  };

  const schedule = () => {
    if (frame === null) {
      lastFrameTime = null;
      frame = window.requestAnimationFrame(applyPosition);
    }
  };

  const reset = () => {
    pointerX = 0;
    pointerY = 0;
    bounds = null;
    schedule();
  };

  scene.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse" || motionPreference.matches || !pointerCapability.matches) return;
    bounds = scene.getBoundingClientRect();
  }, { passive: true });

  scene.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || motionPreference.matches || !pointerCapability.matches) return;
    if (!bounds) bounds = scene.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointerX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
    pointerY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
    schedule();
  }, { passive: true });

  scene.addEventListener("pointerleave", reset, { passive: true });
  window.addEventListener("resize", reset, { passive: true });
  window.addEventListener("scroll", () => { bounds = null; }, { passive: true, capture: true });
  window.addEventListener("blur", reset, { passive: true });

  const updateMotion = () => {
    if (motionPreference.matches || !pointerCapability.matches) reset();
  };
  motionPreference.addEventListener?.("change", updateMotion);
  pointerCapability.addEventListener?.("change", updateMotion);
})();
