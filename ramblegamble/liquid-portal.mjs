const LIQUID_PARAMETERS = [
  ["theatre", "on"],
  ["fullscreen", "on"],
  ["color_low", "#031f16"],
  ["color_mid", "#076831"],
  ["color_high", "#84c226"],
  ["viscosity", "0"],
  ["speed", "2"],
  ["fold_size", "0.65"],
  ["zoom", "0.74"],
  ["wrap_edges", "off"],
  ["height_range", "0.45"],
  ["relief", "1.65"],
  ["detail", "61%"],
  ["gloss", "1.80"],
  ["sharpness", "33"],
  ["blur", "0"],
  ["saturation", "0.88"],
  ["contrast", "0.90"],
  ["brightness", "-0.060"],
  ["render_quality", "50%"],
];

export const LIQUID_PORTAL_SOURCE = `/liquid/?${new URLSearchParams(LIQUID_PARAMETERS)}`;
export const LIQUID_PORTAL_WIDTH = 512;
export const LIQUID_PORTAL_HEIGHT = 1024;

function formatCssNumber(value) {
  const rounded = Number(value.toFixed(15));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export function createCssProjectiveQuad(width, height, corners) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  if (!Array.isArray(corners) || corners.length !== 4) return null;
  if (!corners.every((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))) return null;

  const source = [[0, 0], [width, 0], [width, height], [0, height]];
  const equations = [];
  for (let index = 0; index < 4; index += 1) {
    const [x, y] = source[index];
    const { x: targetX, y: targetY } = corners[index];
    equations.push([x, y, 1, 0, 0, 0, -targetX * x, -targetX * y, targetX]);
    equations.push([0, 0, 0, x, y, 1, -targetY * x, -targetY * y, targetY]);
  }

  // A homography makes this live iframe behave like a perspective-projected
  // plane without copying pixels out of its own WebGL canvas.
  for (let column = 0; column < 8; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < 8; row += 1) {
      if (Math.abs(equations[row][column]) > Math.abs(equations[pivotRow][column])) pivotRow = row;
    }
    if (Math.abs(equations[pivotRow][column]) < 1e-12) return null;
    [equations[column], equations[pivotRow]] = [equations[pivotRow], equations[column]];

    const pivot = equations[column][column];
    for (let entry = column; entry <= 8; entry += 1) equations[column][entry] /= pivot;
    for (let row = 0; row < 8; row += 1) {
      if (row === column) continue;
      const factor = equations[row][column];
      if (factor === 0) continue;
      for (let entry = column; entry <= 8; entry += 1) {
        equations[row][entry] -= factor * equations[column][entry];
      }
    }
  }

  const [a, c, e, b, d, f, g, h] = equations.map((row) => row[8]);
  const matrix = [a, b, 0, g, c, d, 0, h, 0, 0, 1, 0, e, f, 0, 1];
  if (!matrix.every(Number.isFinite)) return null;
  return `matrix3d(${matrix.map(formatCssNumber).join(",")})`;
}

// The room is on the -X side of the right wall. Keep the surface behind the
// jambs, with proportional overscan to cover the tiny parallax at oblique angles.
export function getLiquidPortalPlane(opening) {
  const width = opening.maxZ - opening.minZ;
  const height = opening.maxY - opening.minY;
  const scale = 1.12;
  const x = opening.wallX + 0.008;
  const y = (opening.minY + opening.maxY) / 2;
  const z = (opening.minZ + opening.maxZ) / 2;
  const halfWidth = width * scale / 2;
  const halfHeight = height * scale / 2;
  return {
    x, y, z, width: halfWidth * 2, height: halfHeight * 2,
    rotationY: -Math.PI / 2,
    corners: [
      { x, y: y + halfHeight, z: z - halfWidth },
      { x, y: y + halfHeight, z: z + halfWidth },
      { x, y: y - halfHeight, z: z + halfWidth },
      { x, y: y - halfHeight, z: z - halfWidth },
    ],
  };
}

