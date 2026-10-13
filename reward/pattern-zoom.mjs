const TILE_WIDTH_CSS_PX = 100;
const BASELINE_KEY = "kazvt.reward-pattern-baseline-dpr.v1";
const root = document.documentElement;
const viewport = window.visualViewport;

function readDevicePixelRatio() {
  const ratio = Number(window.devicePixelRatio);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function readPinchScale() {
  const scale = Number(viewport?.scale);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function getBaselineDpr() {
  const currentRatio = readDevicePixelRatio();

  try {
    const savedRatio = Number(window.localStorage.getItem(BASELINE_KEY));
    if (Number.isFinite(savedRatio) && savedRatio > 0) return savedRatio;
    window.localStorage.setItem(BASELINE_KEY, String(currentRatio));
  } catch {
    // Storage may be unavailable; the current page still gets zoom compensation.
  }

  return currentRatio;
}

const baselineDpr = getBaselineDpr();
const baselinePinchScale = readPinchScale();

function updatePatternScale() {
  // Keep the tile's rendered width stable while browser and pinch zoom change CSS pixels.
  const pageZoomRatio = readDevicePixelRatio() / baselineDpr;
  const pinchZoomRatio = readPinchScale() / baselinePinchScale;
  const zoomRatio = pageZoomRatio * pinchZoomRatio;
  const tileWidth = Number((TILE_WIDTH_CSS_PX / zoomRatio).toFixed(4));

  root.style.setProperty("--reward-pattern-tile-width", `${tileWidth}px`);
  root.style.setProperty("--reward-zoom-compensation", Number((1 / zoomRatio).toFixed(6)));
}

function watchResolutionChanges() {
  if (typeof window.matchMedia !== "function") return;

  const query = window.matchMedia(`(resolution: ${readDevicePixelRatio()}dppx)`);
  const handleChange = () => {
    query.removeEventListener?.("change", handleChange);
    query.removeListener?.(handleChange);
    updatePatternScale();
    watchResolutionChanges();
  };

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", handleChange, { once: true });
  } else {
    query.addListener?.(handleChange);
  }
}

updatePatternScale();
window.addEventListener("resize", updatePatternScale, { passive: true });
viewport?.addEventListener("resize", updatePatternScale, { passive: true });
watchResolutionChanges();