export function isLiquidPortalActive({ gameStarted, pauseMenuOpen, diceModeOpen, sceneReady, documentHidden }) {
  return Boolean(gameStarted && !pauseMenuOpen && !diceModeOpen && sceneReady && !documentHidden);
}

// The source lives on the same GitHub Pages origin, but is maintained outside
// Ramble Gamble. Capture its own canvas rather than recreating its shader or
// reading its WebGL drawing buffer after the browser has cleared it.
export function findLiquidCanvas(frame) {
  try {
    const doc = frame.contentDocument;
    if (!doc || !["/liquid", "/liquid/", "/liquid/index.html"].includes(doc.location?.pathname)) return null;
    return [...doc.querySelectorAll("canvas")]
      .filter((canvas) => canvas.width > 0 && canvas.height > 0
        && canvas.clientWidth > 0 && canvas.clientHeight > 0
        && typeof canvas.captureStream === "function"
        && (() => {
          const style = doc.defaultView?.getComputedStyle(canvas);
          return !style || (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0");
        })())
      .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0] || null;
  } catch {
    // A redirect to another origin or a security restriction is not fatal.
    return null;
  }
}

export function createLiquidPortal({ THREE, scene, frame, layer, opening, preview, createVideo = () => document.createElement("video") }) {
  const plane = getLiquidPortalPlane(opening);
  const geometry = new THREE.PlaneGeometry(plane.width, plane.height);
  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x031f16, toneMapped: false, depthTest: true, depthWrite: true });
  // Compatibility path for pages that have no capturable canvas or browsers
  // that reject captureStream. The real iframe is BELOW the WebGL canvas.
  // This opaque-pass shader writes zero alpha AND depth at the same world
  // plane: nearer room geometry still occludes it, unlike a DOM overlay.
  const matteMaterial = new THREE.ShaderMaterial({
    vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `void main() { gl_FragColor = vec4(0.0); }`,
    blending: THREE.NoBlending,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
  });
  const videoMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, depthTest: true, depthWrite: true });
  const surface = new THREE.Mesh(geometry, baseMaterial);
  surface.name = "rg-vip-liquid-plane";
  surface.position.set(plane.x, plane.y, plane.z);
  surface.rotation.y = plane.rotationY;
  surface.visible = false;
  scene.add(surface);

  let active = false;
  let disposed = false;
  let sourceLoaded = false;
  let frameReady = false;
  let nextAttempt = 0;
  let stream = null;
  let video = null;
  let texture = null;
  let textureWidth = 0;
  let textureHeight = 0;
  let captureStarted = 0;
  let lastVideoTime = -1;
  let lastFrameAt = 0;
  let frameCallback = null;
  let usingFrameCallback = false;

  function stopCapture() {
    surface.material = baseMaterial;
    if (texture) {
      texture.dispose();
      texture = null;
      videoMaterial.map = null;
      videoMaterial.needsUpdate = true;
    }
    if (video) {
      if (frameCallback !== null) video.cancelVideoFrameCallback?.(frameCallback);
      video.pause();
      video.srcObject = null;
      video = null;
    }
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    textureWidth = textureHeight = 0;
    lastVideoTime = -1;
    frameCallback = null;
    usingFrameCallback = false;
  }

  function onLoad() {
    if (disposed) return;
    frameReady = true;
    stopCapture();
    nextAttempt = 0;
  }
  frame.addEventListener("load", onLoad);

  function preload() {
    if (disposed || sourceLoaded) return;
    sourceLoaded = true;
    frame.src = LIQUID_PORTAL_SOURCE;
  }

  function setActive(value) {
    if (disposed || active === value) return;
    active = value;
    surface.visible = active;
    layer.hidden = !active;
    if (active) {
      preload();
      nextAttempt = 0;
    } else {
      stopCapture();
      frame.style.transform = "";
    }
  }

  function beginCapture(time) {
    if (video || time < nextAttempt || !frameReady) return;
    nextAttempt = time + 1500;
    const source = findLiquidCanvas(frame);
    if (!source) return;
    try {
      stream = source.captureStream(30);
      if (!stream.getVideoTracks().length) { stopCapture(); return; }
      video = createVideo();
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.srcObject = stream;
      captureStarted = lastFrameAt = time;
      const currentVideo = video;
      if (typeof currentVideo.requestVideoFrameCallback === "function") {
        const onVideoFrame = (now) => {
          if (video !== currentVideo || disposed) return;
          lastFrameAt = now;
          frameCallback = currentVideo.requestVideoFrameCallback(onVideoFrame);
        };
        frameCallback = currentVideo.requestVideoFrameCallback(onVideoFrame);
        usingFrameCallback = true;
      }
      Promise.resolve(video.play()).catch(() => {
        if (video !== currentVideo || disposed) return;
        stopCapture();
        nextAttempt = Math.max(nextAttempt, captureStarted + 5000);
      });
    } catch {
      stopCapture();
      nextAttempt = time + 5000;
    }
  }

  function updateTexture(time) {
    beginCapture(time);
    if (!video) return false;
    if (stream.getVideoTracks().every((track) => track.readyState === "ended") || video.error) {
      stopCapture();
      nextAttempt = time + 1500;
      return false;
    }
    if (!usingFrameCallback && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      lastFrameAt = time;
    }
    // Fall back rather than leave a permanently frozen image if capture stalls.
    if (time - lastFrameAt > 4000) {
      stopCapture();
      nextAttempt = time + 5000;
      return false;
    }
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false;
    if (!texture || textureWidth !== video.videoWidth || textureHeight !== video.videoHeight) {
      texture?.dispose();
      texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      textureWidth = video.videoWidth;
      textureHeight = video.videoHeight;
      videoMaterial.map = texture;
      videoMaterial.needsUpdate = true;
    }
    return true;
  }

  function update(camera, time) {
    if (!active || disposed) return;
    if (updateTexture(time)) {
      surface.material = videoMaterial;
      // Keep the source laid out behind the opaque WebGL canvas, even when
      // the door moves outside the camera view. Do not reload/restart it.
      frame.style.transform = "";
      return;
    }
    surface.material = baseMaterial;
    // Default to an in-viewport source while the physical plane is offscreen
    // or the camera cannot project all four corners (e.g. looking away).
    if (!frameReady || !camera || preview.clientWidth < 1 || preview.clientHeight < 1) {
      frame.style.transform = "";
      return;
    }
    camera.updateMatrixWorld(true);
    if (camera.position.x >= plane.x) {
      frame.style.transform = "";
      return; // outside/back face
    }
    const corners = [];
    for (const corner of plane.corners) {
      const world = new THREE.Vector3(corner.x, corner.y, corner.z);
      const depth = -camera.worldToLocal(world.clone()).z;
      if (depth <= camera.near || depth >= camera.far) {
        frame.style.transform = "";
        return;
      }
      const projected = world.project(camera);
      corners.push({ x: (projected.x + 1) * 0.5 * preview.clientWidth, y: (1 - projected.y) * 0.5 * preview.clientHeight });
    }
    const transform = createCssProjectiveQuad(LIQUID_PORTAL_WIDTH, LIQUID_PORTAL_HEIGHT, corners);
    if (!transform || corners.every(({ x }) => x < 0) || corners.every(({ x }) => x > preview.clientWidth)
      || corners.every(({ y }) => y < 0) || corners.every(({ y }) => y > preview.clientHeight)) {
      frame.style.transform = "";
      return;
    }
    if (frame.style.transform !== transform) frame.style.transform = transform;
    surface.material = matteMaterial;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopCapture();
    frame.removeEventListener("load", onLoad);
    frame.removeAttribute("src");
    layer.hidden = true;
    scene.remove(surface);
    geometry.dispose();
    baseMaterial.dispose();
    matteMaterial.dispose();
    videoMaterial.dispose();
  }

  return { surface, preload, setActive, update, dispose };
}
